#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/android"
if [ -f "./gradlew" ]; then
  ./gradlew assembleDebug
else
  gradle assembleDebug
fi
echo "✅ APK 已生成至: android/app/build/outputs/apk/debug/app-debug.apk"
