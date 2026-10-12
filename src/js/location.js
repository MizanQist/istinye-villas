import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DUR, STAGGER, REDUCED } from './eases.js';
import { p, ctn } from './reveal.js';

// Section 5: the route draws itself from Maitama to the site, the labels settle, the site ring pulses.
export function initLocation() {
  const root = document.querySelector('.location'); if (!root) return;
  const map = root.querySelector('[data-location-map]'), route = root.querySelector('[data-route]'), pulse = root.querySelector('[data-pulse]');
  const labels = root.querySelectorAll('.location__districts text'), site = root.querySelectorAll('.location__site, .location__site-sub, .location__min, .location__pin');
  if (!REDUCED) {
    const len = route.getTotalLength(); gsap.set(route, { strokeDasharray: `${len}`, strokeDashoffset: len });
    gsap.set(labels, { opacity: 0 }); gsap.set(site, { opacity: 0 });
    gsap.fromTo(map.querySelector('img'), { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  ScrollTrigger.create({
    trigger: root, start: 'top 60%', once: true,
    onEnter: () => {
      p(root.querySelectorAll('.location__text [data-reveal="p"]'), 'reveal', 0);
      ctn(root.querySelectorAll('.location__text [data-reveal="ctn"]'), 'reveal', 0.4);
      if (REDUCED) return;
      gsap.to(labels, { opacity: 1, duration: DUR.m, ease: 'out', stagger: 0.08, delay: 0.4 });
      gsap.to(route, { strokeDashoffset: 0, duration: DUR.l, ease: 'inOut', delay: 0.9 });
      gsap.to(site, { opacity: 1, duration: DUR.m, ease: 'out', stagger: 0.1, delay: 1.6 });
      gsap.fromTo(pulse, { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 2.2, duration: 1.8, ease: 'in', repeat: -1, delay: 2.2 });
    },
  });
}
