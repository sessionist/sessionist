#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Sessionist
#
# Regenerates the vendored OTLP decode module in src/receiver/otlp/gen/ from a
# pinned opentelemetry-proto release. Decode-only: no create/verify/convert.
# The generated files are committed; rerun this only to bump the pinned tag.
set -euo pipefail

PROTO_TAG="v1.5.0"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/receiver/otlp/gen"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching opentelemetry-proto $PROTO_TAG ..."
curl -sSL "https://github.com/open-telemetry/opentelemetry-proto/archive/refs/tags/$PROTO_TAG.tar.gz" \
  | tar -xz -C "$TMP" --strip-components=1

mkdir -p "$OUT"

npx pbjs \
  -t static-module -w es6 \
  --no-create --no-verify --no-convert --no-delimited --no-service \
  -p "$TMP" \
  -o "$OUT/otlp.js" \
  "$TMP/opentelemetry/proto/collector/trace/v1/trace_service.proto" \
  "$TMP/opentelemetry/proto/collector/logs/v1/logs_service.proto"

# pbjs emits `import * as $protobuf from "protobufjs/minimal"`. Two problems
# under Node ESM: the extensionless subpath cannot resolve (protobufjs ships
# no exports map), and a namespace import of a CJS module misses properties
# cjs-module-lexer cannot statically detect (e.g. `roots`). A default import
# of the .js file maps to the full module.exports and works everywhere.
sed -i '' 's|import \* as \$protobuf from "protobufjs/minimal"|import $protobuf from "protobufjs/minimal.js"|' "$OUT/otlp.js"

npx pbts -o "$OUT/otlp.d.ts" "$OUT/otlp.js"

cat > "$OUT/README.md" <<EOF
Vendored OTLP decode module, generated from opentelemetry-proto $PROTO_TAG
by scripts/gen-otlp-proto.sh. Do not edit by hand. Exempt from license
header checks (Apache-2.0 upstream; see opentelemetry-proto repository).
EOF

echo "Generated $OUT/otlp.js ($PROTO_TAG)"
