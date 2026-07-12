#!/bin/zsh
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew est requis : https://brew.sh"
  read -k 1
  exit 1
fi
brew install ffmpeg
echo "FFmpeg est installé. Vous pouvez fermer cette fenêtre."
read -k 1
