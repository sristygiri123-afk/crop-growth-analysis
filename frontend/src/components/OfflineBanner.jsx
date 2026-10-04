import { AlertTriangle } from "lucide-react";

export default function OfflineBanner({ message }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Backend unreachable</p>
        <p className="text-red-600/90">{message || "Check that the Flask backend is running and the API base URL is correct."}</p>
      </div>
    </div>
  );
}
