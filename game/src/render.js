// SOLMAR BAY — renderer: canvas 2D top-down city, long shadows, HUD + minimap.
// Palette: sand #E8C98A, sea teal #2E7F8F, coral #E4572E, sunset gold #F2A541,
// deep navy HUD #12233A. One bold element: the sun-soaked bay + long east shadows.
import { CFG, DISTRICTS } from './config.js';
import { CITY, TILE, districtAt, missionTarget } from './world.js';
import { clamp } from './random.js';

const SAND = '#E8C98A', GRASS = '#7FB069', SEA = '#2E7F8F', ROAD_C = '#3D3A38', ROAD_LINE = '#E8C98A';
const SIDEWALK = '#CBB98F', NAVY = '#12233A', CORAL = '#E4572E', GOLD = '#F2A541';

export function drawWorld(ctx, world, viewW, viewH, shotMode = false) {
  const cam = world.camera;
  const shakeX = world.shake ? (world.rng ? 0 : 0) : 0;
  const ox = cam.x - viewW / 2 + (world.shake ? Math.sin(world.time * 47) * world.shake : 0);
  const oy = cam.y - viewH / 2 + (world.shake ? Math.cos(world.time * 39) * world.shake : 0);
  ctx.save();
  // Sky-tinted backdrop beyond the city edge.
  ctx.fillStyle = '#BFD9D4'; ctx.fillRect(0, 0, viewW, viewH);
  drawGround(ctx, world, ox, oy, viewW, viewH);
  drawRoads(ctx, ox, oy, viewW, viewH);
  drawSkids(ctx, world, ox, oy);
  drawPackages(ctx, world, ox, oy);
  drawJumps(ctx, world, ox, oy);
  drawRespray(ctx, world, ox, oy);
  drawMissionMarker(ctx, world, ox, oy);
  drawTaxi(ctx, world, ox, oy);
  drawBuildings(ctx, world, ox, oy);
  drawCars(ctx, world, ox, oy);
  drawPeds(ctx, world, ox, oy);
  drawEnemies(ctx, world, ox, oy);
  drawCops(ctx, world, ox, oy);
  drawBullets(ctx, world, ox, oy);
  drawPlayer(ctx, world, ox, oy);
  drawParticles(ctx, world, ox, oy);
  // Day tint: subtle warm wash that deepens toward evening.
  const hour = world.clock / 3600;
  const dusk = clamp((hour - 17) / 3, 0, 1) * 0.16 + clamp((9 - hour) / 2, 0, 1) * 0.08;
  if (dusk > 0) { ctx.fillStyle = `rgba(226, 110, 60, ${dusk})`; ctx.fillRect(0, 0, viewW, viewH); }
  ctx.restore();
  drawHUD(ctx, world, viewW, viewH);
  drawMinimap(ctx, world, viewW, viewH);
}

