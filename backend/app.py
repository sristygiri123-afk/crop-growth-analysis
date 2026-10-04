"""
Smart Agriculture Assistant - Flask Bridge Backend
====================================================
Reads Arduino UNO serial output (COM5 @ 9600 baud) in a background thread,
parses the known line format, keeps an in-memory rolling history for
charts/history endpoints, and exposes a REST API consumed by the React
frontend. Also exposes a lightweight reachability check for the ESP32-CAM
MJPEG stream (camera streaming itself is NOT proxied here -- the browser
connects directly to http://<camera_ip>:81/stream, this backend only
checks/reports reachability + stores the configured IP).

IMPORTANT SAFETY NOTES (read before running):
- Only ONE process may hold the COM5 serial port open at a time. Close the
  Arduino IDE Serial Monitor before starting this backend, and do not run
  two copies of this backend simultaneously.
- This backend does NOT send arbitrary pump/servo commands. Manual
  irrigation override is intentionally NOT implemented in this version
  (per current project scope: auto-only). The /api/irrigation/control and
  /api/irrigation/mode endpoints exist for forward-compatibility but
  currently return HTTP 501 for manual mode / manual control requests,
  since there is no corresponding Arduino-side command protocol defined
  yet. Wiring this up safely requires first defining a serial command
  protocol on the Arduino sketch (e.g. accepting "PUMP_ON\n" / "PUMP_OFF\n"
  over Serial) -- see README.md "Adding manual control later" section.
- All sensor values are RAW readings as received from the Arduino. This
  backend does not fabricate calibrated percentages.
"""

import base64
import json
import re
import threading
import time
import socket
from collections import deque
from datetime import datetime, timezone

import requests
import serial
from flask import Flask, jsonify, request
from flask_cors import CORS
import crop_advisor

import disease_detector

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

DEFAULT_PORT = "COM5"
DEFAULT_BAUD = 9600
HISTORY_MAXLEN = 24 * 60 * 30  # ~30 readings/min worst case * 24h, generous cap
SERIAL_READ_TIMEOUT = 1.0
STALE_AFTER_SECONDS = 8  # if no serial line in this long, mark Arduino as disconnected-ish

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (different port) to call this API

# --------------------------------------------------------------------------
# Shared state (guarded by state_lock)
# --------------------------------------------------------------------------

state_lock = threading.Lock()

serial_conn = None
serial_thread = None
serial_thread_stop = threading.Event()

arduino_state = {
    "connected": False,
    "port": DEFAULT_PORT,
    "baud": DEFAULT_BAUD,
    "last_line_at": None,       # ISO timestamp of last received serial line
    "last_error": None,
}

camera_state = {
    "ip": None,                 # e.g. "192.168.1.50"
    "last_checked_at": None,
    "reachable": False,
    "last_error": None,
}

# Latest parsed sensor snapshot
latest_reading = {
    "temperature_c": None,
    "humidity_pct": None,
    "soil_moisture_raw": None,
    "soil_status": None,        # "DRY" | "MOIST"
    "rain_raw": None,
    "rain_status": None,        # "RAIN" | "NO RAIN"
    "mq135_raw": None,
    "pump_on": None,            # bool, derived from "Irrigation ON/OFF"
    "servo_open": None,         # bool, best-effort (see parser notes below)
    "timestamp": None,
}

history = deque(maxlen=HISTORY_MAXLEN)   # list of latest_reading snapshots over time
serial_log = deque(maxlen=500)            # raw lines with timestamps, for diagnostics
event_log = deque(maxlen=500)             # connection/irrigation/system events
disease_history = deque(maxlen=100)       # past disease-detection results

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def push_event(kind, message):
    event_log.appendleft({
        "timestamp": now_iso(),
        "kind": kind,       # "connection" | "irrigation" | "sensor" | "system" | "error"
        "message": message,
    })


def push_serial_log(line):
    serial_log.appendleft({"timestamp": now_iso(), "line": line})


