import { el, header, toolbar, status, setStatus } from '../../helpers.js';
import { celebrate } from '../../celebration.js';
import { timers } from '../../timer.js';
import { asyncGame, setupScene, makeHud, flashMessage } from '../../babylon/scene.js';

// 3D Missile Defense. Cities below; incoming ICBMs fall from the sky; tap
// (or click) anywhere in the sky to launch an interceptor that explodes at
// that point. The blast radius destroys any missile inside it. Survive
// progressively harder waves to win.
export const missileDefense = asyncGame((shell, BABYLON, { getMode }, restart) => {
  const mode = getMode();
  const TARGET_WAVES = mode === 'advanced' ? 6 : 4;

  header(shell, {
    title: '🚀 Missile Defense',
    tag: `Defend the city · survive ${TARGET_WAVES} waves`,
    desc: 'Enemy ICBMs are inbound. Click anywhere in the sky to launch an interceptor — the blast wipes out missiles in range. Lose all your cities and it’s game over.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(restartBtn);
  const s = status(shell);

  const arena = el('div', { class: 'bjs-host' });
  shell.appendChild(arena);

  const { canvas, engine, scene, hud, dispose } = setupScene(arena, BABYLON, { clearColor: [0.03, 0.05, 0.12] });
  const ui = makeHud(hud, [
    { key: 'wave',   label: 'Wave',  value: '1' },
    { key: 'cities', label: 'Cities', value: '6' },
    { key: 'score',  label: 'Score', value: '0' },
  ]);

  // --- Scene setup
  const camera = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 18, -55), scene);
  camera.setTarget(new BABYLON.Vector3(0, 12, 0));
  camera.inputs.clear();

  const sky = new BABYLON.HemisphericLight('sky', new BABYLON.Vector3(0, 1, 0), scene);
  sky.intensity = 0.55; sky.diffuse = new BABYLON.Color3(0.5, 0.6, 1);
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.3, -1, 0.4), scene);
  sun.intensity = 0.7;

  // Ground
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 120, height: 60 }, scene);
  const groundMat = new BABYLON.StandardMaterial('gm', scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.08, 0.10, 0.18);
  groundMat.specularColor = BABYLON.Color3.Black();
  ground.material = groundMat;

  // Neon horizon plane (for synth-wave vibe)
  const horizonMat = new BABYLON.StandardMaterial('hm', scene);
  horizonMat.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0.6); horizonMat.disableLighting = true;
  const horizon = BABYLON.MeshBuilder.CreatePlane('horizon', { width: 200, height: 30 }, scene);
  horizon.position.set(0, 14, 60); horizon.material = horizonMat;

  // Cities (boxes)
  const cityRowY = 2;
  const cities = [];
  const cityXs = [-30, -18, -6, 6, 18, 30];
  for (const x of cityXs) {
    const c = BABYLON.MeshBuilder.CreateBox('city', { width: 6, height: 4, depth: 6 }, scene);
    c.position.set(x, cityRowY, 0);
    const m = new BABYLON.StandardMaterial('cm', scene);
    m.diffuseColor = new BABYLON.Color3(0.2, 0.7, 1.0); m.emissiveColor = new BABYLON.Color3(0.06, 0.18, 0.3);
    c.material = m;
    cities.push({ mesh: c, alive: true });
  }

  // Sky pick plane — invisible, used to convert clicks into world points.
  const pickPlane = BABYLON.MeshBuilder.CreatePlane('pp', { width: 200, height: 60 }, scene);
  pickPlane.position.set(0, 22, 0); pickPlane.isPickable = true; pickPlane.isVisible = false;

  // State
  const G = {
    wave: 1, score: 0, cooldown: 0, missiles: [], interceptors: [], blasts: [],
    spawnAcc: 0, waveBudget: 0, alive: cities.length, ended: false, lastTick: 0,
  };

  function startWave() {
    G.waveBudget = 4 + G.wave * 2;
    G.spawnAcc = 0;
    ui.wave(String(G.wave));
    flashMessage(hud, `WAVE ${G.wave}`);
  }
  startWave();

  function spawnMissile() {
    const sx = (Math.random() * 100) - 50;
    const target = cities.filter((c) => c.alive)[Math.floor(Math.random() * Math.max(1, cities.filter(c=>c.alive).length))];
    if (!target) return;
    const m = BABYLON.MeshBuilder.CreateSphere('en', { diameter: 1.2 }, scene);
    const mat = new BABYLON.StandardMaterial('em', scene);
    mat.emissiveColor = new BABYLON.Color3(1, 0.3, 0.3); mat.disableLighting = true;
    m.material = mat;
    m.position.set(sx, 38, 0);
    const dir = target.mesh.position.subtract(m.position).normalize();
    const speed = 0.18 + G.wave * 0.04;
    // trail
    const trail = new BABYLON.TrailMesh('t', m, scene, 0.15, 24, true);
    const trailMat = new BABYLON.StandardMaterial('tm', scene);
    trailMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.3); trailMat.disableLighting = true;
    trail.material = trailMat;
    G.missiles.push({ mesh: m, dir, speed, target, trail });
  }

  function spawnInterceptor(targetPoint) {
    const launchX = cityXs[Math.floor(Math.random() * cityXs.length)] + (Math.random() - 0.5) * 2;
    const m = BABYLON.MeshBuilder.CreateSphere('in', { diameter: 0.8 }, scene);
    const mat = new BABYLON.StandardMaterial('inm', scene);
    mat.emissiveColor = new BABYLON.Color3(0.4, 1, 0.5); mat.disableLighting = true;
    m.material = mat;
    m.position.set(launchX, 4, 0);
    const dir = targetPoint.subtract(m.position).normalize();
    const trail = new BABYLON.TrailMesh('it', m, scene, 0.12, 18, true);
    const trailMat = new BABYLON.StandardMaterial('itm', scene);
    trailMat.emissiveColor = new BABYLON.Color3(0.4, 1, 0.7); trailMat.disableLighting = true;
    trail.material = trailMat;
    G.interceptors.push({ mesh: m, dir, speed: 0.7, target: targetPoint.clone(), trail });
  }

  function explode(pos) {
    const r = 5.5;
    const s = BABYLON.MeshBuilder.CreateSphere('blast', { diameter: 1 }, scene);
    s.position.copyFrom(pos);
    const mat = new BABYLON.StandardMaterial('bm', scene);
    mat.emissiveColor = new BABYLON.Color3(1, 0.7, 0.2); mat.disableLighting = true; mat.alpha = 0.7;
    s.material = mat;
    G.blasts.push({ mesh: s, r, t: 0, maxT: 35 });
    // wipe missiles within radius
    for (const m of G.missiles) {
      if (!m.dead && BABYLON.Vector3.Distance(m.mesh.position, pos) <= r) {
        m.dead = true;
        G.score += 100;
        ui.score(String(G.score));
      }
    }
  }

  // Pointer pick — launch interceptor toward picked sky point
  canvas.addEventListener('pointerdown', (ev) => {
    if (G.ended) return;
    const rect = canvas.getBoundingClientRect();
    scene.pointerX = ev.clientX - rect.left; scene.pointerY = ev.clientY - rect.top;
    const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m === pickPlane);
    if (pick && pick.pickedPoint) spawnInterceptor(pick.pickedPoint);
  });

  // Main loop
  scene.onBeforeRenderObservable.add(() => {
    if (G.ended) return;
    const dt = engine.getDeltaTime() / 1000;
    // Spawning
    G.spawnAcc += dt;
    const spawnEvery = Math.max(0.55, 1.6 - G.wave * 0.18);
    if (G.spawnAcc >= spawnEvery && G.waveBudget > 0) {
      G.spawnAcc = 0; G.waveBudget--;
      spawnMissile();
    }
    // Move missiles
    for (const m of G.missiles) {
      if (m.dead) continue;
      m.mesh.position.addInPlace(m.dir.scale(m.speed * dt * 60));
      if (m.mesh.position.y <= cityRowY + 1 && m.target.alive) {
        // City hit
        m.dead = true;
        m.target.alive = false;
        m.target.mesh.scaling.y = 0.15;
        m.target.mesh.material.diffuseColor = new BABYLON.Color3(0.4, 0.1, 0.1);
        m.target.mesh.material.emissiveColor = new BABYLON.Color3(0.4, 0.05, 0.05);
        G.alive--;
        ui.cities(String(G.alive));
        flashMessage(hud, '💥 City lost!', 700);
        if (G.alive <= 0) return endGame(false);
      }
    }
    // Move interceptors
    for (const it of G.interceptors) {
      if (it.dead) continue;
      it.mesh.position.addInPlace(it.dir.scale(it.speed * dt * 60));
      if (BABYLON.Vector3.Distance(it.mesh.position, it.target) < 1.2) {
        it.dead = true;
        explode(it.mesh.position.clone());
      }
    }
    // Update blasts
    for (const b of G.blasts) {
      b.t++;
      const k = b.t / b.maxT;
      const scale = 0.5 + k * (b.r * 2);
      b.mesh.scaling.set(scale, scale, scale);
      b.mesh.material.alpha = Math.max(0, 0.75 * (1 - k));
      if (b.t >= b.maxT) b.done = true;
    }
    // GC
    G.missiles = G.missiles.filter((m) => { if (m.dead) { m.mesh.dispose(); m.trail && m.trail.dispose(); return false; } return true; });
    G.interceptors = G.interceptors.filter((it) => { if (it.dead) { it.mesh.dispose(); it.trail && it.trail.dispose(); return false; } return true; });
    G.blasts = G.blasts.filter((b) => { if (b.done) { b.mesh.dispose(); return false; } return true; });

    // Wave end?
    if (G.waveBudget === 0 && G.missiles.length === 0) {
      if (G.wave >= TARGET_WAVES) return endGame(true);
      G.wave++;
      startWave();
    }
  });

  function endGame(win) {
    G.ended = true;
    timers.stopGame();
    setStatus(s, win ? `City defended! Final score ${G.score}.` : `City fallen. Final score ${G.score}.`, win ? 'good' : 'bad');
    flashMessage(hud, win ? 'VICTORY' : 'GAME OVER', 2200);
    if (win) {
      celebrate({
        gameName: 'Missile Defense',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Score <b>${G.score}</b> · ${TARGET_WAVES} waves survived`,
      });
    }
  }

  restartBtn.onclick = restart;
  setStatus(s, 'Click anywhere in the sky to fire an interceptor.');
  timers.resetGame();

  return () => dispose();
});
