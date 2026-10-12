import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DUR, STAGGER, REDUCED } from './eases.js';
import { isPhone } from './scroll.js';
import { p, line, ctn } from './reveal.js';
import { PLAN } from './plan-data.js';
import { ROAD } from './plan-road.js';

gsap.registerPlugin(ScrollTrigger);

// Section 6: the master plan. The road draws itself under scroll (one scrubbed pen) and each plot is stamped
// as the pen reaches its villa; the pins open a card with the plot's area and position.
const NS = 'http://www.w3.org/2000/svg';
const KIND = { villa: 'Villa', religious: 'Worship centre', tbc: 'Use to be confirmed' };
const STATUS = { villa: 'Availability on request', religious: 'Set aside for a worship centre', tbc: 'To be confirmed with Leventra' };
const pad = (n) => String(n).padStart(2, '0');
const sqm = (n) => n.toLocaleString('en-GB');
const fmt = (n, el) => (el.dataset.format === 'comma' ? Math.round(n).toLocaleString('en-GB') : el.dataset.format === 'dec' ? n.toFixed(1) : String(Math.round(n))) + (el.dataset.suffix || '');
const waLink = (n) => `https://wa.me/234?text=${encodeURIComponent(`Hello Leventra, I would like to ask about Plot ${n} at Istinye Villas.`)}`;
const TYPICAL = 17;

