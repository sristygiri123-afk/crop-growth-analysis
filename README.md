# Smart Agriculture Assistant

A full-stack dashboard for your Arduino UNO + ESP32-CAM smart farming rig:
React + Vite frontend, Flask serial-bridge backend.

```
smart-agri/
├── backend/
│   ├── app.py            # Flask bridge: reads COM5, exposes REST API
│   └── requirements.txt
└── frontend/              # React + Vite + Tailwind + Recharts app
```

## 1. Backend setup (run this first)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python app.py
```

The backend starts on `http://0.0.0.0:5000` and immediately tries to open
`COM5` at `9600` baud (edit `DEFAULT_PORT`/`DEFAULT_BAUD` at the top of
`app.py` if yours differ, or just reconnect from the Arduino Connection
page in the UI).

**Before starting it:** close the Arduino IDE Serial Monitor and any other
program that might have COM5 open — only one process can hold a serial
port at a time.

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Vite will print a local URL (`http://localhost:5173`) and a network URL
(`http://<your-lan-ip>:5173`) — the `--host` flag is already set in
`package.json` so this works out of the box.

Open `http://localhost:5173` in your laptop's browser.

## 3. Accessing it from your phone

1. Make sure your phone is on the **same Wi-Fi or hotspot** as your laptop.
2. Find your laptop's LAN IP:
   - Windows: `ipconfig` → look for "IPv4 Address" under your Wi-Fi adapter.
   - macOS: `ipconfig getifaddr en0`
3. On your phone's browser, go to `http://<laptop-ip>:5173`.
4. Open the **Settings** (gear icon, top right) inside the app and set the
   **API Base URL** to `http://<laptop-ip>:5000` (not `localhost`), then
   Save & Reload. Do the same for the camera IP on the ESP32-CAM page if
   needed — it's independent of the laptop IP since the browser talks to
   the camera directly.

## 4. What the backend actually implements

All endpoints below are implemented in `backend/app.py` exactly as your
spec suggested:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/status` | overall backend/Arduino/camera health |
| GET | `/api/sensors` | latest parsed sensor snapshot |
| GET | `/api/history?range=1h\|6h\|24h` | rolling in-memory reading history |
| GET | `/api/arduino/status` | detailed connection state |
| POST | `/api/arduino/connect` | opens the serial port `{port, baud}` |
| POST | `/api/arduino/disconnect` | closes the serial port |
| POST | `/api/arduino/config` | updates default port/baud |
| GET | `/api/camera/status` | camera IP + reachability |
| POST | `/api/camera/config` | save + test a camera IP `{ip}` |
| POST | `/api/camera/test` | re-test the currently saved IP |
| POST | `/api/irrigation/control` | **returns HTTP 501** — see below |
| POST | `/api/irrigation/mode` | accepts `{mode:"auto"}`; `"manual"` returns 501 |
| GET | `/api/events` | connection/irrigation/system/error log |
| GET | `/api/serial-log` | raw serial lines with timestamps, for diagnostics |

The serial parser matches your exact print format:

```
Temperature:
Humidity:
Soil Moisture Raw:
Rain Sensor Raw:
MQ-135 Raw:
Soil Status:
Rain Status:
Irrigation ON/OFF
```

It treats the `Irrigation` line as the end of one reading cycle and
commits a snapshot to history at that point. **If your sketch's actual
print statements differ even slightly** (extra spaces, different casing,
a units suffix like `°C`), open `backend/app.py` and adjust the regular
expressions in `LINE_PATTERNS` — they're grouped at the top of the file
with comments.

## 5. Why manual irrigation control is disabled right now

Per your current project scope, irrigation is **auto-only**: the Arduino
decides pump/servo state itself (soil dry AND no rain → pump ON) and just
reports it over serial. `/api/irrigation/control` intentionally returns
`501 Not Implemented` with an explanation, and the Irrigation Control page
shows Manual Mode as locked. Nothing in the frontend fakes a successful
pump/servo command — it only ever displays what the Arduino itself
reports.

### Adding manual control later

To wire this up safely when you're ready:

1. **On the Arduino sketch**: add a `Serial.available()` listener in
   `loop()` that accepts simple text commands, e.g. `PUMP_ON\n` /
   `PUMP_OFF\n`, and have it print back an acknowledgement line like
   `ACK:PUMP_ON` so the backend can confirm the command actually landed
   (not just that it was sent).
2. **On the backend**: in `api_irrigation_control()`, write the command to
   `serial_conn` while holding `state_lock`, then wait briefly for the
   matching `ACK:` line in the reader thread before responding `200 OK` to
   the frontend. Never respond `200` before that acknowledgement arrives.
3. **On the frontend**: the Irrigation page already has a "Manual Pump
   Override" panel scaffolded (currently disabled/greyed out) — swap in a
   confirmation dialog + a call to `api.irrigationControl({...})` once the
   above two pieces exist.

## 6. Demo Mode / offline handling

If the backend is unreachable, every page shows a clear red "Backend
unreachable" banner with the underlying error, rather than silently
displaying stale or fabricated numbers. There is no fake "Demo Mode" data
generator built in by default — if you want one for a demo where hardware
isn't available, let me know and I'll add a clearly-labeled simulated data
toggle that never overlaps with real readings.

## 7. AI Disease Detection (new)

The ESP32-CAM page now has a **Capture & Analyze (AI)** button that runs
real inference, not just photo capture:

- **Model**: `densenet169_v1` from the open-source [`plantdoc-predictor`](https://pypi.org/project/plantdoc-predictor/)
  library — pretrained on the **PlantVillage dataset** (38 classes, 14
  crops: tomato, potato, apple, corn, grape, pepper, etc.), reported
  **99.68% validation accuracy**. Weights auto-download and cache on
  first use — nothing to manually source.
- **How it works**: pressing the button calls the backend, which fetches
  a fresh still JPEG from `http://<camera_ip>/capture` (the standard
  single-shot snapshot endpoint on Espressif's `CameraWebServer` example
  sketch — separate from the `/stream` you already use), runs it through
  the model, and returns crop, disease, confidence, and the image itself.
