// Tidebound Light — deterministic screenshot scenes. Each scene
// builds a real world, freezes it at a composed mid-game moment,
// and lets the renderer draw exactly what a player would see.

import { createWorld } from './world.js';

export function applyShot(name) {
  if (name === 'beam') {
    const w = createWorld(1);
    w.time = 8.0;
    w.player.x = 23.5; w.player.y = 6.5; w.player.face = -0.4;
    w.guards[0].x = 8.5; w.guards[0].y = 4.5; w.guards[0].face = 0.7;
    w.guards[1].x = 27.5; w.guards[1].y = 11.5; w.guards[1].face = 2.8;
    w.detection = 0.3;
    return { world: w, banner: null };
  }
  if (name === 'tide') {
    const w = createWorld(0);
    w.time = 4.4;
    w.player.x = 11.5; w.player.y = 6.5; w.player.face = 0.2;
    w.guards[0].x = 16.5; w.guards[0].y = 3.5; w.guards[0].face = 2.4;
    w.guards[1].x = 25.5; w.guards[1].y = 9.5; w.guards[1].face = -1.2;
    w.detection = 0.42;
    return { world: w, banner: null };
  }
  if (name === 'lamp') {
    const w = createWorld(2);
    w.time = 5.2;
    w.player.x = 20.5; w.player.y = 13.5; w.player.face = 0.4;
    w.guards[0].x = 9.5; w.guards[0].y = 5.5; w.guards[0].face = 0.9;
    w.guards[2].x = 24.5; w.guards[2].y = 15.5; w.guards[2].face = 3.0;
    w.key.taken = true;
    w.score = 825;
    w.detection = 0.25;
    return { world: w, banner: null };
  }
  // title: the Causeway at rest, under the game's name
  const w = createWorld(0);
  w.time = 2.6;
  w.player.x = 3.5; w.player.y = 15.5; w.player.face = 0.2;
  w.guards[0].x = 13.5; w.guards[0].y = 4.5; w.guards[0].face = 0.8;
  return {
    world: w,
    banner: {
      title: 'TIDEBOUND LIGHT',
      lines: [
        'A stealth heist on a drowned lighthouse rock — steal the brass lens key, reach the EXIT unseen.',
        'WASD move · Shift sneak · Click throws a stone · Mind the tide, the beam and the splashing shallows.',
      ],
    },
  };
}
