#!/bin/bash
# Deepgram transcription and translation examples
# Requires: DEEPGRAM_API_KEY set in .env

# Transcribe audio with Nova-3 (latest, best accuracy)
node ./skills/media-generation/scripts/media-gen.mjs audio transcribe \
  --provider deepgram \
  --model nova-3 \
  --input ./audio/interview.mp3 \
  --output ./outputs/interview-transcript.json \
  --metadata \
  --json

# Transcribe with language hint (improves accuracy for known language)
node ./skills/media-generation/scripts/media-gen.mjs audio transcribe \
  --provider deepgram \
  --model nova-3 \
  --input ./audio/spanish-podcast.mp3 \
  --language es \
  --output ./outputs/spanish-transcript.json \
  --json

# Transcribe medical audio with specialized model
node ./skills/media-generation/scripts/media-gen.mjs audio transcribe \
  --provider deepgram \
  --model nova-3-medical \
  --input ./audio/doctor-notes.mp3 \
  --output ./outputs/medical-transcript.json \
  --json

# Transcribe using Nova-2 (older, lower cost)
node ./skills/media-generation/scripts/media-gen.mjs audio transcribe \
  --provider deepgram \
  --model nova-2 \
  --input ./audio/meeting.mp3 \
  --output ./outputs/meeting-transcript.json \
  --json

# Translate audio to English
node ./skills/media-generation/scripts/media-gen.mjs audio translate \
  --provider deepgram \
  --model nova-3 \
  --input ./audio/french-interview.mp3 \
  --target-language en \
  --output ./outputs/french-to-english.json \
  --json

# Dry run (validate inputs without calling API)
node ./skills/media-generation/scripts/media-gen.mjs audio transcribe \
  --provider deepgram \
  --model nova-3 \
  --input ./audio/sample.mp3 \
  --output ./outputs/test.json \
  --dry-run \
  --json
