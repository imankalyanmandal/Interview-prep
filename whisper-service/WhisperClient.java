package com.interview.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Calls the Python Whisper microservice to transcribe candidate audio.
 *
 * Flow:
 *   React (MediaRecorder) → Spring Boot → WhisperClient → Flask/Whisper → transcript text
 *                                                                               │
 *                                                         fed back into interview flow as a typed answer
 */
@Slf4j
@Service
public class WhisperClient {

    private final RestTemplate restTemplate;

    @Value("${whisper.service.url:http://localhost:5002}")
    private String whisperUrl;

    public WhisperClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Sends an audio file to the Whisper service and returns the transcript.
     *
     * @param audioFile  the audio file from the React frontend (wav/webm/mp3)
     * @return           the transcribed text, ready to feed into the interview
     * @throws IOException if file reading fails
     */
    public String transcribe(MultipartFile audioFile) throws IOException {
        log.info("Sending audio to Whisper service: {} ({} bytes)",
                audioFile.getOriginalFilename(), audioFile.getSize());

        // Build multipart request — same structure as a browser form upload
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        // Wrap the audio bytes in a named resource so Flask sees it as field "audio"
        ByteArrayResource audioResource = new ByteArrayResource(audioFile.getBytes()) {
            @Override
            public String getFilename() {
                return audioFile.getOriginalFilename();
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("audio", audioResource);

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    whisperUrl + "/transcribe",
                    request,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<?, ?> responseBody = response.getBody();
                Boolean success = (Boolean) responseBody.get("success");

                if (Boolean.TRUE.equals(success)) {
                    String transcript = (String) responseBody.get("transcript");
                    Double duration   = (Double) responseBody.get("duration_seconds");
                    log.info("Transcription successful ({} seconds): \"{}\"",
                            duration, transcript.substring(0, Math.min(80, transcript.length())));
                    return transcript;
                } else {
                    String error = (String) responseBody.get("error");
                    throw new RuntimeException("Whisper service error: " + error);
                }
            }

            throw new RuntimeException("Unexpected response from Whisper service: " + response.getStatusCode());

        } catch (Exception e) {
            log.error("Failed to transcribe audio: {}", e.getMessage());
            throw new RuntimeException("Transcription failed: " + e.getMessage(), e);
        }
    }

    /**
     * Health check — called on startup to verify Whisper service is reachable.
     */
    public boolean isHealthy() {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                    whisperUrl + "/health", Map.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("Whisper service health check failed: {}", e.getMessage());
            return false;
        }
    }
}
