// SOLMAR BAY — world: deterministic city, traffic, pedestrians, police,
// missions, combat, wanted system, save/load. Pure logic; no DOM here.
import { CFG, DISTRICTS, CAR_MODELS, MISSIONS, TAXI_FARE, PACKAGE_COUNT } from './config.js';
import { makeRng, clamp, lerp, dist2, angleTo, angleDiff, hashStr } from './random.js';

export const TILE = CFG.tile;
export const CITY = CFG.cityBlocks * TILE; // 704 px square city
const ROAD = CFG.roadW;

export function roadCenter(i) { return i * TILE + TILE / 2; }
// Roads run along block edges: a point is on a road when it is within ROAD/2
// of a grid line (x or y multiple of TILE).
export function onRoad(x, y) {
  const rx = ((x % TILE) + TILE) % TILE, ry = ((y % TILE) + TILE) % TILE;
  return rx < ROAD / 2 || rx > TILE - ROAD / 2 || ry < ROAD / 2 || ry > TILE - ROAD / 2;
}
export function nearestRoadPoint(x, y) {
  const gx = Math.round(x / TILE) * TILE, gy = Math.round(y / TILE) * TILE;
  return { x: clamp(gx, 0, CITY), y: clamp(gy, 0, CITY) };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    seed, rng, time: 0, clock: 8 * 3600, // 08:00 start
    cash: 120, wanted: 0, wantedFloat: 0, score: 0,
    missionIndex: 0, missionState: null, missionDone: [],
    packagesFound: 0, taxiDone: 0, kills: 0, carsStolen: 0,
    busted: false, wasted: false, over: false, overReason: '',
    shake: 0, message: '', messageT: 0, banner: '', bannerT: 0,
    buildings: [], cars: [], peds: [], cops: [], bullets: [],
    particles: [], pickups: [], skids: [], enemies: [], packages: [],
    jumps: [], respray: null, taxi: null, player: null, camera: { x: 0, y: 0 },
    stats: { shots: 0, hits: 0 },
  };
  genCity(world, rng);
  genTraffic(world, rng);
  genPeds(world, rng);
  genPackages(world, rng);
  spawnPlayer(world);
  startMission(world, 0);
  return world;
}

function genCity(world, rng) {
  const palette = ['#C97B4A', '#B85C38', '#D9A05B', '#8A7B6B', '#6B7F8F', '#A66B4A', '#7A9B7E', '#C4A484'];
  const downtown = ['#5C6B7A', '#7A6B8F', '#4A5C6B', '#8F7B5C'];
  for (let bx = 0; bx < CFG.cityBlocks; bx++) {
    for (let by = 0; by < CFG.cityBlocks; by++) {
      const cx = bx * TILE + TILE / 2, cy = by * TILE + TILE / 2;
      // Beach strip on the west edge, park in Palm Court, marina water north-west.
      if (bx === 0 && by >= 8) { world.buildings.push({ x: cx, y: cy, w: 40, h: 40, kind: 'beach', color: '#E8C98A', height: 0 }); continue; }
      if (bx === 0 && by < 3) { world.buildings.push({ x: cx, y: cy, w: 40, h: 40, kind: 'water', color: '#2E7F8F', height: 0 }); continue; }
      if (bx >= 3 && bx < 6 && by >= 4 && by < 8 && rng.chance(0.55)) {
        world.buildings.push({ x: cx, y: cy, w: 34, h: 34, kind: 'tree', color: '#5E8C4A', height: 0 }); continue;
      }
      const downtownBlock = bx >= 6 && bx < 11 && by >= 3 && by < 8;
      const col = downtownBlock ? rng.pick(downtown) : rng.pick(palette);
      const h = downtownBlock ? rng.int(26, 52) : rng.int(16, 34);
      const w = rng.range(30, 40);
      world.buildings.push({
        x: cx + rng.range(-3, 3), y: cy + rng.range(-3, 3),
        w, h, kind: 'building', color: col, height: h,
        roof: rng.pick(['#3A3A3A', '#5C4A3A', '#7A8A7A', '#6B5C7A']),
        windows: rng.int(2, 5),
      });
    }
  }
  // Landmarks: respray garage (Harbor Yard), marina office, pier drop, park.
  world.respray = { x: roadCenter(4), y: roadCenter(9), label: 'Spray Shop' };
  world.landmarks = {
    pier: { x: roadCenter(0), y: roadCenter(9), label: 'Old Pier' },
    yard: { x: roadCenter(4), y: roadCenter(9), label: 'Harbor Yard' },
    sunset: { x: roadCenter(8), y: roadCenter(9), label: 'Sunset Row' },
    park: { x: roadCenter(4), y: roadCenter(5), label: 'Palm Court Park' },
    marina: { x: roadCenter(4), y: roadCenter(1), label: 'Marina Office' },
  };
  // Stunt jumps: ramps on long straight roads.
  world.jumps = [
    { x: roadCenter(5), y: roadCenter(2), used: false },
    { x: roadCenter(8), y: roadCenter(6), used: false },
    { x: roadCenter(2), y: roadCenter(10), used: false },
  ];
}

