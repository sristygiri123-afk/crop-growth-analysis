import { useState, useMemo } from "react";
import { Thermometer, Droplet, Sprout, CloudRain, Wind } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";
import TrendChart from "../components/TrendChart.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";

const RANGES = [
  { key: "1h", label: "1 Hour" },
  { key: "6h", label: "6 Hours" },
  { key: "24h", label: "24 Hours" },
];

function stats(values) {
  const clean = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (clean.length === 0) return { min: "--", max: "--", avg: "--" };
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
  return { min: round(min), max: round(max), avg: round(avg) };
}
function round(n) {
  return Math.round(n * 100) / 100;
}

export default function Sensors() {
  const [range, setRange] = useState("1h");
  const [thresholds, setThresholds] = useState({
    tempHigh: 35,
    humidityLow: 30,
    soilDry: 600,
    mqHigh: 400,
  });

  const history = usePolling(() => api.getHistory(range), 3000, [range]);
  const sensors = usePolling(api.getSensors, 2000);

  const readings = history.data?.readings || [];
  const s = sensors.data || {};

  const tempStats = useMemo(() => stats(readings.map((r) => r.temperature_c)), [readings]);
  const humStats = useMemo(() => stats(readings.map((r) => r.humidity_pct)), [readings]);
  const soilStats = useMemo(() => stats(readings.map((r) => r.soil_moisture_raw)), [readings]);
  const rainStats = useMemo(() => stats(readings.map((r) => r.rain_raw)), [readings]);
  const mqStats = useMemo(() => stats(readings.map((r) => r.mq135_raw)), [readings]);

  return (
    <div>
      {(history.offline || sensors.offline) && <OfflineBanner message={history.error || sensors.error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-forest-500">
          Detailed per-sensor history. All values below are raw ADC/sensor readings unless labeled otherwise.
        </p>
        <div className="flex gap-1.5 bg-forest-100 p-1 rounded-full">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                range === r.key ? "bg-forest-700 text-white" : "text-forest-600 hover:bg-forest-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <SensorSection
        icon={Thermometer}
        title="DHT11 — Temperature & Humidity"
        status={sensors.loading ? "…" : "Live"}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <MiniStats label="Temperature (°C)" value={s.temperature_c} statsObj={tempStats} />
            <TrendChart data={readings} dataKey="temperature_c" name="Temp (°C)" color="#336744" height={200} />
            <ThresholdRow
              label="High-temp alert threshold"
              value={thresholds.tempHigh}
              unit="°C"
              onChange={(v) => setThresholds((t) => ({ ...t, tempHigh: v }))}
            />
          </div>
          <div>
            <MiniStats label="Humidity (%)" value={s.humidity_pct} statsObj={humStats} />
            <TrendChart data={readings} dataKey="humidity_pct" name="Humidity (%)" color="#458157" height={200} />
            <ThresholdRow
              label="Low-humidity alert threshold"
              value={thresholds.humidityLow}
              unit="%"
              onChange={(v) => setThresholds((t) => ({ ...t, humidityLow: v }))}
            />
          </div>
        </div>
      </SensorSection>

      <SensorSection icon={Sprout} title="Soil Moisture Sensor (A0)" status={s.soil_status || "--"}>
        <MiniStats label="Raw Reading" value={s.soil_moisture_raw} statsObj={soilStats} raw />
        <TrendChart data={readings} dataKey="soil_moisture_raw" name="Soil Raw" color="#6d8c5c" height={200} />
        <ThresholdRow
          label="Dry threshold (raw value below = dry)"
          value={thresholds.soilDry}
          unit=""
          onChange={(v) => setThresholds((t) => ({ ...t, soilDry: v }))}
        />
        <p className="text-xs text-forest-400 mt-2">
          This threshold is for frontend display/alerting only — it does not change the Arduino's own DRY/MOIST logic.
        </p>
      </SensorSection>

      <SensorSection icon={CloudRain} title="Rain Sensor (A1)" status={s.rain_status || "--"}>
        <MiniStats label="Raw Reading" value={s.rain_raw} statsObj={rainStats} raw />
        <TrendChart data={readings} dataKey="rain_raw" name="Rain Raw" color="#8aa878" height={200} />
      </SensorSection>

      <SensorSection icon={Wind} title="MQ-135 Air Quality Sensor (A2)" status={s.mq135_raw != null ? "Live" : "--"}>
        <MiniStats label="Raw Reading" value={s.mq135_raw} statsObj={mqStats} raw />
        <TrendChart data={readings} dataKey="mq135_raw" name="MQ-135 Raw" color="#557046" height={200} />
        <ThresholdRow
          label="High air-pollutant alert threshold"
          value={thresholds.mqHigh}
          unit=""
          onChange={(v) => setThresholds((t) => ({ ...t, mqHigh: v }))}
        />
      </SensorSection>
    </div>
  );
}

function SensorSection({ icon: Icon, title, status, children }) {
  return (
    <div className="card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-forest-600" />
          </div>
          <h3 className="font-bold text-forest-900">{title}</h3>
        </div>
        <span className="badge bg-forest-100 text-forest-600">{status}</span>
      </div>
      {children}
    </div>
  );
}

function MiniStats({ label, value, statsObj, raw }) {
  return (
    <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
      <div>
        <p className="text-xs text-forest-400">{label}{raw ? " (raw)" : ""}</p>
        <p className="text-xl font-extrabold text-forest-900">{value ?? "--"}</p>
      </div>
      <div className="flex gap-3 text-xs text-forest-500">
        <span>Min <b className="text-forest-700">{statsObj.min}</b></span>
        <span>Max <b className="text-forest-700">{statsObj.max}</b></span>
        <span>Avg <b className="text-forest-700">{statsObj.avg}</b></span>
      </div>
    </div>
  );
}

function ThresholdRow({ label, value, unit, onChange }) {
  return (
    <div className="flex items-center justify-between mt-3 text-xs">
      <label className="text-forest-500">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 px-2 py-1 rounded-lg border border-forest-200 text-right text-forest-800 focus:outline-none focus:ring-2 focus:ring-sage-400"
        />
        <span className="text-forest-400">{unit}</span>
      </div>
    </div>
  );
}
