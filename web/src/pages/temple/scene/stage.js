/**
 * @file 山寺 3D 舞台（uni-app 版）
 * 只负责渲染与场景交互，UI 交给页面（Vue）渲染。
 *
 * 用法：
 *   const stage = mountStage(el, { room: '02', onToast, onPeerCount, ... })
 *   stage.pray(true) / stage.bow() / stage.hitMoktak() / stage.teleport('hall')
 *   stage.destroy()
 */
import * as THREE from 'three';
import { buildWorld } from './world.js';
import Actor from './actor.js';
import Presence from './net.js';

/* ---------------- 音效（WebAudio 合成） ---------------- */
class Sound {
  constructor() { this.ctx = null; this.muted = false; this.amb = null; }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  moktak() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const len = 0.16;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 7);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 720; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(bp).connect(g).connect(this.master); src.start(t);
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.45, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g2).connect(this.master); osc.start(t); osc.stop(t + 0.18);
  }
  bell() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    [174, 261, 392, 523].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 5.2 - i * 0.4);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 5.3);
    });
  }
  click() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.09);
  }
  ambience(on) {
    const ctx = this.ensure(); if (!ctx) return;
    if (on) {
      if (this.amb) return;
      const len = 4;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(this.muted ? 0 : 0.07, ctx.currentTime + 2.5);
      src.connect(lp).connect(g).connect(this.master); src.start();
      this.amb = { src, g };
    } else if (this.amb) {
      const { src, g } = this.amb; const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.8);
      src.stop(t + 1.0);
      this.amb = null;
    }
  }
  setMuted(v) {
    this.muted = v;
    if (this.amb) this.amb.g.gain.value = v ? 0 : 0.07;
  }
  destroy() { try { this.ctx && this.ctx.close(); } catch (e) { /* ignore */ } }
}

