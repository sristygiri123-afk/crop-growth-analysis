import { useState, useRef, useEffect } from "react";
import { Play, Square, RefreshCw, Maximize, Camera as CameraIcon, CheckCircle2, XCircle, Sparkles, Leaf, AlertOctagon } from "lucide-react";
import { api } from "../api/client.js";
import { usePolling } from "../api/usePolling.js";

export default function Camera() {
  const camStatus = usePolling(api.getCameraStatus, 4000);
  const [ipInput, setIpInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    if (camStatus.data?.ip && !ipInput) setIpInput(camStatus.data.ip);
  }, [camStatus.data]);

  const streamUrl = camStatus.data?.ip
    ? `http://${camStatus.data.ip}:81/stream?cachebust=${streamKey}`
    : null;

  const saveIp = async () => {
    if (!ipInput) return;
    setSaving(true);
    try {
      await api.configCamera(ipInput);
      await camStatus.refresh();
    } catch (e) {
      // surfaced via camStatus.offline/error on next poll
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.testCamera();
      await camStatus.refresh();
    } finally {
      setTesting(false);
    }
  };

  const startStream = () => {
    setImgError(false);
    setStreaming(true);
    setStreamKey((k) => k + 1);
  };

  const stopStream = () => setStreaming(false);

  const refreshStream = () => {
    setImgError(false);
    setStreamKey((k) => k + 1);
  };

  const goFullscreen = () => {
    if (frameRef.current?.requestFullscreen) frameRef.current.requestFullscreen();
  };

  const reachable = camStatus.data?.reachable;

  const [analyzing, setAnalyzing] = useState(false);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [diseaseError, setDiseaseError] = useState(null);

  const runDiseaseDetection = async () => {
    setAnalyzing(true);
    setDiseaseError(null);
    try {
      const res = await api.detectDisease();
      setDiseaseResult(res);
    } catch (e) {
      setDiseaseError(e.message);
      setDiseaseResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-forest-500 mb-5">
        The browser connects directly to the ESP32-CAM's MJPEG stream — the Flask backend only checks
        reachability, it does not proxy video frames.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-4">
          <div
            ref={frameRef}
            className="relative bg-forest-900 rounded-xl overflow-hidden flex items-center justify-center"
            style={{ aspectRatio: "16/9" }}
          >
            {!camStatus.data?.ip ? (
              <EmptyState text="No camera IP configured yet. Enter one on the right." />
            ) : !streaming ? (
              <EmptyState text="Stream stopped. Press Start Stream to connect." />
            ) : imgError ? (
              <EmptyState
                text={`Could not load stream from ${camStatus.data.ip}:81. Check the ESP32-CAM is powered, on the same network, and the IP is correct.`}
                error
              />
            ) : (
              <img
                key={streamKey}
                src={streamUrl}
                alt="ESP32-CAM live stream"
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <ActionButton icon={Play} label="Start Stream" onClick={startStream} disabled={!camStatus.data?.ip} primary />
            <ActionButton icon={Square} label="Stop Stream" onClick={stopStream} disabled={!streaming} />
            <ActionButton icon={RefreshCw} label="Refresh" onClick={refreshStream} disabled={!streaming} />
            <ActionButton icon={Maximize} label="Fullscreen" onClick={goFullscreen} disabled={!streaming || imgError} />
            <ActionButton
              icon={Sparkles}
              label={analyzing ? "Analyzing…" : "Capture & Analyze (AI)"}
              onClick={runDiseaseDetection}
              disabled={analyzing || !camStatus.data?.ip}
              primary
            />
          </div>

          <p className="text-xs text-forest-400 mt-2">
            Analysis takes a fresh still snapshot from the camera's <code className="bg-forest-100 px-1 rounded">/capture</code> endpoint
            (independent of the live stream above) and runs it through a pretrained PlantVillage CNN on the backend.
          </p>

          {diseaseError && (
            <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{diseaseError}</div>
          )}

          {diseaseResult && (
            <div className="mt-4 card p-4 bg-forest-50/50">
              <div className="flex flex-col sm:flex-row gap-4">
                <img
                  src={diseaseResult.image}
                  alt="Captured leaf snapshot"
                  className="w-full sm:w-40 h-40 object-cover rounded-xl border border-forest-100"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {diseaseResult.is_healthy ? (
                      <Leaf className="w-4 h-4 text-sage-600" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`badge ${diseaseResult.is_healthy ? "bg-sage-100 text-sage-700" : "bg-red-100 text-red-600"}`}>
                      {diseaseResult.is_healthy ? "Healthy" : "Disease Detected"}
                    </span>
                  </div>
                  <p className="font-bold text-forest-900">
                    {diseaseResult.crop} — {diseaseResult.disease}
                  </p>
                  <p className="text-sm text-forest-500">
                    Confidence: <b>{(diseaseResult.confidence * 100).toFixed(1)}%</b>
                  </p>
                  <p className="text-xs text-forest-400 mt-1">Model: {diseaseResult.model} (PlantVillage-trained CNN)</p>

                  {diseaseResult.top_k?.length > 1 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-forest-500">Other possibilities:</p>
                      <ul className="text-xs text-forest-500">
                        {diseaseResult.top_k.slice(1).map((t, i) => (
                          <li key={i}>
                            {t.crop} — {t.disease} ({(t.confidence * 100).toFixed(1)}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-forest-400 mt-3">
                Note: this model is trained on clean, lab-condition leaf photos (PlantVillage dataset). Field photos with
                background clutter or uneven lighting may reduce accuracy versus the benchmark figure.
              </p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CameraIcon className="w-4 h-4 text-forest-600" />
            <h3 className="font-bold text-forest-900">Camera Setup</h3>
          </div>

          <label className="text-xs font-semibold text-forest-600">ESP32-CAM IP Address</label>
          <input
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="192.168.1.50"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-forest-200 focus:outline-none focus:ring-2 focus:ring-sage-400 text-sm"
          />
          <p className="text-xs text-forest-400 mt-1">
            Stream URL: <code className="bg-forest-100 px-1 rounded">http://{ipInput || "CAMERA_IP"}:81/stream</code>
          </p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={saveIp}
              disabled={saving || !ipInput}
              className="flex-1 py-2 rounded-lg bg-forest-700 hover:bg-forest-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save IP"}
            </button>
            <button
              onClick={testConnection}
              disabled={testing || !camStatus.data?.ip}
              className="flex-1 py-2 rounded-lg bg-sage-100 hover:bg-sage-200 text-sage-700 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test Connection"}
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-forest-100 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-forest-500">Status</span>
              {camStatus.loading ? (
                <span className="text-forest-400 text-xs">Checking…</span>
              ) : reachable ? (
                <span className="flex items-center gap-1.5 text-sage-600 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> Reachable
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-500 font-semibold text-xs">
                  <XCircle className="w-4 h-4" /> Unreachable
                </span>
              )}
            </div>
            {camStatus.data?.last_checked_at && (
              <p className="text-xs text-forest-400 mt-1">
                Last checked {new Date(camStatus.data.last_checked_at).toLocaleTimeString()}
              </p>
            )}
            {camStatus.data?.last_error && (
              <p className="text-xs text-red-500 mt-1 break-words">{camStatus.data.last_error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text, error }) {
  return (
    <div className="text-center px-6">
      <p className={`text-sm ${error ? "text-red-300" : "text-forest-300"}`}>{text}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        primary ? "bg-forest-700 text-white hover:bg-forest-800" : "bg-forest-100 text-forest-700 hover:bg-forest-200"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
