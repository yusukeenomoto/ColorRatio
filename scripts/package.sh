#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-1.0.2}"
ZXP_SIGN_CMD="${ZXP_SIGN_CMD:-$HOME/CEP-Resources/ZXPSignCMD/4.1.3/macOS/ZXPSignCmd}"
CERTIFICATE="${COLORRATIO_CERTIFICATE:-$ROOT_DIR/signing/ColorRatio.p12}"
PASSWORD_FILE="${COLORRATIO_PASSWORD_FILE:-$ROOT_DIR/signing/.p12-password}"
OUTPUT_DIR="$ROOT_DIR/dist"
OUTPUT_ZXP="$OUTPUT_DIR/ColorRatio-$VERSION.zxp"
STAGE_DIR="$(mktemp -d /tmp/ColorRatio-zxp-stage.XXXXXX)"
TEMP_OUTPUT_DIR="$(mktemp -d /tmp/ColorRatio-zxp-output.XXXXXX)"
TEMP_ZXP="$TEMP_OUTPUT_DIR/ColorRatio-$VERSION.zxp"

cleanup() {
  rm -rf "$STAGE_DIR" "$TEMP_OUTPUT_DIR"
}
trap cleanup EXIT

if [[ ! "$VERSION" =~ '^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$' ]]; then
  print -u2 "Invalid version: $VERSION"
  exit 1
fi

if [[ ! -x "$ZXP_SIGN_CMD" ]]; then
  print -u2 "ZXPSignCmd not found: $ZXP_SIGN_CMD"
  exit 1
fi

if [[ ! -f "$CERTIFICATE" || ! -f "$PASSWORD_FILE" ]]; then
  print -u2 "Signing certificate or password file is missing."
  exit 1
fi

mkdir -p "$STAGE_DIR/CSXS" "$STAGE_DIR/jsx" "$OUTPUT_DIR"
cp "$ROOT_DIR/cep/index.html" "$ROOT_DIR/cep/styles.css" "$ROOT_DIR/cep/main.js" "$STAGE_DIR/"
cp "$ROOT_DIR/cep/CSXS/manifest.xml" "$STAGE_DIR/CSXS/manifest.xml"
cp "$ROOT_DIR/cep/jsx/ColorRatioHost.jsx" "$STAGE_DIR/jsx/ColorRatioHost.jsx"

# Keep the signed package metadata aligned with the requested release version.
sed -i '' \
  -e "s/ExtensionBundleVersion=\"[^\"]*\"/ExtensionBundleVersion=\"$VERSION\"/" \
  -e "s/Extension Id=\"com.eeenoooo.illustrator.colorratio.panel\" Version=\"[^\"]*\"/Extension Id=\"com.eeenoooo.illustrator.colorratio.panel\" Version=\"$VERSION\"/" \
  "$STAGE_DIR/CSXS/manifest.xml"

"$ZXP_SIGN_CMD" -sign "$STAGE_DIR" "$TEMP_ZXP" "$CERTIFICATE" "$(cat "$PASSWORD_FILE")"
"$ZXP_SIGN_CMD" -verify "$TEMP_ZXP"
mv -f "$TEMP_ZXP" "$OUTPUT_ZXP"
shasum -a 256 "$OUTPUT_ZXP"
