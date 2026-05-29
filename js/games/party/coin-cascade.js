// Coin Cascade — coins rain from the sky! Slide your basket to catch them and
// rack up a fortune, but a caught Bob-omb spills some of your haul.
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor, clamp } from './party-core.js';

export const coinCascade = {
  id: 'coin-cascade',
  name: 'Coin Cascade',
  icon: '🪙',
  color: '#ffd166',
  blurb: 'Catch the falling coins',
  goal: 'Slide your basket to catch the raining coins — dodge the Bob-ombs!',
  controls: 'Drag / Arrows',
  howto: [
    'Drag left/right (or use the ← → arrow keys) to move your basket.',
    'Catch coins 🪙 for +1 and gems 💎 for +5.',
    'Catch a Bob-omb 💣 and you spill 5 coins! Grab as many as you can before time’s up.',
  ],
  run(stage, { practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const DURATION = practice ? 20 : (mode === 'advanced' ? 35 : 30);

    const field = el('div', { class: 'coin-field' });
    const basket = el('div', { class: 'coin-basket' }, '🧺');
    field.appendChild(basket);
    stage.appendChild(field);

    let W = 360, H = 420, bx = 180, over = false;
    let coins = 0, items = [], spawnT = 0, last = 0, rafId = null, elapsed = 0;
    const keys = { left: false, right: false };

    function measure() { W = field.clientWidth || 360; H = field.clientHeight || 420; bx = clamp(bx, 36, W - 36); }

    function spawn() {
      const roll = Math.random();
      let type, glyph;
      if (!practice && roll < 0.16) { type = 'bomb'; glyph = '💣'; }
      else if (roll < 0.30) { type = 'gem'; glyph = '💎'; }
      else { type = 'coin'; glyph = '🪙'; }
      const node = el('div', { class: 'coin-item ' + type }, glyph);
      field.appendChild(node);
      const heat = elapsed / DURATION;
      items.push({
        node, type,
        x: 28 + Math.random() * (W - 56),
        y: -28,
        vy: (130 + Math.random() * 90) * (1 + heat * 0.8),
      });
    }

    function frame(t) {
      if (over) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      elapsed += dt;

      // keyboard motion
      if (keys.left) bx -= 360 * dt;
      if (keys.right) bx += 360 * dt;
      bx = clamp(bx, 36, W - 36);
      basket.style.left = bx + 'px';

      // spawns speed up over time
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = Math.max(0.28, (practice ? 0.85 : 0.62) - elapsed / DURATION * 0.4); }

      const basketY = H - 40, reach = 40;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy * dt;
        it.node.style.transform = `translate(${it.x - 16}px, ${it.y - 16}px)`;
        if (it.y >= basketY - reach && it.y <= basketY + 18 && Math.abs(it.x - bx) < 40) {
          catchItem(it); items.splice(i, 1); it.node.remove(); continue;
        }
        if (it.y > H + 30) { items.splice(i, 1); it.node.remove(); }
      }

      ui.setInfo(`⏱ ${Math.max(0, Math.ceil(DURATION - elapsed))}s`);
      if (elapsed >= DURATION) return finish();
      rafId = requestAnimationFrame(frame);
    }

    function catchItem(it) {
      if (it.type === 'bomb') { coins = Math.max(0, coins - 5); flash('bad'); pop('−5', it.x, 'bad'); }
      else if (it.type === 'gem') { coins += 5; flash('good'); pop('+5', it.x, 'good'); }
      else { coins += 1; pop('+1', it.x, 'good'); }
      ui.setScore(`💰 ${coins}`);
    }

    function flash(kind) { basket.classList.remove('good', 'bad'); void basket.offsetWidth; basket.classList.add(kind); }
    function pop(text, x, kind) {
      const p = el('div', { class: 'coin-pop ' + kind }, text);
      p.style.left = x + 'px'; p.style.top = (H - 60) + 'px';
      field.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }

    function finish() {
      if (over) return; over = true;
      cancelAnimationFrame(rafId);
      const thr = mode === 'advanced' ? [35, 70, 110] : [25, 55, 90];
      onDone({
        score: coins,
        stars: starsFor(coins, thr),
        detail: `Scooped up ${coins} coins in ${DURATION}s!`,
      });
    }

    const onMove = (e) => { const r = field.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; bx = clamp(cx - r.left, 36, W - 36); basket.style.left = bx + 'px'; };
    const onKeyDown = (e) => { if (e.key === 'ArrowLeft') keys.left = true; if (e.key === 'ArrowRight') keys.right = true; };
    const onKeyUp = (e) => { if (e.key === 'ArrowLeft') keys.left = false; if (e.key === 'ArrowRight') keys.right = false; };
    field.addEventListener('pointerdown', onMove);
    field.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') onMove(e); });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    reg.add(() => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); });

    ui.setScore('💰 0');
    ui.setInfo(`⏱ ${DURATION}s`);
    requestAnimationFrame(() => { measure(); basket.style.left = bx + 'px'; last = 0; rafId = requestAnimationFrame(frame); });
    return reg.run;
  },
};
