// Tracks two timers: the per-game timer (resets on tab change / restart)
// and the total session timer (runs from first interaction).
const fmt = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(t / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return `${m}:${s}`;
};

class StopwatchPair {
  constructor() {
    this.gameEl = document.getElementById('game-timer');
    this.totalEl = document.getElementById('total-timer');
    this.gameStart = null;
    this.totalStart = null;
    this.gameElapsedFreeze = 0;
    this.totalStarted = false;
    this.tick = this.tick.bind(this);
    this.frame = null;
  }
  startTotalIfNeeded() {
    if (!this.totalStarted) {
      this.totalStart = performance.now();
      this.totalStarted = true;
      this.loop();
    }
  }
  resetGame() {
    this.gameStart = performance.now();
    this.gameElapsedFreeze = 0;
    this.startTotalIfNeeded();
  }
  stopGame() {
    if (this.gameStart != null) {
      this.gameElapsedFreeze = performance.now() - this.gameStart;
      this.gameStart = null;
    }
  }
  getGameElapsed() {
    if (this.gameStart == null) return this.gameElapsedFreeze;
    return performance.now() - this.gameStart;
  }
  getTotalElapsed() {
    if (!this.totalStarted) return 0;
    return performance.now() - this.totalStart;
  }
  loop() {
    if (this.frame) return;
    const step = () => {
      this.tick();
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
  tick() {
    this.gameEl.textContent = fmt(this.getGameElapsed());
    this.totalEl.textContent = fmt(this.getTotalElapsed());
  }
}

export const timers = new StopwatchPair();
export const formatMs = fmt;
