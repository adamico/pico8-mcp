import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SECTION_RE } from "./harness.js";

/**
 * PICO-8 resolves `#include` relative to the directory of the cart it loaded,
 * but sessions run an injected copy from a temp dir. So we inline includes
 * ourselves, resolved against the ORIGINAL cart's directory.
 *
 * Mirrors PICO-8 0.2.7 behaviour:
 * - an include is a whole line `#include <path>` (leading whitespace allowed)
 * - `foo.lua` / `foo.txt` (any non-cart file) is inlined verbatim
 * - `foo.p8` inlines that cart's __lua__ section; `foo.p8:n` only tab n (0-based)
 * - one level only: an `#include` inside an included file is NOT expanded by
 *   PICO-8 (it's a syntax error there), so we leave it untouched too
 * .p8.png includes are not supported (would need the PNG code decompressor).
 */
const INCLUDE_RE = /^\s*#include\s+(.+?)\s*$/;

export function inlineIncludes(cartText: string, cartPath: string): string {
  const dir = dirname(resolve(cartPath));
  const lines = cartText.split(/\r?\n/);
  const luaStart = lines.findIndex((l) => l.trim() === "__lua__");
  if (luaStart < 0) return cartText;
  const out = lines.slice(0, luaStart + 1);
  let inLua = true;
  for (const line of lines.slice(luaStart + 1)) {
    if (inLua && SECTION_RE.test(line.trim())) inLua = false;
    const m = inLua ? INCLUDE_RE.exec(line) : null;
    if (m) out.push(...readInclude(dir, m[1]));
    else out.push(line);
  }
  return out.join("\n");
}

function readInclude(dir: string, spec: string): string[] {
  const tab = /^(.*\.p8):(\d+)$/i.exec(spec);
  const name = tab ? tab[1] : spec;
  const path = resolve(dir, name);
  if (/\.p8\.png$/i.test(name)) {
    throw new Error(`#include ${spec}: .p8.png includes are not supported (use a .p8 or .lua file)`);
  }
  if (!existsSync(path)) throw new Error(`could not #include file: ${spec} (looked for ${path})`);
  const text = readFileSync(path, "utf8");
  if (!/\.p8$/i.test(name)) return text.split(/\r?\n/);

  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "__lua__");
  if (start < 0) throw new Error(`#include ${spec}: ${path} has no __lua__ section`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  const code = lines.slice(start + 1, end);
  if (!tab) return code;
  // tabs are separated by "-->8" lines
  const tabs: string[][] = [[]];
  for (const l of code) {
    if (l.startsWith("-->8")) tabs.push([]);
    else tabs[tabs.length - 1].push(l);
  }
  const n = parseInt(tab[2], 10);
  if (n >= tabs.length) throw new Error(`#include ${spec}: ${path} has only ${tabs.length} tab(s)`);
  return tabs[n];
}