- **Why not capture from the live `<img>` stream directly in the
  browser?** Canvas-capturing a cross-origin MJPEG `<img>` typically gets
  "tainted" by CORS and can't be read back as image data. Fetching a
  single snapshot server-side sidesteps this entirely and is far more
  reliable for a live demo.

**Before your demo, confirm your ESP32-CAM sketch exposes `/capture`.**
If you're using Espressif's official `CameraWebServer` example (the
common starting point for ESP32-CAM projects), it's included by default.
If your sketch is custom and doesn't have it, add a simple handler that
grabs one frame and returns it as `image/jpeg` — a few lines, mirroring
whatever your `/stream` handler already does for a single frame instead
of a loop.

**Setup**: `pip install -r requirements.txt` now also installs
`plantdoc-predictor`, `tensorflow`, `Pillow`, and `requests`. First
inference call will be slow (~10-30s) while the model weights download
and TensorFlow initializes — run it once before your demo so it's warm.

**What to tell your professor**: PlantVillage is a lab-condition dataset
(clean backgrounds, single leaf, controlled lighting). Field photos from
a phone-mounted or fixed ESP32-CAM may score lower than the 99.68%
benchmark — this is a known, well-documented limitation of this dataset,
not a flaw in your integration. Mentioning this proactively tends to
land better than pretending the number will hold in the field.

## 8. Known limitations / things to double check before your demo

- The reader thread commits a full snapshot only once it sees a line
  matching `Irrigation:` — if your sketch prints fields in a different
  order and doesn't print an irrigation line every cycle, history won't
  update. Check `backend/app.py`'s `serial_reader_loop`.
- Servo state isn't printed separately by your listed format, so the UI
  currently mirrors it to the pump state. Add a `Servo:` print line on the
  Arduino side and a matching regex in `LINE_PATTERNS` for a real
  independent reading.
- `check_camera_reachable()` only does a TCP reachability check on port
  81 — it doesn't validate that MJPEG frames are actually flowing, only
  that something is listening.