function vis(x, y, ox, oy, viewW, viewH, pad = 80) {
  return x - ox > -pad && x - ox < viewW + pad && y - oy > -pad && y - oy < viewH + pad;
}
function drawGround(ctx, world, ox, oy, viewW, viewH) {
  // Base: warm sand city floor with grass park blocks and sea on the west edge.
  ctx.fillStyle = '#D9BE8C'; ctx.fillRect(0, 0, viewW, viewH);
  const x0 = Math.max(0, Math.floor(ox / TILE)), x1 = Math.min(11, Math.ceil((ox + viewW) / TILE));
  const y0 = Math.max(0, Math.floor(oy / TILE)), y1 = Math.min(11, Math.ceil((oy + viewH) / TILE));
  for (let bx = x0; bx < x1; bx++) for (let by = y0; by < y1; by++) {
    const sx = bx * TILE - ox, sy = by * TILE - oy;
    if (bx === 0 && by < 3) { ctx.fillStyle = SEA; ctx.fillRect(sx, sy, TILE, TILE); continue; }
    if (bx === 0 && by >= 8) { ctx.fillStyle = SAND; ctx.fillRect(sx, sy, TILE, TILE); continue; }
    if (bx >= 3 && bx < 6 && by >= 4 && by < 8) { ctx.fillStyle = GRASS; ctx.fillRect(sx, sy, TILE, TILE); continue; }
    ctx.fillStyle = '#DCC491'; ctx.fillRect(sx, sy, TILE, TILE);
  }
  // Beach waves + boardwalk planks on the west edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    for (let y = 0; y < 720; y += 24) ctx.lineTo(26 + i * 9 + Math.sin((y + world.time * 30 + i * 40) * 0.02) * 4 - ox * 0 + 0, y);
    ctx.stroke();
  }
}
function drawRoads(ctx, ox, oy, viewW, viewH) {
  ctx.fillStyle = ROAD_C;
  for (let i = 0; i <= 11; i++) {
    const gx = i * TILE - ox, gy = i * TILE - oy;
    if (gx > -20 && gx < viewW + 20) ctx.fillRect(gx - 13, -20, 26, viewH + 40);
    if (gy > -20 && gy < viewH + 20) ctx.fillRect(-20, gy - 13, viewW + 40, 26);
  }
  // Dashed centre lines.
  ctx.strokeStyle = ROAD_LINE; ctx.lineWidth = 2; ctx.setLineDash([14, 16]);
  for (let i = 0; i <= 11; i++) {
    const gx = i * TILE - ox, gy = i * TILE - oy;
    if (gx > 0 && gx < viewW) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, viewH); ctx.stroke(); }
    if (gy > 0 && gy < viewH) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(viewW, gy); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  // Sidewalk edging.
  ctx.strokeStyle = SIDEWALK; ctx.lineWidth = 3;
  for (let i = 0; i <= 11; i++) {
    const gx = i * TILE - ox, gy = i * TILE - oy;
    if (gx > 0 && gx < viewW) { ctx.beginPath(); ctx.moveTo(gx - 15, 0); ctx.lineTo(gx - 15, viewH); ctx.moveTo(gx + 15, 0); ctx.lineTo(gx + 15, viewH); ctx.stroke(); }
    if (gy > 0 && gy < viewH) { ctx.beginPath(); ctx.moveTo(0, gy - 15); ctx.lineTo(viewW, gy - 15); ctx.moveTo(0, gy + 15); ctx.lineTo(viewW, gy + 15); ctx.stroke(); }
  }
}
function drawSkids(ctx, world, ox, oy) {
  ctx.strokeStyle = 'rgba(20,20,20,0.35)'; ctx.lineWidth = 4;
  for (const s of world.skids) {
    ctx.beginPath(); ctx.moveTo(s.x - ox - Math.cos(s.angle) * 10, s.y - oy - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x - ox + Math.cos(s.angle) * 10, s.y - oy + Math.sin(s.angle) * 10); ctx.stroke();
  }
}
function drawPackages(ctx, world, ox, oy) {
  for (const pk of world.packages) {
    if (pk.found || !vis(pk.x, pk.y, ox, oy, 1280, 720)) continue;
    const bob = Math.sin(world.time * 3 + pk.id) * 3;
    ctx.fillStyle = GOLD; ctx.fillRect(pk.x - ox - 7, pk.y - oy - 7 + bob, 14, 14);
    ctx.fillStyle = NAVY; ctx.fillRect(pk.x - ox - 7, pk.y - oy - 2 + bob, 14, 4);
  }
}
function drawJumps(ctx, world, ox, oy) {
  for (const j of world.jumps) {
    if (j.used) continue;
    ctx.fillStyle = '#F2A541';
    ctx.beginPath(); ctx.moveTo(j.x - ox, j.y - oy - 14); ctx.lineTo(j.x - ox + 14, j.y - oy + 10); ctx.lineTo(j.x - ox - 14, j.y - oy + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = NAVY; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('JUMP', j.x - ox, j.y - oy + 24);
  }
}
function drawRespray(ctx, world, ox, oy) {
  const r = world.respray;
  ctx.fillStyle = '#7FB069'; ctx.fillRect(r.x - ox - 22, r.y - oy - 16, 44, 32);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SPRAY $100', r.x - ox, r.y - oy + 3);
}
function drawMissionMarker(ctx, world, ox, oy) {
  const t = missionTarget(world);
  if (!t) return;
  const pulse = 1 + Math.sin(world.time * 5) * 0.18;
  const sx = t.x - ox, sy = t.y - oy;
  ctx.save(); ctx.translate(sx, sy); ctx.scale(pulse, pulse);
  ctx.fillStyle = CORAL;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-12, -14); ctx.lineTo(12, -14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = CORAL; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -10);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(t.label, sx, sy - 30);
}
function drawTaxi(ctx, world, ox, oy) {
  const t = world.taxi;
  if (!t) return;
  const tx = t.state === 'riding' ? t.dx : t.x, ty = t.state === 'riding' ? t.dy : t.y;
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(tx - ox, ty - oy, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = NAVY; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', tx - ox, ty - oy + 4);
}

function drawBuildings(ctx, world, ox, oy) {
  // Long afternoon shadows stretch east (+x).
  for (const b of world.buildings) {
    if (!vis(b.x, b.y, ox, oy, 1280, 720, 120)) continue;
    const sx = b.x - ox, sy = b.y - oy;
    if (b.kind === 'water') {
      ctx.fillStyle = SEA; ctx.fillRect(sx - 32, sy - 32, 64, 64);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - 20, sy - 8 + Math.sin(world.time * 2) * 3); ctx.lineTo(sx + 20, sy - 8 + Math.sin(world.time * 2) * 3); ctx.stroke();
      continue;
    }
    if (b.kind === 'beach') {
      ctx.fillStyle = SAND; ctx.fillRect(sx - 32, sy - 32, 64, 64);
      ctx.fillStyle = '#E4572E'; ctx.fillRect(sx - 14, sy - 6, 10, 10); ctx.fillRect(sx + 6, sy + 2, 10, 10);
      continue;
    }
    if (b.kind === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(sx + 10, sy + 8, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8A5A2B'; ctx.fillRect(sx - 2, sy + 8, 4, 8);
      continue;
    }
    // Shadow.
    ctx.fillStyle = 'rgba(30,20,10,0.28)';
    ctx.fillRect(sx - b.w / 2 + 10, sy - b.h / 2 + 8, b.w, b.h);
    // Body + roof + windows.
    ctx.fillStyle = b.color; ctx.fillRect(sx - b.w / 2, sy - b.h / 2, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(sx - b.w / 2 + 3, sy - b.h / 2 + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = 'rgba(255,240,180,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 12)), rows = Math.max(1, Math.floor(b.h / 12));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i + j) % 2 === 0) ctx.fillRect(sx - b.w / 2 + 5 + i * 11, sy - b.h / 2 + 5 + j * 11, 5, 6);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(sx - b.w / 2, sy - b.h / 2, b.w, b.h);
  }
}
function drawCarShape(ctx, x, y, angle, model, color, opts = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (opts.smoke) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-model.len / 2, 0, 8 + Math.sin(Date.now() / 90) * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-model.len / 2 + 4, -model.wid / 2 + 3, model.len, model.wid);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-model.len / 2, -model.wid / 2, model.len, model.wid, 6); ctx.fill();
  ctx.fillStyle = '#1B2A4A';
  ctx.beginPath(); ctx.roundRect(-model.len / 6, -model.wid / 2 + 4, model.len / 3, model.wid - 8, 3); ctx.fill();
  ctx.fillStyle = '#F2E9C9';
  ctx.fillRect(model.len / 2 - 3, -model.wid / 2 + 3, 3, 5); ctx.fillRect(model.len / 2 - 3, model.wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#E4572E';
  ctx.fillRect(-model.len / 2, -model.wid / 2 + 3, 3, 5); ctx.fillRect(-model.len / 2, model.wid / 2 - 8, 3, 5);
  if (opts.siren) {
    ctx.fillStyle = Math.floor(Date.now() / 300) % 2 ? '#E4572E' : '#3A7BD5';
    ctx.fillRect(-4, -model.wid / 2 - 2, 8, 4);
  }
  ctx.restore();
}
function drawCars(ctx, world, ox, oy) {
  for (const c of world.cars) {
    if (!vis(c.x, c.y, ox, oy, 1280, 720, 60)) continue;
    drawCarShape(ctx, c.x - ox, c.y - oy, c.angle, c.model, c.color, { smoke: c.smoke > 0.4, siren: c.siren });
    if (c.hp < 60 && c.kind !== 'traffic') {
      ctx.fillStyle = '#E4572E'; ctx.fillRect(c.x - ox - 14, c.y - oy - c.model.wid / 2 - 12, 28, 4);
      ctx.fillStyle = '#7FB069'; ctx.fillRect(c.x - ox - 14, c.y - oy - c.model.wid / 2 - 12, 28 * (c.hp / 100), 4);
    }
  }
}
function drawPerson(ctx, x, y, angle, shirt, label) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(4, 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E8B98A'; ctx.beginPath(); ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (label) { ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 14); }
}
function drawPeds(ctx, world, ox, oy) {
  for (const ped of world.peds) {
    if (!vis(ped.x, ped.y, ox, oy, 1280, 720)) continue;
    const wob = Math.sin(world.time * 8 + ped.id) * 1.5;
    drawPerson(ctx, ped.x - ox + wob, ped.y - oy, ped.angle, ped.shirt, ped.state === 'flee' ? '!' : null);
  }
}
function drawEnemies(ctx, world, ox, oy) {
  for (const e of world.enemies) {
    if (e.dead || !vis(e.x, e.y, ox, oy, 1280, 720)) continue;
    drawPerson(ctx, e.x - ox, e.y - oy, e.angle, '#3A3A3A', 'RAT');
    ctx.fillStyle = '#E4572E'; ctx.fillRect(e.x - ox - 12, e.y - oy - 18, 24, 3);
    ctx.fillStyle = '#7FB069'; ctx.fillRect(e.x - ox - 12, e.y - oy - 18, 24 * Math.max(0, e.hp / 60), 3);
  }
}
function drawCops(ctx, world, ox, oy) {
  for (const cop of world.cops) {
    if (cop.dead) continue;
    if (cop.kind === 'foot') {
      if (!vis(cop.x, cop.y, ox, oy, 1280, 720)) continue;
      drawPerson(ctx, cop.x - ox, cop.y - oy, cop.angle, '#1B2A4A', 'POLICE');
    }
  }
}
function drawBullets(ctx, world, ox, oy) {
  ctx.fillStyle = '#FFE27A';
  for (const b of world.bullets) {
    ctx.beginPath(); ctx.arc(b.x - ox, b.y - oy, 3, 0, Math.PI * 2); ctx.fill();
  }
}
function drawPlayer(ctx, world, ox, oy) {
  const p = world.player;
  if (!p.onFoot) return;
  const sx = p.x - ox, sy = p.y - oy;
  drawPerson(ctx, sx, sy, p.angle, '#E4572E', 'VEX');
  // Aim line + pistol.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + Math.cos(p.angle) * 12, sy + Math.sin(p.angle) * 12);
  ctx.lineTo(sx + Math.cos(p.angle) * 34, sy + Math.sin(p.angle) * 34); ctx.stroke();
  if (p.fistT > 0) {
    ctx.fillStyle = '#F2A541'; ctx.beginPath(); ctx.arc(sx + Math.cos(p.angle) * 24, sy + Math.sin(p.angle) * 24, 7, 0, Math.PI * 2); ctx.fill();
  }
  if (p.hp < 100) {
    ctx.fillStyle = '#E4572E'; ctx.fillRect(sx - 14, sy - 22, 28, 4);
    ctx.fillStyle = '#7FB069'; ctx.fillRect(sx - 14, sy - 22, 28 * (p.hp / 100), 4);
  }
}
function drawParticles(ctx, world, ox, oy) {
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - ox - pt.size / 2, pt.y - oy - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD ----
function drawHUD(ctx, world, viewW, viewH) {
  const p = world.player;
  ctx.fillStyle = 'rgba(18,35,58,0.85)'; ctx.fillRect(0, 0, viewW, 44);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', 14, 28);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#F2A541';
  ctx.fillText(districtAt(p.x, p.y), 150, 28);
  const hh = Math.floor(world.clock / 3600), mm = Math.floor((world.clock % 3600) / 60);
  ctx.fillStyle = '#fff'; ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 300, 28);
  // Health + armor bars.
  ctx.fillStyle = '#333'; ctx.fillRect(380, 14, 120, 10); ctx.fillStyle = '#E4572E'; ctx.fillRect(380, 14, 120 * (p.hp / 100), 10);
  ctx.fillStyle = '#333'; ctx.fillRect(380, 27, 120, 6); ctx.fillStyle = '#7FB069'; ctx.fillRect(380, 27, 120 * (p.armor / 100), 6);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(`HP ${Math.round(p.hp)}  ARM ${Math.round(p.armor)}`, 506, 24);
  // Cash, weapon, speed.
  ctx.fillStyle = '#7FB069'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`$${world.cash}`, 640, 28);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  ctx.fillText(p.onFoot ? `Pistol ${p.ammo}` : `${p.car.model.name}  ${Math.round(Math.abs(p.car.speed) * 0.18)} km/h`, 730, 28);
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < world.wanted ? GOLD : 'rgba(255,255,255,0.25)';
    drawStar(ctx, 940 + i * 26, 22, 9);
  }
  // Mission objective line.
  if (world.missionState) {
    ctx.fillStyle = 'rgba(18,35,58,0.8)'; ctx.fillRect(14, 54, 520, 30);
    ctx.fillStyle = GOLD; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`M${world.missionState.mission.id} ${world.missionState.mission.title}: ${world.missionState.objective}`, 22, 74);
    if (world.missionState.timer > 0) {
      ctx.fillStyle = world.missionState.timer < 15 ? '#E4572E' : '#fff';
      ctx.fillText(`⏱ ${Math.ceil(world.missionState.timer)}s`, 540, 74);
    }
  }
  // Stats strip: packages, taxi, kills.
  ctx.fillStyle = 'rgba(18,35,58,0.7)'; ctx.fillRect(14, viewH - 34, 330, 24);
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
  ctx.fillText(`Packages ${world.packagesFound}/12   Fares ${world.taxiDone}   Kills ${world.kills}   Score ${world.score}`, 22, viewH - 17);
  if (world.messageT > 0) {
    ctx.fillStyle = 'rgba(18,35,58,0.85)'; ctx.fillRect(viewW / 2 - 300, viewH - 72, 600, 28);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(world.message, viewW / 2, viewH - 53);
    ctx.textAlign = 'left';
  }
  if (world.bannerT > 0) {
    ctx.fillStyle = 'rgba(228,87,46,0.92)'; ctx.fillRect(viewW / 2 - 260, 110, 520, 40);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(world.banner, viewW / 2, 137);
    ctx.textAlign = 'left';
  }
  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px sans-serif';
  ctx.fillText('WASD move/drive · mouse aim · click shoot · Q punch · E enter/exit car · Shift sprint · P pause · M mute', 14, viewH - 44);
}
function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
function drawMinimap(ctx, world, viewW, viewH) {
  const size = 168, mx = viewW - size - 14, my = 58;
  const scale = size / CITY;
  ctx.fillStyle = 'rgba(18,35,58,0.9)'; ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
  ctx.fillStyle = '#D9BE8C'; ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = SEA; ctx.fillRect(mx, my, size * 0.09, size * 0.27);
  // Districts.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color + '55';
    ctx.fillRect(mx + d.x * TILE * scale, my + d.y * TILE * scale, d.w * TILE * scale, d.h * TILE * scale);
  }
  ctx.strokeStyle = '#3D3A38'; ctx.lineWidth = 1;
  for (let i = 0; i <= 11; i++) {
    ctx.beginPath(); ctx.moveTo(mx + i * TILE * scale, my); ctx.lineTo(mx + i * TILE * scale, my + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + i * TILE * scale); ctx.lineTo(mx + size, my + i * TILE * scale); ctx.stroke();
  }
  const dot = (x, y, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2); ctx.fill(); };
  for (const c of world.cars) if (c.kind === 'cop') dot(c.x, c.y, '#3A7BD5', 3);
  for (const c of world.cars) if (c.kind !== 'cop') dot(c.x, c.y, '#fff', 2);
  const t = missionTarget(world);
  if (t) dot(t.x, t.y, CORAL, 5);
  if (world.taxi) dot(world.taxi.x, world.taxi.y, GOLD, 4);
  dot(world.player.x, world.player.y, '#E4572E', 4);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(mx + world.player.x * scale, my + world.player.y * scale, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('N', mx + size / 2 - 4, my - 8);
}

