// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Self-contained .session.html replay: the player bundle inlined plus the session as a gzip+base64
// blob. Must make zero network requests from file://; the embedded .session.jsonl extracts byte-equal.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ExportInput, Exporter } from "./types.js";
import { sessionFile } from "./session-file.js";

interface PlayerBundle {
  js: string;
  css: string;
  faviconDataUri: string;
}

let cachedBundle: PlayerBundle | null = null;

/** Built player assets: dist/player next to the bundled CLI, or player/dist
 *  in a dev checkout — same resolution the serve command uses. */
function loadPlayerBundle(): PlayerBundle {
  if (cachedBundle !== null) return cachedBundle;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "player"), join(here, "..", "..", "player", "dist")];
  for (const dir of candidates) {
    try {
      const assetsDir = join(dir, "assets");
      const assets = readdirSync(assetsDir);
      const jsFile = assets.find((f) => f.endsWith(".js"));
      const cssFile = assets.find((f) => f.endsWith(".css"));
      if (jsFile === undefined || cssFile === undefined) continue;
      const mark = readFileSync(join(dir, "sessionist-mark.svg"));
      cachedBundle = {
        js: readFileSync(join(assetsDir, jsFile), "utf8"),
        css: readFileSync(join(assetsDir, cssFile), "utf8"),
        faviconDataUri: `data:image/svg+xml;base64,${mark.toString("base64")}`,
      };
      return cachedBundle;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    "player assets not found — build the player first (npm run build) to use --html export",
  );
}

/** Inline-safe: "</script" inside the bundle only occurs within JS strings,
 *  where an escaped slash is equivalent. Same treatment Vite applies. */
function inlineSafe(code: string, tag: string): string {
  return code.split(`</${tag}`).join(`<\\/${tag}`);
}

export const sessionHtml: Exporter = {
  name: "session-html",
  extension: "session.html",
  export(input: ExportInput): string {
    const bundle = loadPlayerBundle();
    const jsonl = sessionFile.export(input); // the contract, verbatim
    const blob = gzipSync(Buffer.from(jsonl, "utf8")).toString("base64");
    const title = `sessionist replay — ${input.session.service ?? input.session.id.slice(0, 8)}`;

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(title)}</title>
    <link rel="icon" type="image/svg+xml" href="${bundle.faviconDataUri}" />
    <style>${inlineSafe(bundle.css, "style")}</style>
  </head>
  <body>
    <div id="root"></div>
    <script id="sessionist-session" type="application/gzip+base64">${blob}</script>
    <script>
      // Boot: decompress the embedded session file and hand the raw JSONL to
      // the player, which detects this global and serves everything from it.
      window.__SESSIONIST_EMBEDDED_JSONL__ = (async function () {
        var el = document.getElementById("sessionist-session");
        var bin = atob(el.textContent.trim());
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Response(stream).text();
      })();
    </script>
    <script type="module">${inlineSafe(bundle.js, "script")}</script>
  </body>
</html>
`;
  },
};

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Extract the embedded .session.jsonl from a .session.html — byte-equal to
 *  what was exported. The import path for HTML replays. */
export function extractSessionFromHtml(html: string): string {
  const match = /<script id="sessionist-session"[^>]*>([^<]*)<\/script>/.exec(html);
  if (match === null) {
    throw new Error("no embedded session found — not a sessionist .session.html file");
  }
  return gunzipSync(Buffer.from(match[1]!.trim(), "base64")).toString("utf8");
}
