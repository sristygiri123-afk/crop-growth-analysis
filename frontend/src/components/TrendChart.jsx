import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

export default function TrendChart({ data, dataKey, name, color = "#458157", unit = "", height = 220 }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-forest-400 bg-forest-50/60 rounded-xl"
      >
        No historical readings yet — collecting data…
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, _t: fmtTime(d.timestamp) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7ede2" />
        <XAxis dataKey="_t" tick={{ fontSize: 10, fill: "#7a9382" }} minTickGap={30} />
        <YAxis tick={{ fontSize: 10, fill: "#7a9382" }} />
        <Tooltip
          formatter={(v) => [`${v}${unit}`, name]}
          contentStyle={{ borderRadius: 12, border: "1px solid #d0ddc6", fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