/* ---------------- 舞台 ---------------- */
export function mountStage(container, opt = {}) {
  const {
    room = '02',
    offline = false,
    onToast = () => {},
    onPeerCount = () => {},
    onBead = () => {},
    onMoktak = () => {},
    onLanterns = () => {},
    onIncense = () => {},
    onTiles = () => {},
    onRooms = () => {},
    onPickHook = () => {},
    onOpenSheet = () => {},
  } = opt;

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let soft = false;
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    soft = /swiftshader|software|llvmpipe/i.test(name);
  } catch (e) { /* ignore */ }
  if (soft) { renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 520);
  const world = buildWorld(scene);
  const rack = world.lanternRack;
  const burner = world.burner;
  const pile = world.tilePile;
  rack.group.userData.kind = 'rack';
  burner.group.userData.kind = 'burner';
  pile.group.userData.kind = 'pile';

  const actor = new Actor(scene, 0, 33);
  actor.root.rotation.y = Math.PI;
  actor.groundFn = world.groundHeight;

  const sound = new Sound();
  const cam = { yaw: 0, pitch: 0.19, dist: 10.8, targetYaw: 0, targetPitch: 0.19, targetDist: 10.8, baseDist: 10.8, inHall: false };
  const camTarget = new THREE.Vector3(0, 1.15, 33);

  /* 尺寸 */
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* 相机 */
  function updateCamera(dt) {
    // 入殿后自动收近镜头，避免穿出屋顶
    const inHall = actor.position.z < -6.9 && Math.abs(actor.position.x) < 9.2;
    if (inHall !== cam.inHall) {
      cam.inHall = inHall;
      cam.targetDist = inHall ? 6.2 : cam.baseDist;
    }

    cam.yaw += (cam.targetYaw - cam.yaw) * Math.min(1, dt * 9);
    cam.pitch += (cam.targetPitch - cam.pitch) * Math.min(1, dt * 9);
    cam.dist += (cam.targetDist - cam.dist) * Math.min(1, dt * 7);

    camTarget.x += (actor.position.x - camTarget.x) * Math.min(1, dt * 6);
    camTarget.z += (actor.position.z - camTarget.z) * Math.min(1, dt * 6);
    camTarget.y += ((actor.position.y + 1.12) - camTarget.y) * Math.min(1, dt * 9);

    const cp = Math.cos(cam.pitch);
    let x = camTarget.x + Math.sin(cam.yaw) * cp * cam.dist;
    let z = camTarget.z + Math.cos(cam.yaw) * cp * cam.dist;
    let y = camTarget.y + Math.sin(cam.pitch) * cam.dist;

    // 过肩视角：机身略偏右，角色偏在画面一侧，不挡住正前方
    x += Math.cos(cam.yaw) * 0.62;
    z -= Math.sin(cam.yaw) * 0.62;

    for (const c of world.camBlockers) {
      if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) {
        const d = Math.hypot(x - camTarget.x, z - camTarget.z) || 1;
        const k = Math.max(0.35, (d - 1.2) / d);
        x = camTarget.x + (x - camTarget.x) * k;
        z = camTarget.z + (z - camTarget.z) * k;
        y += 0.6;
      }
    }
    camera.position.lerp(new THREE.Vector3(x, y, z), Math.min(1, dt * 12));
    camera.lookAt(camTarget.x, camTarget.y + 0.15, camTarget.z);
  }

  /* 输入：拖动环视 / 点击行走 / 双指与滚轮缩放 */
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hallPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.655);
  let dragging = false, moved = 0, lastX = 0, lastY = 0, downT = 0;
  const pointers = new Map();
  let pinchStart = 0, pinchDist0 = 0;

  function onDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchDist0 = cam.targetDist;
      dragging = false;
      return;
    }
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; downT = performance.now();
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0 && d > 0) cam.targetDist = THREE.MathUtils.clamp(pinchDist0 * (pinchStart / d), 3.2, 16);
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    cam.targetYaw -= dx * 0.005;
    cam.targetPitch = THREE.MathUtils.clamp(cam.targetPitch + dy * 0.004, -0.15, 0.9);
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (!dragging) return;
    dragging = false;
    const dt = performance.now() - downT;
    if (moved < 8 && dt < 600) {
      const hit = pickInteractive(e.clientX, e.clientY);
      if (hit) {
        if (hit.kind === 'hook') onPickHook(hit.hook);
        else if (hit.kind === 'burner') onOpenSheet('incense');
        else if (hit.kind === 'pile') onOpenSheet('tiles');
      } else {
        walkTo(e.clientX, e.clientY);
      }
    }
    if (pointers.size < 2) pinchStart = 0;
  }
  function onWheel(e) {
    e.preventDefault();
    cam.targetDist = THREE.MathUtils.clamp(cam.targetDist + e.deltaY * 0.006, 3.2, 16);
    if (!cam.inHall) cam.baseDist = cam.targetDist;
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); dragging = false; });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  /** 命中灯钩 / 香炉 / 瓦堆时返回其类型 */
  function pickInteractive(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([rack.group, burner.group, pile.group], true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o) {
      if (o.userData.hook !== undefined) return { kind: 'hook', hook: o.userData.hook };
      if (o.userData.kind) return { kind: o.userData.kind };
      o = o.parent;
    }
    return null;
  }

  function walkTo(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return;
    // 视线落在台基顶面时取高处交点，否则进殿后点哪儿都偏到殿外
    const high = new THREE.Vector3();
    if (ray.ray.intersectPlane(hallPlane, high)
      && high.x > -9.4 && high.x < 9.4 && high.z < -6.9 && high.z > -19.2) {
      hit.copy(high);
    }
    if (Math.hypot(hit.x, hit.z) > 46) return;
    stage.pray(false);
    actor.moveTo(hit);
  }

  /* ---------------- 灯架 / 上香 / 搬瓦 / 换房 ---------------- */
  async function api(path, opt) {
    const r = await fetch(path, opt);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || `请求失败（${r.status}）`);
    return data;
  }
  const post = (path, body) => api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  /* 灯架 */
  const lanternState = { items: [], hooks: 24, total: 0, free: 0 };

  function paintRack() {
    rack.clear();
    (lanternState.items || []).forEach((it) => rack.setLit(it.hook, it.color));
  }
  function emitLanterns() {
    onLanterns({ ...lanternState, items: [...(lanternState.items || [])] });
  }

  async function loadLanterns() {
    if (offline) return;
    try {
      const d = await api(`/api/lanterns?room=${room}`);
      lanternState.items = d.items || [];
      lanternState.hooks = d.hooks ?? 24;
      lanternState.total = d.total ?? lanternState.items.length;
      lanternState.free = d.free ?? 0;
      paintRack();
      emitLanterns();
    } catch (e) { /* 后端缺席时保持空架 */ }
  }

  async function bookLantern(hook, color, wish) {
    if (offline) throw new Error('离线模式，灯挂不上');
    const row = await post('/api/lanterns', { room, hook, color, wish, author: '' });
    lanternState.items.push(row);
    lanternState.total = lanternState.items.length;
    rack.setLit(row.hook, row.color);
    emitLanterns();
    sound.bell();
    return row;
  }

  /* 上香 */
  const incenseState = { current: null, queue: [], hold: 20, mine: null, size: 0 };
  let incenseToken = '';
  try { incenseToken = localStorage.getItem(`sansa.incense.${room}`) || ''; } catch (e) { /* 隐私模式 */ }

  function applyIncense(st) {
    incenseState.current = st.current || null;
    incenseState.queue = st.queue || [];
    incenseState.hold = st.hold || 20;
    incenseState.mine = st.mine || null;
    incenseState.size = st.size || 0;
    burner.setLit(!!st.current);
    onIncense({ ...incenseState });
  }

  async function loadIncense() {
    if (offline) return;
    // 轮询可能与入队并发：带旧 token 的响应回来时若 token 已换，必须丢弃
    const sent = incenseToken;
    try {
      const st = await api(`/api/incense?room=${room}&token=${encodeURIComponent(sent)}`);
      if (sent !== incenseToken) return;
      if (!st.mine && sent) {
        incenseToken = '';
        try { localStorage.removeItem(`sansa.incense.${room}`); } catch (e) { /* ignore */ }
      }
      applyIncense(st);
    } catch (e) { /* 静默 */ }
  }

  async function joinIncense() {
    if (offline) throw new Error('离线模式，排不了队');
    const r = await post('/api/incense', { room, name: opt.name || '访客' });
    incenseToken = r.token;
    try { localStorage.setItem(`sansa.incense.${room}`, r.token); } catch (e) { /* ignore */ }
    applyIncense(r);
    loadIncense();
    return r;
  }

  async function leaveIncense() {
    if (offline) return;
    await api(`/api/incense?room=${room}&token=${encodeURIComponent(incenseToken)}`, { method: 'DELETE' });
    incenseToken = '';
    try { localStorage.removeItem(`sansa.incense.${room}`); } catch (e) { /* ignore */ }
    loadIncense();
  }

  /* 搬瓦 */
  const tileState = { total: 0, goal: 1080, percent: 0, items: [], own: 0 };

  function applyTiles(d, own) {
    if (d.total !== undefined) tileState.total = d.total;
    if (d.goal !== undefined) tileState.goal = d.goal;
    if (d.percent !== undefined) tileState.percent = d.percent;
    if (d.items) tileState.items = d.items;
    tileState.own = own !== undefined
      ? own
      : ((tileState.items || []).find((r) => r.room === room) || { tiles: 0 }).tiles;
    pile.setProgress(tileState.percent);
    onTiles({ ...tileState });
  }

  async function loadTiles() {
    if (offline) { pile.setProgress(0); return; }
    try {
      applyTiles(await api('/api/tiles'));
    } catch (e) { /* 静默 */ }
  }

  async function carryTile() {
    if (offline) throw new Error('离线模式，搬不了瓦');
    const r = await post('/api/tiles', { room, delta: 1 });
    applyTiles(r, r.tiles);
    sound.moktak();
    return r;
  }

  /* 换房 */
  async function loadRooms() {
    if (offline) return [];
    const d = await api('/api/rooms');
    const items = d.items || [];
    onRooms(items);
    return items;
  }

  /* 上香状态轮询：兼作弱网兜底 */
  const incenseTimer = setInterval(loadIncense, 1500);
  loadLanterns();
  loadTiles();
  loadIncense();

  /* 多人 */
  const peers = new Map();
  let selfId = '';
  let net = null;

  function spawnPeer(p) {
    if (!p || p.id === selfId || peers.has(p.id)) return;
    const a = new Actor(scene, p.x || 0, p.z || 33);
    a.groundFn = world.groundHeight;
    a.root.rotation.y = p.ry ?? Math.PI;
    peers.set(p.id, { actor: a, tx: p.x || 0, tz: p.z || 33, ry: p.ry ?? Math.PI });
    onPeerCount(peers.size + 1);
  }

  if (!offline) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const host = opt.wsHost || location.host;  // 同源：由 deploy/sandbox/server.js 代理 /ws/*
    net = new Presence({
      url: `${proto}://${host}/ws/presence?room=${room}&name=${encodeURIComponent(opt.name || '访客')}`,
      onWelcome: (m) => {
        selfId = m.id;
        (m.players || []).forEach(spawnPeer);
        onPeerCount((m.players || []).length + 1);
      },
      onJoin: (p) => spawnPeer(p),
      onLeft: (id) => {
        const peer = peers.get(id);
        if (peer) { scene.remove(peer.actor.root); peers.delete(id); }
        onPeerCount(peers.size + 1);
      },
      onMove: (m) => {
        const peer = peers.get(m.id);
        if (peer) { peer.tx = m.x; peer.tz = m.z; peer.ry = m.ry; }
      },
      onAct: (m) => {
        const peer = peers.get(m.id);
        if (peer) peer.actor.setAction(m.a === 'bow' ? 'bow' : m.a === 'pray' ? 'pray' : 'idle');
      },
      onError: (m) => { if (m.code === 'full') onToast('这间已满，换一间吧'); },
      onLantern: (m) => {
        if (!m.item) return;
        const i = lanternState.items.findIndex((x) => x.hook === m.item.hook);
        if (i >= 0) lanternState.items[i] = m.item;
        else lanternState.items.push(m.item);
        rack.setLit(m.item.hook, m.item.color);
        onLanterns({ ...lanternState, items: [...lanternState.items] });
      },
      onTile: (m) => applyTiles(m, m.room === room ? m.room_tiles : undefined),
      onIncense: () => loadIncense(),
    });
    net.connect();
  }

  /* 主循环 */
  const clock = new THREE.Clock();
  let raf = 0, running = true;
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    actor.update(dt, world.colliders);
    updateCamera(dt);
    burner.update(dt);

    peers.forEach((p) => {
      const a = p.actor;
      const dx = p.tx - a.position.x, dz = p.tz - a.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        a.position.x += dx * Math.min(1, dt * 7);
        a.position.z += dz * Math.min(1, dt * 7);
        a.setAction('walk');
      } else if (a.action === 'walk') a.setAction('idle');
      let diff = p.ry - a.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.root.rotation.y += diff * Math.min(1, dt * 8);
      a.update(dt, world.colliders);
    });

    if (net) net.sendMove(actor.position.x, actor.position.z, actor.root.rotation.y);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  /* 对外 API */
  const stage = {
    scene, camera, renderer, actor, world, peers, sound, cam,
    rack, burner, pile,
    loadLanterns, loadTiles, loadIncense, loadRooms,
    bookLantern, joinIncense, leaveIncense, carryTile,
    get lanterns() { return lanternState; },
    get incense() { return incenseState; },
    get tiles() { return tileState; },
    // 调试用只读入口（?debug=1 时由页面暴露到 window.__temple.stage）
    get actor() { return actor; },
    get world() { return world; },
    get camera() { return camera; },
    get cam() { return cam; },
    pray(on) {
      if (on) { actor.stop(); actor.setAction('pray'); net && net.sendAct('pray'); }
      else { actor.setAction('idle'); }
    },
    bow(done) {
      net && net.sendAct('bow');
      actor.stop();
      actor.bow(done);
    },
    hitMoktak() { actor.strike(); sound.moktak(); },
    strike() { actor.strike(); },
    teleport(key) {
      const spot = world.spots[key];
      if (!spot) return;
      actor.stop();
      const target = spot.clone().add(new THREE.Vector3(0, 0, 2.4));
      actor.moveTo(target);
    },
    setMuted(v) { sound.setMuted(v); },
    bell() { sound.bell(); },
    click() { sound.click(); },
    ambience(on) { sound.ambience(on); },
    zoom(delta) { cam.targetDist = THREE.MathUtils.clamp(cam.targetDist + delta, 3.2, 16); if (!cam.inHall) cam.baseDist = cam.targetDist; },
    destroy() {
      running = false;
      clearInterval(incenseTimer);
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      if (net) net.close();
      sound.destroy();
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
  return stage;
}
