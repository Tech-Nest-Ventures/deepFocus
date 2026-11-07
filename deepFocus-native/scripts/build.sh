#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/verify_direction.py
python3 scripts/generate_project.py
xcodebuild -project DeepFocusNative.xcodeproj -scheme DeepFocusNative \
  -configuration Release -derivedDataPath build build
codesign --verify --deep --strict "build/Build/Products/Release/Deep Focus Native.app"
du -sh "build/Build/Products/Release/Deep Focus Native.app"
ditto -c -k --sequesterRsrc --keepParent "build/Build/Products/Release/Deep Focus Native.app" "build/DeepFocusNative.zip"
