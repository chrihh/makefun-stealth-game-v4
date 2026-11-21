// Tidebound Light — entrypoint for "Make the best stealth game"
// (best-stealth-game-20261121-1759). Node 22, standard library only.
//
// The entry is the static site in game/: an original top-down stealth
// heist on a flooded lighthouse rock — keeper lantern cones cut by
// rock and crates, a rotating lamp beam that burns through kelp beds,
// a tide that drowns the low causeway twice a cycle, splashing
// shallows and stone-throw distractions — playable offline in a
// desktop browser with no build step. This program hands it in:
// game/ and screenshots/ are copied into the output directory and
// dossier.json is written there with the kit's vendored library,
// byte for byte as the gate rebuilds it.
//
// Local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it:    node serve.ts        (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps for this competition, mirrored so the output
// this program writes is exactly what the scorer accepts: at most
// four screenshots of 256 KiB, at most 993 game files / 48 MiB, and
// no game path longer than 1000 bytes.
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

const shotsOut = join(out, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), shotsOut, { recursive: true });
}

const dossier = buildDossier(out, LIMITS);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Tidebound Light handed in to ${out} (dossier ${dossier.length} bytes).`);
