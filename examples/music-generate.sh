#!/bin/bash
set -eu

# Run from the repository root. Append --dry-run to validate the options.
case "${1:-}" in
  google)
    shift
    # Google uses duration and instrumental settings as prompt guidance.
    node ./skills/media-generation/scripts/media-gen.mjs music generate \
      --provider google \
      --model lyria-3.5 \
      --prompt "A chamber miniature with felt piano, warm cello, and sparse brushed percussion. Develop a quiet four-note motif and end on a gentle resolving chord." \
      --duration 30 \
      --instrumental \
      --output ./outputs/lyria-music.mp3 \
      --json "$@"
    ;;
  elevenlabs)
    shift
    # ElevenLabs receives track length and instrumental mode as API parameters.
    node ./skills/media-generation/scripts/media-gen.mjs music generate \
      --provider elevenlabs \
      --model music_v2_5 \
      --prompt "An acoustic bossa nova miniature with nylon-string guitar, upright bass, and soft brushes. End with a gentle resolved chord." \
      --duration 10 \
      --instrumental \
      --output ./outputs/elevenlabs-music.mp3 \
      --json "$@"
    ;;
  *)
    echo "Usage: bash examples/music-generate.sh {google|elevenlabs} [--dry-run]" >&2
    exit 2
    ;;
esac
