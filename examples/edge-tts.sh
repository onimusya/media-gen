#!/bin/bash
# Microsoft Edge TTS examples (FREE - no API key required)
# Uses Microsoft's online TTS service via edge-tts-universal

# Basic English TTS with Emma (multilingual, high quality)
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id en-US-EmmaMultilingualNeural \
  --text "Hello! Welcome to media-gen CLI. This voice is completely free." \
  --output ./outputs/edge-emma.mp3 \
  --json

# Male voice - Andrew
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id en-US-AndrewMultilingualNeural \
  --text "This is Andrew, a male multilingual voice from Microsoft Edge." \
  --output ./outputs/edge-andrew.mp3 \
  --json

# British English - Sonia
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id en-GB-SoniaNeural \
  --text "Good afternoon. This is Sonia with a British accent." \
  --output ./outputs/edge-sonia.mp3 \
  --json

# Chinese - Xiaoxiao
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id zh-CN-XiaoxiaoNeural \
  --text "你好世界！这是微软Edge的免费语音合成。" \
  --output ./outputs/edge-xiaoxiao.mp3 \
  --json

# Japanese - Nanami
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id ja-JP-NanamiNeural \
  --text "こんにちは。これはMicrosoft Edgeの無料音声合成です。" \
  --output ./outputs/edge-nanami.mp3 \
  --json

# Spanish - Elvira
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id es-ES-ElviraNeural \
  --text "Hola mundo. Esta es una demostración de síntesis de voz gratuita." \
  --output ./outputs/edge-elvira.mp3 \
  --json

# French - Denise
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id fr-FR-DeniseNeural \
  --text "Bonjour le monde. Ceci est une voix de synthèse gratuite." \
  --output ./outputs/edge-denise.mp3 \
  --json

# With speed adjustment (1.2 = 20% faster)
node ./skills/media-generation/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id en-US-AriaNeural \
  --text "This is Aria speaking at a slightly faster pace." \
  --speed 1.2 \
  --output ./outputs/edge-aria-fast.mp3 \
  --json

# List available edge-tts voices
node ./skills/media-generation/scripts/media-gen.mjs providers models --provider edge-tts --json
