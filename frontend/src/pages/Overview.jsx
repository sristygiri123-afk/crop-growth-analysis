import { Thermometer, Droplet, Sprout, CloudRain, Wind, Power, ToggleLeft } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";
import StatCard from "../components/StatCard.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import LastUpdated from "../components/LastUpdated.jsx";
import TrendChart from "../components/TrendChart.jsx";

export default function Overview() {
  const sensors = usePolling(api.getSensors, 2000);
  const history = usePolling(() => api.getHistory("1h"), 5000);
  const events = usePolling(() => api.getEvents(), 5000);

  const s = sensors.data || {};
  const readings = history.data?.readings || [];
  const recentAlerts = (events.data?.events || []).slice(0, 6);

  return (
    <div>
      {sensors.offline && <OfflineBanner message={sensors.error} />}

      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-forest-500">
          Live readings polled every 2 seconds from your Flask bridge on COM5.
        </p>
        <LastUpdated date={sensors.lastUpdated} onRefresh={sensors.refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Thermometer}
          label="Temperature"
          value={sensors.loading ? "…" : s.temperature_c}
          unit="°C"
        />
        <StatCard
          icon={Droplet}
          label="Humidity"
          value={sensors.loading ? "…" : s.humidity_pct}
          unit="%"
        />
        <StatCard
          icon={Sprout}
          label="Soil Moisture"
          value={sensors.loading ? "…" : s.soil_moisture_raw}
          raw
          statusLabel={s.soil_status}
          statusTone={s.soil_status === "DRY" ? "warn" : "good"}
        />
        <StatCard
          icon={CloudRain}
          label="Rain Sensor"
          value={sensors.loading ? "…" : s.rain_raw}
          raw
          statusLabel={s.rain_status}
          statusTone={s.rain_status === "RAIN" ? "good" : "neutral"}
        />
        <StatCard
          icon={Wind}
          label="Air Quality (MQ-135)"
          value={sensors.loading ? "…" : s.mq135_raw}
          raw
        />
        <StatCard
          icon={Power}
          label="Water Pump"
          value={s.pump_on === null || s.pump_on === undefined ? "--" : s.pump_on ? "ON" : "OFF"}
          statusLabel={s.pump_on ? "Running" : "Idle"}
          statusTone={s.pump_on ? "good" : "neutral"}
        />
        <StatCard
          icon={ToggleLeft}
          label="Servo Valve"
          value={s.servo_open === null || s.servo_open === undefined ? "--" : s.servo_open ? "OPEN" : "CLOSED"}
          statusLabel={s.servo_open ? "Open" : "Closed"}
          statusTone={s.servo_open ? "good" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-forest-900 mb-3">Temperature & Humidity — Last Hour</h3>
          <TrendChart data={readings} dataKey="temperature_c" name="Temperature (°C)" color="#336744" />
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-forest-900 mb-3">System Alerts</h3>
          {events.loading ? (
            <p className="text-sm text-forest-400">Loading…</p>
          ) : recentAlerts.length === 0 ? (
            <p className="text-sm text-forest-400">No recent events.</p>
          ) : (
            <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {recentAlerts.map((e, i) => (
                <li key={i} className="text-xs border-l-2 border-sage-400 pl-2.5">
                  <p className="font-semibold text-forest-700">{e.kind.toUpperCase()}</p>
                  <p className="text-forest-500">{e.message}</p>
                  <p className="text-forest-300">{new Date(e.timestamp).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-5 mt-5 overflow-x-auto">
        <h3 className="font-bold text-forest-900 mb-3">Recent Readings</h3>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-forest-400 border-b border-forest-100">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Temp (°C)</th>
              <th className="py-2 pr-4">Humidity (%)</th>
              <th className="py-2 pr-4">Soil Raw</th>
              <th className="py-2 pr-4">Rain Raw</th>
              <th className="py-2 pr-4">MQ-135 Raw</th>
              <th className="py-2">Pump</th>
            </tr>
          </thead>
          <tbody>
            {readings.slice(-8).reverse().map((r, i) => (
              <tr key={i} className="border-b border-forest-50 text-forest-700">
                <td className="py-2 pr-4">{new Date(r.timestamp).toLocaleTimeString()}</td>
                <td className="py-2 pr-4">{r.temperature_c ?? "--"}</td>
                <td className="py-2 pr-4">{r.humidity_pct ?? "--"}</td>
                <td className="py-2 pr-4">{r.soil_moisture_raw ?? "--"}</td>
                <td className="py-2 pr-4">{r.rain_raw ?? "--"}</td>
                <td className="py-2 pr-4">{r.mq135_raw ?? "--"}</td>
                <td className="py-2">{r.pump_on ? "ON" : "OFF"}</td>
              </tr>
            ))}
            {readings.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-forest-400">
                  No readings collected yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
