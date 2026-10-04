import { useState } from "react";
import { Cable, Plug, PlugZap, RotateCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";

export default function Arduino() {
  const status = usePolling(api.getArduinoStatus, 2000);
  const sensors = usePolling(api.getSensors, 2000);
  const serialLog = usePolling(api.getSerialLog, 2000);

  const [port, setPort] = useState("COM5");
  const [baud, setBaud] = useState(9600);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const st = status.data || {};

  const runAction = async (fn, label) => {
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fn();
      setActionMsg({ ok: res?.ok !== false, text: res?.error || `${label} succeeded.` });
    } catch (e) {
      setActionMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
      status.refresh();
    }
  };

  const connect = () => runAction(() => api.connectArduino(port, Number(baud)), "Connect");
  const disconnect = () => runAction(() => api.disconnectArduino(), "Disconnect");
  const reconnect = () =>
    runAction(async () => {
      await api.disconnectArduino();
      await new Promise((r) => setTimeout(r, 500));
      return api.connectArduino(port, Number(baud));
    }, "Reconnect");
  const testConnection = () => runAction(() => api.getArduinoStatus(), "Test Connection");

  return (
    <div>
      <p className="text-sm text-forest-500 mb-5">
        All serial communication with the Arduino happens through the Flask backend — a browser cannot
        open a COM port directly. Only one process may hold COM5 at a time.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cable className="w-4 h-4 text-forest-600" />
            <h3 className="font-bold text-forest-900">Connection Settings</h3>
          </div>

          <label className="text-xs font-semibold text-forest-600">COM Port</label>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-forest-200 focus:outline-none focus:ring-2 focus:ring-sage-400 text-sm"
          />

          <label className="text-xs font-semibold text-forest-600 mt-3 block">Baud Rate</label>
          <input
            type="number"
            value={baud}
            onChange={(e) => setBaud(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-forest-200 focus:outline-none focus:ring-2 focus:ring-sage-400 text-sm"
          />

          <div className="grid grid-cols-2 gap-2 mt-4">
            <SmallButton icon={Plug} label="Connect" onClick={connect} disabled={busy || st.connected} primary />
            <SmallButton icon={PlugZap} label="Disconnect" onClick={disconnect} disabled={busy || !st.connected} />
            <SmallButton icon={RotateCw} label="Reconnect" onClick={reconnect} disabled={busy} />
            <SmallButton icon={CheckCircle2} label="Test" onClick={testConnection} disabled={busy} />
          </div>

          {actionMsg && (
            <div
              className={`mt-3 text-xs rounded-lg px-3 py-2 flex items-start gap-2 ${
                actionMsg.ok ? "bg-sage-50 text-sage-700" : "bg-red-50 text-red-600"
              }`}
            >
              {actionMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              <span>{actionMsg.text}</span>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-forest-100 text-xs text-forest-500 space-y-1.5">
            <p className="font-semibold text-forest-600">Port conflicts</p>
            <p>
              If connecting fails, make sure the Arduino IDE's Serial Monitor and any other copy of this
              backend are closed — only one program can hold {port} open at a time.
            </p>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-forest-900 mb-4">Live Status</h3>
          <div className="space-y-3 text-sm">
            <Row label="Connection">
              {status.loading ? (
                <span className="text-forest-400 text-xs">Checking…</span>
              ) : st.connected ? (
                <span className="flex items-center gap-1.5 text-sage-600 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-500 font-semibold text-xs">
                  <XCircle className="w-4 h-4" /> Disconnected
                </span>
              )}
            </Row>
            <Row label="Port">{st.port || "--"}</Row>
            <Row label="Baud">{st.baud || "--"}</Row>
            <Row label="Last communication">
              {st.last_line_at ? new Date(st.last_line_at).toLocaleTimeString() : "--"}
            </Row>
            {st.last_error && (
              <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mt-2">{st.last_error}</div>
            )}
          </div>

          <h4 className="font-bold text-forest-900 mt-6 mb-2 text-sm">Received Sensor Data</h4>
          <pre className="bg-forest-900 text-sage-200 text-xs rounded-lg p-3 overflow-x-auto">
{JSON.stringify(sensors.data || {}, null, 2)}
          </pre>
        </div>

        <div className="card p-5 flex flex-col">
          <h3 className="font-bold text-forest-900 mb-3">Serial Log Console</h3>
          <div className="bg-forest-900 rounded-lg p-3 flex-1 overflow-y-auto text-xs font-mono text-sage-200 h-72">
            {(serialLog.data?.lines || []).length === 0 ? (
              <p className="text-forest-400">No serial lines received yet.</p>
            ) : (
              serialLog.data.lines.map((l, i) => (
                <div key={i} className="mb-1">
                  <span className="text-forest-400">[{new Date(l.timestamp).toLocaleTimeString()}]</span> {l.line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-forest-500">{label}</span>
      <span className="font-semibold text-forest-800">{children}</span>
    </div>
  );
}

function SmallButton({ icon: Icon, label, onClick, disabled, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        primary ? "bg-forest-700 text-white hover:bg-forest-800" : "bg-forest-100 text-forest-700 hover:bg-forest-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
