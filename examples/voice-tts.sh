#!/bin/bash
# Text to speech with ElevenLabs
media-gen voice tts \
  --provider elevenlabs \
  --voice-id JBFqnCBsd6RMkjVDRZzb \
  --model eleven_multilingual_v2 \
  --text "Welcome to Fantasy Football World. Get ready for an epic season!" \
  --output ./outputs/welcome.mp3 \
  --json

# Text to speech with OpenAI
media-gen voice tts \
  --provider openai \
  --voice-id alloy \
  --model tts-1-hd \
  --text "This is a high quality voice synthesis example." \
  --output ./outputs/openai-voice.mp3 \
  --json

# Clone a voice (ElevenLabs)
# media-gen voice clone \
#   --provider elevenlabs \
#   --name "My Custom Voice" \
#   --files ./samples/voice1.mp3 ./samples/voice2.mp3 \
#   --json
