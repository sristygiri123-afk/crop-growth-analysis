import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Activity, Camera, Cable, Droplets, Bell, Leaf, Sprout,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/crops", label: "Crop Advisor", icon: Sprout },
  { to: "/sensors", label: "Sensor Monitoring", icon: Activity },
  { to: "/camera", label: "ESP32-CAM", icon: Camera },
  { to: "/arduino", label: "Arduino Connection", icon: Cable },
  { to: "/irrigation", label: "Irrigation Control", icon: Droplets },
  { to: "/alerts", label: "Alerts & History", icon: Bell },
];

export default function Sidebar({ statusData }) {
  const arduinoOk = statusData?.arduino_connected;
  const cameraOk = statusData?.camera_reachable;

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-forest-800 text-beige-50 min-h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 py-6 border-b border-forest-700/60">
        <div className="w-9 h-9 rounded-xl bg-sage-400/20 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-sage-300" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">Smart Agriculture</p>
          <p className="text-[11px] text-forest-300 leading-tight">Assistant</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sage-500/90 text-white shadow-sm"
                  : "text-forest-200 hover:bg-forest-700/70 hover:text-white"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-forest-700/60 space-y-2">
        <ConnDot label="Arduino (COM5)" ok={arduinoOk} />
        <ConnDot label="ESP32-CAM" ok={cameraOk} />
      </div>
    </aside>
  );
}

function ConnDot({ label, ok }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-forest-300">{label}</span>
      <span className={`flex items-center gap-1.5 font-semibold ${ok ? "text-sage-300" : "text-red-300"}`}>
        <span className={`w-2 h-2 rounded-full ${ok ? "bg-sage-300 animate-pulse" : "bg-red-400"}`} />
        {ok ? "Online" : "Offline"}
      </span>
    </div>
  );
}
