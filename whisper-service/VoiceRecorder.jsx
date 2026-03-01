import { useState, useRef } from "react";
import axios from "axios";

/**
 * VoiceRecorder Component
 *
 * Uses the browser's MediaRecorder API to record the candidate's spoken answer.
 * On stop, sends the audio blob to Spring Boot /api/audio/transcribe.
 * The returned transcript is passed up to the parent ChatWindow via onTranscript().
 *
 * Props:
 *   onTranscript(text) — called when transcription is ready, with the text
 *   disabled           — prevents recording during AI turn or loading
 */
export default function VoiceRecorder({ onTranscript, disabled }) {
  const [recording, setRecording]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [duration, setDuration]     = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);

  // ── Start Recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // webm is well supported across browsers and Whisper handles it fine
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());  // release mic
        await sendAudio();
      };

      mediaRecorder.start(250);   // collect chunks every 250ms
      setRecording(true);

      // duration counter
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    } catch (err) {
      setError("Microphone access denied. Please allow mic permissions.");
    }
  };

  // ── Stop Recording ──────────────────────────────────────────────────────────
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // ── Send to Spring Boot ─────────────────────────────────────────────────────
  const sendAudio = async () => {
    setLoading(true);
    setError(null);

    try {
      const blob     = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "answer.webm");

      const response = await axios.post("/api/audio/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        onTranscript(response.data.transcript);  // pass text up to ChatWindow
      } else {
        setError(response.data.error || "Transcription failed.");
      }
    } catch (err) {
      setError("Could not reach transcription service. Please type your answer.");
    } finally {
      setLoading(false);
      setDuration(0);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>

      {/* Record / Stop Button */}
      {!recording ? (
        <button
          onClick={startRecording}
          disabled={disabled || loading}
          style={{ ...styles.btn, ...(disabled || loading ? styles.btnDisabled : styles.btnIdle) }}
          title="Click to speak your answer"
        >
          🎤 {loading ? "Transcribing..." : "Speak Answer"}
        </button>
      ) : (
        <button
          onClick={stopRecording}
          style={{ ...styles.btn, ...styles.btnRecording }}
          title="Click to stop recording"
        >
          ⏹ Stop  ({duration}s)
        </button>
      )}

      {/* Recording pulse indicator */}
      {recording && (
        <span style={styles.pulse}>● Recording...</span>
      )}

      {/* Transcribing spinner */}
      {loading && (
        <span style={styles.loading}>⏳ Transcribing your answer...</span>
      )}

      {/* Error */}
      {error && (
        <span style={styles.error}>{error}</span>
      )}
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "8px"
  },
  btn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    transition: "background 0.2s"
  },
  btnIdle: {
    background: "#2E5C8A",
    color: "#fff"
  },
  btnRecording: {
    background: "#C0392B",
    color: "#fff",
    animation: "pulse 1s infinite"
  },
  btnDisabled: {
    background: "#ccc",
    color: "#888",
    cursor: "not-allowed"
  },
  pulse: {
    color: "#C0392B",
    fontWeight: "600",
    fontSize: "13px"
  },
  loading: {
    color: "#666",
    fontSize: "13px",
    fontStyle: "italic"
  },
  error: {
    color: "#C0392B",
    fontSize: "13px"
  }
};
