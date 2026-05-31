import { el, header, toolbar, status, setStatus } from '../../helpers.js';
import { celebrate } from '../../celebration.js';
import { timers } from '../../timer.js';
import { asyncGame, setupScene, makeHud, flashMessage } from '../../babylon/scene.js';

// Top-down 3D tank duel vs computer. Move with WASD, aim with mouse/touch,
// click/tap to fire. Destroy the enemy tank to win.
export const tankDuel = asyncGame((shell, BABYLON, { getMode }, restart) => {
  const mode = getMode();
  const PLAYER_HP = mode === 'advanced' ? 5 : 6;
  const AI_HP = mode === 'advanced' ? 7 : 5;
  const AI_REACTION = mode === 'advanced' ? 0.45 : 0.8;

  header(shell, {
    title: '🛡 Tank Duel',
    tag: 'Top-down arena vs the computer',
    desc: 'Crawl around the rubble, line up your shot and fire. Walls block shells. Reduce the enemy tank to scrap to win.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(restartBtn);
  const s = status(shell);
  const arena = el('div', { class: 'bjs-host' });
  shell.appendChild(arena);

  const { canvas, engine, scene, hud, dispose } = setupScene(arena, BABYLON, { clearColor: [0.10, 0.08, 0.05] });
  const ui = makeHud(hud, [
    { key: 'you',  label: 'You', value: '♥'.repeat(PLAYER_HP) },
    { key: 'ai',   label: 'AI',  value: '♥'.repeat(AI_HP) },
    { key: 'shells', label: 'Shells fired', value: '0' },
  ]);

  // Top-down camera
  const camera = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 32, 0), scene);
  camera.setTarget(new BABYLON.Vector3(0, 0, 0));
  camera.inputs.clear();
  new BABYLON.HemisphericLight('hl', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.95;

  // Ground (sand)
  const ground = BABYLON.MeshBuilder.CreateGround('g', { width: 40, height: 30 }, scene);
  const gm = new BABYLON.StandardMaterial('gm', scene); gm.diffuseColor = new BABYLON.Color3(0.55, 0.45, 0.25);
  ground.material = gm;

  // Boundary walls + obstacles
  const walls = [];
  function makeWall(x, z, w, d) {
    const b = BABYLON.MeshBuilder.CreateBox('wall', { width: w, height: 1.8, depth: d }, scene);
    b.position.set(x, 0.9, z);
    const m = new BABYLON.StandardMaterial('wm', scene); m.diffuseColor = new BABYLON.Color3(0.35, 0.3, 0.22); b.material = m;
    walls.push({ mesh: b, w, d, x, z });
    return b;
  }
  // boundary
  makeWall(0,  15.5, 40, 1); makeWall(0, -15.5, 40, 1);
  makeWall( 20.5, 0, 1, 32); makeWall(-20.5, 0, 1, 32);
  // obstacles
  const OBS = [[-10, 4, 3, 2], [8, -3, 4, 2], [-5, -7, 2, 4], [12, 7, 2, 3], [0, 0, 1.5, 1.5]];
  OBS.forEach(([x, z, w, d]) => makeWall(x, z, w, d));

  function makeTank(color, x, z, isPlayer) {
    const node = new BABYLON.TransformNode('tank', scene);
    const hull = BABYLON.MeshBuilder.CreateBox('h', { width: 2.2, height: 0.9, depth: 3.0 }, scene);
    hull.parent = node; hull.position.y = 0.45;
    const turret = BABYLON.MeshBuilder.CreateCylinder('t', { diameter: 1.4, height: 0.6 }, scene);
    turret.parent = node; turret.position.y = 1.1;
    const barrel = BABYLON.MeshBuilder.CreateCylinder('b', { diameter: 0.3, height: 2.0 }, scene);
    barrel.parent = turret; barrel.rotation.x = Math.PI / 2; barrel.position.z = 1.2;
    const mat = new BABYLON.StandardMaterial('tm', scene); mat.diffuseColor = color; mat.specularColor = BABYLON.Color3.Black();
    hull.material = turret.material = barrel.material = mat;
    node.position.set(x, 0, z);
    return { node, turret, barrel, hp: isPlayer ? PLAYER_HP : AI_HP, isPlayer, color };
  }

  const player = makeTank(new BABYLON.Color3(0.3, 0.8, 0.4), -14, -10, true);
  const ai     = makeTank(new BABYLON.Color3(0.85, 0.25, 0.25), 14, 10, false);
  let shellsFired = 0;
  const shells = [];

  function tankBlocked(node, nx, nz) {
    const halfX = 1.3, halfZ = 1.6;
    for (const w of walls) {
      const x0 = w.x - w.w / 2 - halfX, x1 = w.x + w.w / 2 + halfX;
      const z0 = w.z - w.d / 2 - halfZ, z1 = w.z + w.d / 2 + halfZ;
      if (nx > x0 && nx < x1 && nz > z0 && nz < z1) return true;
    }
    return false;
  }

  function fire(tank) {
    const m = BABYLON.MeshBuilder.CreateSphere('shell', { diameter: 0.4 }, scene);
    const mat = new BABYLON.StandardMaterial('sm', scene); mat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.3); mat.disableLighting = true; m.material = mat;
    const angle = tank.turret.rotation.y;
    const dirX = Math.sin(angle), dirZ = Math.cos(angle);
    m.position.set(tank.node.position.x + dirX * 2, 0.9, tank.node.position.z + dirZ * 2);
    shells.push({ mesh: m, dx: dirX, dz: dirZ, owner: tank });
    if (tank === player) { shellsFired++; ui.shells(String(shellsFired)); }
  }

  // Player input
  const keys = {};
  const kd = (e) => { keys[e.key.toLowerCase()] = true; }, ku = (e) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  let aimWorld = new BABYLON.Vector3(0, 0, 1);
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top, (m) => m === ground);
    if (pick && pick.pickedPoint) aimWorld.copyFrom(pick.pickedPoint);
  });
  let lastFire = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (G.ended) return;
    const rect = canvas.getBoundingClientRect();
    const pick = scene.pick(e.clientX - rect.left, e.clientY - rect.top, (m) => m === ground);
    if (pick && pick.pickedPoint) aimWorld.copyFrom(pick.pickedPoint);
    if (performance.now() - lastFire > 350) { lastFire = performance.now(); fire(player); }
  });

  const G = { ended: false, aiCool: 0, aiDir: { x: 0, z: 0 }, aiRetarget: 0 };

  function hasLineOfSight(a, b) {
    const steps = 18;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      for (const w of walls) {
        const x0 = w.x - w.w/2, x1 = w.x + w.w/2, z0 = w.z - w.d/2, z1 = w.z + w.d/2;
        if (x > x0 && x < x1 && z > z0 && z < z1) return false;
      }
    }
    return true;
  }

  scene.onBeforeRenderObservable.add(() => {
    if (G.ended) return;
    const dt = engine.getDeltaTime() / 1000;
    // Player movement
    let mx = 0, mz = 0;
    if (keys['w']) mz += 1; if (keys['s']) mz -= 1;
    if (keys['a']) mx -= 1; if (keys['d']) mx += 1;
    const sp = 7 * dt;
    const nx = player.node.position.x + mx * sp, nz = player.node.position.z + mz * sp;
    if (!tankBlocked(player.node, nx, player.node.position.z)) player.node.position.x = nx;
    if (!tankBlocked(player.node, player.node.position.x, nz)) player.node.position.z = nz;
    // Aim
    const ax = aimWorld.x - player.node.position.x, az = aimWorld.z - player.node.position.z;
    player.turret.rotation.y = Math.atan2(ax, az);

    // AI
    G.aiCool -= dt; G.aiRetarget -= dt;
    if (G.aiRetarget <= 0) {
      G.aiRetarget = 1 + Math.random() * 1.5;
      const dx = player.node.position.x - ai.node.position.x, dz = player.node.position.z - ai.node.position.z;
      const dlen = Math.hypot(dx, dz) || 1;
      G.aiDir = { x: dx / dlen, z: dz / dlen };
      // Add some wobble
      const ang = Math.atan2(G.aiDir.x, G.aiDir.z) + (Math.random() - 0.5) * 0.8;
      G.aiDir = { x: Math.sin(ang), z: Math.cos(ang) };
    }
    const aiSpeed = 4 * dt;
    const anx = ai.node.position.x + G.aiDir.x * aiSpeed, anz = ai.node.position.z + G.aiDir.z * aiSpeed;
    if (!tankBlocked(ai.node, anx, ai.node.position.z)) ai.node.position.x = anx; else G.aiDir.x = -G.aiDir.x;
    if (!tankBlocked(ai.node, ai.node.position.x, anz)) ai.node.position.z = anz; else G.aiDir.z = -G.aiDir.z;
    const adx = player.node.position.x - ai.node.position.x, adz = player.node.position.z - ai.node.position.z;
    ai.turret.rotation.y = Math.atan2(adx, adz);
    if (G.aiCool <= 0 && hasLineOfSight(ai.node.position, player.node.position)) {
      G.aiCool = AI_REACTION + Math.random() * 0.3;
      fire(ai);
    }

    // Shells
    const shellSpeed = 22 * dt;
    for (const sh of shells) {
      if (sh.dead) continue;
      sh.mesh.position.x += sh.dx * shellSpeed; sh.mesh.position.z += sh.dz * shellSpeed;
      // Walls
      for (const w of walls) {
        const x0 = w.x - w.w/2, x1 = w.x + w.w/2, z0 = w.z - w.d/2, z1 = w.z + w.d/2;
        if (sh.mesh.position.x > x0 && sh.mesh.position.x < x1 && sh.mesh.position.z > z0 && sh.mesh.position.z < z1) { sh.dead = true; break; }
      }
      if (sh.dead) continue;
      // Hit target
      const target = sh.owner === player ? ai : player;
      const dx = sh.mesh.position.x - target.node.position.x, dz = sh.mesh.position.z - target.node.position.z;
      if (Math.hypot(dx, dz) < 1.5) {
        sh.dead = true;
        target.hp = Math.max(0, target.hp - 1);
        ui[target.isPlayer ? 'you' : 'ai']('♥'.repeat(target.hp));
        flashMessage(hud, target.isPlayer ? '💥 You hit!' : '🎯 Hit them!', 700);
        if (target.hp <= 0) return endGame(target.isPlayer ? false : true);
      }
      if (Math.abs(sh.mesh.position.x) > 21 || Math.abs(sh.mesh.position.z) > 16) sh.dead = true;
    }
    for (let i = shells.length - 1; i >= 0; i--) if (shells[i].dead) { shells[i].mesh.dispose(); shells.splice(i, 1); }
  });

  function endGame(win) {
    G.ended = true;
    timers.stopGame();
    setStatus(s, win ? `Enemy destroyed! ${shellsFired} shells fired.` : 'Your tank is rubble.', win ? 'good' : 'bad');
    flashMessage(hud, win ? 'VICTORY' : 'DESTROYED', 2400);
    if (win) celebrate({
      gameName: 'Tank Duel',
      gameTimeMs: timers.getGameElapsed(),
      totalTimeMs: timers.getTotalElapsed(),
      extra: `Shells fired: <b>${shellsFired}</b>`,
    });
  }

  restartBtn.onclick = restart;
  setStatus(s, 'WASD to move, mouse/touch to aim, click/tap to fire.');
  timers.resetGame();

  function teardown() {
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    dispose();
  }
  return teardown;
});
