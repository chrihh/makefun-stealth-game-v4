// Tidebound Light — the browser loop: fixed-step simulation, event
// sounds, floor changes, pause and restart. With ?shot=<scene> the
// page instead freezes one deterministic scene for screenshots.

import { createWorld, stepWorld, retryLevel, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_GAME_CLEAR, EVENT_GAME_OVER } from './world.js';
import { LEVELS } from './levels.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

if (shotName) {
  const { world, banner } = applyShot(shotName);
  draw(ctx, world, { banner });
} else {
  const input = createInput(canvas);
  const audio = createAudio();
  let world = createWorld(0);
  let paused = false;
  let overlay = 'TIDEBOUND LIGHT — click, then WASD to move';
  let overlayUntil = performance.now() + 2600;
  let last = performance.now();
  let acc = 0;

  const onEvents = (events) => {
    for (const e of events) {
      if (e === 'stone') audio.splash();
      else if (e === 'key') audio.key();
      else if (e === 'salvage') audio.salvage();
      else if (e === 'alarm') audio.alarm();
      else if (e === EVENT_CAUGHT) {
        audio.caught();
        overlay = 'Caught! A cover is spent — the floor restarts';
        overlayUntil = performance.now() + 2200;
        world = retryLevel(world);
      } else if (e === EVENT_LEVEL_CLEAR) {
        audio.clear();
        const carry = { score: world.score, covers: world.covers };
        overlay = `${world.level.name} cleared — climbing on`;
        overlayUntil = performance.now() + 2200;
        world = createWorld(world.levelIndex + 1, carry);
      } else if (e === EVENT_GAME_CLEAR) {
        audio.clear();
        overlay = `The light is yours — final score ${world.score}. Press R to play again`;
        overlayUntil = performance.now() + 60000;
      } else if (e === EVENT_GAME_OVER) {
        overlay = `No covers left — final score ${world.score}. Press R to start over`;
        overlayUntil = performance.now() + 60000;
      }
    }
  };

  const frame = (now) => {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    const polled = input.poll();
    if (polled.anyPressed) audio.unlock();
    if (polled.pausePressed) paused = !paused;
    if (polled.mutePressed) audio.toggleMute();
    if (polled.restart) {
      if (world.over || world.cleared) world = createWorld(0);
      else world = retryLevel(world);
    }
    input.consume();
    if (!paused && !world.over && !world.cleared) {
      acc += dt;
      const step = 1 / 60;
      while (acc >= step) {
        onEvents(stepWorld(world, polled, step));
        acc -= step;
        if (world.over || world.cleared) break;
      }
    }
    const show = now < overlayUntil ? overlay : null;
    draw(ctx, world, { overlay: paused ? 'Paused — P to resume' : show });
  };
  requestAnimationFrame(frame);
}
