#!/bin/bash
# SVG → PNG (×2) через headless Chrome, со шрифтами IBM Plex из Google Fonts
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd "$(dirname "$0")/uml"
for f in *.svg; do
  n="${f%.svg}"
  read W H < <(python3 -c "import json;m=json.load(open('meta.json'))['$n'];print(m['W'],m['H'])")
  cat > "$n.html" <<HTML
<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=block">
<style>html,body{margin:0;padding:0;background:#fff}svg{display:block;width:${W}px;height:${H}px}</style></head>
<body>$(cat "$f")</body></html>
HTML
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=${W},${H} --virtual-time-budget=4000 --screenshot="$PWD/$n.png" "file://$PWD/$n.html" >/dev/null 2>&1
done
ls -la *.png
