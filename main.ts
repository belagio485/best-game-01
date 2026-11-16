// Starlight Relay — entrypoint. Hands the game in: copies game/ and
// screenshots/ from this repository to the output directory, then writes
// dossier.json with the kit's buildDossier, built from the copied files so
// the dossier matches the handed-in game byte for byte. Standard library
// only; runs twice and writes the same bytes both times.

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(repoRoot, "screenshots"), join(outDir, "screenshots"), {
  recursive: true,
});
const dossier = buildDossier(outDir, { text_max_bytes: 163840 });
if (dossier.byteLength > 1572864) {
  throw new Error(
    `dossier.json is ${dossier.byteLength} bytes, over the 1.5 MiB gate limit`,
  );
}
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(
  `Starlight Relay: handed in game/ and screenshots/ with a ${dossier.byteLength}-byte dossier at ${outDir}`,
);
