// Party Arcade — assembles the 10 minigames into one "🎉 Party" hub tab.
// Exported `partyMode` is a standard game mount used by js/app.js.
import { makePartyHub } from './party-core.js';
import { bumperBalls } from './bumper-balls.js';
import { hotRopeJump } from './hot-rope-jump.js';
import { pedalPower } from './pedal-power.js';
import { memoryMatch } from './memory-match.js';
import { shellShuffle } from './shell-shuffle.js';
import { whackPlant } from './whack-a-plant.js';
import { coinCascade } from './coin-cascade.js';
import { hexagonHeat } from './hexagon-heat.js';
import { bobOmbBlast } from './bob-omb-blast.js';
import { traceRace } from './trace-race.js';

// Order chosen to vary the "feel" as you scan the board.
export const PARTY_GAMES = [
  bumperBalls,   // physics brawl
  hotRopeJump,   // timing
  pedalPower,    // button-mash race
  memoryMatch,   // memory
  shellShuffle,  // observation
  whackPlant,    // reflex
  coinCascade,   // catching
  hexagonHeat,   // colour reaction
  bobOmbBlast,   // push-your-luck
  traceRace,     // precision
];

export const partyMode = makePartyHub(PARTY_GAMES);
