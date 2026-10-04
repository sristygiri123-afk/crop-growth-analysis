import { useEffect, useState } from "react";
import { Sprout, IndianRupee, Thermometer, MapPin, TrendingUp, Loader2 } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";
import OfflineBanner from "../components/OfflineBanner.jsx";

const rupee = (n) =>
  Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function FactorBar({ label, value }) {
  const tone = value >= 75 ? "bg-sage-500" : value >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-forest-600">{label}</span>
        <span className="text-forest-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-forest-100 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export default function CropAdvisor() {
  const sensors = usePolling(api.getSensors, 4000);
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState("");
  const [form, setForm] = useState({
    n: "90",
    p: "45",
    k: "45",
    temperature_c: "",
    location: "Maharashtra",
    land_acres: "1",
    farmer_expense_total: "",
  });
  const [usedLiveTemp, setUsedLiveTemp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .getCropMeta()
      .then((data) => {
        setMeta(data);
        if (data.locations?.length && !data.locations.includes(form.location)) {
          setForm((f) => ({ ...f, location: data.locations[0] }));
        }
      })
      .catch((err) => setMetaError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = sensors.data?.temperature_c;
    if (t === null || t === undefined || t === "") return;
    setForm((f) => {
      if (f.temperature_c !== "") return f;
      return { ...f, temperature_c: String(t) };
    });
    setUsedLiveTemp(true);
  }, [sensors.data]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        n: Number(form.n),
        p: Number(form.p),
        k: Number(form.k),
        temperature_c: Number(form.temperature_c),
        location: form.location,
        land_acres: Number(form.land_acres) || 1,
      };
      if (form.farmer_expense_total !== "") {
        payload.farmer_expense_total = Number(form.farmer_expense_total);
      }
      const data = await api.recommendCrop(payload);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.message || "Could not get a recommendation.");
    } finally {
      setLoading(false);
    }
  };

  const rec = result?.recommendation;
  const scores = rec?.factor_scores || {};

  return (
    <div>
      {(sensors.offline || metaError) && (
        <OfflineBanner message={metaError || sensors.error} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <form onSubmit={onSubmit} className="xl:col-span-2 card p-5 space-y-4">
          <h3 className="font-bold text-forest-900">Farm conditions</h3>
          <p className="text-xs text-forest-500">
            Enter soil NPK (kg/ha), temperature, and location. The advisor also
            checks which crops are selling well and whether profit remains after
            your growing cost.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Nitrogen N" value={form.n} onChange={setField("n")} suffix="kg/ha" />
            <Field label="Phosphorus P" value={form.p} onChange={setField("p")} suffix="kg/ha" />
            <Field label="Potassium K" value={form.k} onChange={setField("k")} suffix="kg/ha" />
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-forest-600 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5" /> Temperature (°C)
            </span>
            <input
              type="number"
              step="0.1"
              required
              value={form.temperature_c}
              onChange={setField("temperature_c")}
              className="mt-1 w-full rounded-xl border border-forest-200 px-3 py-2 text-sm"
            />
            {usedLiveTemp && sensors.data?.temperature_c != null && (
              <p className="text-[11px] text-sage-700 mt-1">
                Filled from live sensor: {sensors.data.temperature_c}°C
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-forest-600 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Location (state)
            </span>
            <select
              value={form.location}
              onChange={setField("location")}
              className="mt-1 w-full rounded-xl border border-forest-200 px-3 py-2 text-sm bg-white"
            >
              {(meta?.locations || [form.location]).map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Land (acres)" value={form.land_acres} onChange={setField("land_acres")} />
            <label className="block">
              <span className="text-xs font-semibold text-forest-600">Your total expenses (₹)</span>
              <input
                type="number"
                min="0"
                placeholder="Optional — uses typical cost"
                value={form.farmer_expense_total}
                onChange={setField("farmer_expense_total")}
                className="mt-1 w-full rounded-xl border border-forest-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-forest-800 text-white py-2.5 text-sm font-semibold hover:bg-forest-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4" />}
            {loading ? "Analysing…" : "Find best crop"}
          </button>
        </form>

        <div className="xl:col-span-3 space-y-5">
          {!rec && (
            <div className="card p-8 text-center text-forest-500 text-sm">
              Enter soil and location details, then run the advisor. You will see
              the best crop, why it was chosen, mandi demand, and profit after expenses.
            </div>
          )}

          {rec && (
            <>
              <div className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Best solution crop</p>
                    <h3 className="text-2xl font-extrabold text-forest-900 mt-0.5">{rec.name}</h3>
                    <p className="text-sm text-forest-500">{rec.season}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold text-forest-800">{rec.overall_score}</p>
                    <p className="text-xs text-forest-400">overall score</p>
                  </div>
                </div>
                <p className="text-sm text-forest-700 bg-sage-50 rounded-xl px-3 py-2.5 mb-4">
                  {rec.decision_summary}
                </p>
                {!rec.viable && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-4">
                    Growing fit is only partial. Treat this as a cautious option, not a guarantee.
                  </p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <MiniStat icon={TrendingUp} label="Mandi demand" value={rec.demand_label} />
                  <MiniStat icon={IndianRupee} label="Price / quintal" value={`₹${rupee(rec.mandi_price_qtl)}`} />
                  <MiniStat icon={IndianRupee} label="Profit / acre" value={`₹${rupee(rec.expected_profit_acre)}`} />
                  <MiniStat icon={IndianRupee} label="Profit (your land)" value={`₹${rupee(rec.expected_profit_total)}`} />
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-forest-900">Why this crop</h4>
                    <ol className="space-y-2">
                      {(rec.why || []).map((line, i) => (
                        <li key={i} className="text-xs text-forest-600 flex gap-2">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-forest-900">Score breakdown</h4>
                    <FactorBar label="Soil NPK fit" value={scores.soil} />
                    <FactorBar label="Temperature" value={scores.temperature} />
                    <FactorBar label="Location" value={scores.location} />
                    <FactorBar label="Market demand" value={scores.market_demand} />
                    <FactorBar label="Profit after cost" value={scores.profit} />
                    <div className="text-xs text-forest-500 pt-1">
                      Sales ₹{rupee(rec.expected_revenue_acre)}/acre − cost ₹{rupee(rec.growing_cost_acre)}/acre
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-5 overflow-x-auto">
                <h4 className="font-bold text-forest-900 mb-3">Other options (ranked)</h4>
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-forest-400 border-b border-forest-100">
                      <th className="py-2 pr-3">Crop</th>
                      <th className="py-2 pr-3">Score</th>
                      <th className="py-2 pr-3">Demand</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Profit/acre</th>
                      <th className="py-2">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.alternatives || []).map((row) => (
                      <tr key={row.id} className="border-b border-forest-50 text-forest-700">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        <td className="py-2 pr-3">{row.overall_score}</td>
                        <td className="py-2 pr-3">{row.demand_label}</td>
                        <td className="py-2 pr-3">₹{rupee(row.mandi_price_qtl)}</td>
                        <td className="py-2 pr-3">₹{rupee(row.expected_profit_acre)}</td>
                        <td className="py-2">{row.location_match ? "Typical belt" : "Less typical"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.method?.note && (
                  <p className="text-[11px] text-forest-400 mt-3">{result.method.note}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {meta?.crops && (
        <div className="card p-5 mt-5">
          <h4 className="font-bold text-forest-900 mb-2">Current mandi snapshot (highest selling first)</h4>
          <p className="text-xs text-forest-500 mb-3">
            Demand ranking used by the advisor. Replace later with live Agmarknet prices if you have an API key.
          </p>
          <div className="flex flex-wrap gap-2">
            {meta.crops.map((c) => (
              <span key={c.id} className="badge bg-forest-50 text-forest-700">
                {c.name} · {c.demand_label} · ₹{rupee(c.mandi_price_qtl)}/qtl
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-forest-600">{label}</span>
      <input
        type="number"
        step="0.1"
        required
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-xl border border-forest-200 px-3 py-2 text-sm"
      />
      {suffix && <span className="text-[10px] text-forest-400">{suffix}</span>}
    </label>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-beige-100/80 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-forest-500 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-sm font-bold text-forest-900 mt-0.5">{value}</p>
    </div>
  );
}
