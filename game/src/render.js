// Tidebound Light — canvas renderer. Draws the rock, the water and
// the turning light exactly as the simulation reports them: lantern
// cones clipped by real line-of-sight, the lamp beam as a bright
// wedge the walls can shadow, tide gauge and detection on the HUD.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H, KEEPER_RANGE, CONE_HALF, BEAM_RANGE } from './config.js';
import { tileAt, tideIsHigh, tidePhaseAt, beamAngleAt, hasLineOfSight } from './world.js';

const PALETTE = {
  rock: '#2c3440', rockEdge: '#1d232c',
  floor: '#4a4a42', floorAlt: '#515146',
  shallow: '#275d75', deep: '#173d55',
  causeway: '#6b6a58', causewayWet: '#2a5a74',
  kelp: '#22402a', crate: '#7a5c33', crateEdge: '#5d4525',
  ink: '#0a1218',
};

function conePath(ctx, level, x, y, face, range) {
  // A fan of rays, each stopped at the first sight-blocking tile.
  const rays = 26;
  ctx.beginPath();
  ctx.moveTo(x * TILE, y * TILE);
  for (let i = 0; i <= rays; i++) {
    const a = face - CONE_HALF + (2 * CONE_HALF * i) / rays;
    let d = range;
    for (let step = 0.2; step < range; step += 0.2) {
      const px = x + Math.cos(a) * step, py = y + Math.sin(a) * step;
      const ch = tileAt(level, Math.floor(px), Math.floor(py));
      if (ch === '#' || ch === 'B') { d = step; break; }
    }
    ctx.lineTo((x + Math.cos(a) * d) * TILE, (y + Math.sin(a) * d) * TILE);
  }
  ctx.closePath();
}

export function draw(ctx, w, opts = {}) {
  const level = w.level;
  const high = tideIsHigh(w.time);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // tiles
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const ch = tileAt(level, x, y);
    const px = x * TILE, py = y * TILE;
    if (ch === '#') {
      ctx.fillStyle = PALETTE.rock;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = PALETTE.rockEdge;
      ctx.fillRect(px, py + TILE - 5, TILE, 5);
    } else if (ch === 'B') {
      ctx.fillStyle = PALETTE.floor;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
    } else if (ch === '~' || ch === '=') {
      const submerged = ch === '=' && high;
      const shimmer = Math.sin(w.time * 1.6 + x * 1.3 + y * 0.7) * 0.5 + 0.5;
      ctx.fillStyle = ch === '~' ? PALETTE.shallow : (submerged ? PALETTE.deep : PALETTE.causeway);
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = `rgba(180,225,245,${0.05 + shimmer * 0.07})`;
      ctx.fillRect(px, py + ((x * 7 + y * 13) % 22), TILE, 3);
      if (ch === '=' && !submerged) {
        ctx.fillStyle = 'rgba(20,26,20,0.25)';
        ctx.fillRect(px, py + TILE - 6, TILE, 3);
        // the causeway frets white as the flood approaches, so a
        // runner mid-crossing can read how long the way stays open
        const phase = tidePhaseAt(w.time);
        if (phase > 0.26 && phase < 0.38) {
          const pulse = 0.35 + 0.3 * Math.sin(w.time * 7 + x);
          ctx.fillStyle = `rgba(235,250,255,${pulse})`;
          ctx.fillRect(px, py + 3, TILE, 3);
        }
      }
    } else {
      ctx.fillStyle = (x + y) % 2 ? PALETTE.floor : PALETTE.floorAlt;
      ctx.fillRect(px, py, TILE, TILE);
      if (ch === 's') {
        ctx.fillStyle = PALETTE.kelp;
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = 'rgba(120,200,130,0.35)';
        for (let k = 0; k < 4; k++) ctx.fillRect(px + 6 + k * 9, py + 8 + ((x + k * 3) % 18), 3, 12);
      }
    }
  }

  // exit: a rowboat on L1/L2 shores, the lamp-room stair on L3
  const ex = w.exit.x * TILE, ey = w.exit.y * TILE;
  ctx.fillStyle = w.key.taken ? '#39d353' : '#5a5148';
  ctx.fillRect(ex - 15, ey - 15, 30, 30);
  ctx.fillStyle = '#0a1218';
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex, ey + 5);

  // lens key and salvage
  if (!w.key.taken) {
    const kx = w.key.x * TILE, ky = w.key.y * TILE;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.arc(kx, ky, 9 + Math.sin(w.time * 3) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5a10';
    ctx.fillRect(kx + 6, ky - 2, 10, 4);
  }
  ctx.fillStyle = '#d8b25a';
  for (const s of w.salvage) {
    if (s.taken) continue;
    ctx.beginPath(); ctx.arc(s.x * TILE, s.y * TILE, 5, 0, Math.PI * 2); ctx.fill();
  }

  // splashes from thrown stones
  for (const s of w.splashes) {
    ctx.strokeStyle = `rgba(200,235,250,${1 - s.t / 1.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x * TILE, s.y * TILE, 6 + s.t * 26, 0, Math.PI * 2); ctx.stroke();
  }

  // the great lamp beam, under the cones but over the ground
  if (level.lamp) {
    const a = beamAngleAt(w);
    const grad = ctx.createRadialGradient(level.lamp.x * TILE, level.lamp.y * TILE, 10, level.lamp.x * TILE, level.lamp.y * TILE, BEAM_RANGE * TILE);
    grad.addColorStop(0, 'rgba(255,240,180,0.34)');
    grad.addColorStop(1, 'rgba(255,240,180,0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(level.lamp.x * TILE, level.lamp.y * TILE);
    ctx.arc(level.lamp.x * TILE, level.lamp.y * TILE, BEAM_RANGE * TILE, a - 0.17, a + 0.17);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(level.lamp.x * TILE, level.lamp.y * TILE, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6d1f'; ctx.lineWidth = 3; ctx.stroke();
  }

  // keeper lantern cones
  for (const g of w.guards) {
    const color = g.state === 'chase' ? 'rgba(255,70,50,0.34)'
      : g.state === 'patrol' ? 'rgba(255,205,90,0.26)' : 'rgba(255,150,50,0.32)';
    ctx.fillStyle = color;
    conePath(ctx, level, g.x, g.y, g.face, KEEPER_RANGE);
    ctx.fill();
  }

  // keepers
  for (const g of w.guards) {
    const gx = g.x * TILE, gy = g.y * TILE;
    ctx.fillStyle = g.state === 'chase' ? '#c0392b' : '#31435c';
    ctx.beginPath(); ctx.arc(gx, gy, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5d76e';
    ctx.beginPath(); ctx.arc(gx + Math.cos(g.face) * 8, gy + Math.sin(g.face) * 8, 4, 0, Math.PI * 2); ctx.fill();
    if (g.state === 'suspicious' || g.state === 'distracted') {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 17px system-ui';
      ctx.fillText('?', gx, gy - 19);
    }
    if (g.state === 'chase') {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 17px system-ui';
      ctx.fillText('!', gx, gy - 19);
    }
  }

  // the tide-runner
  const p = w.player;
  const px = p.x * TILE, py = p.y * TILE;
  ctx.fillStyle = w.litByBeam ? '#ffe9a8' : '#20313d';
  ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9fd8e8'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#e8f4f8';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(p.face) * 15, py + Math.sin(p.face) * 15);
  ctx.stroke();
  if (p.wading) {
    ctx.strokeStyle = 'rgba(190,230,245,0.7)';
    ctx.beginPath(); ctx.arc(px, py, 16 + Math.sin(w.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  drawHud(ctx, w);
  if (w.alarmFlash > 0) {
    ctx.fillStyle = `rgba(200,40,25,${w.alarmFlash * 0.16})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (opts.banner) {
    ctx.fillStyle = 'rgba(5,12,16,0.72)';
    ctx.fillRect(0, VIEW_H / 2 - 92, VIEW_W, 184);
    ctx.fillStyle = '#f2e3b3';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.banner.title, VIEW_W / 2, VIEW_H / 2 - 18);
    ctx.fillStyle = '#cfe3ea';
    ctx.font = '19px system-ui';
    opts.banner.lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 24 + i * 28));
  }
  if (opts.overlay) {
    ctx.fillStyle = 'rgba(5,12,16,0.66)';
    ctx.fillRect(0, VIEW_H / 2 - 60, VIEW_W, 120);
    ctx.fillStyle = '#f2e3b3';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.overlay, VIEW_W / 2, VIEW_H / 2 + 14);
  }
}

