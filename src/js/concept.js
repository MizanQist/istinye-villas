import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DUR, STAGGER, REDUCED } from './eases.js';
import { p, line } from './reveal.js';

const fmt = (n, el) => (el.dataset.format === 'comma' ? Math.round(n).toLocaleString('en-GB') : String(Math.round(n))) + (el.dataset.suffix || '');

export function initConcept() {
  const root = document.querySelector('.concept'); if (!root) return;
  const initial = root.querySelector('.concept__initial');
  if (initial && !REDUCED) gsap.fromTo(initial, { y: 160 }, { y: -40, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } });

  // stats count up in the display face once the row arrives
  const nums = [...root.querySelectorAll('[data-count]')];
  nums.forEach((el) => { el._small = el.querySelector('small'); el._target = +el.dataset.count; });
  const setNum = (el, v) => { el.firstChild.nodeValue = fmt(v, el); };
  const rows = [...root.querySelectorAll('.principle')];
  const rules = root.querySelector('.concept__rule');

  if (!REDUCED) {
    nums.forEach((el) => setNum(el, 0));
    gsap.set(rows, { opacity: 0, y: 24 });
    gsap.set(root.querySelectorAll('.stat'), { opacity: 0, y: 16 });
  }
  ScrollTrigger.create({
    trigger: root, start: 'top 65%', once: true,
    onEnter: () => {
      p(root.querySelectorAll('.concept__eyebrow, .concept__line'), 'reveal', 0);
      line(rules, 'reveal', 0.2);
      p(root.querySelectorAll('.concept__body'), 'reveal', 0.3);
      if (REDUCED) return;
      gsap.to(root.querySelectorAll('.stat'), { opacity: 1, y: 0, duration: DUR.l, ease: 'out', stagger: STAGGER, delay: 0.5 });
      nums.forEach((el, i) => { const o = { v: 0 }; gsap.to(o, { v: el._target, duration: DUR.l, ease: 'out', delay: 0.6 + i * STAGGER, onUpdate: () => setNum(el, o.v) }); });
      gsap.to(rows, { opacity: 1, y: 0, duration: DUR.l, ease: 'out', stagger: STAGGER, delay: 0.7 });
    },
  });

  // principle rows: measure each description so the hover height animates to its real size
  const measure = () => rows.forEach((r) => { const d = r.querySelector('.principle__desc'); r.style.setProperty('--desc-h', 'auto'); const h = d.scrollHeight; r.style.setProperty('--desc-h', `${h}px`); });
  measure(); window.addEventListener('resize', measure);
  rows.forEach((r) => { r.addEventListener('focusin', () => r.classList.add('is-open')); r.addEventListener('focusout', () => r.classList.remove('is-open')); r.tabIndex = 0; });
}
