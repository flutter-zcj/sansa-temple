import * as THREE from 'three';
import { buildWorld } from './world.js';
import Actor from './actor.js';
import Presence from './net.js';

/* ------------------------------------------------------------------
 * 山寺 · 原型入口
 * 渲染 / 相机 / 输入 / 音效 / UI
 * ----------------------------------------------------------------*/

const $ = (s) => document.querySelector(s);
const canvas = $('#scene');

/* ---------------- 渲染器 ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 软件渲染（无独显/远程桌面）时自动降级，保证可交互
let soft = false;
try {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  soft = /swiftshader|software|llvmpipe/i.test(name);
} catch (e) { /* ignore */ }
if (soft) {
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 520);
camera.position.set(0, 4, 40);

const world = buildWorld(scene);
const rack = world.lanternRack;      // 愿望灯架
const burner = world.burner;         // 香炉
const pile = world.tilePile;         // 瓦堆
rack.group.userData.kind = 'rack';
burner.group.userData.kind = 'burner';
pile.group.userData.kind = 'pile';

const actor = new Actor(scene, 0, 33);
actor.root.rotation.y = Math.PI;
actor.groundFn = world.groundHeight;

/* ---------------- 多人：接入 FastAPI ------------- */
const params = new URLSearchParams(location.search);
const roomNo = (params.get('room') || '02').padStart(2, '0');
$('#room-no').textContent = roomNo;

const peers = new Map();          // id -> { actor, tx, tz, ry }
const netOff = params.get('offline') === '1';
let onlineCount = 1;

let selfId = '';
function spawnPeer(p) {
  if (!p || p.id === selfId || peers.has(p.id)) return;
  const a = new Actor(scene, p.x || 0, p.z || 33);
  a.groundFn = world.groundHeight;
  a.root.rotation.y = p.ry ?? Math.PI;
  peers.set(p.id, { actor: a, tx: p.x || 0, tz: p.z || 33, ry: p.ry ?? Math.PI });
}

