import { el, header, toolbar, status, setStatus } from '../../helpers.js';
import { celebrate } from '../../celebration.js';
import { timers } from '../../timer.js';
import { asyncGame, setupScene, makeHud, flashMessage } from '../../babylon/scene.js';

// 3rd-person jet through a neon corridor. Steer with WASD / arrows or by
// dragging on the canvas. Fly through cyan rings for points; avoid magenta
// obstacle pillars. Survive 90 seconds (Quick) / 150 seconds (Advanced) to win.
export const skyRace = asyncGame((shell, BABYLON, { getMode }, restart) => {
  const mode = getMode();
  const TARGET_SEC = mode === 'advanced' ? 150 : 90;

  header(shell, {
    title: '🛩 Sky Race',
    tag: 'Neon corridor · WASD or drag to steer',
    desc: 'Fly through the rings for points and dodge the magenta pillars. Each hit costs health; survive the full run to win.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(restartBtn);
  const s = status(shell);
  const arena = el('div', { class: 'bjs-host' });
  shell.appendChild(arena);

  const { canvas, engine, scene, hud, dispose } = setupScene(arena, BABYLON, { clearColor: [0.06, 0.02, 0.18] });
  const ui = makeHud(hud, [
    { key: 'time',   label: 'Time',   value: TARGET_SEC + 's' },
    { key: 'score',  label: 'Score',  value: '0' },
    { key: 'health', label: 'Health', value: '100' },
    { key: 'speed',  label: 'Speed',  value: '1.0×' },
  ]);

  // Camera + lights
  const camera = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 2.5, -7), scene);
  camera.setTarget(new BABYLON.Vector3(0, 1.5, 8));
  camera.inputs.clear();

  new BABYLON.HemisphericLight('hl', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.5;
  const dir = new BABYLON.DirectionalLight('dl', new BABYLON.Vector3(0.3, -1, 0.5), scene); dir.intensity = 0.5;

  // Floor grid (synth-wave style)
  const floor = BABYLON.MeshBuilder.CreateGround('floor', { width: 100, height: 4000, subdivisions: 1 }, scene);
  floor.position.y = -2;
  const floorMat = new BABYLON.StandardMaterial('fm', scene);
  floorMat.diffuseColor = new BABYLON.Color3(0.06, 0.02, 0.18);
  floorMat.emissiveColor = new BABYLON.Color3(0.04, 0.0, 0.1);
  floor.material = floorMat;

  // Side neon walls
  for (const sx of [-12, 12]) {
    const wall = BABYLON.MeshBuilder.CreateBox('wall', { width: 0.2, height: 18, depth: 4000 }, scene);
    wall.position.set(sx, 5, 1500);
    const wm = new BABYLON.StandardMaterial('wm', scene);
    wm.emissiveColor = new BABYLON.Color3(0.9, 0.2, 0.9); wm.disableLighting = true;
    wall.material = wm;
  }

  // Player jet (cone + wings)
  const jet = new BABYLON.TransformNode('jet', scene);
  const body = BABYLON.MeshBuilder.CreateCylinder('body', { diameterTop: 0, diameterBottom: 1.2, height: 2.4, tessellation: 12 }, scene);
  body.rotation.x = Math.PI / 2; body.parent = jet;
  const wing = BABYLON.MeshBuilder.CreateBox('wing', { width: 3.6, height: 0.12, depth: 0.7 }, scene);
  wing.position.z = -0.2; wing.parent = jet;
  const tail = BABYLON.MeshBuilder.CreateBox('tail', { width: 0.12, height: 0.7, depth: 0.5 }, scene);
  tail.position.set(0, 0.4, -1.1); tail.parent = jet;
  const jetMat = new BABYLON.StandardMaterial('jm', scene);
  jetMat.diffuseColor = new BABYLON.Color3(0.85, 0.95, 1); jetMat.emissiveColor = new BABYLON.Color3(0.15, 0.3, 0.45);
  body.material = wing.material = tail.material = jetMat;
  jet.position.set(0, 1.5, 0);

  // Object pools (rings and pillars are recycled as the world scrolls)
  const rings = [];
  const pillars = [];
  function makeRing(z) {
    const r = BABYLON.MeshBuilder.CreateTorus('ring', { diameter: 4.5, thickness: 0.35, tessellation: 24 }, scene);
    r.rotation.x = Math.PI / 2;
    const rm = new BABYLON.StandardMaterial('rm', scene);
    rm.emissiveColor = new BABYLON.Color3(0.2, 1, 0.9); rm.disableLighting = true;
    r.material = rm;
    r.position.set((Math.random() - 0.5) * 14, 1.5, z);
    rings.push({ mesh: r, scored: false });
  }
  function makePillar(z) {
    const p = BABYLON.MeshBuilder.CreateBox('pillar', { width: 2, height: 8, depth: 2 }, scene);
    p.position.set((Math.random() - 0.5) * 18, 2, z);
    const pm = new BABYLON.StandardMaterial('pm', scene);
    pm.emissiveColor = new BABYLON.Color3(1, 0.2, 0.8); pm.disableLighting = true;
    p.material = pm;
    pillars.push({ mesh: p, hit: false });
  }
  for (let z = 30; z < 400; z += 30) makeRing(z);
  for (let z = 50; z < 400; z += 45) makePillar(z + Math.random() * 20);

  // Input — keyboard + drag
  const keys = {};
  const onKey = (e, v) => { keys[e.key.toLowerCase()] = v; };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  let dragX = 0, dragY = 0, dragging = false;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; dragY = e.clientY; });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => { dragging = false; });
  let steerX = 0, steerY = 0; // -1..1 horizontal/vertical
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    steerX = Math.max(-1, Math.min(1, (e.clientX - dragX) / 80));
    steerY = Math.max(-1, Math.min(1, -(e.clientY - dragY) / 80));
  });

  const G = { score: 0, health: 100, speed: 1.0, t: 0, ended: false };
  scene.onBeforeRenderObservable.add(() => {
    if (G.ended) return;
    const dt = engine.getDeltaTime() / 1000;
    G.t += dt;
    G.speed = 1.0 + Math.min(1.4, G.t * 0.012);
    const fwdSpeed = 22 * G.speed;
    ui.time(Math.max(0, Math.ceil(TARGET_SEC - G.t)) + 's');
    ui.speed(G.speed.toFixed(1) + '×');

    // Steer with keys + drag
    let sx = steerX, sy = steerY;
    if (keys['arrowleft'] || keys['a']) sx -= 1;
    if (keys['arrowright'] || keys['d']) sx += 1;
    if (keys['arrowup'] || keys['w']) sy += 1;
    if (keys['arrowdown'] || keys['s']) sy -= 1;
    sx = Math.max(-1, Math.min(1, sx));
    sy = Math.max(-1, Math.min(1, sy));
    jet.position.x = Math.max(-10, Math.min(10, jet.position.x + sx * 14 * dt));
    jet.position.y = Math.max(0.5, Math.min(7, jet.position.y + sy * 9 * dt));
    jet.rotation.z = -sx * 0.45;
    jet.rotation.x = -sy * 0.25;
    camera.position.x = jet.position.x * 0.65;
    camera.position.y = 2.5 + jet.position.y * 0.4;
    camera.setTarget(new BABYLON.Vector3(jet.position.x * 0.7, jet.position.y, jet.position.z + 10));

    const worldShift = fwdSpeed * dt;
    // Move every object toward the player (world scrolls)
    for (const r of rings) {
      r.mesh.position.z -= worldShift;
      r.mesh.rotation.y += 1.3 * dt;
      if (!r.scored && r.mesh.position.z < 0.8 && r.mesh.position.z > -1.2) {
        const d = Math.hypot(r.mesh.position.x - jet.position.x, r.mesh.position.y - jet.position.y);
        if (d < 1.8) { r.scored = true; G.score += 50; ui.score(String(G.score)); r.mesh.material.emissiveColor = new BABYLON.Color3(1, 1, 0.4); }
      }
      if (r.mesh.position.z < -30) {
        r.mesh.position.z += 460; r.mesh.position.x = (Math.random() - 0.5) * 14; r.scored = false;
        r.mesh.material.emissiveColor = new BABYLON.Color3(0.2, 1, 0.9);
      }
    }
    for (const p of pillars) {
      p.mesh.position.z -= worldShift;
      if (!p.hit && p.mesh.position.z < 1.5 && p.mesh.position.z > -1.5) {
        const dx = Math.abs(p.mesh.position.x - jet.position.x);
        const dy = Math.abs(p.mesh.position.y - jet.position.y);
        if (dx < 1.4 && dy < 3) {
          p.hit = true;
          G.health = Math.max(0, G.health - 24);
          ui.health(String(G.health));
          flashMessage(hud, '💥 -24 HP', 700);
          if (G.health <= 0) return endGame(false);
        }
      }
      if (p.mesh.position.z < -30) {
        p.mesh.position.z += 460 + Math.random() * 40;
        p.mesh.position.x = (Math.random() - 0.5) * 18; p.hit = false;
      }
    }

    if (G.t >= TARGET_SEC) return endGame(true);
  });

  function endGame(win) {
    G.ended = true;
    timers.stopGame();
    setStatus(s, win ? `Run complete! Score ${G.score}.` : `Lost it. Score ${G.score}.`, win ? 'good' : 'bad');
    flashMessage(hud, win ? 'CLEAR' : 'WRECKED', 2400);
    if (win) celebrate({
      gameName: 'Sky Race',
      gameTimeMs: timers.getGameElapsed(),
      totalTimeMs: timers.getTotalElapsed(),
      extra: `Score <b>${G.score}</b>`,
    });
  }

  restartBtn.onclick = restart;
  setStatus(s, 'Steer with WASD / arrows / drag. Fly through the rings, dodge the pillars.');
  timers.resetGame();

  function teardown() {
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    dispose();
  }
  return teardown;
});
