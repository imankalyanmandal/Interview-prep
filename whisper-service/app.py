import os
import uuid
import logging
import whisper
from flask import Flask, request, jsonify

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)

UPLOAD_FOLDER   = "audio_temp"
ALLOWED_EXTENSIONS = {"wav", "mp3", "mp4", "m4a", "webm", "ogg"}
WHISPER_MODEL   = os.getenv("WHISPER_MODEL", "base")   # tiny | base | small | medium

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── Load Whisper model once at startup ───────────────────────────────────────
# Loading is expensive — do it once, reuse for all requests
log.info(f"Loading Whisper model: '{WHISPER_MODEL}'...")
model = whisper.load_model(WHISPER_MODEL)
log.info(f"Whisper model '{WHISPER_MODEL}' loaded and ready.")


# ─── Helpers ──────────────────────────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def cleanup(filepath: str):
    """Remove temp audio file after transcription."""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        log.warning(f"Could not delete temp file {filepath}: {e}")


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check — Spring Boot polls this on startup."""
    return jsonify({
        "status": "ok",
        "model":  WHISPER_MODEL
    }), 200


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Accepts an audio file from Spring Boot and returns the transcribed text.

    Expected request:
        POST /transcribe
        Content-Type: multipart/form-data
        Body: audio file in field named 'audio'

    Returns:
        {
          "success": true,
          "transcript": "I think the Virtual DOM is a lightweight copy...",
          "language": "en",
          "duration_seconds": 12.4
        }

    Called by Spring Boot after the candidate finishes speaking.
    The returned transcript is then fed into the interview flow
    exactly like a typed answer.
    """
    # Validate file presence
    if "audio" not in request.files:
        return jsonify({"success": False, "error": "No audio file provided. Use field name 'audio'."}), 400

    file = request.files["audio"]

    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename."}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "error": f"Unsupported file type. Allowed: {ALLOWED_EXTENSIONS}"
        }), 400

    # Save to temp file with unique name to avoid conflicts
    ext      = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    try:
        file.save(filepath)
        log.info(f"Audio saved: {filename}")

        # Transcribe using Whisper
        log.info(f"Transcribing {filename} using '{WHISPER_MODEL}' model...")
        result = model.transcribe(
            filepath,
            language="en",        # force English — change if multilingual needed
            fp16=False,           # fp16=False for CPU; set True if using GPU
            verbose=False
        )

        transcript = result["text"].strip()
        language   = result.get("language", "en")
        duration   = round(result.get("duration", 0), 1)

        log.info(f"Transcription complete: \"{transcript[:80]}...\"")

        return jsonify({
            "success":          True,
            "transcript":       transcript,
            "language":         language,
            "duration_seconds": duration
        }), 200

    except Exception as e:
        log.error(f"Transcription failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        cleanup(filepath)   # always delete temp audio file


@app.route("/models", methods=["GET"])
def list_models():
    """Returns available Whisper model sizes and their trade-offs."""
    return jsonify({
        "current_model": WHISPER_MODEL,
        "available_models": [
            {"name": "tiny",   "size": "75MB",   "speed": "fastest", "accuracy": "basic",  "recommended_for": "testing"},
            {"name": "base",   "size": "145MB",  "speed": "fast",    "accuracy": "good",   "recommended_for": "development"},
            {"name": "small",  "size": "465MB",  "speed": "medium",  "accuracy": "better", "recommended_for": "production"},
            {"name": "medium", "size": "1.5GB",  "speed": "slow",    "accuracy": "best",   "recommended_for": "high accuracy needs"},
        ]
    }), 200


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=False)
