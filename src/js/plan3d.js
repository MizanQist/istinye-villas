import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DUR, REDUCED } from './eases.js';
import { GEO } from './plan-geo.js';

// Section 6: the estate as an architect's model. A cream plinth, white villa blocks with drafted edges, the pools as
// the one colour, model trees; the villas rise along the road as the page scrolls; orbit with the pointer, a plan
// view, three sun positions. Everything is built from geometry traced off the architect's sheet (plan-geo.js).

const COL = { base: 0xf1ebe1, side: 0xe6dfd2, road: 0xd6cfc2, walk: 0xf8f3ea, lawn: 0xdfe3c9, house: 0xfbf8f1, worship: 0xf2ece1, pool: 0x9ed6e0, coping: 0xf3eee4, tree: 0xb9c0a3, trunk: 0xd2c9b7, ink: 0x1c1c1a, gold: 0xaf8c56 };
const H = { house: 11, worship: 8, plinth: 4 };
const VIEW = { model: { el: 50, az: 0 }, plan: { el: 89.6, az: 0 } };
const SUN = { morning: { az: -68, el: 30 }, midday: { az: 8, el: 64 }, evening: { az: 76, el: 22 } };
const TURN = 14;             // degrees of turntable across the scroll build
const deg = Math.PI / 180;

const v2 = ([x, y]) => new THREE.Vector2(x, -y);
const shapeOf = (pts, holes = []) => { const s = new THREE.Shape(pts.map(v2)); holes.forEach((h) => s.holes.push(new THREE.Path(h.map(v2)))); return s; };
const flat = (pts, y, mat, holes) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(pts, holes)), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m; };
const centre = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
const spherical = (az, el, r) => new THREE.Vector3(Math.sin(az * deg) * Math.cos(el * deg) * r, Math.sin(el * deg) * r, Math.cos(az * deg) * Math.cos(el * deg) * r);
const smooth = (t) => { const x = Math.min(Math.max(t, 0), 1); return x * x * (3 - 2 * x); };

