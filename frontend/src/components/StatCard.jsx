export default function StatCard({ icon: Icon, label, value, unit, statusLabel, statusTone, sub, raw }) {
  const tones = {
    good: "bg-sage-100 text-sage-700",
    warn: "bg-amber-100 text-amber-700",
    bad: "bg-red-100 text-red-600",
    neutral: "bg-forest-100 text-forest-600",
  };

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-forest-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-forest-600" />
        </div>
        {statusLabel && (
          <span className={`badge ${tones[statusTone] || tones.neutral}`}>{statusLabel}</span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-forest-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-extrabold text-forest-900 mt-0.5">
          {value === null || value === undefined || value === "" ? "--" : value}
          {unit && value !== null && value !== undefined && value !== "" && (
            <span className="text-sm font-semibold text-forest-400 ml-1">{unit}</span>
          )}
        </p>
        {sub && <p className="text-xs text-forest-400 mt-1">{sub}</p>}
        {raw && <p className="text-[10px] text-forest-300 mt-1 uppercase tracking-wide">Raw sensor value</p>}
      </div>
    </div>
  );
}
