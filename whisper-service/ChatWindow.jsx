import { useState } from "react";
import VoiceRecorder from "./VoiceRecorder";

/**
 * ChatWindow — Interview conversation UI
 *
 * Shows how VoiceRecorder plugs in alongside the text input.
 * Candidate can either type OR speak their answer — both work the same way.
 * The transcript from VoiceRecorder is just pasted into the text field.
 */
export default function ChatWindow({ onSendAnswer, isAiTurn }) {
  const [answer, setAnswer] = useState("");

  // Called by VoiceRecorder when Whisper returns the transcript
  // Simply populates the text field — candidate can review/edit before sending
  const handleTranscript = (transcript) => {
    setAnswer(transcript);
  };

  const handleSend = () => {
    if (!answer.trim()) return;
    onSendAnswer(answer);
    setAnswer("");
  };

  return (
    <div style={{ padding: "16px" }}>

      {/* Answer input */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer or use the mic below..."
        disabled={isAiTurn}
        rows={4}
        style={{ width: "100%", padding: "10px", borderRadius: "8px",
                 border: "1px solid #ccc", fontSize: "14px", resize: "vertical" }}
      />

      {/* Voice + Send row */}
      <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginTop: "8px" }}>

        {/* Voice recorder — transcript auto-fills the textarea */}
        <VoiceRecorder
          onTranscript={handleTranscript}
          disabled={isAiTurn}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!answer.trim() || isAiTurn}
          style={{ padding: "10px 24px", background: "#1A5276", color: "#fff",
                   border: "none", borderRadius: "8px", fontWeight: "600",
                   cursor: answer.trim() && !isAiTurn ? "pointer" : "not-allowed" }}
        >
          Send Answer →
        </button>
      </div>

    </div>
  );
}