function drawHud(ctx, w) {
  ctx.fillStyle = 'rgba(6,12,16,0.82)';
  ctx.fillRect(0, 0, VIEW_W, 40);
  ctx.fillStyle = '#f2e3b3';
  ctx.font = 'bold 17px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(w.level.name, 14, 26);
  ctx.fillStyle = '#9db4bd';
  ctx.font = '14px system-ui';
  ctx.fillText(w.level.sub, 14 + ctx.measureText(w.level.name).width + 24, 26);
  ctx.font = 'bold 17px system-ui';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8f4f8';
  ctx.fillText(`Score ${w.score}`, VIEW_W - 14, 26);

  // covers (spare oilskins), stones, key — set right of centre so a
  // long floor name can never run into them
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd8e8';
  ctx.fillText(`Covers ${Math.max(0, w.covers + 1)}`, 500, 26);
  ctx.fillStyle = '#d8b25a';
  ctx.fillText(`Stones ${w.stones}`, 612, 26);
  ctx.fillStyle = w.key.taken ? '#39d353' : '#8a8378';
  ctx.fillText(w.key.taken ? 'Lens key ✓' : 'Lens key —', 716, 26);

  // tide gauge: a phase bar; the red stretch is high water
  const tx = 830, tw = 150;
  ctx.fillStyle = '#23404f';
  ctx.fillRect(tx, 14, tw, 12);
  ctx.fillStyle = '#a33327';
  ctx.fillRect(tx + tw * 0.38, 14, tw * (0.66 - 0.38), 12);
  const phase = tidePhaseAt(w.time);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(tx + tw * phase - 2, 11, 4, 18);
  ctx.fillStyle = '#cfe3ea';
  ctx.font = '13px system-ui';
  ctx.fillText(tideIsHigh(w.time) ? 'HIGH TIDE' : 'tide out', tx + tw + 10, 26);

  // detection meter along the bottom
  if (w.detection > 0.01) {
    ctx.fillStyle = 'rgba(6,12,16,0.7)';
    ctx.fillRect(VIEW_W / 2 - 160, VIEW_H - 26, 320, 12);
    ctx.fillStyle = w.detection > 0.7 ? '#ff5040' : '#ffb347';
    ctx.fillRect(VIEW_W / 2 - 158, VIEW_H - 24, 316 * w.detection, 8);
  }
}