export function initPlan() {
  const root = document.querySelector('.plan'); if (!root) return;
  const head = root.querySelector('.plan__head'), stage = root.querySelector('[data-plan-stage]'), svg = root.querySelector('[data-plan-overlay]');
  const pinsEl = root.querySelector('[data-plan-pins]'), card = root.querySelector('[data-plan-card]'), scroller = root.querySelector('[data-plan-scroller]');
  const hint = root.querySelector('[data-plan-hint]'), leader = root.querySelector('[data-plan-leader]'), foot = root.querySelector('.plan__foot');
  const live = document.querySelector('[data-live]');
  const phone = isPhone();

  // ---- the overlay: the pen (gate, roundabout, loop), the spine, and the gold mark around a typical plot
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); svg.appendChild(e); return e; };
  const pen = el('path', { class: 'plan__road', d: ROAD.pen });
  const spine = el('path', { class: 'plan__road', d: ROAD.spine });
  const ring = el('circle', { class: 'plan__road', cx: ROAD.ring.cx, cy: ROAD.ring.cy, r: ROAD.ring.r });
  const typical = PLAN.plots.find((x) => x.n === TYPICAL);
  const markR = Math.round(PLAN.w * 0.042);
  const mark = el('circle', { class: 'plan__mark', cx: (typical.x / 100) * PLAN.w, cy: (typical.y / 100) * PLAN.h, r: markR });

  // ---- the pins, in keyboard order: the villas by number, then the three non-villa plots
  const order = [...PLAN.plots].sort((a, b) => (a.kind === 'villa' ? 0 : 1) - (b.kind === 'villa' ? 0 : 1) || a.n - b.n);
  const pins = order.map((pl, i) => {
    const li = document.createElement('li'); li.className = 'plot' + (pl.kind === 'villa' ? '' : ' plot--hollow');
    li.style.setProperty('--px', `${pl.x}%`); li.style.setProperty('--py', `${pl.y}%`);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'plot__btn'; b.textContent = pad(pl.n);
    b.setAttribute('aria-label', `Plot ${pl.n}, ${sqm(pl.area)} square metres, ${KIND[pl.kind].toLowerCase()}`);
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'plan-card'); b.tabIndex = i === 0 ? 0 : -1;
    li.appendChild(b); pinsEl.appendChild(li);
    return { pl, li, b, on: false, at: 1 };
  });

  // ---- where the pen passes each plot (fraction of the pen's length), measured once from the path itself
  const L = pen.getTotalLength();
  const samples = []; for (let d = 0; d <= L; d += 8) { const q = pen.getPointAtLength(d); samples.push([q.x, q.y, d / L]); }
  const nearest = (x, y) => { let best = Infinity, at = 1; for (const [sx, sy, f] of samples) { const dd = (sx - x) ** 2 + (sy - y) ** 2; if (dd < best) { best = dd; at = f; } } return at; };
  pins.forEach((o) => { o.at = o.pl.kind === 'villa' ? Math.min(nearest((o.pl.x / 100) * PLAN.w, (o.pl.y / 100) * PLAN.h) + 0.015, 0.995) : 0.985; });
  const fRing = nearest(ROAD.ring.cx - ROAD.ring.r, ROAD.ring.cy);
  const m = ROAD.spine.match(/M([\d.]+),([\d.]+)/); const fSpine = nearest(+m[1], +m[2]);

  // ---- initial states
  gsap.set(pins.map((o) => o.li), { opacity: 0, scale: 0.6 });
  [pen, spine, ring, mark].forEach((e) => { const l = e.getTotalLength(); e.style.strokeDasharray = `${l}`; e.style.strokeDashoffset = REDUCED && e !== mark ? '0' : `${l}`; });
  const stats = [...root.querySelectorAll('.plan__stats .stat')], nums = [...root.querySelectorAll('.plan__stats [data-count]')];
  const setNum = (n, v) => { n.firstChild.nodeValue = fmt(v, n); };
  if (!REDUCED) { nums.forEach((n) => setNum(n, 0)); gsap.set(stats, { opacity: 0, y: 16 }); gsap.set(stage, { opacity: 0, y: 40 }); }

  const stampTo = (progress) => pins.forEach((o) => {
    const on = progress >= o.at; if (on === o.on) return; o.on = on;
    if (REDUCED) return gsap.set(o.li, { opacity: on ? 1 : 0, scale: 1 });
    gsap.to(o.li, on ? { opacity: 1, scale: 1, duration: DUR.s, ease: 'out', overwrite: true } : { opacity: 0, scale: 0.6, duration: DUR.s / 2, ease: 'in', overwrite: true });
  });

  // ---- entrance: the words, the hairline, the figures counting in, the sheet rising
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
  ScrollTrigger.create({ trigger: stage, start: 'top 88%', once: true, onEnter: () => { if (!REDUCED) gsap.to(stage, { opacity: 1, y: 0, duration: DUR.l, ease: 'out' }); } });

  // ---- the signature: the pen draws the road under scroll; each plot is stamped as the pen reaches it
  if (REDUCED) stampTo(1);
  else {
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: stage, start: 'top 60%', end: 'center 52%', scrub: true, onUpdate: (st) => stampTo(st.progress) } });
    tl.to(pen, { strokeDashoffset: 0, duration: 1 }, 0);
    tl.to(ring, { strokeDashoffset: 0, duration: 0.05 }, fRing);
    tl.to(spine, { strokeDashoffset: 0, duration: 0.12 }, fSpine);
    if (!phone) gsap.fromTo(scroller, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: scroller, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // ---- the card
  const f = { label: card.querySelector('[data-card-label]'), area: card.querySelector('[data-card-area]'), where: card.querySelector('[data-card-where]'), status: card.querySelector('[data-card-status]'), link: card.querySelector('[data-card-link]') };
  let active = null;
  const fill = (pl) => {
    f.label.textContent = `Plot ${pad(pl.n)} / ${KIND[pl.kind]}`;
    f.area.innerHTML = `${sqm(pl.area)}<small>sqm</small>`;
    f.where.textContent = `${pl.where}.${pl.tags.includes('corner') ? ' An end plot.' : ''}`;
    f.status.textContent = STATUS[pl.kind];
    f.link.hidden = pl.kind !== 'villa'; f.link.href = waLink(pl.n); f.link.textContent = `Ask about plot ${pl.n}`;
  };
  const place = (pl) => {
    if (phone) { scroller.scrollTo({ left: (pl.x / 100) * stage.offsetWidth - scroller.clientWidth / 2, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
    const flip = pl.x > 60;
    card.style.left = flip ? 'auto' : `calc(${pl.x}% + 22px)`; card.style.right = flip ? `calc(${100 - pl.x}% + 22px)` : 'auto';
    card.style.top = `calc(${Math.min(pl.y, 68)}% - 20px)`;
  };
  const open = (o) => {
    if (active) active.b.setAttribute('aria-expanded', 'false');
    active = o; o.b.setAttribute('aria-expanded', 'true');
    fill(o.pl); place(o.pl); card.hidden = false;
    gsap.fromTo(card, { opacity: 0, y: REDUCED ? 0 : 12 }, { opacity: 1, y: 0, duration: REDUCED ? 0.2 : DUR.s, ease: 'out', overwrite: true });
    if (live) live.textContent = `Plot ${o.pl.n}. ${sqm(o.pl.area)} square metres. ${KIND[o.pl.kind]}. ${o.pl.where}.`;
  };
  const close = (refocus) => {
    if (!active) return; const o = active; active = null; o.b.setAttribute('aria-expanded', 'false');
    gsap.to(card, { opacity: 0, duration: DUR.s / 2, ease: 'in', overwrite: true, onComplete: () => { card.hidden = true; } });
    if (refocus) o.b.focus();
  };
  pins.forEach((o) => o.b.addEventListener('click', () => (active === o ? close(true) : open(o))));
  card.querySelector('[data-plan-close]').addEventListener('click', () => close(true));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(true); return; }
    const i = pins.findIndex((o) => o.b === document.activeElement); if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const to = step ? (i + step + pins.length) % pins.length : e.key === 'Home' ? 0 : e.key === 'End' ? pins.length - 1 : -1;
    if (to < 0) return; e.preventDefault();
    pins[i].b.tabIndex = -1; pins[to].b.tabIndex = 0; pins[to].b.focus();
    if (phone) place(pins[to].pl);
  });
  document.addEventListener('pointerdown', (e) => { if (active && !card.contains(e.target) && !pinsEl.contains(e.target)) close(false); });
  if (hint) scroller.addEventListener('scroll', () => gsap.to(hint, { opacity: 0, duration: DUR.s, ease: 'out' }), { once: true, passive: true });

  // ---- the hand-off: a gold circle around the typical plot, a leader that runs from it to the foot of the page
  leader.style.setProperty('--lx', `${typical.x}%`);
  leader.style.setProperty('--ly', `${typical.y + (markR / PLAN.h) * 100}%`);
  const geom = () => {
    const shift = +gsap.getProperty(scroller, 'y') || 0;                       // the parallax, so the leader is measured at rest
    const r = root.getBoundingClientRect(), s = stage.getBoundingClientRect();
    leader.style.setProperty('--lh', `${r.bottom - (s.top - shift) - (typical.y / 100 + markR / PLAN.h) * s.height}px`);
  };
  geom(); ScrollTrigger.addEventListener('refreshInit', geom);
  ScrollTrigger.create({
    trigger: foot, start: 'top 85%', once: true,
    onEnter: () => {
      gsap.to(mark, { strokeDashoffset: 0, duration: REDUCED ? 0.4 : DUR.l, ease: 'inOut' });
      line(leader, 'reveal', 0.3);
      ctn(root.querySelectorAll('.plan__callout-label'), 'reveal', 0.6);
    },
  });
}
