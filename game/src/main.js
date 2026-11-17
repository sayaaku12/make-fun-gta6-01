// SOLMAR BAY — entry point: loop, screens, save/load, shot staging hook.
import { CFG } from './config.js';
import { createWorld, update, fireWeapon, saveGame, loadSaveData, applySave, setMessage, snapshot } from './world.js';
import { drawWorld, drawStart, drawPause, drawOver } from './render.js';
import { createInput, bindInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? CFG.seedDefault) || CFG.seedDefault;

let world = createWorld(seed);
const input = createInput();
const audio = createAudio();
let screen = 'start'; // start | play | pause | over
let last = performance.now();
let fireCooldown = 0;

function resize() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

bindInput(input, canvas, {
  onEnter() {
    if (screen === 'start') startGame(false);
    else if (screen === 'over') restart();
  },
});
canvas.addEventListener('mousedown', () => {
  audio.unlock();
  if (screen === 'start') startGame(false);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && screen === 'start') startGame(true);
});

function startGame(continueSave) {
  audio.unlock();
  if (continueSave) {
    const data = loadSaveData();
    if (data && applySave(world, data)) setMessage(world, 'Save loaded — welcome back, Vex.', 3);
    else setMessage(world, 'No save found — starting fresh.', 3);
  }
  screen = 'play';
}
function restart() {
  world = createWorld(seed);
  screen = 'play';
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  // Global keys.
  if (input.pause) { input.pause = false; if (screen === 'play') screen = 'pause'; else if (screen === 'pause') screen = 'play'; }
  if (input.mute) { input.mute = false; audio.toggleMute(); }
  if (input.restart) { input.restart = false; if (screen !== 'start') restart(); }
  if (screen === 'play') {
    fireCooldown -= dt;
    if (input.fireHeld && fireCooldown <= 0 && world.player.onFoot) { fireWeapon(world); fireCooldown = 0.28; audio.shot(); }
    update(world, input, dt);
    // Audio follows state.
    const p = world.player;
    audio.engine(p.car ? Math.abs(p.car.speed) / 520 : 0, !!p.car);
    audio.siren(world.wanted >= 1);
    if (world.over) { screen = 'over'; audio.busted(); saveGame(world); }
    if (world.time > 0 && Math.floor(world.time) % 20 === 0 && world.time % 1 < dt) saveGame(world); // autosave
  }
  // Render.
  const w = canvas.width, h = canvas.height;
  if (screen === 'start') drawStart(ctx, world, w, h);
  else if (screen === 'pause') { drawWorld(ctx, world, w, h); drawPause(ctx, w, h); }
  else if (screen === 'over') { drawWorld(ctx, world, w, h); drawOver(ctx, world, w, h); }
  else drawWorld(ctx, world, w, h);
  statusEl.textContent = screen === 'play'
    ? `Solmar Bay: ${world.missionState ? world.missionState.objective : 'free roam'}, wanted ${world.wanted}, cash $${world.cash}`
    : 'Solmar Bay — open-world crime game';
  requestAnimationFrame(frame);
}

// Shot mode: stage a deterministic scene, draw twice (a presented frame),
// freeze, signal readiness.
if (shotName) {
  stageShot(world, shotName, seed).then(() => {
    screen = 'play';
    const w = canvas.width, h = canvas.height;
    const drawOnce = () => {
      if (shotName === 'start') drawStart(ctx, world, w, h);
      else drawWorld(ctx, world, w, h);
    };
    drawOnce();
    requestAnimationFrame(() => {
      drawOnce();
      window.__shotReady = true;
      window.__shotSnapshot = snapshot(world);
    });
  });
} else {
  requestAnimationFrame(frame);
}
