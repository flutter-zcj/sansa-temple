import * as THREE from 'three';

/* ------------------------------------------------------------------
 * 山寺场景：全部程序化建模（低模、秋色、暮光）
 * 不依赖任何外部模型/贴图，便于替换与二次创作
 * ----------------------------------------------------------------*/

const PAL = {
  soil: 0x9c6d4c,
  soilDark: 0x8d5c3d,
  stone: 0x9a9a90,
  stoneLight: 0xb9b7a9,
  wood: 0x4a3428,
  woodLight: 0x6a4a35,
  roof: 0x6f6e67,
  roofDark: 0x55544f,
  roofEdge: 0xb3afa3,
  plaster: 0xe3ddca,
  gold: 0xd9a94e,
  maple: [0xb4482c, 0xd0722f, 0x8f3a24, 0xc98a3a],
  pine: 0x3f5240,
  bamboo: 0x6f8455,
  water: 0x5c7d78,
};

/* ---------- 小工具 ---------- */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.92, metalness: opts.metalness ?? 0,
    flatShading: opts.flat ?? true, transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1, side: opts.side ?? THREE.FrontSide,
  });
}
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function makeTextTexture(text, {
  w = 512, h = 192, bg = '#2b2a24', color = '#e8d8a8', font = '600 96px "Songti SC", "Noto Serif CJK SC", serif',
  letter = 18, border = true,
} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = 'rgba(232,216,168,.35)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  // 逐字绘制，模拟传统匾额的宽字距
  const chars = [...text];
  // 从 font 里取字号（parseFloat 会把 "600 96px" 读成 600，必须用正则）
  const fm = font.match(/(\d+(?:\.\d+)?)px/);
  const px = fm ? parseFloat(fm[1]) : 96;
  const step = px * 0.72 + letter;
  const totalW = chars.length * step;
  let cx = w / 2 - totalW / 2 + step / 2;
  chars.forEach((ch) => { g.fillText(ch, cx, h / 2 + 4); cx += step; });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- 天空 ---------- */
function makeSky(scene) {
  const geo = new THREE.SphereGeometry(420, 32, 20);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      cTop: { value: new THREE.Color('#8fb6d6') },
      cMid: { value: new THREE.Color('#c6d8e2') },
      cLow: { value: new THREE.Color('#eae4d6') },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 cTop,cMid,cLow;
      void main(){
        float h = normalize(vP).y;
        vec3 c = mix(cLow, cMid, smoothstep(-0.02, 0.26, h));
        c = mix(c, cTop, smoothstep(0.16, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, m);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}


/* ---------- 地面噪点纹理 ---------- */
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  // 底：干草黄褐（参照原型寺院外参道两侧的枯草地）
  g.fillStyle = '#948a5c'; g.fillRect(0, 0, 512, 512);
  const cols = [
    'rgba(146,130,88,.42)', 'rgba(176,164,118,.30)', 'rgba(112,116,70,.34)',
    'rgba(88,104,58,.34)', 'rgba(188,176,132,.18)', 'rgba(120,106,70,.22)',
    'rgba(78,96,52,.24)',
  ];
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = cols[i % cols.length];
    const x = Math.random() * 512, y = Math.random() * 512, r = Math.random() * 6 + 0.7;
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  // 细草茎，增加远处草地的杂色感
  g.strokeStyle = 'rgba(118,124,70,.22)';
  g.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, h = 3 + Math.random() * 7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - h); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(15, 15);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- 地形 ---------- */
function makeGround(scene) {
  const g = new THREE.PlaneGeometry(260, 260, 60, 60);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const n = Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.5 + Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) * 1.4;
    const fade = THREE.MathUtils.smoothstep(d, 26, 90);
    pos.setY(i, n * fade + (d > 70 ? (d - 70) * 0.05 : 0));
  }
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    map: makeGroundTexture(), color: 0xffffff, roughness: 1, metalness: 0, flatShading: false,
  }));
  ground.receiveShadow = true;
  scene.add(ground);

  // 草色斑块
  const patchCols = [0x808049, 0x6e7642, 0x8e8a52, 0x5e6b3a];
  const patchMats = patchCols.map((c) => mat(c, { flat: true }));
  for (let i = 0; i < 92; i++) {
    const r = 2.0 + Math.random() * 6.0;
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 8), patchMats[i % patchMats.length]);
    p.rotation.x = -Math.PI / 2;
    p.position.set((Math.random() - 0.5) * 120, 0.028, (Math.random() - 0.5) * 120);
    p.material = p.material.clone();
    p.material.transparent = true;
    p.material.opacity = 0.5;
    p.receiveShadow = true;
    if (Math.hypot(p.position.x, p.position.z) > 22) scene.add(p);
  }
  return ground;
}

/* ---------- 参道 ---------- */
function makePath(scene) {
  const g = new THREE.Group();
  // 石板缝的底
  const bed = box(4.72, 0.05, 52, mat(0x6e6b60), 0, 0.015, 17);
  g.add(bed);
  // 浅灰石板：横向长条，宽窄交替，模拟原型参道
  const colors = [0xb2b0a4, 0xa7a599, 0xbcb9ac, 0x9c9a8e, 0xb8b5a6];
  for (let z = 43; z > -8; z -= 1.28) {
    const w = 4.36 + Math.random() * 0.16;
    const slab = box(w, 0.075, 1.16, mat(colors[Math.floor(Math.random() * colors.length)], { roughness: 1, flat: false }),
      (Math.random() - 0.5) * 0.08, 0.038, z);
    slab.rotation.y = (Math.random() - 0.5) * 0.012;
    g.add(slab);
  }
  // 两侧路缘石
  for (const x of [-2.44, 2.44]) {
    for (let z = 43; z > -8; z -= 2.2) {
      g.add(box(0.44, 0.14, 2.1, mat(0x8e8b7e), x, 0.06, z));
    }
  }
  // 法堂前小广场
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      g.add(box(2.2, 0.075, 1.62, mat(0xaaa89b), -4.4 + i * 2.2, 0.038, -8.5 - j * 1.6));
    }
  }
  scene.add(g);
  return g;
}

/* ---------- 屋顶 ---------- */
function makeRoof(width, depth, opts = {}) {
  const g = new THREE.Group();
  const rise = opts.rise ?? 1.9;
  const color = opts.color ?? PAL.roof;
  const roofMat = mat(color, { roughness: 0.9, flat: false });
  const edgeMat = mat(PAL.roofDark, { roughness: 0.86, flat: false });
  const trimMat = mat(PAL.roofEdge, { roughness: 0.92, flat: false });
  const halfW = width / 2;

  // 两片坡面
  const slopeLen = Math.hypot(depth / 2, rise);
  const angle = Math.atan2(rise, depth / 2);
  for (const s of [-1, 1]) {
    const slab = box(width, 0.22, slopeLen, roofMat, 0, rise / 2, s * depth / 4);
    slab.rotation.x = -s * angle;
    g.add(slab);
    // 瓦垄
    for (let i = 0; i < Math.floor(width / 0.72); i++) {
      const x = -halfW + 0.4 + i * 0.72;
      const ridge = box(0.13, 0.09, slopeLen * 0.98, edgeMat, x, rise / 2 + 0.1, s * depth / 4);
      ridge.rotation.x = -s * angle;
      g.add(ridge);
    }
  }
  // 正脊：浅色脊带 + 两端翘起的鸱吻
  g.add(box(width + 0.5, 0.16, 0.44, trimMat, 0, rise + 0.02, 0));
  g.add(box(width + 0.36, 0.26, 0.36, edgeMat, 0, rise + 0.2, 0));
  for (const sx of [-1, 1]) {
    const tail = box(0.34, 0.62, 0.36, edgeMat, sx * (halfW + 0.2), rise + 0.42, 0);
    tail.rotation.z = -sx * 0.34;
    g.add(tail);
  }
  // 檐下望板（浅木），从下方仰视时不会一片死黑
  for (const s of [-1, 1]) {
    const board = box(width - 0.5, 0.05, slopeLen * 0.96,
      mat(0x6d5138, { flat: false, roughness: 0.95 }), 0, rise / 2 - 0.17, s * depth / 4);
    board.rotation.x = -s * angle;
    g.add(board);
  }
  // 檐下椽条：一排浅木细条，仰视时有层次
  const rafterMat = mat(0x9b7b52, { flat: false, roughness: 0.95 });
  for (const s of [-1, 1]) {
    const n = Math.max(2, Math.floor(width / 0.92));
    for (let i = 0; i < n; i++) {
      const x = -halfW + 0.46 + i * 0.92;
      const r = box(0.085, 0.08, slopeLen * 0.94, rafterMat, x, rise / 2 - 0.23, s * depth / 4);
      r.rotation.x = -s * angle;
      g.add(r);
    }
  }
  // 檐口：厚瓦檐 + 白色封檐带（原型檐下最醒目的一道浅色边）
  for (const s of [-1, 1]) {
    g.add(box(width + 0.9, 0.3, 0.56, edgeMat, 0, 0.0, s * (depth / 2 + 0.08)));
    g.add(box(width + 0.94, 0.09, 0.1, trimMat, 0, -0.16, s * (depth / 2 + 0.34)));
  }
  // 起翘檐角
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tip = box(1.05, 0.16, 0.42, edgeMat, sx * (halfW + 0.28), 0.3, sz * (depth / 2 - 0.1));
      tip.rotation.z = -sx * 0.26;
      tip.rotation.x = sz * 0.06;
      g.add(tip);
    }
  }
  return g;
}

