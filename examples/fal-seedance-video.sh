#!/bin/bash
# Fal.ai Seedance 2.0 video generation examples
# Requires: FAL_KEY set in .env

# Text-to-video with Seedance 2.0
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --provider fal \
  --model bytedance/seedance-2.0/fast/text-to-video \
  --prompt "A graceful ballerina performing a pirouette in a moonlit studio, cinematic lighting, slow motion" \
  --duration 5 \
  --output ./outputs/ballerina.mp4 \
  --wait \
  --json

# Action scene
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --provider fal \
  --model bytedance/seedance-2.0/fast/text-to-video \
  --prompt "A samurai drawing a katana in a bamboo forest, cherry blossoms falling, dramatic camera pan" \
  --duration 8 \
  --output ./outputs/samurai.mp4 \
  --wait \
  --json

# Nature scene
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --provider fal \
  --model bytedance/seedance-2.0/fast/text-to-video \
  --prompt "Aerial drone shot of ocean waves crashing against rocky cliffs at golden hour, 4K cinematic" \
  --output ./outputs/ocean-cliffs.mp4 \
  --wait \
  --json

# Product showcase
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --provider fal \
  --model bytedance/seedance-2.0/fast/text-to-video \
  --prompt "A luxury watch rotating slowly on a black marble surface with soft studio lighting and reflections" \
  --duration 6 \
  --output ./outputs/watch-showcase.mp4 \
  --wait \
  --json

# Without --wait (get job ID, check later)
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --provider fal \
  --model bytedance/seedance-2.0/fast/text-to-video \
  --prompt "A futuristic city skyline with flying cars at sunset, cyberpunk aesthetic" \
  --output ./outputs/cyberpunk-city.mp4 \
  --json
# Returns: { "ok": true, "jobId": "...", "status": "processing" }

# Then check status:
# node ./skills/media-generation/scripts/media-gen.mjs job status --provider fal --job-id "<job-id>" --json

# And download when complete:
# node ./skills/media-generation/scripts/media-gen.mjs job download --provider fal --job-id "<job-id>" --output ./outputs/cyberpunk-city.mp4 --json
