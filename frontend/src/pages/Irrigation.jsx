import { Droplets, Power, ToggleLeft, Info, Lock } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";
import OfflineBanner from "../components/OfflineBanner.jsx";

export default function Irrigation() {
  const sensors = usePolling(api.getSensors, 2000);
  const s = sensors.data || {};

  const soilDry = s.soil_status === "DRY";
  const noRain = s.rain_status === "NO RAIN";
  const autoWouldRun = soilDry && noRain;

  return (
    <div>
      {sensors.offline && <OfflineBanner message={sensors.error} />}

      <div className="bg-sage-50 border border-sage-200 text-sage-800 rounded-xl px-4 py-3 text-sm mb-6 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          The system currently runs in <b>Auto-only mode</b>. Irrigation is controlled entirely by the
          Arduino's own onboard logic — this dashboard mirrors that logic for display, it does not
          override it. Manual pump/servo control is not enabled yet because no safe command protocol
          exists between this backend and the Arduino sketch for it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Power className="w-4 h-4 text-forest-600" />
            <h3 className="font-bold text-forest-900">Water Pump (Relay D7)</h3>
          </div>
          <p className="text-3xl font-extrabold text-forest-900">
            {s.pump_on === undefined || s.pump_on === null ? "--" : s.pump_on ? "ON" : "OFF"}
          </p>
          <p className="text-xs text-forest-400 mt-1">Reported live by the Arduino over serial.</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ToggleLeft className="w-4 h-4 text-forest-600" />
            <h3 className="font-bold text-forest-900">Servo Valve (D9)</h3>
          </div>
          <p className="text-3xl font-extrabold text-forest-900">
            {s.servo_open === undefined || s.servo_open === null ? "--" : s.servo_open ? "OPEN" : "CLOSED"}
          </p>
          <p className="text-xs text-forest-400 mt-1">Mirrors pump state (no distinct servo line in current sketch output).</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-4 h-4 text-forest-600" />
            <h3 className="font-bold text-forest-900">Auto Logic</h3>
          </div>
          <ul className="text-sm space-y-1.5 text-forest-600">
            <li>Soil: <b className={soilDry ? "text-amber-600" : "text-sage-600"}>{s.soil_status || "--"}</b></li>
            <li>Rain: <b className={noRain ? "text-sage-600" : "text-amber-600"}>{s.rain_status || "--"}</b></li>
          </ul>
          <p className={`mt-3 text-sm font-semibold ${autoWouldRun ? "text-sage-600" : "text-forest-400"}`}>
            Rule: DRY soil AND NO RAIN → pump ON
          </p>
        </div>
      </div>

      <div className="card p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-forest-900">Mode</h3>
          <span className="badge bg-forest-100 text-forest-700">Auto</span>
        </div>
        <div className="flex gap-3">
          <button className="flex-1 py-2.5 rounded-xl bg-forest-700 text-white font-semibold text-sm cursor-default">
            Auto Mode (active)
          </button>
          <button
            disabled
            title="Manual mode requires an Arduino-side command protocol that doesn't exist yet"
            className="flex-1 py-2.5 rounded-xl bg-forest-100 text-forest-400 font-semibold text-sm flex items-center justify-center gap-1.5 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" /> Manual Mode (locked)
          </button>
        </div>
      </div>

      <div className="card p-5 mt-5 opacity-60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-forest-900">Manual Pump Override</h3>
          <span className="badge bg-forest-100 text-forest-400">Coming later</span>
        </div>
        <p className="text-sm text-forest-500">
          Once a serial command protocol is added to the Arduino sketch (e.g. accepting <code className="bg-forest-100 px-1 rounded">PUMP_ON</code>/<code className="bg-forest-100 px-1 rounded">PUMP_OFF</code>),
          this panel will require a confirmation dialog before sending any command, and will never report
          success without a backend-confirmed acknowledgement from the Arduino.
        </p>
      </div>
    </div>
  );
}
