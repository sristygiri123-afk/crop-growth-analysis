// Centralized API client.
// Base URL is configurable at runtime (stored in localStorage) so the app
// works both on the laptop (localhost) and on a phone on the same
// Wi-Fi/hotspot (http://<laptop-lan-ip>:5000).

const STORAGE_KEY = "smart_agri_api_base_url";
const DEFAULT_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000`;

export function getApiBaseUrl() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL;
}

export function setApiBaseUrl(url) {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ""));
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 4000);

  try {
    const res = await fetch(`${base}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeout);

    let data = null;
    try {
      data = await res.json();
    } catch {
      // no JSON body
    }

    if (!res.ok) {
      throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
    }
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new ApiError("AI analysis timed out. The disease model may still be loading. Please try again", 0);
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "Could not reach backend. Check the API base URL and that the Flask server is running.",
      0
    );
  }
}

export const api = {
  getStatus: () => request("/api/status"),
  getSensors: () => request("/api/sensors"),
  getHistory: (range = "24h") => request(`/api/history?range=${range}`),
  getArduinoStatus: () => request("/api/arduino/status"),
  connectArduino: (port, baud) =>
    request("/api/arduino/connect", { method: "POST", body: JSON.stringify({ port, baud }) }),
  disconnectArduino: () => request("/api/arduino/disconnect", { method: "POST" }),
  configArduino: (port, baud) =>
    request("/api/arduino/config", { method: "POST", body: JSON.stringify({ port, baud }) }),
  getCameraStatus: () => request("/api/camera/status"),
  configCamera: (ip) =>
    request("/api/camera/config", { method: "POST", body: JSON.stringify({ ip }) }),
  testCamera: () => request("/api/camera/test", { method: "POST" }),
  irrigationControl: (payload) =>
    request("/api/irrigation/control", { method: "POST", body: JSON.stringify(payload) }),
  irrigationMode: (mode) =>
    request("/api/irrigation/mode", { method: "POST", body: JSON.stringify({ mode }) }),
  getEvents: (kind) => request(`/api/events${kind ? `?kind=${kind}` : ""}`),
  getSerialLog: () => request("/api/serial-log"),
  //detectDisease: () => request("/api/disease/detect", { method: "POST", timeoutMs: 120000 }),
  captureSnapshot: () => request("/api/camera/capture", { method: "POST", timeoutMs: 15000 }),
  detectDisease: (image) =>
      request("/api/disease/detect", {
          method: "POST",
          timeoutMs: 120000,
          body: JSON.stringify(image ? { image } : {}),
    }),
  getDiseaseHistory: () => request("/api/disease/history"),
  getCropMeta: () => request("/api/crops/meta", { timeoutMs: 8000 }),
  recommendCrop: (payload) =>
    request("/api/crops/recommend", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 12000,
    }),
};

export { ApiError };