# Parsers for each expected line. Adjust these regexes if your sketch's
# exact print format differs -- these match the field names given in the
# project spec:
#   Temperature:
#   Humidity:
#   Soil Moisture Raw:
#   Rain Sensor Raw:
#   MQ-135 Raw:
#   Soil Status:
#   Rain Status:
#   Irrigation ON/OFF
LINE_PATTERNS = {
    "temperature_c": re.compile(r"Temperature\s*:\s*([-\d.]+)", re.I),
    "humidity_pct": re.compile(r"Humidity\s*:\s*([-\d.]+)", re.I),
    "soil_moisture_raw": re.compile(r"Soil Moisture Raw\s*:\s*(\d+)", re.I),
    "rain_raw": re.compile(r"Rain Sensor Raw\s*:\s*(\d+)", re.I),
    "mq135_raw": re.compile(r"MQ-?135 Raw\s*:\s*(\d+)", re.I),
    "soil_status": re.compile(r"Soil Status\s*:\s*(\w+)", re.I),
    "rain_status": re.compile(r"Rain Status\s*:\s*([A-Z ]+)", re.I),
    "irrigation": re.compile(r"Irrigation\s*:?\s*(ON|OFF)", re.I),
}


def parse_serial_line(line, snapshot):
    """Mutate `snapshot` in place if `line` matches a known field.
    Returns True if the line was recognized."""
    m = LINE_PATTERNS["temperature_c"].search(line)
    if m:
        snapshot["temperature_c"] = float(m.group(1))
        return True
    m = LINE_PATTERNS["humidity_pct"].search(line)
    if m:
        snapshot["humidity_pct"] = float(m.group(1))
        return True
    m = LINE_PATTERNS["soil_moisture_raw"].search(line)
    if m:
        snapshot["soil_moisture_raw"] = int(m.group(1))
        return True
    m = LINE_PATTERNS["rain_raw"].search(line)
    if m:
        snapshot["rain_raw"] = int(m.group(1))
        return True
    m = LINE_PATTERNS["mq135_raw"].search(line)
    if m:
        snapshot["mq135_raw"] = int(m.group(1))
        return True
    m = LINE_PATTERNS["soil_status"].search(line)
    if m:
        snapshot["soil_status"] = m.group(1).upper()
        return True
    m = LINE_PATTERNS["rain_status"].search(line)
    if m:
        snapshot["rain_status"] = m.group(1).strip().upper()
        return True
    m = LINE_PATTERNS["irrigation"].search(line)
    if m:
        snapshot["pump_on"] = (m.group(1).upper() == "ON")
        # Servo state is not separately reported in the given format; we
        # mirror pump state as a best-effort default (valve open while
        # pump runs). Update LINE_PATTERNS/this block if your sketch
        # prints a distinct "Servo:" line.
        snapshot["servo_open"] = snapshot["pump_on"]
        return True
    return False


# --------------------------------------------------------------------------
# Serial reader thread
# --------------------------------------------------------------------------