const net = netOff ? null : new Presence({
  url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/presence?room=${roomNo}&name=${encodeURIComponent('访客')}`,
  onWelcome: (m) => {
    selfId = m.id;
    onlineCount = (m.players || []).length + 1;
    (m.players || []).forEach(spawnPeer);
  },
  onJoin: (p) => spawnPeer(p),
  onLeft: (id) => {
    const peer = peers.get(id);
    if (peer) { scene.remove(peer.actor.root); peers.delete(id); }
  },
  onMove: (m) => {
    const peer = peers.get(m.id);
    if (peer) { peer.tx = m.x; peer.tz = m.z; peer.ry = m.ry; }
  },
  onAct: (m) => {
    const peer = peers.get(m.id);
    if (peer) peer.actor.setAction(m.a === 'bow' ? 'bow' : m.a === 'pray' ? 'pray' : 'idle');
  },
  onCount: (n) => { onlineCount = n; },
  onLantern: (m) => {
    if (!m.item) return;
    const i = lanternState.items.findIndex((x) => x.hook === m.item.hook);
    if (i >= 0) lanternState.items[i] = m.item;
    else lanternState.items.push(m.item);
    rack.setLit(m.item.hook, m.item.color);
  },
  onTile: (m) => renderTiles(m, m.room === roomNo ? m.room_tiles : undefined),
  onIncense: () => loadIncense(),
  onError: (m) => { if (m.code === 'full') toast('这间已满，换一间吧'); },
});
if (net) net.connect();

/* ---------------- 相机控制 ---------------- */
const cam = { yaw: 0, pitch: 0.19, dist: 10.8, targetYaw: 0, targetPitch: 0.19, targetDist: 10.8, inHall: false };
const camTarget = new THREE.Vector3(0, 1.15, 33);

function updateCamera(dt) {
  // 入殿后自动收近镜头，避免穿出屋顶看着一片瓦
  const inHall = actor.position.z < -6.9 && Math.abs(actor.position.x) < 9.2;
  if (inHall !== cam.inHall) {
    cam.inHall = inHall;
    cam.targetDist = inHall ? 6.0 : 10.8;
  }

  cam.yaw += (cam.targetYaw - cam.yaw) * Math.min(1, dt * 9);
  cam.pitch += (cam.targetPitch - cam.pitch) * Math.min(1, dt * 9);
  cam.dist += (cam.targetDist - cam.dist) * Math.min(1, dt * 7);

  // 目标点跟随后方一点，避免角色总在正中
  const px = actor.position.x, pz = actor.position.z;
  camTarget.x += (px - camTarget.x) * Math.min(1, dt * 6);
  camTarget.z += (pz - camTarget.z) * Math.min(1, dt * 6);
  camTarget.y = 1.15;

  const cp = Math.cos(cam.pitch);
  const ox = Math.sin(cam.yaw) * cp * cam.dist;
  const oz = Math.cos(cam.yaw) * cp * cam.dist;
  const oy = Math.sin(cam.pitch) * cam.dist;

  let x = camTarget.x + ox;
  let z = camTarget.z + oz;
  let y = camTarget.y + oy;

  // 过肩视角：机身略偏右，角色偏在画面一侧，不挡住正前方
  x += Math.cos(cam.yaw) * 0.62;
  z -= Math.sin(cam.yaw) * 0.62;

  // 简单镜头避障：只避大体积的水面，台基放行
  for (const c of world.camBlockers) {
    if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) {
      const d = Math.hypot(x - camTarget.x, z - camTarget.z);
      const k = Math.max(0.35, (d - 1.2) / d);
      x = camTarget.x + (x - camTarget.x) * k;
      z = camTarget.z + (z - camTarget.z) * k;
      y += 0.6;
    }
  }

  camera.position.lerp(new THREE.Vector3(x, y, z), Math.min(1, dt * 12));
  camera.lookAt(camTarget.x, camTarget.y + 0.15, camTarget.z);
}

/* ---------------- 输入 ---------------- */
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// 法堂台基顶面（y = 0.95），用于正确拾取殿内地板
const hallPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.98);
let dragging = false, moved = 0, lastX = 0, lastY = 0, downT = 0;
const pointers = new Map();
let pinchStart = 0, pinchDist0 = 0;

canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    pinchDist0 = cam.targetDist;
    dragging = false;
    return;
  }
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; downT = performance.now();
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart > 0) cam.targetDist = THREE.MathUtils.clamp(pinchDist0 * (pinchStart / d), 3.2, 16);
    return;
  }
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  cam.targetYaw -= dx * 0.005;
  cam.targetPitch = THREE.MathUtils.clamp(cam.targetPitch + dy * 0.004, -0.15, 0.9);
});

canvas.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  if (!dragging) return;
  dragging = false;
  const dt = performance.now() - downT;
  if (moved < 8 && dt < 600) {
    const hit = pickInteractive(e.clientX, e.clientY);
    if (hit) {
      hideHint();
      if (hit.kind === 'hook') openLantern(hit.hook);
      else if (hit.kind === 'burner') openSheet('sheet-incense');
      else if (hit.kind === 'pile') openSheet('sheet-tiles');
    } else {
      walkToScreen(e.clientX, e.clientY);
    }
  }
  if (pointers.size < 2) pinchStart = 0;
});
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); dragging = false; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.targetDist = THREE.MathUtils.clamp(cam.targetDist + e.deltaY * 0.006, 3.2, 16);
}, { passive: false });

/** 命中灯钩 / 香炉 / 瓦堆时返回其类型，用于区分"走过去"与"动手" */
function pickInteractive(cx, cy) {
  const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([rack.group, burner.group, pile.group], true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o) {
    if (o.userData.hook !== undefined) return { kind: 'hook', hook: o.userData.hook };
    if (o.userData.kind) return { kind: o.userData.kind };
    o = o.parent;
  }
  return null;
}

function walkToScreen(cx, cy) {
  const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
  // 视线落在台基顶面时取高处交点，否则进殿后点哪儿都偏到殿外
  const high = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(hallPlane, high)
    && high.x > -9.4 && high.x < 9.4 && high.z < -6.9 && high.z > -19.2) {
    hit.copy(high);
  }
  if (Math.hypot(hit.x, hit.z) > 46) return;
  closeAllSheets();
  actor.setAction('walk');
  actor.moveTo(hit);
  hideHint();
}

/* ---------------- 音效（WebAudio 合成，无需音频文件） ---------------- */
class Sound {
  constructor() { this.ctx = null; this.muted = false; this.amb = null; }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  get out() { return this.muted ? this.ctx.createGain() : this.master; }

  moktak() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    // 木质敲击：短噪声 + 快速衰减
    const len = 0.16;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 7);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 720; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(bp).connect(g).connect(this.master); src.start(t);

    // 木腔共鸣
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g2).connect(this.master); osc.start(t); osc.stop(t + 0.18);
  }

  bell() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    [174, 261, 392, 523].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 5.5 - i * 0.4);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 5.6);
    });
  }

  click() {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
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
      g.gain.linearRampToValueAtTime(this.muted ? 0 : 0.075, ctx.currentTime + 2.5);
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
    if (this.amb) this.amb.g.gain.value = v ? 0 : 0.075;
  }
}
const sound = new Sound();

/* ---------------- UI ---------------- */
const toastEl = $('#toast');
let toastTimer = 0;
function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

const hintEl = $('#hint');
let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  hintEl.classList.add('is-hidden');
}

const sheets = ['sheet-moktak', 'sheet-beads', 'sheet-map', 'sheet-lantern', 'sheet-incense', 'sheet-tiles', 'sheet-rooms'];
function closeAllSheets() {
  sheets.forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; });
  document.querySelectorAll('.dock-btn').forEach((b) => b.classList.remove('is-active'));
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAllSheets));

function openSheet(id) {
  const wasHidden = document.getElementById(id).hidden;
  closeAllSheets();
  if (wasHidden) document.getElementById(id).hidden = false;
}

/* dock */
let praying = false, moktakAuto = false, moktakTimer = 0, moktakCount = 0;
let bowTotal = Number(localStorage.getItem('sansa.bow') || 0);

function setActive(name) {
  document.querySelectorAll('.dock-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.act === name));
}

$('#dock').addEventListener('click', (e) => {
  const btn = e.target.closest('.dock-btn');
  if (!btn) return;
  const act = btn.dataset.act;
  hideHint();

  if (act === 'bow') {
    praying = !praying;
    actor.stop();
    if (praying) { actor.setAction('pray'); setActive('bow'); toast('合掌。呼吸慢一点。'); if (net) net.sendAct('pray'); }
    else { actor.setAction('idle'); setActive(''); }
    sound.click();
  }

  if (act === 'pray') {
    actor.stop();
    if (net) net.sendAct('bow');
    actor.bow(() => {
      bowTotal += 1;
      localStorage.setItem('sansa.bow', String(bowTotal));
      sound.moktak();
      toast(bowTotal % 25 === 0 ? `已拜 ${bowTotal} 拜 · 满 25 拜可换一杯咖啡` : `已拜 ${bowTotal} 拜`);
      setActive('');
    });
    setActive('pray');
    sound.click();
  }

  if (act === 'moktak') {
    const hidden = $('#sheet-moktak').hidden;
    openSheet('sheet-moktak');
    setActive(hidden ? 'moktak' : '');
    if (hidden) { actor.stop(); actor.setAction('pray'); }
    sound.click();
  }

  if (act === 'beads') {
    const hidden = $('#sheet-beads').hidden;
    openSheet('sheet-beads');
    setActive(hidden ? 'beads' : '');
    if (hidden) { actor.stop(); actor.setAction('pray'); }
    sound.click();
  }
});

/* 木鱼 */
const moktakEl = $('#moktak-hit');
function hitMoktak() {
  moktakCount += 1;
  $('#moktak-num').textContent = String(moktakCount);
  moktakEl.classList.remove('hit');
  void moktakEl.offsetWidth;
  moktakEl.classList.add('hit');
  actor.strike();
  sound.moktak();
  if (moktakCount % 108 === 0) toast(`敲满 ${moktakCount} 声。歇一歇。`, 3000);
}
moktakEl.addEventListener('click', hitMoktak);
$('#moktak-auto').addEventListener('click', () => {
  moktakAuto = !moktakAuto;
  $('#moktak-auto').classList.toggle('on', moktakAuto);
  clearInterval(moktakTimer);
  if (moktakAuto) {
    hitMoktak();
    moktakTimer = setInterval(hitMoktak, 620);
    toast('自动木鱼已开始');
  } else toast('已停');
});
$('#moktak-reset').addEventListener('click', () => { moktakCount = 0; $('#moktak-num').textContent = '0'; });

/* 念珠 */
const TOTAL_BEADS = 108;
const beadsLine = $('#beads-line');
for (let i = 0; i < TOTAL_BEADS; i++) {
  const d = document.createElement('i');
  d.className = 'bead';
  beadsLine.appendChild(d);
}
let beadIndex = Number(localStorage.getItem('sansa.beads') || 0);
const beadEls = [...beadsLine.children];
function renderBeads() {
  beadEls.forEach((el, i) => {
    el.classList.toggle('past', i < beadIndex % TOTAL_BEADS);
    el.classList.toggle('head', i === beadIndex % TOTAL_BEADS);
  });
  const round = Math.floor(beadIndex / TOTAL_BEADS) + 1;
  $('#beads-round').textContent = `第 ${round} 圈`;
  $('#beads-detail').textContent = `本轮 ${beadIndex % TOTAL_BEADS} 颗 · 共 ${beadIndex} 颗`;
  const head = beadEls[beadIndex % TOTAL_BEADS];
  if (head) {
    const track = $('#beads-track');
    const left = head.offsetLeft - track.clientWidth / 2 + 10;
    track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }
}
function advanceBead(n = 1) {
  beadIndex = Math.max(0, beadIndex + n);
  localStorage.setItem('sansa.beads', String(beadIndex));
  renderBeads();
  if (beadIndex > 0 && beadIndex % TOTAL_BEADS === 0) { sound.bell(); toast(`圆满 ${beadIndex / TOTAL_BEADS} 圈 · 共 ${beadIndex} 颗`, 3200); }
  else sound.click();
}
renderBeads();

let lastScroll = 0;
$('#beads-track').addEventListener('scroll', (e) => {
  const d = e.target.scrollLeft - lastScroll;
  if (Math.abs(d) > 14) { advanceBead(d > 0 ? 1 : -1); lastScroll = e.target.scrollLeft; }
});
$('#beads-track').addEventListener('wheel', (e) => {
  e.preventDefault();
  advanceBead(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

/* 地图 */
document.querySelectorAll('.map-pins g').forEach((pin) => {
  pin.addEventListener('click', () => {
    const key = pin.dataset.go;
    const spot = world.spots[key];
    if (!spot) return;
    closeAllSheets();
    setActive('');
    actor.setAction('walk');
    actor.moveTo(spot.clone().add(new THREE.Vector3(0, 0, 2.4)));
    toast('沿着石路走过去。');
    sound.click();
  });
});

/* 顶部 */
$('#btn-map').addEventListener('click', () => {
  const hidden = $('#sheet-map').hidden;
  openSheet('sheet-map');
  sound.click();
});

$('#btn-sound').addEventListener('click', () => {
  const muted = !sound.muted;
  sound.setMuted(muted);
  $('#btn-sound').classList.toggle('is-off', muted);
  toast(muted ? '声音已关' : '声音已开');
});

let chanting = false;
$('#btn-chant').addEventListener('click', () => {
  chanting = !chanting;
  sound.ambience(chanting);
  $('#btn-chant').classList.toggle('is-off', !chanting);
  if (chanting) { sound.bell(); toast('风声起，钟声落。'); }
  else toast('已静。');
});

$('#btn-room').addEventListener('click', () => openRooms());

/* ================================================================
 * 点灯 / 上香 / 搬瓦 / 换房
 * 四个功能都"后端先落，界面再跟"：失败一律 toast，不阻断走场景
 * ============================================================== */

/** 统一 JSON 请求；非 2xx 取出 detail 抛错 */
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

/* ---------------- 灯架 ---------------- */
let lanternState = { items: [], hooks: 24, total: 0, free: 0 };
let pendingHook = -1;
let pickColor = 'jin';

function paintRack() {
  rack.clear();
  (lanternState.items || []).forEach((it) => rack.setLit(it.hook, it.color));
}

async function loadLanterns() {
  if (netOff) return;
  try {
    lanternState = await api(`/api/lanterns?room=${roomNo}`);
    paintRack();
  } catch (e) { /* 后端不在，保持空架 */ }
}

function openLantern(hook) {
  const taken = (lanternState.items || []).find((i) => i.hook === hook);
  if (taken) {
    toast(`这盏已有人挂上：\n「${taken.wish}」`, 3400);
    return;
  }
  pendingHook = hook;
  $('#lantern-hook').textContent = String(hook + 1);
  $('#lantern-wish').value = '';
  $('#lantern-count').textContent = '0';
  closeAllSheets();
  setActive('');
  $('#sheet-lantern').hidden = false;
  sound.click();
}

$('#lantern-colors').addEventListener('click', (e) => {
  const b = e.target.closest('.swatch');
  if (!b) return;
  pickColor = b.dataset.color;
  [...$('#lantern-colors').children].forEach((x) => x.classList.toggle('is-on', x === b));
  sound.click();
});

$('#lantern-wish').addEventListener('input', (e) => {
  $('#lantern-count').textContent = String(e.target.value.length);
});

$('#lantern-submit').addEventListener('click', async () => {
  const wish = $('#lantern-wish').value.trim();
  if (!wish) { toast('写一句再挂。'); return; }
  if (pendingHook < 0) return;

  if (netOff) { closeAllSheets(); toast('离线模式，灯挂不上。'); return; }

  const btn = $('#lantern-submit');
  btn.disabled = true;
  try {
    const row = await post('/api/lanterns', {
      room: roomNo, hook: pendingHook, color: pickColor, wish, author: '',
    });
    rack.setLit(row.hook, row.color);
    lanternState.items.push(row);
    closeAllSheets();
    sound.bell();
    toast('灯亮了。');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- 上香 ---------------- */
const RING_LEN = 263.9;
let incenseToken = localStorage.getItem(`sansa.incense.${roomNo}`) || '';

function renderIncense(st) {
  const cur = st.current;
  const mine = st.mine;
  const hold = st.hold || 20;
  const joinBtn = $('#incense-join');
  const leaveBtn = $('#incense-leave');

  world.burner.setLit(!!cur);

  if (cur) {
    const frac = Math.max(0, Math.min(1, cur.remain / hold));
    $('#incense-ring-fg').style.strokeDashoffset = String(RING_LEN * (1 - frac));
    $('#incense-remain').textContent = String(cur.remain);
    const isMe = mine && mine.position === 1;
    $('#incense-line').textContent = isMe ? '你的香正燃着' : `${cur.name} 在上香`;
    $('#incense-sub').textContent = isMe ? '不必做什么，看它烧完。' : `还需约 ${cur.remain} 秒。`;
  } else {
    $('#incense-ring-fg').style.strokeDashoffset = String(RING_LEN);
    $('#incense-remain').textContent = '—';
    $('#incense-line').textContent = '香炉空着';
    $('#incense-sub').textContent = '点一支，等它自己烧完。';
  }

  if (mine) {
    joinBtn.hidden = true;
    leaveBtn.hidden = false;
    leaveBtn.textContent = mine.position > 1 ? `排第 ${mine.position} · 离开` : '离开';
    if (mine.position > 1) {
      $('#incense-sub').textContent = `前面还有 ${mine.position - 1} 人，约 ${mine.wait} 秒。`;
    }
  } else {
    joinBtn.hidden = false;
    leaveBtn.hidden = true;
    joinBtn.textContent = cur ? '排队上香' : '上香';
  }
}

async function loadIncense() {
  if (netOff) return;
  // 记下发出请求时的 token：轮询可能与入队并发，
  // 带旧 token 的响应回来时若 token 已换，必须丢弃，否则会误判"我已不在队里"
  const sent = incenseToken;
  try {
    const st = await api(`/api/incense?room=${roomNo}&token=${encodeURIComponent(sent)}`);
    if (sent !== incenseToken) return;

    if (!st.mine && sent) {
      // 服务端确实没有我这个 token 了（烧完或被人挤掉），本地一并清掉
      incenseToken = '';
      localStorage.removeItem(`sansa.incense.${roomNo}`);
    }
    renderIncense(st);
  } catch (e) { /* 静默：上香状态拿不到不影响走场景 */ }
}

$('#incense-join').addEventListener('click', async () => {
  if (netOff) { toast('离线模式，排不了队。'); return; }
  try {
    const r = await post('/api/incense', { room: roomNo, name: '访客' });
    incenseToken = r.token;
    localStorage.setItem(`sansa.incense.${roomNo}`, r.token);
    renderIncense(r);
    loadIncense();   // 用带 token 的查询对齐一次，避免广播与本地状态错位
    sound.click();
    toast(r.position === 1 ? '香点着了。' : `排第 ${r.position} 位，约 ${r.wait} 秒。`);
  } catch (e) {
    toast(e.message);
  }
});

$('#incense-leave').addEventListener('click', async () => {
  if (netOff) return;
  try {
    await api(`/api/incense?room=${roomNo}&token=${encodeURIComponent(incenseToken)}`, { method: 'DELETE' });
    incenseToken = '';
    localStorage.removeItem(`sansa.incense.${roomNo}`);
    sound.click();
    toast('下次再来。');
    loadIncense();
  } catch (e) {
    toast(e.message);
  }
});

/* ---------------- 搬瓦 ---------------- */
let tileState = { total: 0, goal: 1080, percent: 0, items: [] };

function renderTiles(d, own) {
  if (d.total !== undefined) tileState.total = d.total;
  if (d.goal !== undefined) tileState.goal = d.goal;
  if (d.percent !== undefined) tileState.percent = d.percent;
  if (d.items) tileState.items = d.items;

  $('#tiles-total').textContent = String(tileState.total);
  $('#tiles-goal').textContent = String(tileState.goal);
  $('#tiles-left').textContent = String(Math.max(0, tileState.goal - tileState.total));
  $('#tiles-bar').style.width = `${Math.min(100, tileState.percent)}%`;

  const ownCount = own !== undefined
    ? own
    : ((tileState.items || []).find((r) => r.room === roomNo) || { tiles: 0 }).tiles;
  $('#tiles-own').textContent = String(ownCount);

  pile.setProgress(tileState.percent);
}

async function loadTiles() {
  if (netOff) { pile.setProgress(0); return; }
  try {
    renderTiles(await api('/api/tiles'));
  } catch (e) { /* 静默 */ }
}

$('#tiles-carry').addEventListener('click', async () => {
  if (netOff) { toast('离线模式，搬不了瓦。'); return; }
  const btn = $('#tiles-carry');
  btn.disabled = true;
  try {
    const r = await post('/api/tiles', { room: roomNo, delta: 1 });
    renderTiles(r, r.tiles);
    sound.moktak();
    if (r.total % 100 === 0) toast(`已搬 ${r.total} 片，还差 ${Math.max(0, r.goal - r.total)} 片。`, 3000);
    else toast('放上去一片。');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- 换房 ---------------- */
async function openRooms() {
  closeAllSheets();
  setActive('');
  $('#sheet-rooms').hidden = false;
  sound.click();

  const list = $('#room-list');
  if (netOff) {
    list.innerHTML = '<p class="sheet-note">离线模式看不到房间。</p>';
    return;
  }

  list.innerHTML = '<p class="sheet-note">正在看哪间还空着…</p>';
  try {
    const d = await api('/api/rooms');
    list.innerHTML = (d.items || []).map((r) => {
      const label = r.status === 'full' ? '已满' : r.status === 'busy' ? '将满' : '清静';
      return `<button class="room-item${r.room === roomNo ? ' is-current' : ''}" data-room="${r.room}">
        <span class="room-id">${r.room}</span>
        <span class="room-meta">${r.online} / ${r.capacity} 人</span>
        <span class="room-state s-${r.status}">${label}</span>
      </button>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="sheet-note">房间状态暂时看不到。</p>';
  }
}

