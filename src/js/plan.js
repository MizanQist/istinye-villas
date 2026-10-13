import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DUR, STAGGER, REDUCED } from './eases.js';
import { isPhone } from './scroll.js';
import { p, line, ctn } from './reveal.js';
import { PLAN } from './plan-data.js';

gsap.registerPlugin(ScrollTrigger);

// Section 6: the master plan. The words and figures reveal; the estate model (plan3d.js, lazy) rises along the road
// as the page scrolls; the pins follow the blocks and open a card with the plot's area and position.
const KIND = { villa: 'Villa', religious: 'Worship centre', tbc: 'Use to be confirmed' };
const STATUS = { villa: 'Availability on request', religious: 'Set aside for a worship centre', tbc: 'To be confirmed with Leventra' };
const pad = (n) => String(n).padStart(2, '0');
const sqm = (n) => n.toLocaleString('en-GB');
const fmt = (n, el) => (el.dataset.format === 'comma' ? Math.round(n).toLocaleString('en-GB') : el.dataset.format === 'dec' ? n.toFixed(1) : String(Math.round(n))) + (el.dataset.suffix || '');
const waLink = (n) => `https://wa.me/234?text=${encodeURIComponent(`Hello Leventra, I would like to ask about Plot ${n} at Istinye Villas.`)}`;
const TYPICAL = 17;

