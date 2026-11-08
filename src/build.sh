#!/bin/sh
# 使い方: sh src/build.sh
#   index.html  … 娘さん用 (練習・じぶんの記録)          GitHub Pages
#   parent.html … 保護者用 (きろく・フィードバック・改善の記録) GitHub Pages
#   dist/keisan-tani.html … 両方入りの確認用 (claude.ai artifact)
cd "$(dirname "$0")/.."
mkdir -p dist
body() { printf '<div id="app"></div>\n<script>\nconst PAGE = %s;\n' "'$1'"; cat src/logic.js src/changelog.js; printf '</script>\n<script>\n'; cat src/ui.js; printf '</script>\n'; }
page() { # $1 = PAGE, $2 = タイトル
  cat <<H
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="$2">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
H
  cat src/head.html; printf '</head>\n<body>\n'; body "$1"; printf '</body>\n</html>\n'
}
page child '練習帳' > index.html
page trial '練習帳 お試し' | sed 's|<title>計算と単位の練習帳</title>|<title>練習帳 お試し (保護者用)</title>|' > trial.html
page parent '練習帳 保護者' | sed 's|<title>計算と単位の練習帳</title>|<title>練習帳 保護者ページ</title>|' > parent.html
{ cat src/head.html; body all; } > dist/keisan-tani.html
