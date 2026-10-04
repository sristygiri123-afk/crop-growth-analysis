import { useState, useMemo } from "react";
import { X, Filter } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";
import OfflineBanner from "../components/OfflineBanner.jsx";

const KINDS = ["all", "connection", "irrigation", "sensor", "system", "error"];

export default function Alerts() {
  const events = usePolling(() => api.getEvents(), 3000);
  const [filter, setFilter] = useState("all");
  const [dismissed, setDismissed] = useState(new Set());

  const list = events.data?.events || [];

  const filtered = useMemo(() => {
    return list.filter((e, i) => (filter === "all" || e.kind === filter) && !dismissed.has(`${e.timestamp}-${i}`));
  }, [list, filter, dismissed]);

  const dismiss = (key) => setDismissed((prev) => new Set(prev).add(key));

  const kindTone = {
    connection: "bg-forest-100 text-forest-700",
    irrigation: "bg-sage-100 text-sage-700",
    sensor: "bg-beige-200 text-forest-700",
    system: "bg-forest-100 text-forest-500",
    error: "bg-red-100 text-red-600",
  };

  return (
    <div>
      {events.offline && <OfflineBanner message={events.error} />}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Filter className="w-4 h-4 text-forest-500" />
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
              filter === k ? "bg-forest-700 text-white" : "bg-forest-100 text-forest-600 hover:bg-forest-200"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {events.loading ? (
          <p className="text-sm text-forest-400">Loading events…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-forest-400">No events match this filter.</p>
        ) : (
          <ul className="divide-y divide-forest-50">
            {filtered.map((e, i) => {
              const key = `${e.timestamp}-${i}`;
              return (
                <li key={key} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`badge shrink-0 ${kindTone[e.kind] || "bg-forest-100 text-forest-600"}`}>
                      {e.kind}
                    </span>
                    <div>
                      <p className="text-sm text-forest-800">{e.message}</p>
                      <p className="text-xs text-forest-400 mt-0.5">{new Date(e.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(key)}
                    className="p-1 rounded-lg hover:bg-forest-100 text-forest-400 hover:text-forest-700 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