function spawnCar(world, rng, x, y, angle, opts = {}) {
  const model = opts.model ?? rng.pick(CAR_MODELS);
  const car = {
    id: world.cars.length, x, y, angle, speed: 0, model,
    color: opts.color ?? model.color, kind: opts.kind ?? 'traffic',
    parked: !!opts.parked, driver: opts.driver !== false,
    hp: 100, smoke: 0, honk: 0, targetAngle: angle, stuck: 0,
    route: null, routeIdx: 0, wait: 0, siren: !!opts.siren,
  };
  world.cars.push(car);
  return car;
}

function genTraffic(world, rng) {
  // Parked cars along roads.
  for (let i = 0; i < 16; i++) {
    const bx = rng.int(1, 10), by = rng.int(1, 10);
    const along = rng.chance(0.5);
    const x = along ? roadCenter(bx) + rng.range(-8, 8) : roadCenter(bx) + (rng.chance(0.5) ? -16 : 16);
    const y = along ? roadCenter(by) + (rng.chance(0.5) ? -16 : 16) : roadCenter(by) + rng.range(-8, 8);
    spawnCar(world, rng, x, y, along ? 0 : Math.PI / 2, { parked: true });
  }
  // Moving traffic on the grid.
  for (let i = 0; i < 14; i++) {
    const bx = rng.int(0, 10), by = rng.int(0, 10);
    const c = spawnCar(world, rng, roadCenter(bx), roadCenter(by), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    c.speed = rng.range(60, 130);
    c.route = makeRoute(world, rng, c.x, c.y);
  }
  // Player's starter car near spawn.
  spawnCar(world, rng, roadCenter(5) + 10, roadCenter(5) + 18, 0, { parked: true, model: CAR_MODELS[0], kind: 'player' });
}

function makeRoute(world, rng, x, y) {
  const pts = [];
  let cx = Math.round(x / TILE), cy = Math.round(y / TILE);
  for (let i = 0; i < 8; i++) {
    if (rng.chance(0.5)) cx = clamp(cx + rng.pick([-1, 1]), 0, CFG.cityBlocks);
    else cy = clamp(cy + rng.pick([-1, 1]), 0, CFG.cityBlocks);
    pts.push({ x: roadCenter(cx), y: roadCenter(cy) });
  }
  return pts;
}

function genPeds(world, rng) {
  const names = ['Ana', 'Bo', 'Cleo', 'Dev', 'Elif', 'Finn', 'Gia', 'Hugo', 'Ivy', 'Jae', 'Kira', 'Leo', 'Mia', 'Noor', 'Omar', 'Pia'];
  const shirts = ['#E4572E', '#2E7F8F', '#F2A541', '#7FB069', '#C44569', '#5C6B7A', '#E8C98A', '#8F5C8F'];
  for (let i = 0; i < 26; i++) {
    const bx = rng.int(0, 10), by = rng.int(0, 10);
    world.peds.push({
      id: i, name: rng.pick(names), x: roadCenter(bx) + rng.range(-20, 20), y: roadCenter(by) + rng.range(-20, 20),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52), shirt: rng.pick(shirts),
      state: 'walk', panic: 0, target: null, wait: rng.range(0, 3),
    });
  }
}

function genPackages(world, rng) {
  for (let i = 0; i < PACKAGE_COUNT; i++) {
    const bx = rng.int(0, 10), by = rng.int(0, 10);
    world.packages.push({ x: roadCenter(bx) + rng.range(-24, 24), y: roadCenter(by) + rng.range(-24, 24), found: false, id: i });
  }
}

function spawnPlayer(world) {
  world.player = {
    x: roadCenter(5), y: roadCenter(5) + 30, angle: -Math.PI / 2,
    vx: 0, vy: 0, hp: 100, armor: 50, cash: world.cash,
    onFoot: true, car: null, weapon: 'pistol', ammo: CFG.pistolAmmoStart,
    sprint: false, speed: 0, invuln: 0, firing: false, fistT: 0,
  };
  world.camera.x = world.player.x; world.camera.y = world.player.y;
}

export function districtAt(x, y) {
  const bx = Math.floor(x / TILE), by = Math.floor(y / TILE);
  for (const d of DISTRICTS) if (bx >= d.x && bx < d.x + d.w && by >= d.y && by < d.y + d.h) return d.name;
  return 'Solmar Bay';
}

export function setMessage(world, text, secs = 3) { world.message = text; world.messageT = secs; }
export function setBanner(world, text, secs = 2.2) { world.banner = text; world.bannerT = secs; }
export function addWanted(world, stars) {
  world.wantedFloat = clamp(world.wantedFloat + stars, 0, 5);
  world.wanted = Math.ceil(world.wantedFloat);
  world.heatT = world.time;
  if (world.wanted >= 1) setMessage(world, `Wanted level ${world.wanted} — lose the heat!`, 2.5);
}
export function addCash(world, n) { world.cash += n; world.player.cash = world.cash; world.score += n; }
export function burst(world, x, y, color, n = 10, speed = 120) {
  for (let i = 0; i < n; i++) {
    const a = world.rng.range(0, Math.PI * 2), s = world.rng.range(speed * 0.3, speed);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: world.rng.range(0.3, 0.8), max: 0.8, color, size: world.rng.range(2, 5) });
  }
}

