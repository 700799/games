// Babylon.js infrastructure for our 3D action games. Lazy-loads the engine
// from a CDN the first time any 3D game opens, then exposes a small helper
// for building a canvas + engine + scene + HUD that disposes cleanly.

const BJS_CDN = 'https://cdn.babylonjs.com/babylon.js';
let _ready = null;

export function loadBabylon() {
  if (window.BABYLON) return Promise.resolve(window.BABYLON);
  if (_ready) return _ready;
  _ready = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = BJS_CDN; s.async = true;
    s.onload = () => resolve(window.BABYLON);
    s.onerror = () => { _ready = null; reject(new Error('Failed to load Babylon.js from CDN')); };
    document.head.appendChild(s);
  });
  return _ready;
}

// Build a sized canvas inside `host` plus the Babylon engine + an empty scene.
// Returns { canvas, engine, scene, hud, dispose }. Call dispose() in teardown.
export function setupScene(host, BABYLON, { clearColor = [0.04, 0.06, 0.12] } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'bjs-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'bjs-canvas';
  canvas.tabIndex = 0;
  wrap.appendChild(canvas);
  const hud = document.createElement('div');
  hud.className = 'bjs-hud';
  wrap.appendChild(hud);
  host.appendChild(wrap);

  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(clearColor[0], clearColor[1], clearColor[2], 1);

  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  engine.runRenderLoop(() => scene.render());

  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    window.removeEventListener('resize', onResize);
    try { engine.stopRenderLoop(); } catch (_) {}
    try { scene.dispose(); } catch (_) {}
    try { engine.dispose(); } catch (_) {}
    try { wrap.remove(); } catch (_) {}
  }

  return { canvas, engine, scene, hud, wrap, dispose };
}

// Convenience: build a top-bar HUD line with score/time chips that auto-update.
export function makeHud(hud, fields) {
  const out = {};
  fields.forEach((f) => {
    const chip = document.createElement('div');
    chip.className = 'bjs-chip';
    chip.innerHTML = `<span class="bjs-chip-label">${f.label}</span><span class="bjs-chip-value">${f.value ?? ''}</span>`;
    hud.appendChild(chip);
    out[f.key] = (v) => { chip.lastElementChild.textContent = v; };
  });
  return out;
}

// A floating message in the centre (e.g., "GAME OVER", "WAVE 3").
export function flashMessage(hud, text, ms = 1400) {
  const m = document.createElement('div');
  m.className = 'bjs-flash';
  m.textContent = text;
  hud.appendChild(m);
  setTimeout(() => m.remove(), ms);
}

// Wire a synchronous mount(shell, opts) ↦ teardown contract around an async
// Babylon setup so the existing app router still works. The asyncStart
// callback receives a `restart` helper it can call to fully tear down and
// rebuild the scene, with the wrapper's tracked cleanup updated each time so
// nothing leaks when the user later navigates away.
export function asyncGame(asyncStart) {
  return function mount(shell, opts) {
    const state = { cleanup: () => {}, cancelled: false };

    function showLoader() {
      shell.innerHTML = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'bjs-loading';
      placeholder.innerHTML = '<div class="bjs-spinner"></div><div>Loading 3D engine…</div>';
      shell.appendChild(placeholder);
      return placeholder;
    }

    function startFresh() {
      // Dispose anything still running from a previous start.
      try { state.cleanup(); } catch (_) {}
      state.cleanup = () => {};
      const placeholder = showLoader();
      loadBabylon().then((BABYLON) => {
        if (state.cancelled) return;
        placeholder.remove();
        try {
          const teardown = asyncStart(shell, BABYLON, opts, startFresh);
          state.cleanup = () => { try { teardown && teardown(); } catch (_) {} };
        } catch (e) {
          console.error(e);
          const err = document.createElement('div');
          err.className = 'bjs-error';
          err.textContent = '⚠️ Could not start the 3D game: ' + (e.message || e);
          shell.appendChild(err);
        }
      }).catch((e) => {
        if (state.cancelled) return;
        placeholder.innerHTML = `<div class="bjs-error">⚠️ ${e.message}. Check your connection and try again.</div>`;
      });
    }

    startFresh();
    return () => { state.cancelled = true; state.cleanup(); };
  };
}
