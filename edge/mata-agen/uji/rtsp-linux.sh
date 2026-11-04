#!/bin/bash
# Uji RTSP biner Linux (docs/edge/PASANG.md bagian Uji): mediamtx (MIT) + ffmpeg memutar video korpus Mata sebagai kamera
# rtsp://127.0.0.1:8554/meja, lalu menjalankan agen dengan env NADI_* yang diberikan pemanggil (scripts/uji-agen-mata.ts).
set -u
AKAR=$(cd "$(dirname "$0")/../../.." && pwd)
mkdir -p ~/mtx && cd ~/mtx
[ -x mediamtx ] || { curl -s -L -o m.tgz https://github.com/bluenviron/mediamtx/releases/download/v1.21.3/mediamtx_v1.21.3_linux_amd64.tar.gz && tar xzf m.tgz; }
./mediamtx > mtx.log 2>&1 &
MTX=$!
sleep 2
ffmpeg -loglevel error -re -stream_loop -1 -i "$AKAR/fixtures/korpus/mata/video.webm" -c:v libx264 -preset veryfast -tune zerolatency -g 4 -f rtsp rtsp://127.0.0.1:8554/meja > pub.log 2>&1 &
PUB=$!
sleep 4
timeout "${DURASI:-65}" "$AGEN_LINUX" jalan
kill $PUB $MTX 2>/dev/null