// ---- Missions ----
export function startMission(world, idx) {
  if (idx >= MISSIONS.length) { world.missionState = null; return; }
  const m = MISSIONS[idx];
  const lm = world.landmarks;
  const target = lm[m.target] ?? lm.pier;
  world.missionState = {
    index: idx, mission: m, stage: 0, target: { x: target.x, y: target.y, label: target.label },
    timer: m.time ?? 0, killsNeeded: 0, killsDone: 0, collected: false,
    objective: missionObjective(world, m, 0),
  };
  if (m.kind === 'clear') {
    world.missionState.killsNeeded = 4;
    for (let i = 0; i < 4; i++) {
      world.enemies.push({
        x: lm.park.x + world.rng.range(-70, 70), y: lm.park.y + world.rng.range(-70, 70),
        hp: 60, angle: 0, speed: 90, kind: 'rat', state: 'idle', shootT: world.rng.range(1, 3),
      });
    }
  }
  if (m.kind === 'collect') {
    world.pickups.push({ x: lm.marina.x + 30, y: lm.marina.y, kind: 'manifest', label: 'Harbor manifest' });
  }
  setBanner(world, `Mission ${m.id}: ${m.title}`, 3);
  setMessage(world, `${m.giver}: ${m.brief}`, 6);
}
function missionObjective(world, m, stage) {
  switch (m.kind) {
    case 'driveTo': return `Drive to ${world.landmarks[m.target].label}`;
    case 'stealDeliver': return stage === 0 ? 'Steal a Marina GT in Coral Heights' : `Deliver the Marina GT to ${world.landmarks.yard.label}`;
    case 'timedDrive': return `Reach ${world.landmarks.sunset.label} before the timer runs out`;
    case 'clear': return 'Clear the Dock Rats from Palm Court Park';
    case 'collect': return 'Grab the harbor manifest at the Marina Office, then lose the heat';
    case 'finale': return `Deliver the case to ${world.landmarks.pier.label} — survive the heat`;
    default: return 'Follow the marker';
  }
}
export function missionTarget(world) {
  const s = world.missionState;
  if (!s) return null;
  if (s.mission.kind === 'stealDeliver' && s.stage === 0) return { x: roadCenter(8), y: roadCenter(1), label: 'Coral Heights' };
  return s.target;
}
export function completeMission(world) {
  const s = world.missionState;
  if (!s) return;
  addCash(world, s.mission.reward);
  world.missionDone.push(s.mission.id);
  setBanner(world, `Mission passed! +$${s.mission.reward}`, 3);
  burst(world, world.player.x, world.player.y, '#F2A541', 24, 200);
  world.missionIndex += 1;
  world.enemies = world.enemies.filter((e) => e.kind !== 'rat');
  if (world.missionIndex >= MISSIONS.length) {
    world.missionState = null;
    setBanner(world, 'STORY COMPLETE — Solmar Bay is yours, Vex!', 5);
    setMessage(world, 'All missions done. Free roam: taxi fares, hidden packages, stunt jumps.', 6);
  } else {
    startMission(world, world.missionIndex);
  }
  saveGame(world);
}
export function failMission(world, why) {
  const s = world.missionState;
  if (!s) return;
  setBanner(world, `Mission failed: ${why} — retrying`, 3);
  world.player.hp = Math.max(world.player.hp, 60);
  startMission(world, s.index);
}

