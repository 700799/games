// Tiny DOM + game helpers used across games.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') node.className = props[k];
    else if (k === 'style' && typeof props[k] === 'object') Object.assign(node.style, props[k]);
    else if (k.startsWith('on') && typeof props[k] === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), props[k]);
    } else if (k === 'html') {
      node.innerHTML = props[k];
    } else {
      node.setAttribute(k, props[k]);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function header(shell, { title, tag, desc }) {
  const h = el('header', { class: 'game-header' }, [
    el('div', {}, [
      el('h2', { class: 'game-title' }, title),
      tag ? el('div', { class: 'game-tag' }, tag) : null,
    ]),
  ]);
  shell.appendChild(h);
  if (desc) shell.appendChild(el('p', { class: 'game-desc' }, desc));
  return h;
}

export function toolbar(shell) {
  const t = el('div', { class: 'game-toolbar' });
  shell.appendChild(t);
  return t;
}

export function status(shell) {
  const s = el('div', { class: 'status' });
  shell.appendChild(s);
  return s;
}

export function setStatus(node, text, kind = '') {
  node.className = `status ${kind}`;
  node.innerHTML = text;
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Smart cleanup: returns a teardown function that runs all registered fns.
export function teardownRegistry() {
  const fns = [];
  return {
    add(fn) { fns.push(fn); },
    run() { fns.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); fns.length = 0; },
  };
}
