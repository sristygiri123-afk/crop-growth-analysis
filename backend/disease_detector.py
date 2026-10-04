"""
AI Disease Detection module.
=============================
Uses the open-source `plantdoc-predictor` library (PyPI, MIT licensed),
which ships pretrained CNN models fine-tuned on the PlantVillage 38-class
leaf disease dataset (14 crops: tomato, potato, apple, corn, grape, etc).
Weights auto-download and cache locally (~/.plantdoc/ or similar) on
first use -- no manual model file hunting required.

Model chosen: densenet169_v1 (99.68% reported validation accuracy on
PlantVillage, a good accuracy/size tradeoff for a live demo on a laptop
CPU). Swap MODEL_NAME below for a lighter one (e.g. "mobilenetv2_v1",
96.8% accuracy, much faster) if inference feels slow on your hardware.

IMPORTANT HONESTY NOTE (say this to your professor, it makes you look
more credible, not less): PlantVillage is a *lab-condition* dataset --
clean, single-leaf, plain-background photos. Real field photos from your
ESP32-CAM (background clutter, uneven lighting, multiple leaves) will
likely get lower accuracy than the benchmark 99.68% figure. That's a
normal, well-known limitation of this dataset, not a bug in your project.
"""

import io
import threading

MODEL_NAME = "densenet169_v1"

_predictor = None
_predictor_lock = threading.Lock()


def get_predictor():
    """Lazily load the model on first request (keeps Flask startup fast)."""
    global _predictor
    if _predictor is None:
        with _predictor_lock:
            if _predictor is None:
                from plantdoc_predictor import Predictor
                _predictor = Predictor(model_name=MODEL_NAME, verbose=False)
    return _predictor


def parse_label(label):
    """PlantVillage labels look like 'Tomato___Late_blight' or
    'Apple___healthy'. Split into crop / disease / is_healthy."""
    parts = label.split("___")
    crop = parts[0].replace("_", " ") if len(parts) > 0 else label
    disease_raw = parts[1] if len(parts) > 1 else "unknown"
    is_healthy = disease_raw.lower() == "healthy"
    disease = "Healthy" if is_healthy else disease_raw.replace("_", " ")
    return crop, disease, is_healthy


def predict_from_bytes(image_bytes, top_k=3):
    """Run inference on raw image bytes (e.g. a JPEG captured from the
    ESP32-CAM). Returns a JSON-serializable dict. Raises on failure --
    caller is responsible for catching and reporting errors, never for
    fabricating a result."""
    from PIL import Image

    predictor = get_predictor()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    result = predictor.predict(img, top_k=top_k)
    crop, disease, is_healthy = parse_label(result["label"])

    top_k_parsed = []
    for item in result.get("top_k", []):
        c, d, h = parse_label(item["label"])
        top_k_parsed.append({
            "label": item["label"],
            "crop": c,
            "disease": d,
            "is_healthy": h,
            "confidence": item["confidence"],
        })

    return {
        "model": result["model"],
        "raw_label": result["label"],
        "crop": crop,
        "disease": disease,
        "is_healthy": is_healthy,
        "confidence": result["confidence"],
        "top_k": top_k_parsed,
    }
