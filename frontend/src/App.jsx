import { Routes, Route, useLocation } from "react-router-dom";
import { api } from "./api/client.js";
import { usePolling } from "./api/usePolling.js";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Overview from "./pages/Overview.jsx";
import Sensors from "./pages/Sensors.jsx";
import Camera from "./pages/Camera.jsx";
import Arduino from "./pages/Arduino.jsx";
import Irrigation from "./pages/Irrigation.jsx";
import Alerts from "./pages/Alerts.jsx";
import CropAdvisor from "./pages/CropAdvisor.jsx";

const TITLES = {
  "/": ["Overview Dashboard", "Live snapshot of your farm's sensors and systems"],
  "/sensors": ["Sensor Monitoring", "Per-sensor detail, history and thresholds"],
  "/camera": ["ESP32-CAM", "Live field camera stream"],
  "/arduino": ["Arduino Connection", "Serial link diagnostics for COM5"],
  "/irrigation": ["Irrigation Control", "Pump and valve status, auto-irrigation logic"],
  "/alerts": ["Alerts & History", "System, sensor and irrigation event log"],
  "/crops": ["Explainable Crop Advisor", "Soil, climate, mandi demand and profit — with reasons"],
};

export default function App() {
  const location = useLocation();
  const status = usePolling(api.getStatus, 3000);
  const [title, subtitle] = TITLES[location.pathname] || TITLES["/"];

  return (
    <div className="min-h-screen flex bg-beige-50">
      <Sidebar statusData={status.data} />
      <div className="flex-1 min-w-0">
        <TopBar title={title} subtitle={subtitle} backendOk={!status.offline} />
        <main className="p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/arduino" element={<Arduino />} />
            <Route path="/irrigation" element={<Irrigation />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/crops" element={<CropAdvisor />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
