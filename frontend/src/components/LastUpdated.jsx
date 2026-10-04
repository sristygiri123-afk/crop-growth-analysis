export default function LastUpdated({ date, onRefresh }) {
  return (
    <div className="flex items-center gap-3 text-xs text-forest-400">
      <span>
        {date ? `Last updated ${date.toLocaleTimeString()}` : "Waiting for data…"}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="px-2.5 py-1 rounded-full bg-forest-100 hover:bg-forest-200 text-forest-700 font-semibold transition-colors"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