// ---- Player actions ----
export function nearestCar(world, maxD = 60) {
  let best = null, bestD = maxD * maxD;
  for (const c of world.cars) {
    const d = dist2(world.player.x, world.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
export function enterCar(world, car) {
  if (!car) return false;
  const p = world.player;
  if (car.parked || car.kind === 'traffic') {
    if (car.driver && car.kind === 'traffic') {
      // Driver flees; stealing raises the heat.
      car.driver = false;
      world.carsStolen += 1;
      addWanted(world, 1);
      setMessage(world, `Stole the ${car.model.name}! The driver ran for it.`, 2.5);
      spawnPed(world, car.x + 20, car.y, true);
    } else if (car.parked) {
      world.carsStolen += car.kind === 'player' ? 0 : 1;
      if (car.kind !== 'player') addWanted(world, 0.5);
    }
  }
  car.parked = false; car.kind = 'player'; car.route = null;
  p.onFoot = false; p.car = car; p.x = car.x; p.y = car.y;
  return true;
}
export function exitCar(world) {
  const p = world.player, car = p.car;
  if (!car) return;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.onFoot = true; p.car = null; car.kind = 'parked';
  car.parked = true;
}
export function spawnPed(world, x, y, fleeing = false) {
  world.peds.push({
    id: world.peds.length, name: 'Driver', x, y, angle: world.rng.range(0, Math.PI * 2),
    speed: 70, shirt: '#C44569', state: fleeing ? 'flee' : 'walk', panic: fleeing ? 3 : 0,
    target: null, wait: 0,
  });
}
export function fireWeapon(world) {
  const p = world.player;
  if (!p.onFoot || world.over) return;
  if (p.weapon === 'pistol') {
    if (p.ammo <= 0) { setMessage(world, 'Out of ammo — find a pickup (green crate).', 2); return; }
    p.ammo -= 1; world.stats.shots += 1;
    const a = p.angle;
    world.bullets.push({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.6, from: 'player', damage: CFG.pistolDamage });
    burst(world, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, '#F2A541', 4, 90);
    world.shake = Math.max(world.shake, 3);
  }
}
export function fistAttack(world) {
  const p = world.player;
  if (!p.onFoot || world.over) return;
  p.fistT = 0.25;
  for (const e of world.enemies) {
    if (dist2(p.x, p.y, e.x, e.y) < 42 * 42) { damageEnemy(world, e, CFG.fistDamage); }
  }
  for (const ped of world.peds) {
    if (dist2(p.x, p.y, ped.x, ped.y) < 40 * 40) { ped.state = 'flee'; ped.panic = 3; addWanted(world, 0.5); }
  }
}
export function damageEnemy(world, e, dmg) {
  e.hp -= dmg; world.stats.hits += 1;
  burst(world, e.x, e.y, '#E4572E', 6, 100);
  if (e.hp <= 0 && !e.dead) {
    e.dead = true; world.kills += 1; world.score += 50;
    burst(world, e.x, e.y, '#C44569', 16, 160);
    if (world.missionState?.mission.kind === 'clear') world.missionState.killsDone += 1;
    if (world.rng.chance(0.5)) world.pickups.push({ x: e.x, y: e.y, kind: 'ammo', label: '+12 ammo' });
  }
}
export function damagePlayer(world, dmg, cause = '') {
  const p = world.player;
  if (p.invuln > 0 || world.over) return;
  let left = dmg;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left * 0.6); p.armor -= absorbed; left -= absorbed; }
  p.hp -= left; p.invuln = 0.4; world.shake = Math.max(world.shake, 5);
  burst(world, p.x, p.y, '#E4572E', 8, 120);
  if (p.hp <= 0) {
    p.hp = 0;
    if (world.wanted >= 3 && cause === 'cop') { world.busted = true; world.over = true; world.overReason = 'BUSTED'; }
    else { world.wasted = true; world.over = true; world.overReason = 'WASTED'; }
    setBanner(world, world.overReason, 4);
  }
}

// ---- Police ----
export function spawnCop(world, kind) {
  const p = world.player;
  const a = world.rng.range(0, Math.PI * 2);
  const x = clamp(p.x + Math.cos(a) * 420, 20, CITY - 20), y = clamp(p.y + Math.sin(a) * 420, 20, CITY - 20);
  if (kind === 'car') {
    const c = spawnCar(world, world.rng, x, y, a, { kind: 'cop', color: '#1B2A4A', siren: true, driver: true });
    c.model = { name: 'Cruiser', color: '#1B2A4A', len: 48, wid: 23, top: 300 };
    world.cops.push({ kind: 'car', car: c, hp: 100, chaseT: 0 });
  } else {
    world.cops.push({ kind: 'foot', x, y, angle: a, hp: 50, shootT: 1.5, chaseT: 0 });
  }
}
function ensureCops(world) {
  const want = world.wanted >= 4 ? 5 : world.wanted >= 3 ? 4 : world.wanted >= 2 ? 3 : world.wanted >= 1 ? 2 : 0;
  if (want === 0) return;
  // No reinforcements once the heat has gone cold and nobody can see the player:
  // that is what lets the wanted level decay when the player hides.
  const p = world.player;
  const seen = world.cops.some((c) => {
    const cx = c.kind === 'car' ? c.car.x : c.x, cy = c.kind === 'car' ? c.car.y : c.y;
    return dist2(cx, cy, p.x, p.y) < 340 * 340;
  });
  const fresh = world.time - (world.heatT ?? 0) < 10;
  if (!seen && !fresh) {
    // Far cops give up and leave.
    for (const c of world.cops) {
      const cx = c.kind === 'car' ? c.car.x : c.x, cy = c.kind === 'car' ? c.car.y : c.y;
      if (dist2(cx, cy, p.x, p.y) > 500 * 500) c.dead = true;
    }
    return;
  }
  const alive = world.cops.filter((c) => !c.dead).length;
  for (let i = alive; i < want; i++) spawnCop(world, world.rng.chance(0.6) ? 'car' : 'foot');
}

// ---- Save / load ----
export function saveGame(world) {
  try {
    const p = world.player;
    const data = {
      cash: world.cash, missionIndex: world.missionIndex, missionDone: world.missionDone,
      packagesFound: world.packagesFound, taxiDone: world.taxiDone, kills: world.kills,
      carsStolen: world.carsStolen, score: world.score,
      player: { x: p.x, y: p.y, hp: p.hp, armor: p.armor, ammo: p.ammo },
      packages: world.packages.map((pk) => pk.found),
    };
    if (typeof localStorage !== 'undefined') localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return JSON.stringify(data);
  } catch { return null; }
}
export function loadSaveData() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function applySave(world, data) {
  if (!data) return false;
  world.cash = data.cash ?? 120; world.missionIndex = data.missionIndex ?? 0;
  world.missionDone = data.missionDone ?? []; world.packagesFound = data.packagesFound ?? 0;
  world.taxiDone = data.taxiDone ?? 0; world.kills = data.kills ?? 0;
  world.carsStolen = data.carsStolen ?? 0; world.score = data.score ?? 0;
  if (data.player) {
    world.player.x = data.player.x; world.player.y = data.player.y;
    world.player.hp = data.player.hp; world.player.armor = data.player.armor; world.player.ammo = data.player.ammo;
  }
  if (Array.isArray(data.packages)) data.packages.forEach((f, i) => { if (world.packages[i]) world.packages[i].found = !!f; });
  world.missionState = null;
  startMission(world, world.missionIndex);
  return true;
}

// ---- Main update ----
export function update(world, input, dt) {
  if (world.over) { updateParticles(world, dt); return; }
  world.time += dt;
  world.clock = (world.clock + dt * 12) % 86400; // game clock runs fast
  if (world.messageT > 0) world.messageT -= dt;
  if (world.bannerT > 0) world.bannerT -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 14);
  const p = world.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fistT > 0) p.fistT -= dt;

  // --- input: movement ---
  const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (p.onFoot) {
    const sp = (input.sprint ? CFG.sprintSpeed : CFG.walkSpeed);
    const len = Math.hypot(ix, iy) || 1;
    p.vx = ix / len * sp * (ix || iy ? 1 : 0);
    p.vy = iy / len * sp * (ix || iy ? 1 : 0);
    p.x = clamp(p.x + p.vx * dt, 12, CITY - 12);
    p.y = clamp(p.y + p.vy * dt, 12, CITY - 12);
    p.speed = Math.hypot(p.vx, p.vy);
    if (input.mouseX !== undefined) p.angle = Math.atan2(input.mouseY - p.y + (world.camera.y - 360), input.mouseX - p.x + (world.camera.x - 640));
    resolveBuildingCollision(world, p, CFG.playerRadius);
    if (input.fireHeld) { /* hold-to-fire handled by main.js edge */ }
    if (input.fist) { fistAttack(world); input.fist = false; }
  } else if (p.car) {
    driveCar(world, p.car, input, dt);
    p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle; p.speed = Math.abs(p.car.speed);
    // Skid marks at speed + steering.
    if (Math.abs(p.car.speed) > 260 && (input.left || input.right)) {
      world.skids.push({ x: p.car.x, y: p.car.y, angle: p.car.angle, life: 4 });
      if (world.skids.length > 220) world.skids.shift();
    }
    // Stunt jumps.
    for (const j of world.jumps) {
      if (!j.used && Math.abs(p.car.speed) > 300 && dist2(p.x, p.y, j.x, j.y) < 30 * 30) {
        j.used = true; addCash(world, 200); setBanner(world, 'STUNT JUMP! +$200', 2.5);
        burst(world, p.x, p.y, '#F2A541', 20, 220);
      }
    }
    // Respray: lose the heat for $100.
    if (world.wanted > 0 && dist2(p.x, p.y, world.respray.x, world.respray.y) < 46 * 46) {
      if (world.cash >= 100) {
        world.cash -= 100; world.wanted = 0; world.wantedFloat = 0;
        world.cops.forEach((c) => { c.dead = true; if (c.car) c.car.kind = 'traffic'; });
        world.cops = [];
        setBanner(world, 'Resprayed — heat gone (-$100)', 3);
        burst(world, p.x, p.y, '#7FB069', 18, 150);
      }
    }
  }
  if (input.enter) { input.enter = false; if (p.onFoot) { const c = nearestCar(world); if (c) enterCar(world, c); } else exitCar(world); }

  updateTraffic(world, dt);
  updatePeds(world, dt);
  updateCops(world, dt);
  updateEnemies(world, dt);
  updateBullets(world, dt);
  updateParticles(world, dt);
  updatePickups(world, dt);
  updateMission(world, dt);
  updateWanted(world, dt);
  // Camera follows with slight look-ahead.
  const tx = p.x + (p.onFoot ? 0 : Math.cos(p.angle) * 40);
  const ty = p.y + (p.onFoot ? 0 : Math.sin(p.angle) * 40);
  world.camera.x = lerp(world.camera.x, tx, 1 - Math.pow(0.001, dt));
  world.camera.y = lerp(world.camera.y, ty, 1 - Math.pow(0.001, dt));
}

