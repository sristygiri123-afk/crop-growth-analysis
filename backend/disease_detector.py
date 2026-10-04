import io
import threading

MODEL_NAME = "densenet169_v1"

_predictor = None
_predictor_lock = threading.Lock()


def get_predictor():
    global _predictor

    if _predictor is None:
        with _predictor_lock:
            if _predictor is None:
                from plantdoc_predictor import GuardedPredictor

                _predictor = GuardedPredictor(
                    model_name=MODEL_NAME,
                    guard_threshold=0.5
                )

    return _predictor


def parse_label(label):
    parts = label.split("___")

    crop = parts[0].replace("_", " ") if len(parts) > 0 else label
    disease_raw = parts[1] if len(parts) > 1 else "unknown"

    is_healthy = disease_raw.lower() == "healthy"

    disease = (
        "Healthy"
        if is_healthy
        else disease_raw.replace("_", " ")
    )

    return crop, disease, is_healthy


def predict_from_bytes(image_bytes, top_k=3):
    from PIL import Image

    predictor = get_predictor()

    img = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    result = predictor.predict(
        img,
        top_k=top_k
    )

    if not result.get("is_leaf", False):
        return {
            "model": result.get("model", MODEL_NAME),
            "raw_label": "unknown",
            "crop": None,
            "disease": None,
            "is_healthy": None,
            "confidence": None,
            "is_leaf": False,
            "guard_score": result.get("guard_score"),
            "top_k": [],
            "rejected": True,
            "rejection_reason": "No crop leaf detected"
        }

    label = result["label"]

    crop, disease, is_healthy = parse_label(label)

    top_k_parsed = []

    for item in result.get("top_k", []):
        c, d, h = parse_label(item["label"])

        top_k_parsed.append({
            "label": item["label"],
            "crop": c,
            "disease": d,
            "is_healthy": h,
            "confidence": item["confidence"]
        })

    return {
        "model": result["model"],
        "raw_label": label,
        "crop": crop,
        "disease": disease,
        "is_healthy": is_healthy,
        "confidence": result["confidence"],
        "is_leaf": True,
        "guard_score": result.get("guard_score"),
        "top_k": top_k_parsed,
        "rejected": False
    }