def serial_reader_loop(port, baud):
    global serial_conn
    try:
        serial_conn = serial.Serial(port, baud, timeout=SERIAL_READ_TIMEOUT)
    except serial.SerialException as e:
        with state_lock:
            arduino_state["connected"] = False
            arduino_state["last_error"] = (
                f"Could not open {port}: {e}. Is another program (Arduino IDE "
                f"Serial Monitor, another instance of this backend, etc.) "
                f"already using this port?"
            )
        push_event("error", arduino_state["last_error"])
        return

    with state_lock:
        arduino_state["connected"] = True
        arduino_state["port"] = port
        arduino_state["baud"] = baud
        arduino_state["last_error"] = None
    push_event("connection", f"Connected to Arduino on {port} @ {baud} baud")

    pending_snapshot = {}

    while not serial_thread_stop.is_set():
        try:
            raw = serial_conn.readline()
        except serial.SerialException as e:
            with state_lock:
                arduino_state["connected"] = False
                arduino_state["last_error"] = f"Serial read error: {e}"
            push_event("error", arduino_state["last_error"])
            break

        if not raw:
            continue  # timeout with no data, loop again

        try:
            line = raw.decode("utf-8", errors="ignore").strip()
        except Exception:
            continue

        if not line:
            continue

        push_serial_log(line)

        recognized = parse_serial_line(line, pending_snapshot)
        with state_lock:
            arduino_state["last_line_at"] = now_iso()

        # Heuristic: once we've collected the core fields for one Arduino
        # print cycle, commit a snapshot. The Arduino repeats this block
        # every loop, so "Irrigation" is treated as the terminator line.
        if recognized and "pump_on" in pending_snapshot and len(pending_snapshot) >= 1:
            if LINE_PATTERNS["irrigation"].search(line):
                snapshot = {
                    "temperature_c": pending_snapshot.get("temperature_c"),
                    "humidity_pct": pending_snapshot.get("humidity_pct"),
                    "soil_moisture_raw": pending_snapshot.get("soil_moisture_raw"),
                    "soil_status": pending_snapshot.get("soil_status"),
                    "rain_raw": pending_snapshot.get("rain_raw"),
                    "rain_status": pending_snapshot.get("rain_status"),
                    "mq135_raw": pending_snapshot.get("mq135_raw"),
                    "pump_on": pending_snapshot.get("pump_on"),
                    "servo_open": pending_snapshot.get("servo_open"),
                    "timestamp": now_iso(),
                }
                with state_lock:
                    latest_reading.update(snapshot)
                    history.append(dict(snapshot))
                pending_snapshot = {}

    try:
        if serial_conn and serial_conn.is_open:
            serial_conn.close()
    except Exception:
        pass
    with state_lock:
        arduino_state["connected"] = False
    push_event("connection", "Disconnected from Arduino")


def start_serial_thread(port, baud):
    global serial_thread
    stop_serial_thread()
    serial_thread_stop.clear()
    serial_thread = threading.Thread(
        target=serial_reader_loop, args=(port, baud), daemon=True
    )
    serial_thread.start()


def stop_serial_thread():
    global serial_conn
    if serial_thread and serial_thread.is_alive():
        serial_thread_stop.set()
        serial_thread.join(timeout=3)
    if serial_conn:
        try:
            if serial_conn.is_open:
                serial_conn.close()
        except Exception:
            pass
    serial_conn = None


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@app.route("/api/status", methods=["GET"])
def api_status():
    with state_lock:
        stale = False
        if arduino_state["last_line_at"]:
            last_dt = datetime.fromisoformat(arduino_state["last_line_at"])
            stale = (datetime.now(timezone.utc) - last_dt).total_seconds() > STALE_AFTER_SECONDS
        return jsonify({
            "backend_ok": True,
            "arduino_connected": arduino_state["connected"] and not stale,
            "arduino_stale": stale,
            "camera_configured": camera_state["ip"] is not None,
            "camera_reachable": camera_state["reachable"],
            "server_time": now_iso(),
        })


@app.route("/api/sensors", methods=["GET"])
def api_sensors():
    with state_lock:
        return jsonify(dict(latest_reading))


@app.route("/api/history", methods=["GET"])
def api_history():
    # optional query params: ?range=1h|6h|24h
    range_param = request.args.get("range", "24h")
    seconds_map = {"1h": 3600, "6h": 6 * 3600, "24h": 24 * 3600}
    window = seconds_map.get(range_param, 24 * 3600)
    cutoff = datetime.now(timezone.utc).timestamp() - window

    with state_lock:
        snapshot_list = list(history)

    def in_window(item):
        try:
            ts = datetime.fromisoformat(item["timestamp"]).timestamp()
            return ts >= cutoff
        except Exception:
            return False

    filtered = [i for i in snapshot_list if in_window(i)]
    return jsonify({"range": range_param, "count": len(filtered), "readings": filtered})


@app.route("/api/arduino/status", methods=["GET"])
def api_arduino_status():
    with state_lock:
        return jsonify(dict(arduino_state))