function resolveBuildingCollision(world, ent, r) {
  for (const b of world.buildings) {
    if (b.kind !== 'building') continue;
    const hw = b.w / 2 + r, hh = b.h / 2 + r;
    const dx = ent.x - b.x, dy = ent.y - b.y;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
      const px = hw - Math.abs(dx), py = hh - Math.abs(dy);
      if (px < py) ent.x += dx > 0 ? px : -px; else ent.y += dy > 0 ? py : -py;
    }
  }
}

function driveCar(world, car, input, dt) {
  const fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  // Steering is inverted in reverse, like real cars.
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CFG.carTurn * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * dir;
  if (fwd > 0) car.speed += CFG.carAccel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 160 * dt);
  car.speed = clamp(car.speed, -CFG.carReverseMax, car.model.top * 1.9);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Building collision: bounce + damage.
  let hit = false;
  for (const b of world.buildings) {
    if (b.kind !== 'building') continue;
    if (Math.abs(nx - b.x) < b.w / 2 + 12 && Math.abs(ny - b.y) < b.h / 2 + 12) { hit = true; break; }
  }
  if (hit) {
    car.speed *= -0.35; car.hp -= Math.abs(car.speed) * 0.05 + 4;
    burst(world, nx, ny, '#8A8A8A', 8, 120); world.shake = Math.max(world.shake, 4);
    if (car.hp <= 0) { car.hp = 0; car.smoke = 1; }
  } else { car.x = clamp(nx, 12, CITY - 12); car.y = clamp(ny, 12, CITY - 12); }
  if (car.hp < 40) car.smoke = Math.max(car.smoke, 0.6);
  // Crash into other cars.
  for (const other of world.cars) {
    if (other === car) continue;
    if (dist2(car.x, car.y, other.x, other.y) < 34 * 34) {
      const push = angleTo(other.x, other.y, car.x, car.y);
      other.x += Math.cos(push) * 14 * dt * 10; other.y += Math.sin(push) * 14 * dt * 10;
      if (Math.abs(car.speed) > 150) {
        car.hp -= 5; other.hp -= 5; burst(world, car.x, car.y, '#F2A541', 8, 120);
        if (other.kind === 'traffic') addWanted(world, 0.25);
      }
    }
  }
  // Running over pedestrians is a crime.
  for (const ped of world.peds) {
    if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26 && Math.abs(car.speed) > 60) {
      ped.state = 'flee'; ped.panic = 4; addWanted(world, 0.75);
      burst(world, ped.x, ped.y, '#E4572E', 6, 100);
    }
  }
}

