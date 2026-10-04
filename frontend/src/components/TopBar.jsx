import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Settings, WifiOff, Wifi } from "lucide-react";
import SettingsModal from "./SettingsModal.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/crops", label: "Crop Advisor" },
  { to: "/sensors", label: "Sensors" },
  { to: "/camera", label: "Camera" },
  { to: "/arduino", label: "Arduino" },
  { to: "/irrigation", label: "Irrigation" },
  { to: "/alerts", label: "Alerts" },
];

export default function TopBar({ title, subtitle, backendOk }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 bg-beige-50/90 backdrop-blur border-b border-forest-100">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-forest-100"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-forest-900">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-forest-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`hidden sm:flex badge ${
              backendOk ? "bg-sage-100 text-sage-700" : "bg-red-100 text-red-600"
            }`}
          >
            {backendOk ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {backendOk ? "Backend Connected" : "Backend Unreachable"}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg bg-forest-800 text-white hover:bg-forest-700 transition-colors"
            title="API / Camera settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden px-4 pb-4 flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-xs font-semibold ${
                  isActive ? "bg-forest-800 text-white" : "bg-forest-100 text-forest-700"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