@app.route("/api/arduino/connect", methods=["POST"])
def api_arduino_connect():
    body = request.get_json(silent=True) or {}
    port = body.get("port", DEFAULT_PORT)
    baud = body.get("baud", DEFAULT_BAUD)

    with state_lock:
        already_connected = arduino_state["connected"]

    if already_connected:
        return jsonify({"ok": False, "error": "Already connected. Disconnect first."}), 409

    start_serial_thread(port, baud)
    time.sleep(0.6)  # brief grace period so open-failure surfaces immediately

    with state_lock:
        result = dict(arduino_state)
    status_code = 200 if result["connected"] else 500
    return jsonify({"ok": result["connected"], **result}), status_code


@app.route("/api/arduino/disconnect", methods=["POST"])
def api_arduino_disconnect():
    stop_serial_thread()
    with state_lock:
        arduino_state["connected"] = False
    return jsonify({"ok": True, **arduino_state})


@app.route("/api/arduino/config", methods=["POST"])
def api_arduino_config():
    """Update default port/baud without necessarily reconnecting."""
    body = request.get_json(silent=True) or {}
    with state_lock:
        if "port" in body:
            arduino_state["port"] = body["port"]
        if "baud" in body:
            arduino_state["baud"] = body["baud"]
        result = dict(arduino_state)
    push_event("system", f"Arduino config updated: port={result['port']} baud={result['baud']}")
    return jsonify({"ok": True, **result})


@app.route("/api/camera/status", methods=["GET"])
def api_camera_status():
    return jsonify(dict(camera_state))


@app.route("/api/camera/config", methods=["POST"])
def api_camera_config():
    body = request.get_json(silent=True) or {}
    ip = body.get("ip")
    if not ip:
        return jsonify({"ok": False, "error": "Missing 'ip' in request body"}), 400

    with state_lock:
        camera_state["ip"] = ip

    reachable, error = check_camera_reachable(ip)
    with state_lock:
        camera_state["reachable"] = reachable
        camera_state["last_error"] = error
        camera_state["last_checked_at"] = now_iso()
        result = dict(camera_state)

    push_event("system", f"Camera IP set to {ip} (reachable={reachable})")
    return jsonify({"ok": True, **result})


@app.route("/api/camera/test", methods=["POST"])
def api_camera_test():
    with state_lock:
        ip = camera_state["ip"]
    if not ip:
        return jsonify({"ok": False, "error": "No camera IP configured yet"}), 400

    reachable, error = check_camera_reachable(ip)
    with state_lock:
        camera_state["reachable"] = reachable
        camera_state["last_error"] = error
        camera_state["last_checked_at"] = now_iso()
        result = dict(camera_state)
    return jsonify({"ok": True, **result})


def check_camera_reachable(ip, port=81, timeout=1.5):
    """Best-effort TCP reachability check on the MJPEG stream port.
    This does NOT proxy video -- the browser connects directly."""
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True, None
    except Exception as e:
        return False, str(e)


@app.route("/api/irrigation/control", methods=["POST"])
def api_irrigation_control():
    """Manual pump/servo override.
    NOT YET IMPLEMENTED: no serial command protocol is defined on the
    Arduino sketch for accepting manual commands. Implementing this safely
    requires (1) adding a command listener in the Arduino sketch, and
    (2) sending the command here via serial_conn.write(...) while holding
    state_lock, then waiting for/confirming a serial acknowledgement
    before reporting success to the frontend. See README.md."""
    return jsonify({
        "ok": False,
        "error": (
            "Manual irrigation control is not implemented yet. The system "
            "is currently auto-only: irrigation is controlled entirely by "
            "the Arduino's own logic (soil dry AND no rain => pump ON). "
            "Add a serial command protocol to the Arduino sketch to enable "
            "this endpoint -- see README.md 'Adding manual control later'."
        ),
    }), 501


@app.route("/api/irrigation/mode", methods=["POST"])
def api_irrigation_mode():
    body = request.get_json(silent=True) or {}
    mode = body.get("mode")
    if mode == "auto":
        return jsonify({"ok": True, "mode": "auto"})
    return jsonify({
        "ok": False,
        "error": "Only 'auto' mode is currently supported. Manual mode requires "
                 "backend + Arduino changes not yet implemented.",
    }), 501