function updateTraffic(world, dt) {
  for (const c of world.cars) {
    if (c.kind === 'player' || c.kind === 'cop' || c.parked) continue;
    if (!c.route || c.routeIdx >= c.route.length) { c.route = makeRoute(world, world.rng, c.x, c.y); c.routeIdx = 0; }
    const t = c.route[c.routeIdx];
    const d = Math.hypot(t.x - c.x, t.y - c.y);
    if (d < 12) { c.routeIdx += 1; continue; }
    const want = angleTo(c.x, c.y, t.x, t.y);
    c.angle += clamp(angleDiff(c.angle, want), -1.8 * dt, 1.8 * dt);
    // Stop for a car ahead.
    let blocked = false;
    for (const o of world.cars) {
      if (o === c) continue;
      const ahead = (o.x - c.x) * Math.cos(c.angle) + (o.y - c.y) * Math.sin(c.angle);
      const side = Math.abs((o.x - c.x) * Math.sin(c.angle) - (o.y - c.y) * Math.cos(c.angle));
      if (ahead > 0 && ahead < 52 && side < 20) { blocked = true; break; }
    }
    const target = blocked ? 0 : 110;
    c.speed = lerp(c.speed, target, 1 - Math.pow(0.05, dt));
    c.x = clamp(c.x + Math.cos(c.angle) * c.speed * dt, 12, CITY - 12);
    c.y = clamp(c.y + Math.sin(c.angle) * c.speed * dt, 12, CITY - 12);
  }
}

function updatePeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const away = angleTo(world.player.x, world.player.y, ped.x, ped.y);
      ped.x = clamp(ped.x + Math.cos(away) * 130 * dt, 12, CITY - 12);
      ped.y = clamp(ped.y + Math.sin(away) * 130 * dt, 12, CITY - 12);
      ped.angle = away;
      if (ped.panic <= 0) ped.state = 'walk';
      continue;
    }
    ped.wait -= dt;
    if (ped.wait <= 0) {
      ped.target = { x: clamp(ped.x + world.rng.range(-90, 90), 20, CITY - 20), y: clamp(ped.y + world.rng.range(-90, 90), 20, CITY - 20) };
      ped.wait = world.rng.range(2, 6);
    }
    if (ped.target) {
      const d = Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y);
      if (d > 6) {
        ped.angle = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    // Flee gunfire.
    if (world.bullets.length && dist2(ped.x, ped.y, world.player.x, world.player.y) < 200 * 200) {
      ped.state = 'flee'; ped.panic = 2.5;
    }
  }
}

