#!/bin/bash
# Transcribe audio with Deepgram
media-gen audio transcribe \
  --provider deepgram \
  --input ./audio/interview.mp3 \
  --output ./outputs/transcript.json \
  --json

# Transcribe with OpenAI Whisper
media-gen audio transcribe \
  --provider openai \
  --model whisper-1 \
  --input ./audio/meeting.mp3 \
  --language en \
  --output ./outputs/meeting-transcript.json \
  --json

# Translate audio to English
media-gen audio translate \
  --provider openai \
  --input ./audio/spanish-interview.mp3 \
  --output ./outputs/translation.json \
  --json