export function initPlan3d({ stage, canvasHost, plots, phone, onStamp, onHover, onSelect, onFrame }) {
  const state = { az: REDUCED ? 0 : -TURN, el: VIEW.model.el, zoom: 1, build: REDUCED ? 1 : 0, sunAz: SUN.midday.az, sunEl: SUN.midday.el, tx: 0, tz: 0 };
  let needs = true, dragging = false, touched = false, view = 'model', hovered = null, selected = null;

  // ---- renderer, scene, camera, light
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
  const sky = new THREE.HemisphereLight(0xfff9f0, 0xe2dbcd, 1.7); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff2df, 1.15); sun.castShadow = true;
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 1, far: 1400 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // ---- the model
  const model = new THREE.Group(); scene.add(model);
  const lambert = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, ...extra });
  const ink = (opacity) => new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity });
  // plinth: the site, 4 m thick, top at 0
  const plinth = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(GEO.site), { depth: H.plinth, bevelEnabled: false }), [lambert(COL.base), lambert(COL.side)]);
  plinth.rotation.x = -Math.PI / 2; plinth.position.y = -H.plinth; plinth.receiveShadow = true; model.add(plinth);
  const plinthEdges = new THREE.LineSegments(new THREE.EdgesGeometry(plinth.geometry, 30), ink(0.35)); plinthEdges.rotation.x = -Math.PI / 2; plinthEdges.position.y = -H.plinth + 0.01; model.add(plinthEdges);
  // ground: lawns, roads, the walkway ring
  GEO.lawns?.forEach((l) => model.add(flat(l, 0.03, lambert(COL.lawn))));
  GEO.roads.forEach((r) => model.add(flat(r.outer, 0.06, lambert(COL.road, { roughness: 1 }), r.holes)));
  GEO.walks.forEach((w) => model.add(flat(w, 0.1, lambert(COL.walk))));
  // plots: a fill for hover and selection, a hairline outline
  const plotMat = () => new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0, depthWrite: false });
  const cells = {}; const pickable = [];
  Object.entries(GEO.plots).forEach(([n, pts]) => {
    const m = flat(pts, 0.14, plotMat()); m.userData.n = +n; model.add(m); pickable.push(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), ink(0.16)); e.rotation.x = -Math.PI / 2; e.position.y = 0.15; model.add(e);
    cells[n] = { fill: m, edge: e };
  });
  // villas: a block per house, scaled up from the ground as the page scrolls
  const houses = {}; const byN = Object.fromEntries(plots.map((p) => [p.n, p]));
  GEO.houses.forEach((h) => {
    const pl = byN[h.n]; const g = new THREE.Group(); g.userData.n = h.n; model.add(g);
    const c = centre(h.rect); houses[h.n] = { g, c, at: h.at, kind: pl?.kind || 'villa', up: false, h: 0 };
    if (pl?.kind === 'tbc') {   // to be confirmed: a dashed footprint, no mass
      const geom = new THREE.BufferGeometry().setFromPoints([...h.rect, h.rect[0]].map(([x, y]) => new THREE.Vector3(x, 0.2, y)));
      const line = new THREE.Line(geom, new THREE.LineDashedMaterial({ color: COL.ink, dashSize: 2, gapSize: 1.6, transparent: true, opacity: 0.6 })); line.computeLineDistances(); g.add(line); return;
    }
    const height = pl?.kind === 'religious' ? H.worship : H.house; houses[h.n].h = height;
    const geom = new THREE.ExtrudeGeometry(shapeOf(h.lShape ? h.poly : h.rect), { depth: height, bevelEnabled: false });
    const mesh = new THREE.Mesh(geom, lambert(pl?.kind === 'religious' ? COL.worship : COL.house)); mesh.rotation.x = -Math.PI / 2; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.n = h.n; g.add(mesh); pickable.push(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 20), ink(0.3)); edges.rotation.x = -Math.PI / 2; g.add(edges);
    if (pl?.kind === 'villa') { const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(h.rect.map((p) => [c[0] + (p[0] - c[0]) * 0.86, c[1] + (p[1] - c[1]) * 0.86])), { depth: 0.5, bevelEnabled: false }), lambert(COL.coping)); cap.rotation.x = -Math.PI / 2; cap.position.y = height; cap.receiveShadow = true; g.add(cap); }
    g.scale.y = REDUCED ? 1 : 0.001;
  });
  // pools and their coping
  GEO.pools.forEach((p) => {
    const c = centre(p.rect); const grow = (k) => p.rect.map((q) => [c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k]);
    const g = houses[p.n]?.g || model;
    g.add(flat(grow(1.22), 0.2, lambert(COL.coping)));
    const water = flat(p.rect, 0.28, new THREE.MeshStandardMaterial({ color: COL.pool, roughness: 0.25, metalness: 0.05 })); g.add(water);
  });
  // trees: model trees, a sphere on a stem
  const trees = GEO.trees.filter((t) => t[2] > 1.2);
  const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), lambert(COL.tree), trees.length);
  const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1, 6), lambert(COL.trunk), trees.length);
  const M = new THREE.Matrix4();
  trees.forEach(([x, y, r], i) => {
    const R = Math.min(Math.max(r * 0.9, 1.5), 3.4), sh = 2.2 + R * 0.6;
    crown.setMatrixAt(i, M.compose(new THREE.Vector3(x, sh + R * 0.8, y), new THREE.Quaternion(), new THREE.Vector3(R, R * 0.92, R)));
    stem.setMatrixAt(i, M.compose(new THREE.Vector3(x, sh / 2, y), new THREE.Quaternion(), new THREE.Vector3(1, sh, 1)));
  });
  crown.castShadow = true; stem.castShadow = true; model.add(crown, stem);

  // ---- camera framing: fit the site (and the tallest block) for a view, at the extremes of the turntable
  const corners = GEO.site.flatMap(([x, y]) => [new THREE.Vector3(x, 0, y), new THREE.Vector3(x, H.house, y)]);
  const place = () => { camera.position.copy(spherical(state.az, state.el, 900)).add(new THREE.Vector3(state.tx, 0, state.tz)); camera.lookAt(state.tx, 0, state.tz); camera.zoom = state.zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
  const fitFor = (el, azs) => {
    const keep = { ...state }; let z = Infinity;
    azs.forEach((az) => {
      Object.assign(state, { az, el, zoom: 1 }); place();
      let xs = 0, ys = 0; corners.forEach((p) => { const q = p.clone().project(camera); xs = Math.max(xs, Math.abs(q.x)); ys = Math.max(ys, Math.abs(q.y)); });
      z = Math.min(z, 0.9 / Math.max(xs, ys));
    });
    Object.assign(state, keep); place(); return z;
  };
  const zooms = {};
  const size = () => {
    const w = stage.clientWidth, h = stage.clientHeight, a = w / h, F = 200;
    renderer.setSize(w, h, false); Object.assign(camera, { left: -a * F, right: a * F, top: F, bottom: -F });
    zooms.model = fitFor(VIEW.model.el, [-TURN, 0, TURN]); zooms.plan = fitFor(VIEW.plan.el, [0]);
    state.zoom = zooms[view]; place(); needs = true;
  };
  size(); new ResizeObserver(() => { size(); }).observe(stage);

  // ---- the sun
  const light = () => { sun.position.copy(spherical(state.sunAz, state.sunEl, 600)); needs = true; };
  light();

  // ---- pins follow the blocks; the leader follows plot 17
  const ndc = new THREE.Vector3();
  const project = () => {
    const out = {};
    Object.entries(houses).forEach(([n, h]) => {
      ndc.set(h.c[0], h.h * h.g.scale.y + 1.6 + h.g.position.y, h.c[1]).project(camera);
      out[n] = { x: (ndc.x + 1) * 50, y: (1 - ndc.y) * 50 };
    });
    onFrame && onFrame(out);
  };

  // ---- render on demand
  const tick = () => {
    if (!needs) return; needs = false;
    place(); renderer.render(scene, camera); project();
  };
  gsap.ticker.add(tick);
  const dirty = () => { needs = true; };

  // ---- the build: blocks rise in road order as the page scrolls; the model turns a little with it
  const build = (p) => {
    Object.values(houses).forEach((h) => {
      const s = smooth((p - h.at * 0.9) / 0.08); if (h.kind !== 'tbc') h.g.scale.y = Math.max(s, 0.001); else h.g.visible = s > 0.5;
      const up = s > 0.5; if (up !== h.up) { h.up = up; onStamp && onStamp(h.g.userData.n, up); }
    });
    dirty();
  };
  if (REDUCED) build(1);
  else {
    gsap.fromTo(model.position, { y: -10 }, { y: 0, duration: DUR.l, ease: 'out', scrollTrigger: { trigger: stage, start: 'top 85%', once: true }, onUpdate: dirty });
    ScrollTrigger.create({ trigger: stage, start: 'top 74%', end: 'center 64%', scrub: true, onUpdate: (st) => { state.build = st.progress; build(st.progress); if (!touched && view === 'model') { state.az = -TURN + 2 * TURN * st.progress; dirty(); } } });
  }

  // ---- views and sun
  const setView = (name) => {
    view = name; const v = VIEW[name]; touched = true;
    gsap.to(state, { el: v.el, az: v.az, zoom: zooms[name], duration: REDUCED ? 0 : 1.4, ease: 'inOut', overwrite: true, onUpdate: dirty });
  };
  const setSun = (name) => { const s = SUN[name]; gsap.to(state, { sunAz: s.az, sunEl: s.el, duration: REDUCED ? 0 : DUR.l, ease: 'inOut', overwrite: 'auto', onUpdate: light }); };

  // ---- pointer: orbit, hover, pick
  const ray = new THREE.Raycaster(); const pt = new THREE.Vector2();
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect(); pt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pt, camera); const hit = ray.intersectObjects(pickable, false)[0]; return hit ? hit.object.userData.n : null;
  };
  const tint = (n, fill, edge, gold) => { const c = cells[n]; if (!c) return; gsap.to(c.fill.material, { opacity: fill, duration: DUR.s, ease: 'out', overwrite: true, onUpdate: dirty }); gsap.to(c.edge.material, { opacity: edge, duration: DUR.s, ease: 'out', overwrite: true, onUpdate: dirty }); c.edge.material.color.set(gold ? COL.gold : COL.ink); };
  const lift = (n, y) => { const h = houses[n]; if (h) gsap.to(h.g.position, { y, duration: DUR.s, ease: 'out', overwrite: true, onUpdate: dirty }); };
  const hover = (n) => {
    if (n === hovered) return;
    if (hovered !== null && hovered !== selected) { tint(hovered, 0, 0.16, false); lift(hovered, 0); }
    hovered = n; if (n !== null && n !== selected) { tint(n, 0.12, 0.5, true); lift(n, 0.5); }
    renderer.domElement.style.cursor = n !== null ? 'pointer' : ''; onHover && onHover(n);
  };
  const select = (n) => {
    if (selected !== null) { tint(selected, 0, 0.16, false); lift(selected, 0); }
    selected = n; if (n !== null) { tint(n, 0.16, 1, true); lift(n, 0.5); }
  };
  let down = null, lastX = 0, lastY = 0, vx = 0, unlocked = !phone;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { if (!unlocked) return; down = { x: e.clientX, y: e.clientY, t: performance.now() }; lastX = e.clientX; lastY = e.clientY; vx = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (down) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) { dragging = true; touched = true; gsap.killTweensOf(state); hover(null); }
      if (dragging) { state.az -= dx * 0.22; if (view === 'model') state.el = Math.min(Math.max(state.el + dy * 0.18, 30), 78); vx = dx; dirty(); }
      return;
    }
    if (e.pointerType === 'mouse') hover(pick(e));
  });
  const end = (e) => {
    if (!down) return; const wasDrag = dragging; down = null; dragging = false;
    if (wasDrag) { if (Math.abs(vx) > 1) gsap.to(state, { az: state.az - vx * 3, duration: DUR.l, ease: 'out', overwrite: true, onUpdate: dirty }); return; }
    const n = pick(e); if (n !== null) { select(n); onSelect && onSelect(n); }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { down = null; dragging = false; });
  el.addEventListener('pointerleave', () => { if (!down) hover(null); });

  const look = (v) => { Object.assign(state, v); build(1); light(); dirty(); };   // capture hook: frame a part of the estate
  stage._plan = { state, houses, look };   // QA hook
  return {
    setView, setSun, select, hover,
    unlock() { unlocked = true; el.style.touchAction = 'none'; },
    lock() { unlocked = false; el.style.touchAction = ''; },
    refresh: dirty,
    look,
  };
}