function updateCops(world, dt) {
  ensureCops(world);
  const p = world.player;
  for (const cop of world.cops) {
    if (cop.dead) continue;
    cop.chaseT = (cop.chaseT ?? 0) + dt;
    // After a long chase with no catch, the unit breaks off — the heat goes cold.
    // At low wanted levels the unit gives up outright; at 3+ stars it only
    // breaks off when it has lost the player at range.
    const pd = Math.hypot(p.x - (cop.kind === 'car' ? cop.car.x : cop.x), p.y - (cop.kind === 'car' ? cop.car.y : cop.y));
    if (cop.chaseT > 12 && (world.wanted <= 2 || pd > 90)) { cop.dead = true; if (cop.car) cop.car.kind = 'traffic'; continue; }
    if (cop.kind === 'car') {
      const c = cop.car;
      const want = angleTo(c.x, c.y, p.x, p.y);
      c.angle += clamp(angleDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
      c.speed = lerp(c.speed, 330, 1 - Math.pow(0.1, dt));
      c.x = clamp(c.x + Math.cos(c.angle) * c.speed * dt, 12, CITY - 12);
      c.y = clamp(c.y + Math.sin(c.angle) * c.speed * dt, 12, CITY - 12);
      if (dist2(c.x, c.y, p.x, p.y) < 44 * 44) {
        if (p.onFoot) damagePlayer(world, CFG.copRamDamage * dt * 2, 'cop');
        else if (p.car) { p.car.hp -= 8 * dt; if (p.car.hp <= 0) { p.car.smoke = 1; setMessage(world, 'Your car is wrecked — get out!', 2); } }
        // Ram nudge.
        const push = angleTo(c.x, c.y, p.x, p.y);
        if (p.car) { p.car.x += Math.cos(push) * 40 * dt; p.car.y += Math.sin(push) * 40 * dt; }
      }
    } else {
      const want = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = want;
      cop.x = clamp(cop.x + Math.cos(want) * CFG.copSpeed * dt, 12, CITY - 12);
      cop.y = clamp(cop.y + Math.sin(want) * CFG.copSpeed * dt, 12, CITY - 12);
      cop.shootT -= dt;
      if (dist2(cop.x, cop.y, p.x, p.y) < 260 * 260 && cop.shootT <= 0) {
        cop.shootT = 1.1;
        world.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(want) * 560, vy: Math.sin(want) * 560, life: 0.7, from: 'cop', damage: 9 });
      }
      if (dist2(cop.x, cop.y, p.x, p.y) < 30 * 30 && p.onFoot) damagePlayer(world, 12 * dt, 'cop');
    }
  }
  world.cops = world.cops.filter((c) => !c.dead);
}

function updateEnemies(world, dt) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < 320) {
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      e.x = clamp(e.x + Math.cos(e.angle) * e.speed * dt * (d > 90 ? 1 : 0), 12, CITY - 12);
      e.y = clamp(e.y + Math.sin(e.angle) * e.speed * dt * (d > 90 ? 1 : 0), 12, CITY - 12);
      e.shootT -= dt;
      if (d < 280 && e.shootT <= 0) {
        e.shootT = 1.4;
        world.bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle) * 520, vy: Math.sin(e.angle) * 520, life: 0.7, from: 'enemy', damage: 8 });
      }
      if (d < 26) damagePlayer(world, 10 * dt, 'enemy');
    }
  }
  world.enemies = world.enemies.filter((e) => !e.dead);
}

function updateBullets(world, dt) {
  const p = world.player;
  for (const b of world.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.from === 'player') {
      for (const e of world.enemies) {
        if (!e.dead && dist2(b.x, b.y, e.x, e.y) < 18 * 18) { damageEnemy(world, e, b.damage); b.life = 0; break; }
      }
      for (const cop of world.cops) {
        if (cop.kind === 'foot' && !cop.dead && dist2(b.x, b.y, cop.x, cop.y) < 18 * 18) {
          cop.hp -= b.damage; b.life = 0; addWanted(world, 0.5);
          if (cop.hp <= 0) { cop.dead = true; world.kills += 1; addWanted(world, 1); }
          break;
        }
      }
    } else if (dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
      damagePlayer(world, b.damage, b.from === 'cop' ? 'cop' : 'enemy');
      b.life = 0;
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < CITY && b.y > 0 && b.y < CITY);
}

function updateParticles(world, dt) {
  for (const pt of world.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  for (const s of world.skids) s.life -= dt;
  world.skids = world.skids.filter((s) => s.life > 0);
}

function updatePickups(world, dt) {
  const p = world.player;
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (dist2(p.x, p.y, pk.x, pk.y) < 26 * 26) {
      pk.taken = true;
      if (pk.kind === 'ammo') { p.ammo += 12; setMessage(world, 'Picked up +12 pistol ammo', 2); }
      if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); setMessage(world, 'Picked up a medkit +40 HP', 2); }
      if (pk.kind === 'manifest') {
        if (world.missionState) world.missionState.collected = true;
        addWanted(world, 2); setMessage(world, 'Manifest grabbed — the whole marina is hot. Lose them!', 3);
      }
      burst(world, pk.x, pk.y, '#7FB069', 10, 120);
    }
  }
  world.pickups = world.pickups.filter((pk) => !pk.taken || pk.kind === 'manifest');
  for (const pkg of world.packages) {
    if (!pkg.found && dist2(p.x, p.y, pkg.x, pkg.y) < 24 * 24) {
      pkg.found = true; world.packagesFound += 1; addCash(world, 150);
      setBanner(world, `Hidden package ${world.packagesFound}/${PACKAGE_COUNT} — +$150`, 2.5);
    }
  }
  // Taxi: a fare appears when free-roaming with no mission timer running.
  if (!world.taxi && !world.missionState?.timer && world.rng.chance(0.002)) {
    const bx = world.rng.int(0, 10), by = world.rng.int(0, 10);
    world.taxi = { x: roadCenter(bx), y: roadCenter(by), state: 'waiting' };
    setMessage(world, 'A taxi fare is waiting (yellow marker) — drive to them, then to their stop.', 4);
  }
  if (world.taxi) {
    const t = world.taxi;
    if (t.state === 'waiting' && dist2(p.x, p.y, t.x, t.y) < 40 * 40 && !p.onFoot) {
      t.state = 'riding';
      const bx = world.rng.int(0, 10), by = world.rng.int(0, 10);
      t.dx = roadCenter(bx); t.dy = roadCenter(by);
      setMessage(world, 'Passenger aboard — take them to the yellow marker.', 3);
    } else if (t.state === 'riding' && dist2(p.x, p.y, t.dx, t.dy) < 40 * 40) {
      addCash(world, TAXI_FARE); world.taxiDone += 1;
      setBanner(world, `Fare complete! +$${TAXI_FARE}`, 2.5);
      world.taxi = null;
    }
  }
}