@app.route("/api/events", methods=["GET"])
def api_events():
    kind = request.args.get("kind")
    items = list(event_log)
    if kind:
        items = [e for e in items if e["kind"] == kind]
    return jsonify({"count": len(items), "events": items})


@app.route("/api/serial-log", methods=["GET"])
def api_serial_log():
    return jsonify({"count": len(serial_log), "lines": list(serial_log)})


@app.route("/api/disease/detect", methods=["POST"])
def api_disease_detect():
    print("\n========== DISEASE DETECTION START ==========")

    with state_lock:
        cam_ip = camera_state["ip"]

    print("Camera IP:", cam_ip)

    if not cam_ip:
        print("ERROR: No camera IP configured")
        return jsonify({
            "ok": False,
            "error": "No camera IP configured yet."
        }), 400

    capture_url = f"http://{cam_ip}/capture"
    print("Capture URL:", capture_url)

    try:
        print("Requesting image from ESP32-CAM...")
        resp = requests.get(capture_url, timeout=10)

        print("Camera HTTP status:", resp.status_code)
        print("Content-Type:", resp.headers.get("Content-Type"))
        print("Image bytes received:", len(resp.content))

        resp.raise_for_status()

        image_bytes = resp.content

    except requests.RequestException as e:
        print("CAMERA CAPTURE ERROR:", repr(e))

        return jsonify({
            "ok": False,
            "error": f"Could not capture image from ESP32-CAM: {e}"
        }), 502

    try:
        print("Starting disease model...")
        result = disease_detector.predict_from_bytes(image_bytes)

        print("MODEL RESULT:", result)

    except Exception as e:
        print("MODEL ERROR:", repr(e))

        return jsonify({
            "ok": False,
            "error": f"Model inference failed: {e}"
        }), 500

    thumbnail_b64 = (
        "data:image/jpeg;base64,"
        + base64.b64encode(image_bytes).decode("ascii")
    )

    record = {
        "timestamp": now_iso(),
        "image": thumbnail_b64,
        **result,
    }

    disease_history.appendleft(record)

    print("DISEASE DETECTION SUCCESS")
    print("============================================\n")

    return jsonify({
        "ok": True,
        **record
    })


@app.route("/api/disease/history", methods=["GET"])
def api_disease_history():
    return jsonify({"count": len(disease_history), "results": list(disease_history)})


#//crop advisor code
@app.route("/api/crops/meta", methods=["GET"])
def api_crops_meta():
    return jsonify(crop_advisor.meta())


@app.route("/api/crops/recommend", methods=["POST"])
def api_crops_recommend():
    try:
        data = request.get_json(silent=True) or {}

        n = float(data["n"])
        p = float(data["p"])
        k = float(data["k"])
        temperature_c = float(data["temperature_c"])
        location = str(data["location"])
        land_acres = float(data.get("land_acres", 1))

        farmer_expense_total = data.get("farmer_expense_total")
        if farmer_expense_total is not None:
            farmer_expense_total = float(farmer_expense_total)

        result = crop_advisor.recommend(
            n=n,
            p=p,
            k=k,
            temperature_c=temperature_c,
            location=location,
            land_acres=land_acres,
            farmer_expense_total=farmer_expense_total,
        )

        return jsonify(result)

    except KeyError as e:
        return jsonify({
            "ok": False,
            "error": f"Missing field: {e.args[0]}"
        }), 400

    except ValueError as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 400

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": f"Crop recommendation failed: {str(e)}"
        }), 500



if __name__ == "__main__":
    push_event("system", "Backend started")
    # Auto-start serial reading on the default port at boot, matching the
    # "already connected hardware" project context. Comment this out if
    # you'd rather always connect manually from the Arduino Connection page.
    start_serial_thread(DEFAULT_PORT, DEFAULT_BAUD)
    # 0.0.0.0 so it's reachable from your phone on the same Wi-Fi/hotspot
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
