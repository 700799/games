// Big Bob-omb Blast — a push-your-luck nerve game. Press plungers for escalating
// coins, but one is wired to a Bob-omb. Bank your coins before it goes BOOM!
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor } from './party-core.js';

export const bobOmbBlast = {
  id: 'bob-omb-blast',
  name: 'Big Bob-omb Blast',
  icon: '💣',
  color: '#fb7185',
  blurb: 'Press your luck for coins',
  goal: 'Press plungers for escalating coins — but bank before the Bob-omb blows!',
  controls: 'Tap / Click',
  howto: [
    'Each plunger you press is either safe (💨) or the hidden Bob-omb (💥).',
    'Every safe press is worth more coins than the last — the pot keeps growing.',
    'Hit “Bank it!” to lock in your coins. Press the Bob-omb and you lose the whole pot. How brave are you?',
  ],
  run(stage, { rng, practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const N = mode === 'advanced' ? 8 : 6;
    const bombIdx = Math.floor(rng() * N);
    let pressed = 0, pot = 0, over = false;

    const msg = el('div', { class: 'bomb-msg' }, 'Press a plunger… or will you?');
    const potEl = el('div', { class: 'bomb-pot' }, '💰 Pot: 0');
    const row = el('div', { class: 'bomb-row' });
    const bankBtn = el('button', { class: 'party-btn success big', disabled: 'disabled' }, '💰 Bank it! (0)');
    const bankWrap = el('div', { class: 'bomb-bank' }, [bankBtn]);
    stage.append(msg, potEl, row, bankWrap);

    const plungers = [];
    for (let i = 0; i < N; i++) {
      const p = el('button', { class: 'bomb-plunger' }, [
        el('div', { class: 'bomb-plunger-top' }),
        el('div', { class: 'bomb-plunger-stem' }),
        el('div', { class: 'bomb-plunger-face' }, practice && i === bombIdx ? '💣' : '◉'),
      ]);
      p.onclick = () => press(i);
      row.appendChild(p);
      plungers.push(p);
    }

    function odds() {
      const remaining = N - pressed;
      return remaining > 0 ? Math.round((1 / remaining) * 100) : 0;
    }

    function refresh() {
      potEl.textContent = `💰 Pot: ${pot}`;
      bankBtn.textContent = `💰 Bank it! (${pot})`;
      bankBtn.disabled = pot <= 0 || over;
      ui.setScore(`💰 ${pot}`);
      ui.setInfo(over ? '' : `Blast odds: ${odds()}%`);
    }

    function press(i) {
      if (over || plungers[i].classList.contains('done')) return;
      const p = plungers[i];
      if (i === bombIdx) {
        p.classList.add('done', 'boom');
        p.querySelector('.bomb-plunger-face').textContent = '💥';
        msg.innerHTML = practice
          ? '💥 BOOM! (In a real challenge that would cost you the whole pot.)'
          : '💥 BOOM! The Bob-omb got you — pot lost!';
        stage.classList.add('shake');
        const lost = practice ? 0 : pot;
        finish(practice ? pot : 0, lost, true);
        return;
      }
      pressed++;
      pot += 10 * pressed;            // escalating: 10, 20, 30, ...
      p.classList.add('done', 'safe');
      p.querySelector('.bomb-plunger-face').textContent = '💨';
      msg.innerHTML = pressed >= N - 1
        ? '😱 Only the Bob-omb is left — BANK NOW!'
        : `Phew! +${10 * pressed} coins. Press again… or bank?`;
      refresh();
      if (pressed >= N - 1) {
        // all safe plungers found — auto-bank the guaranteed pot
        msg.innerHTML = '🎉 You found every safe plunger! Pot secured!';
        finish(pot, 0, false);
      }
    }

    bankBtn.onclick = () => { if (!over && pot > 0) { msg.innerHTML = `💰 Banked ${pot} coins — smart!`; finish(pot, 0, false); } };

    function finish(score, _lost, blew) {
      if (over) return; over = true;
      plungers.forEach((p, i) => {
        p.classList.add('done');
        if (i === bombIdx && !p.classList.contains('boom')) p.querySelector('.bomb-plunger-face').textContent = '💣';
      });
      refresh();
      const thr = mode === 'advanced' ? [80, 200, 380] : [60, 150, 280];
      setTimeout(() => onDone({
        score,
        stars: starsFor(score, thr),
        detail: blew
          ? (practice ? `You banked ${score} in practice — nerves of steel needed!` : 'The Bob-omb blew the pot sky-high!')
          : `Banked ${score} coins after ${pressed} brave press${pressed === 1 ? '' : 'es'}!`,
      }), blew ? 700 : 350);
    }

    reg.add(() => { stage.classList.remove('shake'); });
    refresh();
    return reg.run;
  },
};
