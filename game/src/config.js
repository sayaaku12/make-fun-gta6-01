// SOLMAR BAY — tuning constants. One place for every number the world uses.
export const CFG = {
  tile: 64,
  cityBlocks: 11,          // blocks per side; city is blocks*tile wide
  roadW: 26,
  viewW: 1280, viewH: 720,
  playerRadius: 13,
  walkSpeed: 170, sprintSpeed: 265,
  carAccel: 420, carBrake: 700, carMaxSpeed: 520, carReverseMax: 180,
  carTurn: 2.6, carGrip: 3.2,
  pistolDamage: 34, fistDamage: 12, pistolRange: 340, pistolAmmoStart: 24,
  copSpeed: 205, copRamDamage: 14,
  wantedDecay: 0.08,      // stars per second while unseen
  saveKey: 'solmar-bay-save-v1',
  seedDefault: 1,
};
// District names shown on the minimap + HUD (all original).
export const DISTRICTS = [
  { name: 'Old Pier', x: 0, y: 3, w: 3, h: 5, color: '#2E7F8F' },
  { name: 'Marina', x: 3, y: 0, w: 3, h: 4, color: '#3A9AB0' },
  { name: 'Boardwalk', x: 0, y: 8, w: 3, h: 3, color: '#E8C98A' },
  { name: 'Downtown', x: 6, y: 3, w: 5, h: 5, color: '#F2A541' },
  { name: 'Coral Heights', x: 6, y: 0, w: 5, h: 3, color: '#E4572E' },
  { name: 'Palm Court', x: 3, y: 4, w: 3, h: 4, color: '#7FB069' },
  { name: 'Harbor Yard', x: 3, y: 8, w: 3, h: 3, color: '#8A7B6B' },
  { name: 'Sunset Row', x: 6, y: 8, w: 5, h: 3, color: '#D97B4F' },
];
// Original car models (names invented for this game).
export const CAR_MODELS = [
  { name: 'Sunbeam', color: '#E4572E', len: 46, wid: 22, top: 240 },
  { name: 'Pelican', color: '#2E7F8F', len: 50, wid: 23, top: 210 },
  { name: 'Dune Runner', color: '#F2A541', len: 48, wid: 24, top: 200 },
  { name: 'Coral Coupe', color: '#C44569', len: 44, wid: 21, top: 260 },
  { name: 'Harbor Van', color: '#7FB069', len: 56, wid: 25, top: 170 },
  { name: 'Marina GT', color: '#3A3A5C', len: 47, wid: 22, top: 280 },
];
// Six-mission story chain. Ria "Vex" Marlowe, fixer Del Okafor.
export const MISSIONS = [
  { id: 1, title: 'First Light', giver: 'Del Okafor',
    brief: 'Del needs a courier. Drive the Sunbeam to the Old Pier drop before the harbor patrol clocks you.',
    reward: 250, kind: 'driveTo', target: 'pier' },
  { id: 2, title: 'Hot Wheels', giver: 'Del Okafor',
    brief: 'The buyer wants a Marina GT, not a receipt. Borrow one from Coral Heights — fast — and bring it to the Harbor Yard.',
    reward: 400, kind: 'stealDeliver', target: 'yard' },
  { id: 3, title: 'Rush Hour', giver: 'Mara Voss',
    brief: 'Mara has a parcel and a deadline. Cross town to Sunset Row in 75 seconds. Traffic will not wait for you.',
    reward: 500, kind: 'timedDrive', target: 'sunset', time: 75 },
  { id: 4, title: 'Turf War', giver: 'Del Okafor',
    brief: 'The Dock Rats moved on Palm Court. Clear their crew out of the park — fists or pistol, your call.',
    reward: 650, kind: 'clear', target: 'park' },
  { id: 5, title: 'The Setup', giver: 'Mara Voss',
    brief: 'Lift the harbor manifest from the Marina office, then lose the cruisers. Grab the package and run.',
    reward: 900, kind: 'collect', target: 'marina' },
  { id: 6, title: 'Bay Run', giver: 'Del Okafor',
    brief: 'One last run: the whole bay is hot. Get the case to the Old Pier, survive the heat, and walk away clean.',
    reward: 1500, kind: 'finale', target: 'pier' },
];
export const TAXI_FARE = 120;
export const PACKAGE_COUNT = 12;
