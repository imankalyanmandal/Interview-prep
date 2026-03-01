FROM python:3.11-slim

# ffmpeg is required by Whisper to decode audio files
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the Whisper model during build so first request is fast
# Change 'base' to 'small' or 'medium' for better accuracy
ARG WHISPER_MODEL=base
RUN python -c "import whisper; whisper.load_model('${WHISPER_MODEL}')"

COPY . .

RUN mkdir -p audio_temp

ENV WHISPER_MODEL=${WHISPER_MODEL}

EXPOSE 5002

CMD ["python", "app.py"]
