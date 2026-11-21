// Tidebound Light — tuning constants for the lighthouse stealth sim.
// Every number the simulation and the renderer share lives here, so
// the balance of tide, beam and lantern can be revised in one place.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = TILE * COLS;
export const VIEW_H = TILE * ROWS;

export const PLAYER_SPEED = 3.3;        // tiles per second, walking
export const PLAYER_SNEAK_SPEED = 1.8;  // tiles per second, sneaking
export const PLAYER_WADE_SPEED = 2.2;   // tiles per second, in the shallows
export const PLAYER_RADIUS = 0.32;

export const KEEPER_PATROL_SPEED = 1.6;
export const KEEPER_PROWL_SPEED = 2.1;  // suspicious / distracted
export const KEEPER_CHASE_SPEED = 2.85;

export const KEEPER_RANGE = 5.4;        // lantern cone length, tiles
export const CONE_HALF = 0.45;          // lantern cone half-angle, radians

export const DETECT_FILL = 1.2;         // seconds in plain sight to fill
export const DETECT_BEAM = 2.6;         // extra fill rate inside the lamp beam
export const DETECT_DRAIN = 0.34;       // per second while unseen
export const START_COVERS = 3;
export const STONES_PER_LEVEL = 5;

export const TIDE_PERIOD = 36;          // seconds for a full tide cycle
export const TIDE_HIGH_FROM = 0.38;     // phase where the causeway drowns
export const TIDE_HIGH_TO = 0.66;

export const BEAM_SPEED = 0.32;         // lamp beam rotation, radians/second
export const BEAM_HALF = 0.17;          // beam half-angle, radians
export const BEAM_RANGE = 15;           // beam reach, tiles

export const NOISE_WALK = 2.0;          // hearing radius, dry stone
export const NOISE_SPLASH = 4.4;        // wading splashes much further
export const NOISE_SNEAK = 0.8;
export const NOISE_SNEAK_SPLASH = 1.6;
export const STONE_HEARING = 7.5;       // keepers this close hear a splash

export const SCORE_KEY = 150;
export const SCORE_SALVAGE = 75;
export const SCORE_CLEAR = 300;
export const SCORE_GHOST = 200;
export const SCORE_STONE_LEFT = 20;
