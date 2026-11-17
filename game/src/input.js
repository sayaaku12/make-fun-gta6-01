// SOLMAR BAY — input: keyboard + mouse, edge-triggered actions.
export function createInput() {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, fireHeld: false, enter: false, fist: false,
    mouseX: 640, mouseY: 360, mouseDown: false,
    pause: false, mute: false, restart: false, anyKey: false,
  };
}
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};
export function bindInput(input, canvas, handlers) {
  const down = (e) => {
    input.anyKey = true;
    const k = KEYMAP[e.code];
    if (k) { input[k] = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'KeyF') { input.enter = true; }
    if (e.code === 'KeyQ' || e.code === 'Space') { input.fist = true; e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') { input.pause = true; }
    if (e.code === 'KeyM') { input.mute = true; }
    if (e.code === 'KeyR') { input.restart = true; }
    if (e.code === 'Enter') handlers.onEnter?.();
  };
  const up = (e) => {
    const k = KEYMAP[e.code];
    if (k) input[k] = false;
  };
  const mouse = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', mouse);
  canvas.addEventListener('mousedown', (e) => { mouse(e); input.mouseDown = true; input.fireHeld = true; });
  window.addEventListener('mouseup', () => { input.mouseDown = false; input.fireHeld = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
