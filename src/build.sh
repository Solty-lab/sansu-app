#!/bin/sh
# 使い方: sh src/build.sh  → index.html (GitHub Pages 用) と dist/keisan-tani.html (確認用 artifact) を作る
cd "$(dirname "$0")/.."
mkdir -p dist
{ printf '<div id="app"></div>\n<script>\n'; cat src/logic.js; printf '</script>\n<script>\n'; cat src/ui.js; printf '</script>\n'; } > dist/body.html
cat src/head.html dist/body.html > dist/keisan-tani.html
{ cat <<'H'
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="練習帳">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
H
cat src/head.html; printf '</head>\n<body>\n'; cat dist/body.html; printf '</body>\n</html>\n'; } > index.html
rm dist/body.html