$('#room-list').addEventListener('click', (e) => {
  const b = e.target.closest('.room-item');
  if (!b) return;
  const code = b.dataset.room;
  if (code === roomNo) { closeAllSheets(); return; }
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  location.href = url.toString();
});

/* 首次拉取 + 上香状态轮询（兼作弱网兜底） */
loadLanterns();
loadTiles();
loadIncense();
setInterval(loadIncense, 1500);

/* ---------------- 加载 ---------------- */
const bootMsgs = ['正在铺开山路。', '正在立起山门。', '正在点灯。', '正在等你。'];
let p = 0;
const bootTimer = setInterval(() => {
  p = Math.min(100, p + 12 + Math.random() * 16);
  $('#boot-bar').style.width = p + '%';
  $('#boot-msg').textContent = bootMsgs[Math.min(bootMsgs.length - 1, Math.floor(p / 28))];
  if (p >= 100) {
    clearInterval(bootTimer);
    setTimeout(() => $('#boot').classList.add('done'), 320);
  }
}, 260);

/* ---------------- 主循环 ---------------- */
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  actor.update(dt, world.colliders);
  updateCamera(dt);
  burner.update(dt);

  // 他人插值
  peers.forEach((p) => {
    const a = p.actor;
    const dx = p.tx - a.position.x, dz = p.tz - a.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      a.position.x += dx * Math.min(1, dt * 7);
      a.position.z += dz * Math.min(1, dt * 7);
      a.setAction('walk');
    } else if (a.action === 'walk') {
      a.setAction('idle');
    }
    let diff = p.ry - a.root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    a.root.rotation.y += diff * Math.min(1, dt * 8);
    a.update(dt, world.colliders);
  });

  if (net) net.sendMove(actor.position.x, actor.position.z, actor.root.rotation.y);

  // 走到法堂前时轻提示
  if (!hintHidden && Math.hypot(actor.position.x, actor.position.z + 10) < 9) {
    // 保持原提示，不打断
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

/* ---------------- 自适应 ---------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 暴露给调试
window.__sansa = {
  scene, camera, actor, world, renderer, cam, peers, net,
  rack, burner, pile,
  openLantern, openRooms, loadLanterns, loadTiles, loadIncense,
  get online() { return onlineCount; },
  get lanterns() { return lanternState; },
  get tiles() { return tileState; },
};
