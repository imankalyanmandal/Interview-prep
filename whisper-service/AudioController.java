package com.interview.controller;

import com.interview.dto.TranscriptResponseDTO;
import com.interview.service.WhisperClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Receives audio recordings from the React frontend,
 * transcribes them via Whisper, and returns the text.
 *
 * The React frontend uses the browser's MediaRecorder API to record
 * the candidate's spoken answer, then POSTs the audio blob here.
 * The returned transcript is treated exactly like a typed answer.
 */
@Slf4j
@RestController
@RequestMapping("/api/audio")
@RequiredArgsConstructor
public class AudioController {

    private final WhisperClient whisperClient;

    /**
     * POST /api/audio/transcribe
     *
     * React sends audio blob → Spring Boot → Whisper → transcript text
     *
     * Request:  multipart/form-data with field "audio" containing the audio file
     * Response: { "transcript": "I think the Virtual DOM is a...", "success": true }
     */
    @PostMapping("/transcribe")
    public ResponseEntity<TranscriptResponseDTO> transcribe(
            @RequestParam("audio") MultipartFile audioFile
    ) {
        log.info("Audio received: {} bytes, type: {}",
                audioFile.getSize(), audioFile.getContentType());

        if (audioFile.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new TranscriptResponseDTO(false, null, "Audio file is empty"));
        }

        try {
            String transcript = whisperClient.transcribe(audioFile);
            return ResponseEntity.ok(new TranscriptResponseDTO(true, transcript, null));

        } catch (Exception e) {
            log.error("Transcription failed: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(new TranscriptResponseDTO(false, null, e.getMessage()));
        }
    }
}