/* ---------- 山门 ---------- */
function makeGate(scene, z = 26) {
  const g = new THREE.Group();
  const woodMat = mat(PAL.wood, { roughness: 0.9 });
  const H = 6.2;
  for (const x of [-3.7, 3.7]) {
    g.add(cyl(0.3, 0.34, H, 8, woodMat, x, H / 2, 0));
    // 柱础
    g.add(cyl(0.42, 0.46, 0.28, 8, mat(0x8f8c7d), x, 0.14, 0));
  }
  // 横梁
  g.add(box(10.2, 0.5, 0.5, mat(PAL.woodLight), 0, H - 1.0, 0));
  g.add(box(10.8, 0.34, 0.6, mat(PAL.woodLight), 0, H - 2.4, 0));
  // 斗拱（简化）
  for (let x = -4.4; x <= 4.4; x += 1.1) {
    g.add(box(0.34, 0.42, 0.7, mat(0x7a5232), x, H - 0.45, 0));
  }
  // 匾额
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.94),
    new THREE.MeshBasicMaterial({ map: makeTextTexture('山寺', { w: 640, h: 240, font: '600 104px "Songti SC","Noto Serif CJK SC",serif', letter: 10 }) }));
  plaque.position.set(0, H - 1.75, 0.32);
  g.add(plaque);
  const plaqueBack = box(2.72, 1.08, 0.12, mat(0x2a2822), 0, H - 1.75, 0.24);
  g.add(plaqueBack);

  const roof = makeRoof(13.0, 4.8, { rise: 1.8 });
  roof.position.y = H + 0.05;
  g.add(roof);
  g.position.z = z;
  scene.add(g);
  return g;
}

/* ---------- 殿内木地板纹理 ---------- */
function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const board = 512 / 8; // 8 条板
  for (let i = 0; i < 8; i++) {
    const base = ['#63513f', '#5a4938', '#6b5844', '#544434', '#665441'][i % 5];
    g.fillStyle = base;
    g.fillRect(0, i * board, 512, board);
    // 木纹
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = `rgba(${60 + Math.random() * 40},${44 + Math.random() * 30},${30 + Math.random() * 24},${0.10 + Math.random() * 0.14})`;
      g.lineWidth = 0.6 + Math.random() * 1.4;
      const y = i * board + Math.random() * board;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + k) * 1.6);
      g.stroke();
    }
    // 板缝
    g.fillStyle = 'rgba(38,28,20,.55)';
    g.fillRect(0, i * board, 512, 1.8);
    // 板与板之间的错缝
    const seamX = (i % 2 ? 0.3 : 0.68) * 512;
    g.fillStyle = 'rgba(38,28,20,.42)';
    g.fillRect(seamX, i * board, 1.6, board);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- 佛龛壁画（唐卡风格，纯 canvas 绘制） ---------- */
function makeMuralTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // 底：深赭红
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#56301f');
  bg.addColorStop(0.5, '#3e2015');
  bg.addColorStop(1, '#4a2a1a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // 斑驳做旧
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${96 + Math.random() * 70},${52 + Math.random() * 40},${30 + Math.random() * 24},${0.05 + Math.random() * 0.09})`;
    const r = Math.random() * 22 + 3;
    g.beginPath(); g.arc(Math.random() * W, Math.random() * H, r, 0, 6.3); g.fill();
  }

  const gold = '#c9a153';
  const goldDim = 'rgba(201,161,83,.5)';

  // 外框：三重金线
  g.strokeStyle = gold;
  g.lineWidth = 7; g.strokeRect(16, 16, W - 32, H - 32);
  g.lineWidth = 2; g.strokeRect(34, 34, W - 68, H - 68);
  g.strokeStyle = goldDim;
  g.lineWidth = 1.4; g.strokeRect(46, 46, W - 92, H - 92);

  // 边框卷草纹
  g.strokeStyle = goldDim; g.lineWidth = 2.2;
  for (let x = 60; x < W - 60; x += 34) {
    g.beginPath();
    g.moveTo(x, 26);
    g.quadraticCurveTo(x + 17, 8, x + 34, 26);
    g.stroke();
    g.beginPath();
    g.moveTo(x, H - 26);
    g.quadraticCurveTo(x + 17, H - 8, x + 34, H - 26);
    g.stroke();
  }

  // 中央大背光：深绿同心圆
  const cx = W / 2, cy = H * 0.52;
  for (let i = 4; i >= 1; i--) {
    g.beginPath();
    g.arc(cx, cy, 60 + i * 26, 0, 6.3);
    g.strokeStyle = `rgba(120,148,96,${0.16 + i * 0.06})`;
    g.lineWidth = 3.4;
    g.stroke();
  }
  // 莲瓣环
  g.save();
  g.translate(cx, cy);
  for (let i = 0; i < 24; i++) {
    g.rotate((Math.PI * 2) / 24);
    g.beginPath();
    g.ellipse(0, -128, 13, 30, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(201,161,83,.32)';
    g.fill();
    g.strokeStyle = 'rgba(201,161,83,.55)'; g.lineWidth = 1.2; g.stroke();
  }
  g.restore();

  // 两侧胁侍：打坐小像剪影（圆头 + 坐姿身 + 头光 + 莲座）
  for (const sx of [-1, 1]) {
    const bx = cx + sx * 262;
    const by = cy + 6;
    // 头光
    g.beginPath(); g.arc(bx, by - 78, 40, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(201,161,83,.40)'; g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.arc(bx, by - 78, 30, 0, Math.PI * 2);
    g.fillStyle = 'rgba(206,158,86,.16)'; g.fill();
    // 头
    g.beginPath(); g.arc(bx, by - 78, 21, 0, Math.PI * 2);
    g.fillStyle = 'rgba(226,190,136,.42)'; g.fill();
    g.strokeStyle = 'rgba(201,161,83,.6)'; g.lineWidth = 1.6; g.stroke();
    // 肩与身（宽肩收腰的坐姿）
    g.beginPath();
    g.moveTo(bx, by - 56);
    g.bezierCurveTo(bx + 40, by - 42, bx + 44, by + 6, bx + 52, by + 34);
    g.lineTo(bx + 62, by + 54);
    g.lineTo(bx - 62, by + 54);
    g.lineTo(bx - 52, by + 34);
    g.bezierCurveTo(bx - 44, by + 6, bx - 40, by - 42, bx, by - 56);
    g.fillStyle = 'rgba(214,172,116,.28)'; g.fill();
    g.strokeStyle = 'rgba(201,161,83,.55)'; g.lineWidth = 2; g.stroke();
    // 莲座
    g.beginPath();
    g.ellipse(bx, by + 62, 62, 14, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(201,161,83,.22)'; g.fill();
    g.strokeStyle = 'rgba(201,161,83,.5)'; g.lineWidth = 1.8; g.stroke();
    // 飘带
    g.strokeStyle = 'rgba(198,110,72,.45)'; g.lineWidth = 3;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(bx + d * 44, by - 18);
      g.bezierCurveTo(bx + d * 78, by + 10, bx + d * 52, by + 60, bx + d * 84, by + 92);
      g.stroke();
    }
  }

  // 底部莲池与供品
  for (let i = 0; i < 9; i++) {
    const x = 100 + i * 100;
    g.beginPath();
    g.ellipse(x, H - 70, 26, 12, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(120,148,96,.22)'; g.fill();
    g.strokeStyle = 'rgba(201,161,83,.4)'; g.lineWidth = 1.6; g.stroke();
  }
  // 角花
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    g.save();
    g.translate(sx ? W - 62 : 62, sy ? H - 62 : 62);
    g.beginPath(); g.arc(0, 0, 16, 0, 6.3);
    g.strokeStyle = goldDim; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4);
      g.beginPath(); g.ellipse(0, -22, 4, 9, 0, 0, Math.PI * 2);
      g.fillStyle = goldDim; g.fill();
    }
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- 法堂 ---------- */
/* ---------- 法堂 ---------- */
function makeHall(scene) {
  const g = new THREE.Group();
  const baseY = 0.62;
  const FLOOR = 0.652;   // 殿内木地板面（略高于台基压顶 0.65，避免与人物脚底 z-fighting）

  /* ---- 台基 + 压顶 + 台阶 ---- */
  g.add(box(17.4, baseY, 12, mat(0xb3afa2), 0, baseY / 2, 0));
  g.add(box(18, 0.12, 12.6, mat(0x9c988b), 0, baseY - 0.03, 0));
  // 压顶石缝
  for (let i = -3; i <= 3; i++) {
    g.add(box(0.03, 0.13, 12.58, mat(0x8b877b), i * 2.6, baseY - 0.03, 0));
  }
  for (let i = 0; i < 2; i++) {
    g.add(box(4.8 - i * 0.35, 0.31, 0.66, mat(0xb6b2a4), 0, 0.155 + i * 0.31, 6.72 - i * 0.60));
  }

  /* ---- 木地板 ---- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(17.3, 11.9),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.86, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  floor.receiveShadow = true;
  g.add(floor);

  /* ---- 柱列：前檐 4 根 + 内柱 4 根 + 后檐 4 根 ---- */
  const woodMat = mat(0x54382a, { flat: false });
  const woodDark = mat(0x3f2a1e, { flat: false });
  const pillarXs = [-7.7, -3.6, 3.6, 7.7];
  for (const x of pillarXs) {
    for (const z of [4.7, -4.7]) {
      g.add(cyl(0.29, 0.33, 5.4, 12, woodMat, x, baseY + 2.7, z));
      g.add(cyl(0.44, 0.48, 0.3, 12, mat(0x8f8c7d), x, baseY + 0.15, z));   // 柱础
    }
  }
  for (const x of [-8.6, 8.6]) {
    for (const z of [0.6, -2.6]) {
      g.add(cyl(0.27, 0.31, 5.4, 12, woodMat, x, baseY + 2.7, z));
      g.add(cyl(0.42, 0.46, 0.28, 12, mat(0x8f8c7d), x, baseY + 0.14, z));
    }
  }

  /* ---- 后墙 + 左右墙（白灰抹面，左右墙开大格窗） ---- */
  const wallMat = mat(0xe6e0cd, { roughness: 1, flat: false });
  g.add(box(19.2, 5.2, 0.4, wallMat, 0, baseY + 2.6, -5.0));      // 后墙
  for (const sx of [-1, 1]) {
    // 墙分三段：前段墙垛、中间窗洞、后段墙垛
    g.add(box(0.4, 5.2, 1.5, wallMat, sx * 9.5, baseY + 2.6, 4.0));
    g.add(box(0.4, 5.2, 1.5, wallMat, sx * 9.5, baseY + 2.6, -4.2));
    // 窗下裙板
    g.add(box(0.42, 1.0, 7.0, mat(0x4a3226, { flat: false }), sx * 9.5, baseY + 0.5, -0.1));
    // 窗上过梁
    g.add(box(0.42, 0.9, 7.0, wallMat, sx * 9.5, baseY + 4.75, -0.1));
    // 窗洞：淡色玻璃
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.3),
      new THREE.MeshStandardMaterial({
        color: 0xdfeaf0, roughness: 0.35, metalness: 0,
        transparent: true, opacity: 0.34, side: THREE.DoubleSide,
      }));
    glass.position.set(sx * 9.52, baseY + 2.62, -0.1);
    glass.rotation.y = Math.PI / 2;
    g.add(glass);
    // 格条：竖 10 根 + 横 5 根
    const barMat = mat(0x3c2a1e, { flat: false });
    for (let i = 0; i <= 10; i++) {
      g.add(box(0.09, 3.3, 0.07, barMat, sx * 9.44, baseY + 2.62, -0.1 - 3.5 + (i / 10) * 7.0));
    }
    for (let i = 0; i <= 5; i++) {
      g.add(box(0.08, 0.065, 7.0, barMat, sx * 9.44, baseY + 2.62 - 1.65 + (i / 5) * 3.3, -0.1));
    }
  }

  /* ---- 天花板：横梁 + 纵向脊梁 ---- */
  const beamMat = mat(0x4a3126, { flat: false });
  for (const z of [4.0, 2.0, 0.0, -2.0, -4.0]) {
    g.add(box(19.0, 0.26, 0.26, beamMat, 0, baseY + 5.28, z));
  }
  for (const x of [-3.5, 3.5]) {
    g.add(box(0.24, 0.32, 11.6, mat(0x412a1f, { flat: false }), x, baseY + 5.42, 0));
  }
  // 椽子（沿 z 向细条，用 InstancedMesh 压 draw call）
  const rafterGeo = new THREE.BoxGeometry(19.4, 0.1, 0.12);
  const rafterCount = 26;
  const rafters = new THREE.InstancedMesh(rafterGeo, beamMat, rafterCount);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < rafterCount; i++) {
    mtx.makeTranslation(0, baseY + 5.55, -5.6 + (i / (rafterCount - 1)) * 11.2);
    rafters.setMatrixAt(i, mtx);
  }
  rafters.instanceMatrix.needsUpdate = true;
  g.add(rafters);

  /* ---- 吊灯：白色纸罩圆筒灯从梁下垂 ---- */
  const cordMat = mat(0x2c2018, { flat: false });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e8, roughness: 0.62, metalness: 0,
    emissive: 0xffe3b4, emissiveIntensity: 0.78, flatShading: false,
  });
  const lampPositions = [];
  for (const x of [-4.9, 0, 4.9]) {
    for (const z of [3.5, 0.2]) lampPositions.push([x, z]);
  }
  lampPositions.forEach(([x, z], i) => {
    g.add(cyl(0.016, 0.016, 0.72, 6, cordMat, x, baseY + 4.86, z));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.2, 0.36, 14, 1, true), lampMat);
    shade.position.set(x, baseY + 4.28, z);
    g.add(shade);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14), lampMat);
    cap.position.set(x, baseY + 4.1, z);
    g.add(cap);
    // 只给两盏加真实点光，其余靠自发光，避免 9 个动态光拖垮低端机
    if (i === 1 || i === 4) {
      const pl = new THREE.PointLight(0xffe3b8, 10, 9.5, 2);
      pl.position.set(x, baseY + 4.16, z);
      g.add(pl);
    }
  });

  /* ---- 佛龛壁画 ---- */
  const muralW = 11.4, muralH = 4.5;
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(muralW, muralH),
    new THREE.MeshStandardMaterial({
      map: makeMuralTexture(), roughness: 0.94, metalness: 0,
      emissive: 0x1d0e08, emissiveIntensity: 0.22,
    }));
  mural.position.set(0, baseY + 2.55, -4.72);
  g.add(mural);
  // 壁画外框
  g.add(box(muralW + 0.28, 0.16, 0.1, mat(0x3a2416), 0, baseY + 2.55 + muralH / 2, -4.7));
  g.add(box(muralW + 0.28, 0.16, 0.1, mat(0x3a2416), 0, baseY + 2.55 - muralH / 2, -4.7));
  for (const sx of [-1, 1]) {
    g.add(box(0.16, muralH, 0.1, mat(0x3a2416), sx * (muralW / 2 + 0.06), baseY + 2.55, -4.7));
  }

  /* ---- 正面：敞开的两扇木门 ---- */
  const doorMat = mat(0x4a3524, { flat: false });
  const doorEdge = mat(0x2c2118, { flat: false });
  const makeLeaf = (sign) => {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 2.28, baseY + 0.02, 4.9);
    pivot.add(box(2.22, 4.42, 0.11, doorMat, -sign * 1.11, 2.21, 0));
    for (let i = 0; i < 4; i++) {
      pivot.add(box(1.92, 0.07, 0.14, doorEdge, -sign * 1.11, 0.66 + i * 1.04, 0.01));
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 14),
      mat(0xb08d4a, { metalness: 0.6, roughness: 0.45, flat: false }));
    ring.position.set(-sign * 1.84, 2.3, 0.11);
    pivot.add(ring);
    pivot.rotation.y = -sign * 1.34;   // 向内敞开约 77°
    return pivot;
  };
  g.add(makeLeaf(1));
  g.add(makeLeaf(-1));
  // 门楣
  g.add(box(5.9, 0.32, 0.48, mat(PAL.woodLight, { flat: false }), 0, baseY + 4.3, 4.9));
  // 匾额：绿底金字
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0),
    new THREE.MeshBasicMaterial({
      map: makeTextTexture('淸緣堂', {
        w: 640, h: 220, bg: '#1f4a37', color: '#e9d9a6',
        font: '600 96px "Songti SC","Noto Serif CJK SC",serif',
      }),
    }));
  plaque.position.set(0, baseY + 5.15, 5.02);
  g.add(plaque);
  g.add(box(2.86, 1.16, 0.12, mat(0x2a2018), 0, baseY + 5.15, 4.94));

  /* ---- 屋顶 + 檐下椽头 ---- */
  const roof = makeRoof(21.6, 13.2, { rise: 3.5 });
  roof.position.y = baseY + 6.06;
  g.add(roof);
  // 额枋：柱顶一圈横梁，把屋檐"托住"
  const fangMat = mat(0x5c3d2b, { flat: false });
  for (const z of [4.7, -4.7]) {
    g.add(box(19.6, 0.42, 0.42, fangMat, 0, baseY + 5.55, z));
  }
  for (const x of [-8.9, 8.9]) {
    g.add(box(0.42, 0.42, 11.0, fangMat, x, baseY + 5.55, 0));
  }
  // 椽头：正面与背面各一排，浅色小方块，原型里檐下最显眼的细节
  const rafterHeadMat = mat(0x8a6a4a, { flat: false });
  const headGeo = new THREE.BoxGeometry(0.13, 0.14, 0.62);
  const headCount = 2 * 42;
  const heads = new THREE.InstancedMesh(headGeo, rafterHeadMat, headCount);
  let hi = 0;
  for (const zs of [1, -1]) {
    for (let i = 0; i < 42; i++) {
      const x = -9.8 + (i / 41) * 19.6;
      mtx.makeTranslation(x, baseY + 5.86, zs * 6.55);
      heads.setMatrixAt(hi++, mtx);
    }
  }
  heads.instanceMatrix.needsUpdate = true;
  g.add(heads);

  /* ---- 蒲团：外阵 + 内阵，中间留过道 ---- */
  const cushionMat = mat(0x7d8571, { flat: false, roughness: 0.97 });
  const cushionEdge = mat(0x666d5c, { flat: false, roughness: 0.97 });
  for (const x of [-5.4, -4.2, -3.0, -1.8, -0.62, 0.62, 1.8, 3.0, 4.2, 5.4]) {
    for (const z of [4.7, 3.6, 2.5, 1.4, 0.3]) {
      g.add(box(0.8, 0.07, 0.8, cushionEdge, x, FLOOR + 0.035, z));
      g.add(box(0.76, 0.09, 0.76, cushionMat, x, FLOOR + 0.11, z));
    }
  }

  /* ---- 佛坛（须弥座）：主尊坐在高台上，不再坐地板 ---- */
  const altarMat = mat(0xc4b79c, { flat: false, roughness: 0.94 });
  const altarDark = mat(0xa89a80, { flat: false, roughness: 0.94 });
  g.add(box(9.6, 0.16, 3.1, altarDark, 0, FLOOR + 0.08, -3.35));      // 下枭
  g.add(box(9.2, 0.26, 2.8, altarMat, 0, FLOOR + 0.29, -3.35));       // 束腰
  g.add(box(9.6, 0.12, 3.1, altarDark, 0, FLOOR + 0.48, -3.35));      // 上枋
  const ALTAR_TOP = FLOOR + 0.54;

  /* ---- 三尊像（浅象牙石雕色，非金身） ---- */
  g.add(makeBuddha(0, ALTAR_TOP, -3.5, 1.34));
  g.add(makeBuddha(-3.5, ALTAR_TOP, -3.6, 0.94));
  g.add(makeBuddha(3.5, ALTAR_TOP, -3.6, 0.94));

  /* ---- 供桌：石台 + 香炉 + 一对花瓶 + 烛台 ---- */
  const woodDesk = mat(0x6a4630, { flat: false, roughness: 0.86 });
  const woodDeskDark = mat(0x533524, { flat: false, roughness: 0.86 });
  g.add(box(5.4, 0.14, 1.1, woodDesk, 0, FLOOR + 0.72, -0.95));
  g.add(box(5.4, 0.09, 1.1, woodDeskDark, 0, FLOOR + 0.6, -0.95));
  for (const sx of [-1, 1]) {
    g.add(box(0.26, 0.62, 0.95, woodDeskDark, sx * 2.2, FLOOR + 0.31, -0.95));
  }
  // 香炉
  g.add(cyl(0.3, 0.24, 0.26, 12, mat(0x8a6f45, { metalness: 0.35, roughness: 0.5, flat: false }), 0, FLOOR + 0.91, -0.95));
  for (const sx of [-1, 1]) {
    g.add(cyl(0.022, 0.022, 0.04, 6, mat(0x5a4426), sx * 0.1, FLOOR + 0.97, -0.95));
  }
  // 花瓶 + 青枝
  for (const sx of [-1, 1]) {
    const vx = sx * 2.0;
    g.add(cyl(0.13, 0.2, 0.42, 12, mat(0xdcd6c4, { flat: false, roughness: 0.7 }), vx, FLOOR + 0.91, -0.95));
    g.add(cyl(0.07, 0.13, 0.2, 12, mat(0xdcd6c4, { flat: false, roughness: 0.7 }), vx, FLOOR + 1.15, -0.95));
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + sx * 0.4;
      const stem = cyl(0.012, 0.016, 0.5, 5, mat(0x5f7346, { flat: false }), vx + Math.cos(ang) * 0.06, FLOOR + 1.4, -0.95 + Math.sin(ang) * 0.06);
      stem.rotation.z = Math.cos(ang) * 0.24;
      stem.rotation.x = -Math.sin(ang) * 0.24;
      g.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(0x6f8452, { flat: false }));
      leaf.scale.set(1, 0.42, 1.5);
      leaf.position.set(vx + Math.cos(ang) * 0.17, FLOOR + 1.6, -0.95 + Math.sin(ang) * 0.17);
      leaf.rotation.y = -ang;
      g.add(leaf);
    }
  }
  // 烛台
  for (const sx of [-1, 1]) {
    const cx2 = sx * 1.15;
    g.add(cyl(0.065, 0.09, 0.3, 8, mat(0x9a7b3e, { metalness: 0.4, roughness: 0.45, flat: false }), cx2, FLOOR + 0.87, -0.87));
    g.add(cyl(0.04, 0.04, 0.16, 8, mat(0xf2e6cf, { flat: false, roughness: 0.8 }), cx2, FLOOR + 1.08, -0.87));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd07a }));
    flame.scale.set(0.8, 1.5, 0.8);
    flame.position.set(cx2, FLOOR + 1.19, -0.87);
    g.add(flame);
  }

  /* ---- 堂内基础照明（吊灯已提供局部暖光，这里补一点整体亮度） ---- */
  const light = new THREE.PointLight(0xffd9a4, 9, 17, 2);
  light.position.set(0, baseY + 3.6, 1.2);
  g.add(light);

  g.position.z = -14;
  scene.add(g);
  return g;
}


function makeBuddha(x, y, z, s = 1) {
  const g = new THREE.Group();
  const PHI = Math.PI * 2;

  // 浅象牙石雕色（参照原型：佛身是浅色石材，不是金身），暗部用暖灰
  const gold = mat(0xd8c6a2, { roughness: 0.8, metalness: 0.06, emissive: 0x2a2013, emissiveIntensity: 0.16, flat: false });
  const goldDeep = mat(0xc2ae8a, { roughness: 0.84, metalness: 0.05, emissive: 0x241b10, emissiveIntensity: 0.15, flat: false });
  const goldLight = mat(0xe8d9b8, { roughness: 0.74, metalness: 0.08, emissive: 0x332716, emissiveIntensity: 0.18, flat: false });
  const ink = mat(0x6e5b45, { roughness: 0.86, metalness: 0, emissive: 0x1c150e, emissiveIntensity: 0.1, flat: false });

  /* ---- 莲座：覆莲锥台 + 腰线 + 仰莲锥台 + 座面，外圈一圈细瓣棱 ---- */
  g.add(cyl(1.14, 1.32, 0.26, 20, goldDeep, 0, 0.13, 0));   // 覆莲（下宽上收）
  g.add(cyl(1.18, 1.14, 0.09, 20, goldLight, 0, 0.305, 0)); // 腰线
  g.add(cyl(1.06, 1.16, 0.2, 20, goldDeep, 0, 0.45, 0));    // 仰莲
  g.add(cyl(0.96, 1.04, 0.13, 20, goldLight, 0, 0.615, 0)); // 座面
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * PHI;
    const rib = box(0.07, 0.3, 0.1, goldLight,
      Math.cos(a) * 1.225, 0.15, Math.sin(a) * 1.225);
    rib.rotation.y = -a + Math.PI / 2;
    rib.rotation.z = Math.cos(a) * 0.1;
    g.add(rib);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * PHI + 0.157;
    const rib = box(0.06, 0.2, 0.09, goldLight,
      Math.cos(a) * 1.1, 0.46, Math.sin(a) * 1.1);
    rib.rotation.y = -a + Math.PI / 2;
    g.add(rib);
  }

  /* ---- 结跏趺坐：裙摆 + 双膝 + 交叉双腿 + 脚掌 ---- */
  const lap = new THREE.Mesh(new THREE.SphereGeometry(0.86, 16, 10), gold);
  lap.scale.set(1.2, 0.3, 0.9);
  lap.position.y = 0.9;
  g.add(lap);
  // 交叠的小腿：一条横在身前的扁圆柱，正面看得出是盘坐
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.135, 1.26, 12), gold);
  shin.rotation.z = Math.PI / 2;
  shin.position.set(0, 0.9, 0.42);
  g.add(shin);

  for (const sx of [-1, 1]) {
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), gold);
    knee.scale.set(1.0, 0.8, 1.1);
    knee.position.set(sx * 0.92, 0.92, 0.2);
    g.add(knee);

    // 交叉的大腿：从一侧膝绕到身前
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 1.36, 7), goldLight);
    thigh.position.set(sx * 0.08, 1.0, 0.26);
    thigh.rotation.set(Math.PI / 2 - 0.1, 0, 0);
    thigh.rotation.z = sx * 0.6;
    g.add(thigh);
  }
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), goldLight);
  foot.scale.set(1.4, 0.6, 1.1);
  foot.position.set(-0.24, 1.06, 0.5);
  foot.rotation.y = 0.4;
  g.add(foot);

  /* ---- 上身：腰腹 + 胸肩 + 颈 ---- */
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 1.0, 18), gold);
  torso.position.y = 1.34;
  g.add(torso);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), gold);
  chest.scale.set(1.0, 0.56, 0.9);
  chest.position.y = 1.72;
  g.add(chest);

  // 颈：拉长一点，头才不会像直接扣在肩上
  g.add(cyl(0.155, 0.2, 0.3, 10, goldDeep, 0, 1.94, 0));

  // 袈裟：右肩斜披到左肋的一片弧形衣（贴着躯干，侧面不显突兀）
  const cloth = mat(0xb8a582, { roughness: 0.8, metalness: 0.06, emissive: 0x241a0e, emissiveIntensity: 0.14, side: THREE.DoubleSide, flat: false });
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.495, 0.485, 0.15, 18, 1, true, -1.45, 2.9), cloth);
  hem.position.set(0, 1.24, 0);
  hem.rotation.z = 0.08;
  g.add(hem);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.472, 0.468, 0.13, 18, 1, true, -1.1, 2.2), cloth);
  collar.position.set(0, 1.8, 0);
  collar.rotation.z = 0.34;
  g.add(collar);

  /* ---- 双臂 + 禅定印（两手叠放腹前） ---- */
  for (const sx of [-1, 1]) {
    // 肩头圆角，避免圆柱顶端露出方角
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 6), gold);
    shoulderCap.position.set(sx * 0.48, 1.79, 0.04);
    g.add(shoulderCap);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.098, 0.5, 7), gold);
    upper.position.set(sx * 0.49, 1.56, 0.07);
    upper.rotation.z = sx * 0.16;
    upper.rotation.x = -0.1;
    g.add(upper);

    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.075, 0.46, 8), goldLight);
    fore.position.set(sx * 0.25, 1.2, 0.31);
    fore.rotation.z = sx * 0.92;
    fore.rotation.x = -0.34;
    g.add(fore);
  }
  const palmA = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), goldLight);
  palmA.scale.set(1.05, 0.24, 0.78);
  palmA.position.set(0.02, 1.06, 0.4);
  g.add(palmA);
  const palmB = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), goldLight);
  palmB.scale.set(1.0, 0.22, 0.74);
  palmB.position.set(-0.02, 1.13, 0.42);
  g.add(palmB);

  /* ---- 头：面 + 螺髻 + 肉髻 + 长耳 + 五官 ---- */
  const H = 2.48;
  const HR = 0.315;
  const head = new THREE.Mesh(new THREE.SphereGeometry(HR, 14, 12), gold);
  head.scale.set(1, 1.05, 0.98);
  head.position.y = H;
  g.add(head);

  // 螺髻：三圈小球贴合头顶球面
  const coilGeo = new THREE.SphereGeometry(0.062, 5, 4);
  [[0.26, 12], [0.2, 10], [0.125, 7]].forEach(([r, n], ri) => {
    const hy = Math.sqrt(Math.max(0, HR * HR - r * r)) * 1.03;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PHI + ri * 0.32;
      const c = new THREE.Mesh(coilGeo, goldLight);
      c.position.set(Math.cos(a) * r, H + hy + 0.015, Math.sin(a) * r * 0.96);
      g.add(c);
    }
  });

  // 肉髻
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 6), gold);
  bun.scale.set(0.92, 1.1, 0.92);
  bun.position.y = H + 0.36;
  g.add(bun);

  // 长耳垂
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), goldLight);
    ear.scale.set(0.5, 2.1, 0.85);
    ear.position.set(sx * 0.345, H - 0.09, 0.02);
    g.add(ear);
  }

  // 眉 / 眼 / 鼻 / 嘴（用压扁的球，低模下比方块柔和）
  for (const sx of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), ink);
    brow.scale.set(2.3, 0.42, 0.5);
    brow.position.set(sx * 0.135, H + 0.12, 0.315);
    brow.rotation.z = sx * -0.14;
    g.add(brow);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 6, 4), ink);
    eye.scale.set(1.7, 0.46, 0.44);
    eye.position.set(sx * 0.135, H + 0.045, 0.32);
    eye.rotation.z = sx * -0.1;
    g.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.062, 6, 5), goldLight);
  nose.scale.set(0.78, 1.18, 0.85);
  nose.position.set(0, H - 0.04, 0.325);
  g.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.058, 6, 4), ink);
  mouth.scale.set(1.75, 0.42, 0.42);
  mouth.position.set(0, H - 0.165, 0.318);
  g.add(mouth);

  /* ---- 背光 ---- */
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.032, 7, 32), goldLight);
  halo.position.set(0, H + 0.02, -0.3);
  g.add(halo);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x9db07a, transparent: true, opacity: 0.22, depthWrite: false }));
  disc.position.set(0, H + 0.02, -0.32);
  g.add(disc);

  g.position.set(x, y, z);
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}


/* ---------- 石塔 ---------- */
function makePagoda(scene, x = -20, z = -2) {
  const g = new THREE.Group();
  const stoneMat = mat(0x9c9a8b, { roughness: 1 });
  const darkStone = mat(0x7f7d70);
  g.add(box(3.2, 0.5, 3.2, darkStone, 0, 0.25, 0));       // 基座
  let y = 0.5;
  for (let i = 0; i < 3; i++) {
    const w = 2.2 - i * 0.42;
    g.add(box(w, 1.15, w, stoneMat, 0, y + 0.58, 0));      // 塔身
    y += 1.15;
    g.add(box(w + 0.95, 0.22, w + 0.95, darkStone, 0, y + 0.06, 0)); // 檐
    y += 0.16;
    if (i < 2) y += 0.22;
  }
  // 塔刹
  g.add(cyl(0.1, 0.16, 0.9, 6, darkStone, 0, y + 0.5, 0));
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.26 - i * 0.04, 0.03, 6, 12), darkStone).translateY(y + 0.35 + i * 0.18));
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

/* ---------- 钟楼 ---------- */
function makeBell(scene, x = 21, z = -4) {
  const g = new THREE.Group();
  const woodMat = mat(0x4d3628);
  for (const dx of [-2.2, 2.2]) for (const dz of [-2.2, 2.2]) g.add(cyl(0.2, 0.24, 4.6, 8, woodMat, dx, 2.3, dz));
  g.add(box(5.4, 0.32, 5.4, mat(0x5a3d2c), 0, 4.6, 0));
  const roof = makeRoof(6.6, 6.6, { rise: 1.5 });
  roof.position.y = 4.85; g.add(roof);

  // 钟
  const bronze = mat(0x6f6146, { roughness: 0.5, metalness: 0.6, flat: false });
  g.add(cyl(0.52, 0.78, 1.5, 16, bronze, 0, 3.35, 0));
  g.add(cyl(0.84, 0.88, 0.14, 16, bronze, 0, 2.56, 0));
  g.add(cyl(0.1, 0.1, 0.22, 8, bronze, 0, 4.15, 0));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.0, 8), mat(0x6a4a30));
  beam.rotation.x = Math.PI / 2; beam.position.set(0, 3.1, 1.5);
  g.add(beam);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

/* ---------- 莲池 ---------- */
function makePond(scene, x = 24, z = 17, r = 7.2) {
  const g = new THREE.Group();
  // 池岸
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.42, 8, 40), mat(0x8c8a7c));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.16; rim.receiveShadow = true;
  g.add(rim);
  // 水面
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.2, 40),
    new THREE.MeshStandardMaterial({ color: PAL.water, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.1;
  g.add(water);
  // 荷叶与莲花
  const leafMat = mat(0x4c6b45);
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * (r - 1.4);
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.42 + Math.random() * 0.3, 8), leafMat);
    leaf.rotation.x = -Math.PI / 2; leaf.rotation.z = Math.random() * 3;
    leaf.position.set(Math.cos(a) * rr, 0.14, Math.sin(a) * rr);
    g.add(leaf);
    if (Math.random() > 0.6) {
      const lotus = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), mat(0xe9d4c8));
      lotus.scale.set(1, 0.7, 1); lotus.position.set(leaf.position.x, 0.26, leaf.position.z);
      g.add(lotus);
    }
  }
  // 石灯笼
  for (const [lx, lz] of [[-r - 1.2, 3.2], [r + 0.4, -3.0]]) {
    const l = new THREE.Group();
    l.add(cyl(0.3, 0.4, 0.4, 8, mat(0x8b887a), 0, 0.2, 0));
    l.add(cyl(0.18, 0.18, 1.0, 8, mat(0x8b887a), 0, 0.9, 0));
    l.add(box(0.62, 0.62, 0.62, mat(0xd8c9a1, { emissive: 0xffb765, emissiveIntensity: 0.55 }), 0, 1.7, 0));
    l.add(cyl(0.02, 0.62, 0.42, 4, mat(0x7e7b6d), 0, 2.16, 0));
    const pl = new THREE.PointLight(0xffb765, 7, 9, 2); pl.position.set(0, 1.75, 0); l.add(pl);
    l.position.set(lx, 0, lz);
    g.add(l);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

/* ---------- 植被 ---------- */
function makeMaple(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = cyl(0.17, 0.34, 2.3, 8, mat(0x4a362b, { flat: false }));
  trunk.position.y = 1.15; g.add(trunk);
  // 分枝
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.random();
    const br = cyl(0.06, 0.13, 1.15, 6, mat(0x4a362b, { flat: false }),
      Math.cos(a) * 0.3, 2.15, Math.sin(a) * 0.3);
    br.rotation.z = Math.cos(a) * 0.55;
    br.rotation.x = -Math.sin(a) * 0.55;
    g.add(br);
  }
  // 树冠：7~9 个球簇叠成饱满的一团
  const greens = [0x5d7346, 0x6b8152, 0x4f6440, 0x77894f, 0x869149];
  const blobs = 8;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    const rr = i === 0 ? 1.15 : 0.72 + Math.random() * 0.34;
    const rad = i === 0 ? 0 : 0.85 + Math.random() * 0.55;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1),
      mat(greens[i % greens.length], { roughness: 1, flat: false }));
    blob.position.set(Math.cos(a) * rad, 2.9 + (i === 0 ? 0.55 : Math.random() * 1.0), Math.sin(a) * rad);
    blob.scale.set(1.1, 0.88, 1.1);
    blob.castShadow = true;
    g.add(blob);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}
function makePine(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.13, 0.24, 2.4, 7, mat(0x3f2f24, { flat: false }), 0, 1.2, 0));
  const c1 = mat(0x4a6042, { roughness: 1, flat: false });
  const c2 = mat(0x556c4a, { roughness: 1, flat: false });
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 1.45 * (1 - t * 0.72);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.95, 9, 1), i % 2 ? c2 : c1);
    cone.position.y = 1.9 + i * 0.62;
    cone.scale.y = 0.95;
    cone.castShadow = true;
    g.add(cone);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}
function makeBamboo(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const h = 6 + Math.random() * 3;
    const stalk = cyl(0.045, 0.06, h, 5, mat(PAL.bamboo), (Math.random() - 0.5) * 2.4, h / 2, (Math.random() - 0.5) * 2.4);
    stalk.rotation.z = (Math.random() - 0.5) * 0.07;
    g.add(stalk);
    for (let k = 0; k < 5; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), mat(0x7d9159, { flat: false }));
      leaf.scale.set(1.9, 0.16, 0.5);
      leaf.position.set(
        stalk.position.x + (Math.random() - 0.5) * 0.7,
        h - 0.4 - k * 0.75 - Math.random() * 0.4,
        stalk.position.z + (Math.random() - 0.5) * 0.7);
      leaf.rotation.z = (Math.random() - 0.5) * 0.9;
      leaf.rotation.y = Math.random() * Math.PI;
      g.add(leaf);
    }
  }
  g.position.set(x, 0, z);
  return g;
}
function makeRock(x, z, s = 1) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x8b8878, { roughness: 1 }));
  m.position.set(x, s * 0.45, z); m.rotation.set(Math.random(), Math.random(), Math.random());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- 远山 ---------- */
function makeMountains(scene) {
  const g = new THREE.Group();
  const layers = [
    { d: 112, h: 22, c: 0x9dadb2, op: 1 },
    { d: 138, h: 30, c: 0xb0bec1, op: 1 },
    { d: 166, h: 38, c: 0xc4cfd0, op: 1 },
  ];
  layers.forEach((L, li) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + li * 0.3;
      const geo = new THREE.ConeGeometry(L.h * (0.8 + Math.random() * 0.6), L.h * (0.7 + Math.random() * 0.7), 5 + (i % 3));
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: L.c }));
      m.position.set(Math.cos(a) * L.d, -4, Math.sin(a) * L.d);
      m.rotation.y = Math.random() * 3;
      g.add(m);
    }
  });
  scene.add(g);
  return g;
}

/* ---------- 灯笼串 ---------- */
function makeLanternString(scene, from, to, count = 7) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * 0.9;
    const l = new THREE.Group();
    l.add(cyl(0.16, 0.2, 0.42, 8, mat(0xd9b06a, { emissive: 0xffa94d, emissiveIntensity: 0.9 })));
    l.add(cyl(0.02, 0.02, 0.28, 4, mat(0x3a3128), 0, 0.34, 0));
    l.position.copy(p);
    g.add(l);
  }
  scene.add(g);
  return g;
}

/* ---------- 纸灯笼（暖白，自发光 + 柔光晕） ---------- */
function makePaperLantern(radius = 0.22, color = 0xfff2d6) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10),
    new THREE.MeshStandardMaterial({
      color, roughness: 0.9, metalness: 0,
      emissive: 0xffdca6, emissiveIntensity: 0.85, flatShading: false,
    }));
  body.scale.set(1, 1.18, 1);
  g.add(body);
  // 上下木盖
  for (const y of [radius * 1.06, -radius * 1.06]) {
    const cap = cyl(radius * 0.46, radius * 0.5, 0.05, 8, mat(0x4a3524, { flat: false }), 0, y, 0);
    g.add(cap);
  }
  // 柔光晕
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xffcf94, transparent: true, opacity: 0.3,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(radius * 7);
  g.add(glow);
  return g;
}

/* ---------- 参道灯笼竿 ---------- */
function makeLampPole(x, z, faceIn = 1) {
  const g = new THREE.Group();
  const wood = mat(0x4c3423, { flat: false });
  g.add(box(0.9, 0.16, 0.9, mat(0x8b877b), 0, 0.08, 0));          // 石基
  g.add(cyl(0.085, 0.105, 3.4, 8, wood, 0, 1.75, 0));             // 立柱
  // 横臂朝参道内侧挑出
  g.add(box(1.1, 0.09, 0.09, wood, faceIn * 0.52, 3.36, 0));
  g.add(cyl(0.012, 0.012, 0.26, 4, mat(0x2e2419), faceIn * 0.95, 3.22, 0));
  const lantern = makePaperLantern(0.24);
  lantern.position.set(faceIn * 0.95, 2.96, 0);
  g.add(lantern);
  g.position.set(x, 0, z);
  return g;
}

/* ---------- 石灯笼 ---------- */
function makeStoneLantern(x, z, s = 1) {
  const g = new THREE.Group();
  const st = mat(0x9d9a8c, { flat: false, roughness: 0.96 });
  const stDark = mat(0x86836f, { flat: false, roughness: 0.96 });
  g.add(cyl(0.44, 0.5, 0.16, 8, stDark, 0, 0.08, 0));             // 基座
  g.add(cyl(0.15, 0.19, 1.05, 8, st, 0, 0.68, 0));                // 竿
  g.add(cyl(0.34, 0.3, 0.1, 8, stDark, 0, 1.24, 0));              // 中台
  // 火袋：四角立柱 + 上下框，中间透光
  for (const dx of [-0.24, 0.24]) {
    for (const dz of [-0.24, 0.24]) {
      g.add(box(0.1, 0.5, 0.1, st, dx, 1.55, dz));
    }
  }
  g.add(box(0.62, 0.08, 0.62, st, 0, 1.28, 0));
  g.add(box(0.62, 0.08, 0.62, st, 0, 1.82, 0));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfff0cd, emissive: 0xffca7a, emissiveIntensity: 2.2, roughness: 0.9, flatShading: false,
    }));
  flame.position.y = 1.55;
  g.add(flame);
  // 笠：宽檐六角
  g.add(cyl(0.1, 0.68, 0.34, 6, stDark, 0, 1.99, 0));
  for (let i = 0; i < 6; i++) {                       // 蕨手（檐角小翘）
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const tip = box(0.1, 0.16, 0.1, stDark, Math.cos(a) * 0.62, 2.16, Math.sin(a) * 0.62);
    tip.rotation.y = -a;
    g.add(tip);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), st);
  ball.position.y = 2.28;
  g.add(ball);
  g.scale.setScalar(s);
  g.position.set(x, 0, z);
  return g;
}

/* ---------- 灌木丛 ---------- */
function makeBush(x, z, s = 1) {
  const g = new THREE.Group();
  const cols = [0x4f5c3c, 0x5b6845, 0x445232, 0x66734a];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.random();
    const r = 0.28 + Math.random() * 0.16;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(cols[i % cols.length], { flat: false, roughness: 1 }));
    b.scale.set(1.15, 0.82, 1.15);
    b.position.set(Math.cos(a) * 0.26, r * 0.78, Math.sin(a) * 0.26);
    b.castShadow = true;
    g.add(b);
  }
  g.scale.setScalar(s);
  g.position.set(x, 0, z);
  return g;
}

/* ---------- 大块平石 ---------- */
function makeFlatRock(x, z, s = 1) {
  const r = 1.5 * s;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, 0.16 * s, 9),
    mat(0x6e6b58, { flat: true, roughness: 1 }));
  m.position.set(x, 0.075 * s, z);
  m.rotation.y = Math.random() * Math.PI;
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}


/* ---------- 落叶与草 ---------- */
function makeScatter(scene) {
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();

  // 落叶
  const N = 520;
  const leafGeo = new THREE.PlaneGeometry(0.28, 0.19);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide, flatShading: true });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N);
  leaves.receiveShadow = true;
  const cols = [0xb4482c, 0xd0722f, 0xc98a3a, 0x8f3a24, 0x9a6a35];
  for (let i = 0; i < N; i++) {
    let x = (Math.random() - 0.5) * 96;
    let z = (Math.random() - 0.5) * 96;
    if (Math.abs(x) < 2.9 && z > -9 && z < 41) x += (x >= 0 ? 1 : -1) * 3.4;
    dummy.position.set(x, 0.035 + Math.random() * 0.02, z);
    dummy.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    dummy.scale.setScalar(0.7 + Math.random() * 0.8);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    c.setHex(cols[i % cols.length]);
    leaves.setColorAt(i, c);
  }
  scene.add(leaves);

  // 草丛
  const GN = 320;
  const gGeo = new THREE.ConeGeometry(0.13, 0.4, 4);
  const gMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const grass = new THREE.InstancedMesh(gGeo, gMat, GN);
  const gCols = [0x8a8449, 0x6f7a45, 0x9a8b4c, 0x5f6b3a];
  for (let i = 0; i < GN; i++) {
    let x = (Math.random() - 0.5) * 100;
    let z = (Math.random() - 0.5) * 100;
    if (Math.abs(x) < 4.6 && z > -9 && z < 41) x += (x >= 0 ? 1 : -1) * 5.0;
    if (Math.hypot(x, z) < 12) continue;
    dummy.position.set(x, 0.18, z);
    dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
    dummy.scale.setScalar(0.7 + Math.random() * 0.9);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    c.setHex(gCols[i % gCols.length]);
    grass.setColorAt(i, c);
  }
  scene.add(grass);
}


/* ---------- 远景树线 ---------- */
function makeTreeLine(scene) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x42382d });
  const crownMats = [0x51604a, 0x5c6a4c, 0x46543e, 0x647049].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const N = 104;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.06;
    const r = 44 + Math.random() * 34;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 5.5 + Math.random() * 7;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, h * 0.52, 5), trunkMat);
    trunk.position.set(x, h * 0.26, z);
    scene.add(trunk);
    // 两层锥形冠 + 一个球冠，远看是茂密的树冠而不是三角形
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(h * 0.33, h * 0.62, 6), crownMats[i % 4]);
    c1.position.set(x, h * 0.62, z);
    scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(h * 0.25, h * 0.46, 6), crownMats[(i + 1) % 4]);
    c2.position.set(x, h * 0.86, z);
    scene.add(c2);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(h * 0.2, 6, 5), crownMats[(i + 2) % 4]);
    ball.position.set(x, h * 0.95, z);
    ball.scale.y = 0.75;
    scene.add(ball);
  }
}


/* ---------- 发光贴图（灯晕 / 香烟共用） ---------- */
let GLOW_TEX = null;
function glowTexture() {
  if (GLOW_TEX) return GLOW_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,242,208,.62)');
  grd.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  GLOW_TEX = new THREE.CanvasTexture(c);
  GLOW_TEX.colorSpace = THREE.SRGBColorSpace;
  return GLOW_TEX;
}

/* ---------- 愿望灯架 ----------
 * 3 层 × 8 钩 = 24 个钩位，与后端 LANTERN_HOOKS 对齐。
 * 点亮只改材质与光晕透明度，不新增光源：24 个 PointLight 会直接压垮低端机。
 */
const LANTERN_COLORS = { jin: 0xffcf94, zhu: 0xf08a6a, qing: 0x8fc6c0, bai: 0xefe6d2 };

function makeLanternRack(x, z, rotationY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotationY;

  const wood = mat(0x4a3529, { flat: false, roughness: 0.86 });
  const perRow = 8, layers = 3, total = perRow * layers;

  g.add(box(4.6, 0.18, 0.92, mat(0x8f8c7d), 0, 0.09, 0));         // 台座
  for (const px of [-2.12, 2.12]) {                                 // 立柱
    g.add(cyl(0.09, 0.12, 3.36, 8, wood, px, 1.78, 0));
    g.add(cyl(0.15, 0.16, 0.1, 8, mat(0x7f7d72), px, 0.24, 0));
  }
  for (let l = 0; l < layers; l++) {                                // 横梁
    g.add(box(4.34, 0.085, 0.13, wood, 0, 1.18 + l * 0.78, 0));
  }
  g.add(box(4.72, 0.11, 0.2, wood, 0, 3.34, 0));                    // 顶梁
  // 顶檐
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.1, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x3f3a33, roughness: 0.9, flatShading: true }));
  roof.position.set(0, 3.43, 0.02);
  roof.castShadow = true;
  g.add(roof);

  const hookGeo = new THREE.CylinderGeometry(0.155, 0.185, 0.3, 8);
  const unlit = mat(0xcfc4a8, { flat: false, roughness: 0.92 });
  const litMats = {};
  const litMat = (key) => {
    if (!litMats[key]) {
      const c = LANTERN_COLORS[key] || LANTERN_COLORS.jin;
      litMats[key] = new THREE.MeshStandardMaterial({
        color: c, emissive: c, emissiveIntensity: 1.15, roughness: 0.55, flatShading: false,
      });
    }
    return litMats[key];
  };

  const hooks = [];
  for (let i = 0; i < total; i++) {
    const l = Math.floor(i / perRow);
    const c = i % perRow;
    const hx = -1.86 + c * 0.5315;
    const hy = 1.02 + l * 0.78;

    const mesh = new THREE.Mesh(hookGeo, unlit);
    mesh.position.set(hx, hy, 0.05);
    mesh.castShadow = true;
    mesh.userData.hook = i;
    g.add(mesh);

    // 挂绳
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), wood);
    cord.position.set(hx, hy + 0.24, 0.05);
    g.add(cord);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffffff,
    }));
    glow.scale.set(0.95, 0.95, 1);
    glow.position.set(hx, hy, 0.13);
    glow.raycast = () => {};   // 光晕不参与拾取，否则会挡住钩位
    g.add(glow);

    hooks.push({ index: i, mesh, glow, lit: false, color: '' });
  }

  return {
    group: g,
    hooks,
    /** 点亮某个钩位；colorKey 取 jin/zhu/qing/bai */
    setLit(index, colorKey = 'jin') {
      const h = hooks[index];
      if (!h) return;
      const col = LANTERN_COLORS[colorKey] ? colorKey : 'jin';
      h.mesh.material = litMat(col);
      h.glow.material.color.setHex(LANTERN_COLORS[col]);
      h.glow.material.opacity = 0.5;
      h.lit = true;
      h.color = col;
    },
    /** 全部熄灭，用于切房间后重建 */
    clear() {
      hooks.forEach((h) => {
        h.mesh.material = unlit;
        h.glow.material.opacity = 0;
        h.lit = false;
        h.color = '';
      });
    },
  };
}

/* ---------- 香炉 ---------- */
function makeBurner(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const stone = mat(0x8d8a7d, { flat: false, roughness: 0.96 });
  const bronze = mat(0x76614a, { flat: false, roughness: 0.62, metalness: 0.35 });

  g.add(cyl(0.74, 0.82, 0.22, 10, stone, 0, 0.11, 0));        // 底座
  for (let i = 0; i < 3; i++) {                                 // 三足
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(cyl(0.07, 0.06, 0.26, 6, stone, Math.cos(a) * 0.44, 0.13, Math.sin(a) * 0.44));
  }
  g.add(cyl(0.52, 0.64, 0.74, 12, bronze, 0, 0.62, 0));       // 炉身
  g.add(cyl(0.58, 0.54, 0.12, 12, bronze, 0, 1.03, 0));       // 炉口
  for (const sx of [-1, 1]) {                                  // 双耳
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 12, Math.PI * 1.2), bronze);
    ear.position.set(sx * 0.5, 1.08, 0);
    ear.rotation.y = Math.PI / 2;
    ear.rotation.z = -sx * 0.2;
    g.add(ear);
  }

  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.47, 14), mat(0x9d9585, { flat: false }));
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 1.08;
  g.add(ash);

  // 三支香
  const tips = [];
  const stickGeo = new THREE.CylinderGeometry(0.017, 0.017, 1.0, 5);
  const stickMat = mat(0x8a6a4a, { flat: false });
  [[-0.13, -0.05], [0.01, 0.11], [0.15, -0.02]].forEach(([sx, sz], i) => {
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.set(sx, 1.58, sz);
    stick.rotation.z = (i - 1) * 0.045;
    g.add(stick);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x4a3a2a, emissive: 0xff5a1e, emissiveIntensity: 0 })
    );
    tip.position.set(sx, 2.08, sz);
    g.add(tip);
    tips.push(tip);
  });

  // 烟：一组上升粒子
  const N = 96;
  const posArr = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    posArr[i * 3] = (Math.random() - 0.5) * 0.34;
    posArr[i * 3 + 1] = 2.05 + Math.random() * 1.7;
    posArr[i * 3 + 2] = (Math.random() - 0.5) * 0.34;
    seed[i] = Math.random();
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
    size: 0.42, map: glowTexture(), color: 0xd8ded6, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  smoke.frustumCulled = false;
  smoke.raycast = () => {};   // 烟不参与拾取
  g.add(smoke);

  let lit = false, clock = 0;

  return {
    group: g,
    setLit(v) {
      lit = !!v;
      tips.forEach((t) => { t.material.emissiveIntensity = lit ? 1.7 : 0; });
    },
    get lit() { return lit; },
    update(dt) {
      clock += dt;
      const target = lit ? 0.30 : 0;
      smoke.material.opacity += (target - smoke.material.opacity) * Math.min(1, dt * 1.8);
      if (smoke.material.opacity < 0.008) return;

      const p = smokeGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] += dt * (0.30 + seed[i] * 0.26);
        p[i * 3] += Math.sin(clock * 0.8 + seed[i] * 6.28) * dt * 0.07;
        p[i * 3 + 2] += Math.cos(clock * 0.7 + seed[i] * 4.2) * dt * 0.05;
        if (p[i * 3 + 1] > 3.9) {
          p[i * 3 + 1] = 2.05;
          p[i * 3] = (Math.random() - 0.5) * 0.34;
          p[i * 3 + 2] = (Math.random() - 0.5) * 0.34;
        }
      }
      smokeGeo.attributes.position.needsUpdate = true;
    },
  };
}

/* ---------- 瓦堆 ---------- */
function makeTilePile(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const MAX = 144, perLayer = 8;
  const geo = new THREE.BoxGeometry(0.44, 0.058, 0.32);
  const mesh = new THREE.InstancedMesh(geo, mat(0x6f6c60, { flat: true, roughness: 0.95 }), MAX);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.count = 0;
  g.add(mesh);

  const dummy = new THREE.Object3D();
  const slot = [];
  for (let i = 0; i < MAX; i++) {
    const layer = Math.floor(i / perLayer);
    const k = i % perLayer;
    const col = k % 4, row = Math.floor(k / 4);
    dummy.position.set(
      (col - 1.5) * 0.46 + (layer % 2 ? 0.07 : 0),
      0.032 + layer * 0.062,
      (row - 0.5) * 0.34
    );
    dummy.rotation.set(0, (Math.random() - 0.5) * 0.07, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    slot.push(dummy.matrix.clone());
  }

  // 垫板
  g.add(box(2.0, 0.06, 0.9, mat(0x5b5347), 0, 0.03, 0));

  let shown = -1;
  return {
    group: g,
    /** @param {number} percent 0-100 */
    setProgress(percent) {
      const n = Math.max(0, Math.min(MAX, Math.round((MAX * percent) / 100)));
      if (n === shown) return;
      shown = n;
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, slot[i]);
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    get count() { return mesh.count; },
  };
}

/* ---------- 场地装配 ---------- */
export function buildWorld(scene) {
  makeSky(scene);
  makeGround(scene);
  makeMountains(scene);
  makePath(scene);
  makeGate(scene, 26);
  const hall = makeHall(scene);
  makePagoda(scene, -20, -2);
  makeBell(scene, 21, -4);
  makePond(scene, 24, 17, 7.0);

  // 竹林
  for (let i = 0; i < 7; i++) scene.add(makeBamboo(-26 + (Math.random() - 0.5) * 7, 10 + (Math.random() - 0.5) * 9));
  // 枫树群
  const maples = [[-9, 30], [10, 31], [-13, 18], [13, 20], [-16, 6], [16, 8], [-11, -20], [12, -21], [26, 2], [-26, -12], [8, 41], [-8, 42]];
  maples.forEach(([x, z], i) => scene.add(makeMaple(x, z, 0.9 + (i % 3) * 0.15)));
  // 松树
  [[-24, 28], [24, 30], [-30, 0], [30, 8], [0, -34], [-14, -28], [14, -30]].forEach(([x, z], i) => scene.add(makePine(x, z, 0.85 + (i % 2) * 0.2)));
  // 石
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 26;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 5 && z > -10 && z < 43) continue; // 不挡参道
    scene.add(makeRock(x, z, 0.35 + Math.random() * 0.5));
  }
  // 参道两侧：灯笼竿（近）、石灯笼（中）、大平石与灌木（草地带）
  for (const z of [33, 25, 17, 9]) {
    scene.add(makeLampPole(-5.6, z, 1));
    scene.add(makeLampPole(5.6, z, -1));
  }
  scene.add(makeStoneLantern(-7.6, 3.4, 1.0));
  scene.add(makeStoneLantern(7.6, 3.4, 1.0));
  // 大平石（原型参道两侧的天然石台）
  [[-8.4, 29], [9.0, 28.5], [-9.8, 14], [10.2, 15.5], [-12.5, 34], [12.8, 33]]
    .forEach(([x, z]) => scene.add(makeFlatRock(x, z, 0.9 + Math.random() * 0.5)));
  // 修剪过的灌木丛
  [[-5.2, 38], [5.4, 37.5], [-7.6, 22], [7.8, 22.5], [-6.4, 10.5], [6.6, 10.5],
   [-11, 26], [11.5, 26], [-12.6, 18], [13, 17]]
    .forEach(([x, z], i) => scene.add(makeBush(x, z, 0.85 + (i % 3) * 0.22)));
  // 参道两侧的低矮灌木带，填补空草地
  for (let z = 40; z > -6; z -= 4.6) {
    if (Math.random() < 0.75) scene.add(makeBush(-3.8 - Math.random() * 1.6, z + Math.random() * 1.6, 0.45 + Math.random() * 0.45));
    if (Math.random() < 0.75) scene.add(makeBush(3.8 + Math.random() * 1.6, z + Math.random() * 1.6, 0.45 + Math.random() * 0.45));
  }
  // 檐下小灯笼：法堂正面一排
  for (let i = 0; i < 7; i++) {
    const lx = -8.4 + i * 2.8;
    const l = makePaperLantern(0.17);
    l.position.set(lx, 6.05, -6.15);
    scene.add(l);
  }
  makeScatter(scene);
  makeTreeLine(scene);

  // 三处可交互：灯架（右）、香炉（左）、瓦堆（法堂右后）
  const lanternRack = makeLanternRack(7.6, 20.4, -0.30);
  scene.add(lanternRack.group);
  const burner = makeBurner(-7.6, 20.0);
  scene.add(burner.group);
  const tilePile = makeTilePile(10.8, 6.4);
  scene.add(tilePile.group);

  // 灯光：明亮的日间天光（参照原型，晴天薄雾）
  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x8b8161, 1.12);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.35);
  sun.position.set(-30, 34, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa8c0d8, 0.42);
  fill.position.set(30, 16, -30);
  scene.add(fill);

  scene.fog = new THREE.Fog(0xcdd6d2, 72, 250);

  return {
    spots: {
      gate: new THREE.Vector3(0, 0, 30),
      hall: new THREE.Vector3(0, 0, -12.2),
      pagoda: new THREE.Vector3(-17, 0, 0),
      bell: new THREE.Vector3(18, 0, -1),
      pond: new THREE.Vector3(16, 0, 20),
      bamboo: new THREE.Vector3(-22, 0, 13),
      lanterns: new THREE.Vector3(7.6, 0, 22.2),
      incense: new THREE.Vector3(-7.6, 0, 21.8),
      tiles: new THREE.Vector3(10.8, 0, 8.0),
    },
    // 地面高度：法堂台基靠台阶抬升，人可拾级入殿
    // 0.98 = 台基压顶板顶面，与 makeHall 里的 baseY - 0.03 + 0.06 对应，差 1cm 就会陷脚
    groundHeight: (x, z) => {
      if (Math.abs(x) < 9.4 && z < -6.85 && z > -19.2) {
        const t = z > -8.0 ? (-6.85 - z) / 1.15 : 1;
        return 0.65 * Math.min(1, Math.max(0, t));
      }
      return 0;
    },
    colliders: [
      // 法堂正面台基立面：中间 x ∈ ±2.2 是台阶口，不设墙
      { minX: -10.2, maxX: -2.2, minZ: -8.35, maxZ: -7.75 },
      { minX: 2.2, maxX: 10.2, minZ: -8.35, maxZ: -7.75 },
      // 殿内佛龛与供桌
      { minX: -5.6, maxX: 5.6, minZ: -19.2, maxZ: -14.5 },
      // 殿内后墙、左右山墙
      { minX: -10.2, maxX: 10.2, minZ: -19.3, maxZ: -18.7 },
      { minX: -10.2, maxX: -9.0, minZ: -19.3, maxZ: -7.75 },
      { minX: 9.0, maxX: 10.2, minZ: -19.3, maxZ: -7.75 },
      { minX: 16.4, maxX: 31.6, minZ: 9.4, maxZ: 24.6 },     // 莲池
      { minX: 5.1, maxX: 10.1, minZ: 19.5, maxZ: 21.3 },     // 灯架
      { minX: -8.5, maxX: -6.7, minZ: 19.1, maxZ: 20.9 },    // 香炉
      { minX: 9.8, maxX: 11.8, minZ: 5.9, maxZ: 6.9 },       // 瓦堆
      // 山门两根立柱，避免从柱心穿过去
      { minX: -4.05, maxX: -3.35, minZ: 25.65, maxZ: 26.35 },
      { minX: 3.35, maxX: 4.05, minZ: 25.65, maxZ: 26.35 },
    ],
    // 镜头避障只认大体积水面，台基放行，否则进殿会被顶回门口
    camBlockers: [
      { minX: 16.4, maxX: 31.6, minZ: 9.4, maxZ: 24.6 },
    ],
    lanternRack,
    burner,
    tilePile,
  };
}
