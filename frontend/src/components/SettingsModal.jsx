import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getApiBaseUrl, setApiBaseUrl } from "../api/client.js";

export default function SettingsModal({ open, onClose }) {
  const [url, setUrl] = useState(getApiBaseUrl());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(getApiBaseUrl());
      setSaved(false);
    }
  }, [open]);

  if (!open) return null;

  const save = () => {
    setApiBaseUrl(url);
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-forest-400 hover:text-forest-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-forest-900 mb-1">Backend Settings</h2>
        <p className="text-sm text-forest-500 mb-4">
          Set this to your laptop's LAN IP (not <code className="text-xs bg-forest-100 px-1 rounded">localhost</code>)
          when opening this app from your phone.
        </p>
        <label className="text-xs font-semibold text-forest-600">API Base URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.23:5000"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-forest-200 focus:outline-none focus:ring-2 focus:ring-sage-400 text-sm"
        />
        <p className="text-xs text-forest-400 mt-2">
          Find your laptop's IP with <code className="bg-forest-100 px-1 rounded">ipconfig</code> (Windows) — look
          for the IPv4 address on your Wi-Fi adapter.
        </p>
        <button
          onClick={save}
          className="mt-4 w-full py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm transition-colors"
        >
          {saved ? "Saved — reloading…" : "Save & Reload"}
        </button>
      </div>
    </div>
  );
}
