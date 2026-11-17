// SOLMAR BAY — shot staging: each ?shot= scene runs the game's own world
// forward deterministically, freezes, and reports a snapshot for cross-checks.
// ?shot=start|play|chase|mission &seed=1
import { update, autopilot, enterCar, nearestCar, addWanted, startMission, spawnCop, setBanner, snapshot } from './world.js';
import { roadCenter, CITY } from './world.js';
import { angleTo } from './random.js';

const DT = 1 / 60;
function step(world, n, target) {
  for (let i = 0; i < n; i++) autopilot(world, DT, target ?? { x: roadCenter(5), y: roadCenter(5) });
}
function placePlayer(world, x, y, opts = {}) {
  const p = world.player;
  p.x = x; p.y = y; p.angle = opts.angle ?? -Math.PI / 2;
  world.camera.x = x; world.camera.y = y;
  if (opts.car) {
    const car = nearestCar(world, 10000);
    if (car) { enterCar(world, car); }
  }
}
function walkStep(world, tx, ty, n) {
  const p = world.player;
  for (let i = 0; i < n; i++) {
    const a = angleTo(p.x, p.y, tx, ty);
    update(world, { up: Math.sin(a) < -0.3, down: Math.sin(a) > 0.3, left: Math.cos(a) < -0.3, right: Math.cos(a) > 0.3, sprint: false, enter: false, fist: false, fireHeld: false }, DT);
  }
}
export async function stageShot(world, name, seed) {
  const p = world.player;
  if (name === 'start') {
    // Title screen over a lively downtown: traffic + peds moving, camera downtown.
    placePlayer(world, roadCenter(7), roadCenter(5));
    walkStep(world, roadCenter(8), roadCenter(5), 60);
    world.bannerT = 0; world.messageT = 0; // title screen stays clean
    return snapshot(world);
  }
  if (name === 'play') {
    // On foot downtown: player walks (never enters a car here), pistol out.
    placePlayer(world, roadCenter(7), roadCenter(5));
    p.ammo = 24;
    walkStep(world, roadCenter(8), roadCenter(5), 240);
    return snapshot(world);
  }
  if (name === 'chase') {
    // Cover: driving at speed with 3 wanted stars, cruisers chasing, mission live.
    placePlayer(world, roadCenter(4), roadCenter(5));
    const car = nearestCar(world, 10000);
    if (car) enterCar(world, car);
    addWanted(world, 3);
    for (let i = 0; i < 3; i++) spawnCop(world, 'car');
    world.player.car.speed = 380;
    step(world, 300, { x: roadCenter(9), y: roadCenter(5) });
    if (world.player.car) { world.player.car.speed = 340; world.player.car.hp = 100; world.player.car.smoke = 0; }
    world.messageT = 0; // hide any wreck/crash note — the cover shows a live chase
    setBanner(world, 'Mission 1: First Light', 10);
    return snapshot(world);
  }
  if (name === 'mission') {
    // Mission 4 turf war: enemies in the park, player fighting on foot.
    startMission(world, 3);
    placePlayer(world, roadCenter(4), roadCenter(5) - 40);
    p.ammo = 48;
    walkStep(world, roadCenter(4), roadCenter(5), 180);
    world.bannerT = 0;
    return snapshot(world);
  }
  // Fallback: plain play scene.
  step(world, 120, { x: roadCenter(6), y: roadCenter(6) });
  return snapshot(world);
}