export function initPlan() {
  const root = document.querySelector('.plan'); if (!root) return;
  const head = root.querySelector('.plan__head'), stage = root.querySelector('[data-plan-stage]'), host = root.querySelector('[data-plan-canvas]');
  const pinsEl = root.querySelector('[data-plan-pins]'), card = root.querySelector('[data-plan-card]'), sheet = root.querySelector('.plan__sheet');
  const leader = root.querySelector('[data-plan-leader]'), foot = root.querySelector('.plan__foot'), lock = root.querySelector('[data-plan-lock]'), hint = root.querySelector('[data-plan-hint]');
  const live = document.querySelector('[data-live]');
  const phone = isPhone();

  // ---- the pins, in keyboard order: the villas by number, then the three non-villa plots
  const order = [...PLAN.plots].sort((a, b) => (a.kind === 'villa' ? 0 : 1) - (b.kind === 'villa' ? 0 : 1) || a.n - b.n);
  const pins = order.map((pl, i) => {
    const li = document.createElement('li'); li.className = 'plot' + (pl.kind === 'villa' ? '' : ' plot--hollow');
    li.style.setProperty('--px', `${pl.x}%`); li.style.setProperty('--py', `${pl.y}%`);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'plot__btn'; b.textContent = pad(pl.n);
    b.setAttribute('aria-label', `Plot ${pl.n}, ${sqm(pl.area)} square metres, ${KIND[pl.kind].toLowerCase()}`);
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'plan-card'); b.tabIndex = i === 0 ? 0 : -1;
    li.appendChild(b); pinsEl.appendChild(li);
    return { pl, li, b, sx: pl.x, sy: pl.y, on: false };
  });
  const byN = Object.fromEntries(pins.map((o) => [o.pl.n, o]));
  gsap.set(pins.map((o) => o.li), { opacity: 0, scale: 0.6 });
  const stamp = (n, on) => {
    const o = byN[n]; if (!o || o.on === on) return; o.on = on;
    if (REDUCED) return gsap.set(o.li, { opacity: on ? 1 : 0, scale: 1 });
    gsap.to(o.li, on ? { opacity: 1, scale: 1, duration: DUR.s, ease: 'out', overwrite: true } : { opacity: 0, scale: 0.6, duration: DUR.s / 2, ease: 'in', overwrite: true });
  };

  // ---- entrance: the words, the hairline, the figures counting in, the stage rising
  const stats = [...root.querySelectorAll('.plan__stats .stat')], nums = [...root.querySelectorAll('.plan__stats [data-count]')];
  const setNum = (n, v) => { n.firstChild.nodeValue = fmt(v, n); };
  if (!REDUCED) { nums.forEach((n) => setNum(n, 0)); gsap.set(stats, { opacity: 0, y: 16 }); gsap.set(stage, { opacity: 0 }); }
  ScrollTrigger.create({
    trigger: head, start: 'top 60%', once: true,
    onEnter: () => {
      p(head.querySelectorAll('[data-reveal="p"]'), 'reveal', 0);
      line(head.querySelectorAll('[data-reveal="line"]'), 'reveal', 0.2);
      if (REDUCED) return;
      gsap.to(stats, { opacity: 1, y: 0, duration: DUR.l, ease: 'out', delay: 0.5, stagger: STAGGER });
      nums.forEach((n, i) => { const o = { v: 0 }; gsap.to(o, { v: +n.dataset.count, duration: DUR.l, ease: 'out', delay: 0.6 + i * STAGGER, onUpdate: () => setNum(n, o.v) }); });
    },
  });
  ScrollTrigger.create({ trigger: stage, start: 'top 88%', once: true, onEnter: () => { if (!REDUCED) gsap.to(stage, { opacity: 1, duration: DUR.l, ease: 'out' }); } });

  // ---- the card
  const f = { label: card.querySelector('[data-card-label]'), area: card.querySelector('[data-card-area]'), where: card.querySelector('[data-card-where]'), status: card.querySelector('[data-card-status]'), link: card.querySelector('[data-card-link]') };
  let active = null, model = null, pickedAt = 0;   // pickedAt: a tap on the model also fires a click on the pin it reveals
  const fill = (pl) => {
    f.label.textContent = `Plot ${pad(pl.n)} / ${KIND[pl.kind]}`;
    f.area.innerHTML = `${sqm(pl.area)}<small>sqm</small>`;
    f.where.textContent = `${pl.where}.${pl.tags.includes('corner') ? ' An end plot.' : ''}`;
    f.status.textContent = STATUS[pl.kind];
    f.link.hidden = pl.kind !== 'villa'; f.link.href = waLink(pl.n); f.link.textContent = `Ask about plot ${pl.n}`;
  };
  const place = (o) => {
    if (phone) return;
    const flip = o.sx > 60;
    card.style.left = flip ? 'auto' : `calc(${o.sx}% + 22px)`; card.style.right = flip ? `calc(${100 - o.sx}% + 22px)` : 'auto';
    card.style.top = `calc(${Math.min(Math.max(o.sy, 4), 66)}% - 20px)`;
  };
  const open = (o) => {
    if (active) active.b.setAttribute('aria-expanded', 'false');
    active = o; o.b.setAttribute('aria-expanded', 'true');
    fill(o.pl); place(o); card.hidden = false; model && model.select(o.pl.n);
    gsap.fromTo(card, { opacity: 0, y: REDUCED ? 0 : 12 }, { opacity: 1, y: 0, duration: REDUCED ? 0.2 : DUR.s, ease: 'out', overwrite: true });
    if (live) live.textContent = `Plot ${o.pl.n}. ${sqm(o.pl.area)} square metres. ${KIND[o.pl.kind]}. ${o.pl.where}.`;
  };
  const close = (refocus) => {
    if (!active) return; const o = active; active = null; o.b.setAttribute('aria-expanded', 'false'); model && model.select(null);
    gsap.to(card, { opacity: 0, duration: DUR.s / 2, ease: 'in', overwrite: true, onComplete: () => { card.hidden = true; } });
    if (refocus) o.b.focus();
  };
  pins.forEach((o) => {
    o.b.addEventListener('click', () => { if (performance.now() - pickedAt < 600) return; active === o ? close(true) : open(o); });
    o.b.addEventListener('focus', () => model && model.hover(o.pl.n));
    o.b.addEventListener('blur', () => model && model.hover(null));
    o.li.addEventListener('pointerenter', () => model && model.hover(o.pl.n));
    o.li.addEventListener('pointerleave', () => model && model.hover(null));
  });
  card.querySelector('[data-plan-close]').addEventListener('click', () => close(true));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(true); return; }
    const i = pins.findIndex((o) => o.b === document.activeElement); if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const to = step ? (i + step + pins.length) % pins.length : e.key === 'Home' ? 0 : e.key === 'End' ? pins.length - 1 : -1;
    if (to < 0) return; e.preventDefault();
    pins[i].b.tabIndex = -1; pins[to].b.tabIndex = 0; pins[to].b.focus();
  });
  document.addEventListener('pointerdown', (e) => { if (active && !card.contains(e.target) && !pinsEl.contains(e.target) && !host.contains(e.target)) close(false); });

  // ---- the hand-off: a leader from the typical plot to the foot of the page (section 7 starts its rule at the same x)
  const typical = byN[TYPICAL];
  const geom = () => { const r = root.getBoundingClientRect(), s = stage.getBoundingClientRect(); leader.style.setProperty('--lh', `${r.bottom - s.top - (typical.sy / 100) * s.height - 22}px`); };
  const setLeader = () => { leader.style.setProperty('--lx', `${typical.sx}%`); leader.style.setProperty('--ly', `calc(${typical.sy}% + 22px)`); document.documentElement.style.setProperty('--leader-page-x', `${Math.round(stage.offsetLeft + (typical.sx / 100) * stage.offsetWidth)}px`); };
  setLeader(); geom(); ScrollTrigger.addEventListener('refreshInit', geom);
  ScrollTrigger.create({ trigger: foot, start: 'top 85%', once: true, onEnter: () => { geom(); line(leader, 'reveal', 0.3); ctn(root.querySelectorAll('.plan__callout-label'), 'reveal', 0.6); } });

  // ---- the model: loaded when the section comes near; the architect's sheet stays as the fallback
  const boot = () => import('./plan3d.js').then((m) => {
    model = m.initPlan3d({
      stage, canvasHost: host, plots: PLAN.plots, phone,
      onStamp: stamp,
      onHover: (n) => pins.forEach((o) => o.li.classList.toggle('is-hover', o.pl.n === n)),
      onSelect: (n) => { const o = byN[n]; if (o) { pickedAt = performance.now(); pins.forEach((x) => { x.b.tabIndex = x === o ? 0 : -1; }); open(o); } },
      onFrame: (pos) => {
        pins.forEach((o) => { const q = pos[o.pl.n]; if (!q) return; o.sx = q.x; o.sy = q.y; o.li.style.setProperty('--px', `${q.x}%`); o.li.style.setProperty('--py', `${q.y}%`); });
        setLeader(); if (active) place(active);
      },
    });
    stage.classList.add('is-3d'); sheet.hidden = true;
    root.querySelectorAll('[data-plan-view]').forEach((b) => b.addEventListener('click', () => { model.setView(b.dataset.planView); root.querySelectorAll('[data-plan-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    root.querySelectorAll('[data-plan-sun]').forEach((b) => b.addEventListener('click', () => { model.setSun(b.dataset.planSun); root.querySelectorAll('[data-plan-sun]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    if (lock) lock.addEventListener('click', () => { const on = lock.getAttribute('aria-pressed') !== 'true'; lock.setAttribute('aria-pressed', String(on)); lock.textContent = on ? 'Done exploring' : 'Touch to explore'; on ? model.unlock() : model.lock(); if (hint) hint.hidden = true; });
  }).catch((e) => { console.error(e); sheet.hidden = false; stage.classList.add('is-flat'); pins.forEach((o) => stamp(o.pl.n, true)); });
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { boot(); io.disconnect(); } }, { rootMargin: '1200px 0px' }); io.observe(stage); } else boot();
}