// ---- Screens ----
export function drawStart(ctx, world, viewW, viewH) {
  drawWorld(ctx, world, viewW, viewH, true);
  ctx.fillStyle = 'rgba(18,35,58,0.72)'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD; ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', viewW / 2, 190);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText('An original open-world crime story — one courier, one bay, one last job chain.', viewW / 2, 228);
  ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#F2A541';
  ctx.fillText('Ria "Vex" Marlowe is back in town. Del Okafor has six jobs. The bay is watching.', viewW / 2, 258);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  const lines = [
    'WASD / arrows — move & drive   ·   Mouse — aim   ·   Click — shoot   ·   Q — punch',
    'E — steal / enter car, exit car   ·   Shift — sprint   ·   P — pause   ·   M — mute   ·   R — restart',
    'Steal cars, dodge traffic, outrun the police, finish all 6 missions, find 12 hidden packages.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, viewW / 2, 320 + i * 26));
  ctx.fillStyle = CORAL; ctx.fillRect(viewW / 2 - 210, 430, 420, 52);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO START', viewW / 2, 463);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#E8C98A';
  ctx.fillText('Continue available if a save exists — press C to continue.', viewW / 2, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px sans-serif';
  ctx.fillText('All city, characters, vehicles, names, story, art and music are original. Nothing from any commercial game.', viewW / 2, 560);
  ctx.textAlign = 'left';
}
export function drawPause(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(18,35,58,0.7)'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 10);
  ctx.font = '16px sans-serif'; ctx.fillText('P / Esc to resume · R to restart · M to mute', viewW / 2, viewH / 2 + 30);
  ctx.textAlign = 'left';
}
export function drawOver(ctx, world, viewW, viewH) {
  ctx.fillStyle = 'rgba(18,35,58,0.8)'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = world.busted ? '#3A7BD5' : '#E4572E';
  ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(world.overReason, viewW / 2, viewH / 2 - 20);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText(world.busted ? 'The Solmar Bay police took you in. The bay keeps your car.' : 'Vex is down. The bay keeps moving without you.', viewW / 2, viewH / 2 + 20);
  ctx.fillText(`Score ${world.score} · Cash $${world.cash} · Missions ${world.missionDone.length}/6`, viewW / 2, viewH / 2 + 52);
  ctx.fillText('Press R to try again', viewW / 2, viewH / 2 + 92);
  ctx.textAlign = 'left';
}