function updateMission(world, dt) {
  const s = world.missionState;
  if (!s) return;
  const p = world.player;
  const m = s.mission;
  if (s.timer > 0) {
    s.timer -= dt;
    if (s.timer <= 0) { failMission(world, 'time ran out'); return; }
  }
  const t = missionTarget(world);
  const near = t ? dist2(p.x, p.y, t.x, t.y) < 52 * 52 : false;
  switch (m.kind) {
    case 'driveTo': if (near && !p.onFoot) completeMission(world); break;
    case 'stealDeliver':
      if (s.stage === 0 && !p.onFoot && p.car && p.car.model.name === 'Marina GT') {
        s.stage = 1; s.objective = missionObjective(world, m, 1);
        setMessage(world, 'Got the Marina GT — now deliver it to Harbor Yard.', 3);
      } else if (s.stage === 1 && near && !p.onFoot) completeMission(world);
      break;
    case 'timedDrive': if (near) completeMission(world); break;
    case 'clear': if (s.killsDone >= s.killsNeeded) completeMission(world); break;
    case 'collect':
      if (s.collected) {
        if (world.wanted === 0) completeMission(world);
        s.objective = 'Lose the heat (wanted 0) to finish';
      }
      break;
    case 'finale':
      if (near) {
        if (world.wanted >= 2) { /* must arrive hot, then survive */ }
        completeMission(world);
      }
      break;
    default: break;
  }
  if (m.kind === 'finale' && s.stage === 0) { addWanted(world, dt * 0.12); s.stage = 1; }
}

function updateWanted(world, dt) {
  const p = world.player;
  const seen = world.cops.some((c) => {
    const cx = c.kind === 'car' ? c.car.x : c.x, cy = c.kind === 'car' ? c.car.y : c.y;
    return dist2(cx, cy, p.x, p.y) < 340 * 340;
  });
  if (!seen && world.wanted > 0) {
    world.wantedFloat -= CFG.wantedDecay * dt;
    if (world.wantedFloat <= 0) { world.wantedFloat = 0; world.wanted = 0; world.cops = []; setMessage(world, 'You lost them. Heat is off.', 2.5); }
    else world.wanted = Math.ceil(world.wantedFloat);
  }
  // Ambient ammo/health pickups respawn occasionally.
  if (world.rng.chance(0.0006) && world.pickups.filter((pk) => pk.kind === 'ammo' || pk.kind === 'health').length < 4) {
    const bx = world.rng.int(0, 10), by = world.rng.int(0, 10);
    world.pickups.push({ x: roadCenter(bx), y: roadCenter(by), kind: world.rng.chance(0.6) ? 'ammo' : 'health', label: '' });
  }
}

// Autopilot for tests + shot staging: drives toward a target, fires sometimes.
export function autopilot(world, dt, target) {
  const p = world.player;
  const input = { up: false, down: false, left: false, right: false, sprint: false, enter: false, fist: false, fireHeld: false };
  if (p.onFoot) {
    const c = nearestCar(world, 400);
    if (c) { input.enter = dist2(p.x, p.y, c.x, c.y) < 50 * 50; }
    const goal = c ?? target;
    if (goal) {
      const a = angleTo(p.x, p.y, goal.x, goal.y);
      input.right = Math.cos(a) > 0.3; input.left = Math.cos(a) < -0.3;
      input.down = Math.sin(a) > 0.3; input.up = Math.sin(a) < -0.3;
    }
  } else if (p.car) {
    const a = angleTo(p.car.x, p.car.y, target.x, target.y);
    const diff = angleDiff(p.car.angle, a);
    input.up = true;
    input.left = diff > 0.25; input.right = diff < -0.25;
  }
  update(world, input, dt);
  return input;
}
export function snapshot(world) {
  const p = world.player;
  return {
    time: Math.round(world.time * 10) / 10, cash: world.cash, wanted: world.wanted,
    mission: world.missionState?.mission.title ?? null, missionIndex: world.missionIndex,
    px: Math.round(p.x), py: Math.round(p.y), hp: Math.round(p.hp), ammo: p.ammo,
    onFoot: p.onFoot, cars: world.cars.length, peds: world.peds.length,
    cops: world.cops.length, kills: world.kills, score: world.score,
    packages: world.packagesFound, district: districtAt(p.x, p.y),
  };
}
