import { el, header, toolbar, status, setStatus } from '../../helpers.js';
import { celebrate } from '../../celebration.js';
import { timers } from '../../timer.js';
import { asyncGame, setupScene, makeHud, flashMessage } from '../../babylon/scene.js';

// First-person 3D photo safari: drag to look around the savanna, tap to snap
// pictures of wild animals. Centered, larger animals score more. Beat the
// target score within the time limit.
export const photoSafari = asyncGame((shell, BABYLON, { getMode }, restart) => {
  const mode = getMode();
  const DURATION = mode === 'advanced' ? 90 : 60;
  const TARGET = mode === 'advanced' ? 600 : 350;

  header(shell, {
    title: '📷 Photo Safari',
    tag: 'Drag to look · tap to snap',
    desc: 'You’re on a wildlife reserve. Drag the view to find animals; tap to photograph. Bigger and more centered shots score higher. Beat the target score before the clock runs out.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(restartBtn);
  const s = status(shell);
  const arena = el('div', { class: 'bjs-host' });
  shell.appendChild(arena);

  const { canvas, engine, scene, hud, dispose } = setupScene(arena, BABYLON, { clearColor: [0.55, 0.78, 0.95] });
  const ui = makeHud(hud, [
    { key: 'time',   label: 'Time',   value: DURATION + 's' },
    { key: 'score',  label: 'Score',  value: '0' },
    { key: 'shots',  label: 'Shots',  value: '0' },
    { key: 'target', label: 'Target', value: String(TARGET) },
  ]);

  // First-person camera at human eye height
  const camera = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 1.7, 0), scene);
  camera.setTarget(new BABYLON.Vector3(0, 1.7, 1));
  camera.inputs.clear();

  new BABYLON.HemisphericLight('hl', new BABYLON.Vector3(0, 1, 0), scene).intensity = 1.0;

  // Savanna ground (large green plane)
  const ground = BABYLON.MeshBuilder.CreateGround('g', { width: 400, height: 400 }, scene);
  const gm = new BABYLON.StandardMaterial('gm', scene);
  gm.diffuseColor = new BABYLON.Color3(0.55, 0.70, 0.30); gm.specularColor = BABYLON.Color3.Black();
  ground.material = gm;

  // Distant hills (a few flat triangular silhouettes)
  for (let i = 0; i < 10; i++) {
    const h = BABYLON.MeshBuilder.CreateCylinder('hill', { diameterTop: 0, diameterBottom: 30 + Math.random() * 30, height: 12 + Math.random() * 6, tessellation: 5 }, scene);
    const a = (i / 10) * Math.PI * 2;
    h.position.set(Math.cos(a) * 180, 6, Math.sin(a) * 180);
    const hm = new BABYLON.StandardMaterial('hm', scene); hm.diffuseColor = new BABYLON.Color3(0.4, 0.55, 0.3); h.material = hm;
  }
  // A few sparse trees (cylinder trunk + sphere canopy)
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 22 + Math.random() * 70;
    const tx = Math.cos(ang) * r, tz = Math.sin(ang) * r;
    const trunk = BABYLON.MeshBuilder.CreateCylinder('tr', { diameter: 0.7, height: 4 }, scene);
    trunk.position.set(tx, 2, tz);
    const tm = new BABYLON.StandardMaterial('tm', scene); tm.diffuseColor = new BABYLON.Color3(0.4, 0.27, 0.15); trunk.material = tm;
    const canopy = BABYLON.MeshBuilder.CreateSphere('cn', { diameter: 4.5 }, scene);
    canopy.position.set(tx, 5.6, tz); canopy.scaling.y = 0.6;
    const cm = new BABYLON.StandardMaterial('cm', scene); cm.diffuseColor = new BABYLON.Color3(0.25, 0.55, 0.25); canopy.material = cm;
  }

  // Animals — low-poly cute placeholders, identified by species + rarity bonus
  const SPECIES = [
    { name: 'Zebra',    color: new BABYLON.Color3(0.95, 0.95, 0.95), scale: 1.0, value: 30 },
    { name: 'Giraffe',  color: new BABYLON.Color3(0.95, 0.82, 0.45), scale: 1.4, value: 50 },
    { name: 'Elephant', color: new BABYLON.Color3(0.55, 0.55, 0.6),  scale: 1.6, value: 70 },
    { name: 'Lion',     color: new BABYLON.Color3(0.85, 0.6, 0.35),  scale: 1.0, value: 80 },
    { name: 'Gazelle',  color: new BABYLON.Color3(0.75, 0.55, 0.3),  scale: 0.8, value: 40 },
  ];

  function makeAnimal(sp) {
    const node = new BABYLON.TransformNode('a', scene);
    const body = BABYLON.MeshBuilder.CreateBox('b', { width: 2.4 * sp.scale, height: 1.4 * sp.scale, depth: 1.0 * sp.scale }, scene);
    body.position.y = 0.7 * sp.scale; body.parent = node;
    const head = BABYLON.MeshBuilder.CreateBox('h', { width: 0.7 * sp.scale, height: 0.7 * sp.scale, depth: 0.7 * sp.scale }, scene);
    head.position.set(1.2 * sp.scale, 1.0 * sp.scale, 0); head.parent = node;
    // 4 legs
    for (const [x, z] of [[-0.7, 0.35], [-0.7, -0.35], [0.7, 0.35], [0.7, -0.35]]) {
      const leg = BABYLON.MeshBuilder.CreateBox('l', { width: 0.25 * sp.scale, height: 0.9 * sp.scale, depth: 0.25 * sp.scale }, scene);
      leg.position.set(x * sp.scale, 0.0, z * sp.scale); leg.parent = node;
    }
    const m = new BABYLON.StandardMaterial('am', scene); m.diffuseColor = sp.color;
    body.material = head.material = m;
    // place randomly on the field within camera range
    const ang = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 60;
    node.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    node.rotation.y = Math.random() * Math.PI * 2;
    return { node, sp, dir: Math.random() * Math.PI * 2, snapped: false };
  }
  const animals = [];
  for (let i = 0; i < 14; i++) animals.push(makeAnimal(SPECIES[Math.floor(Math.random() * SPECIES.length)]));

  // Drag-to-look
  let yaw = 0, pitch = 0, dragging = false, lx = 0, ly = 0;
  function applyView() {
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }
  applyView();
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
  canvas.addEventListener('pointerup', (e) => { if (dragging) { snap(); } dragging = false; });
  canvas.addEventListener('pointerleave', () => { dragging = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lx) * 0.005;
    pitch = Math.max(-0.6, Math.min(0.4, pitch - (e.clientY - ly) * 0.005));
    lx = e.clientX; ly = e.clientY;
    applyView();
  });
  // Keyboard fallback for desktop
  const keys = {};
  const kd = (e) => { keys[e.key.toLowerCase()] = true; if (e.key === ' ') { snap(); e.preventDefault(); } };
  const ku = (e) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  const G = { t: 0, score: 0, shots: 0, ended: false };

  function snap() {
    if (G.ended) return;
    G.shots++; ui.shots(String(G.shots));
    // Find best animal in view: forward dot product + on-screen + distance
    const fwd = camera.getForwardRay().direction;
    let best = null, bestScore = 0, bestAnim = null;
    for (const a of animals) {
      if (a.snapped) continue;
      const to = a.node.position.subtract(camera.position);
      const d = to.length(); if (d < 1) continue;
      const dot = BABYLON.Vector3.Dot(to.normalize(), fwd);
      if (dot < 0.92) continue; // not in front, within ~23°
      // distance score: closer is better up to ~5m
      const distScore = Math.max(0.2, Math.min(1, 14 / d));
      const sc = Math.round(a.sp.value * distScore * (0.7 + dot * 0.6));
      if (sc > bestScore) { bestScore = sc; best = a.sp.name; bestAnim = a; }
    }
    if (bestAnim) {
      bestAnim.snapped = true;
      bestAnim.node.scaling.scaleInPlace(1.05);
      G.score += bestScore; ui.score(String(G.score));
      flashMessage(hud, `📷 ${best} +${bestScore}`, 900);
    } else {
      flashMessage(hud, '… nothing in frame', 700);
    }
    if (G.score >= TARGET) endGame(true);
  }

  scene.onBeforeRenderObservable.add(() => {
    if (G.ended) return;
    const dt = engine.getDeltaTime() / 1000;
    G.t += dt; ui.time(Math.max(0, Math.ceil(DURATION - G.t)) + 's');
    // Wander animals
    for (const a of animals) {
      if (Math.random() < 0.005) a.dir += (Math.random() - 0.5) * 0.6;
      a.node.position.x += Math.cos(a.dir) * 0.4 * dt;
      a.node.position.z += Math.sin(a.dir) * 0.4 * dt;
      a.node.rotation.y = -a.dir;
    }
    // Keyboard look
    if (keys['arrowleft'] || keys['a']) yaw -= 1.2 * dt;
    if (keys['arrowright'] || keys['d']) yaw += 1.2 * dt;
    if (keys['arrowup'] || keys['w']) pitch = Math.max(-0.6, pitch - 1.0 * dt);
    if (keys['arrowdown'] || keys['s']) pitch = Math.min(0.4, pitch + 1.0 * dt);
    applyView();

    if (G.t >= DURATION && !G.ended) endGame(G.score >= TARGET);
  });

  function endGame(win) {
    G.ended = true;
    timers.stopGame();
    setStatus(s, win ? `Score ${G.score} ≥ target ${TARGET}!` : `Time! Final score ${G.score} (target ${TARGET}).`, win ? 'good' : 'bad');
    flashMessage(hud, win ? 'GOLD ALBUM' : 'OUT OF TIME', 2200);
    if (win) celebrate({
      gameName: 'Photo Safari',
      gameTimeMs: timers.getGameElapsed(),
      totalTimeMs: timers.getTotalElapsed(),
      extra: `Score <b>${G.score}</b> in <b>${G.shots}</b> shots`,
    });
  }

  restartBtn.onclick = restart;
  setStatus(s, 'Drag to look · release to snap a photo · Space also works on desktop.');
  timers.resetGame();

  function teardown() {
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    dispose();
  }
  return teardown;
});
