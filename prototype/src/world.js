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
  roof: 0x63665f,
  roofDark: 0x4a4d48,
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
      cTop: { value: new THREE.Color('#141a30') },
      cMid: { value: new THREE.Color('#4d4a68') },
      cLow: { value: new THREE.Color('#cf8a63') },
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
  g.fillStyle = '#8a6248'; g.fillRect(0, 0, 512, 512);
  const cols = ['rgba(116,82,58,.42)', 'rgba(154,116,84,.30)', 'rgba(92,74,50,.34)', 'rgba(104,112,66,.20)', 'rgba(168,132,96,.18)'];
  for (let i = 0; i < 11000; i++) {
    g.fillStyle = cols[i % cols.length];
    const x = Math.random() * 512, y = Math.random() * 512, r = Math.random() * 5.5 + 0.8;
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
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
  const patchCols = [0x76744a, 0x6b6b45, 0x857a52, 0x5e6440];
  const patchMats = patchCols.map((c) => mat(c, { flat: true }));
  for (let i = 0; i < 42; i++) {
    const r = 4 + Math.random() * 10;
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 8), patchMats[i % patchMats.length]);
    p.rotation.x = -Math.PI / 2;
    p.position.set((Math.random() - 0.5) * 120, 0.028, (Math.random() - 0.5) * 120);
    p.receiveShadow = true;
    if (Math.hypot(p.position.x, p.position.z) > 22) scene.add(p);
  }
  return ground;
}

/* ---------- 参道 ---------- */
function makePath(scene) {
  const g = new THREE.Group();
  // 石板缝的底
  const bed = box(4.0, 0.05, 49, mat(0x5b5347), 0, 0.015, 16);
  g.add(bed);
  const colors = [0x9a988c, 0x8e8c80, 0xa3a094, 0x848276];
  for (let z = 40; z > -8; z -= 1.05) {
    const w = 3.66 + Math.random() * 0.18;
    const slab = box(w, 0.07, 0.94, mat(colors[Math.floor(Math.random() * colors.length)], { roughness: 1 }), (Math.random() - 0.5) * 0.10, 0.035, z);
    slab.rotation.y = (Math.random() - 0.5) * 0.02;
    g.add(slab);
  }
  // 两侧路缘石
  for (const x of [-2.08, 2.08]) {
    for (let z = 40; z > -8; z -= 2.1) {
      g.add(box(0.40, 0.12, 2.0, mat(0x7f7d72), x, 0.055, z));
    }
  }
  // 法堂前小广场
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      g.add(box(2.2, 0.07, 1.62, mat(0x9b998c), -4.4 + i * 2.2, 0.035, -8.5 - j * 1.6));
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
  const roofMat = mat(color, { roughness: 0.85 });
  const edgeMat = mat(PAL.roofDark, { roughness: 0.8 });
  const halfW = width / 2;

  // 两片坡面
  const slopeLen = Math.hypot(depth / 2, rise);
  const angle = Math.atan2(rise, depth / 2);
  for (const s of [-1, 1]) {
    const slab = box(width, 0.22, slopeLen, roofMat, 0, rise / 2, s * depth / 4);
    slab.rotation.x = -s * angle;
    g.add(slab);
    // 瓦垄
    for (let i = 0; i < Math.floor(width / 0.55); i++) {
      const x = -halfW + 0.4 + i * 0.55;
      const ridge = box(0.16, 0.1, slopeLen * 0.98, edgeMat, x, rise / 2 + 0.12, s * depth / 4);
      ridge.rotation.x = -s * angle;
      g.add(ridge);
    }
  }
  // 屋脊
  g.add(box(width + 0.5, 0.3, 0.4, edgeMat, 0, rise + 0.08, 0));
  // 檐口
  for (const s of [-1, 1]) {
    g.add(box(width + 0.9, 0.18, 0.5, edgeMat, 0, 0.02, s * (depth / 2 + 0.06)));
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

  const roof = makeRoof(13.5, 5.2, { rise: 1.7 });
  roof.position.y = H + 0.05;
  g.add(roof);
  g.position.z = z;
  scene.add(g);
  return g;
}

/* ---------- 法堂 ---------- */
function makeHall(scene) {
  const g = new THREE.Group();
  const baseY = 0.95;
  // 台基
  g.add(box(17.4, baseY, 12, mat(0xa5a292), 0, baseY / 2, 0));
  g.add(box(18, 0.2, 12.6, mat(0x8f8c7d), 0, baseY + 0.02, 0));
  // 台阶
  for (let i = 0; i < 3; i++) {
    g.add(box(4.4 - i * 0.4, 0.32, 0.6, mat(0xa9a696), 0, 0.16 + i * 0.32, 6.9 - i * 0.55));
  }
  // 柱
  const woodMat = mat(0x54382a);
  for (const x of [-7.6, -3.8, 3.8, 7.6]) {
    g.add(cyl(0.28, 0.32, 5.6, 8, woodMat, x, baseY + 2.8, 4.6));
    g.add(cyl(0.28, 0.32, 5.6, 8, woodMat, x, baseY + 2.8, -4.6));
  }
  // 墙体
  const wallMat = mat(PAL.plaster, { roughness: 1 });
  g.add(box(19, 5.4, 0.4, wallMat, 0, baseY + 2.7, -5.0));       // 后墙
  g.add(box(0.4, 5.4, 10.2, wallMat, -9.4, baseY + 2.7, 0));     // 左墙
  g.add(box(0.4, 5.4, 10.2, wallMat, 9.4, baseY + 2.7, 0));      // 右墙
  // 木格窗（左右墙内侧）
  const lattice = makeTextTexture('', { w: 256, h: 256, bg: '#3b2a20', color: '#3b2a20', border: false });
  for (const x of [-9.15, 9.15]) {
    for (const z of [-2.4, 1.2]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0),
        new THREE.MeshStandardMaterial({ map: lattice, roughness: 0.9 }));
      win.position.set(x + (x < 0 ? 0.21 : -0.21), baseY + 2.9, z);
      win.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(win);
    }
  }
  // 正面：敞开的两扇木门（中间留出门洞，人可入殿）
  const doorMat = mat(0x3a2a20);
  const doorEdge = mat(0x241c15);
  const makeLeaf = (sign) => {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 2.28, baseY + 0.02, 4.86);
    // 门板：从门轴往内延伸
    pivot.add(box(2.22, 4.42, 0.11, doorMat, -sign * 1.11, 2.21, 0));
    // 横向门钉条
    for (let i = 0; i < 4; i++) {
      pivot.add(box(1.92, 0.07, 0.14, doorEdge, -sign * 1.11, 0.66 + i * 1.04, 0.01));
    }
    // 门环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 14),
      mat(0xb08d4a, { metalness: 0.6, roughness: 0.45, flat: false }));
    ring.position.set(-sign * 1.84, 2.3, 0.11);
    pivot.add(ring);
    // 向内敞开约 77°
    pivot.rotation.y = -sign * 1.34;
    return pivot;
  };
  g.add(makeLeaf(1));
  g.add(makeLeaf(-1));
  // 门楣（压低到门板顶端，避免挡住上方匾额）
  g.add(box(5.7, 0.3, 0.46, mat(PAL.woodLight), 0, baseY + 4.28, 4.86));
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0),
    new THREE.MeshBasicMaterial({ map: makeTextTexture('淸緣堂', { w: 640, h: 220, font: '600 96px "Songti SC","Noto Serif CJK SC",serif' }) }));
  plaque.position.set(0, baseY + 5.15, 5.0);
  g.add(plaque);
  g.add(box(2.9, 1.2, 0.12, mat(0x241f19), 0, baseY + 5.15, 4.9));

  // 屋顶
  const roof = makeRoof(22, 15.4, { rise: 3.1 });
  roof.position.y = baseY + 5.5;
  g.add(roof);

  // 三尊像
  g.add(makeBuddha(0, baseY, -1.6, 1));
  g.add(makeBuddha(-3.5, baseY, -1.0, 0.78));
  g.add(makeBuddha(3.5, baseY, -1.0, 0.78));

  // 供桌
  g.add(box(4.6, 0.16, 1.1, mat(0x5b3a26), 0, baseY + 1.15, 2.4));
  g.add(box(0.3, 1.1, 0.3, mat(0x4a2f20), -1.9, baseY + 0.56, 2.4));
  g.add(box(0.3, 1.1, 0.3, mat(0x4a2f20), 1.9, baseY + 0.56, 2.4));

  // 堂内暖光
  const light = new THREE.PointLight(0xffc98a, 26, 18, 2);
  light.position.set(0, baseY + 3.4, 0.5);
  g.add(light);

  g.position.z = -14;
  scene.add(g);
  return g;
}

function makeBuddha(x, y, z, s = 1) {
  const g = new THREE.Group();
  const goldMat = mat(PAL.gold, { roughness: 0.4, metalness: 0.55, emissive: 0x6b4a12, emissiveIntensity: 0.45, flat: false });
  const goldSoft = mat(0xc79b47, { roughness: 0.5, metalness: 0.4, emissive: 0x4a3208, emissiveIntensity: 0.4, flat: false });
  // 莲座
  g.add(cyl(1.05, 1.2, 0.32, 12, goldSoft, 0, 0.16, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 4), goldSoft);
    petal.scale.set(1, 0.55, 1.5);
    petal.position.set(Math.cos(a) * 1.02, 0.3, Math.sin(a) * 1.02);
    petal.rotation.y = -a;
    g.add(petal);
  }
  // 身
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), goldMat);
  body.scale.set(1, 1.15, 0.78); body.position.y = 1.15;
  g.add(body);
  const lap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), goldMat);
  lap.scale.set(1, 0.42, 0.8); lap.position.y = 0.62;
  g.add(lap);
  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), goldMat);
  head.position.y = 2.06; g.add(head);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), goldMat);
  bun.position.y = 2.44; g.add(bun);
  // 背光
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 28), goldSoft);
  halo.position.set(0, 1.95, -0.42);
  g.add(halo);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.82, 28), new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.16 }));
  disc.position.set(0, 1.95, -0.44);
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
  g.add(cyl(0.72, 0.92, 1.7, 14, bronze, 0, 3.4, 0));
  g.add(cyl(0.98, 0.98, 0.16, 14, bronze, 0, 2.5, 0));
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
  const trunk = cyl(0.2, 0.36, 1.95, 7, mat(0x46312a));
  trunk.position.y = 0.97; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const br = cyl(0.07, 0.14, 1.2, 5, mat(0x4a3428));
    const a = (i / 3) * Math.PI * 2;
    br.position.set(Math.cos(a) * 0.35, 2.0, Math.sin(a) * 0.35);
    br.rotation.z = Math.cos(a) * 0.6; br.rotation.x = Math.sin(a) * 0.6;
    g.add(br);
  }
  const colors = PAL.maple;
  for (let i = 0; i < 5; i++) {
    const r = 0.72 + Math.random() * 0.42;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(colors[i % colors.length], { roughness: 1 }));
    blob.position.set((Math.random() - 0.5) * 1.55, 2.15 + Math.random() * 0.95, (Math.random() - 0.5) * 1.55);
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
  g.add(cyl(0.14, 0.26, 2.2, 6, mat(0x3f2f24), 0, 1.1, 0));
  const c = mat(PAL.pine, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 - i * 0.36, 1.5, 6), c);
    cone.position.y = 2.4 + i * 0.85; cone.castShadow = true; g.add(cone);
  }
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}
function makeBamboo(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const h = 6 + Math.random() * 3;
    const stalk = cyl(0.045, 0.06, h, 5, mat(PAL.bamboo), (Math.random() - 0.5) * 2.4, h / 2, (Math.random() - 0.5) * 2.4);
    stalk.rotation.z = (Math.random() - 0.5) * 0.07;
    g.add(stalk);
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 4), mat(0x7d9159));
      leaf.position.set(stalk.position.x + (Math.random() - 0.5) * 0.5, h - 0.6 - k * 0.9, stalk.position.z + (Math.random() - 0.5) * 0.5);
      leaf.rotation.z = (Math.random() - 0.5) * 1.2;
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
    { d: 105, h: 26, c: 0x7a6457, op: 1 },
    { d: 130, h: 34, c: 0x6b574c, op: 1 },
    { d: 158, h: 42, c: 0x50413a, op: 1 },
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
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x40352c });
  const crownMats = [0x4a4c3a, 0x53503c, 0x3f4636].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 54; i++) {
    const a = (i / 54) * Math.PI * 2 + Math.random() * 0.05;
    const r = 58 + Math.random() * 26;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 5 + Math.random() * 6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, h * 0.5, 5), trunkMat);
    trunk.position.set(x, h * 0.25, z);
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(h * 0.34, h, 5), crownMats[i % 3]);
    crown.position.set(x, h * 0.72, z);
    scene.add(crown);
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
  const unlit = mat(0x6b5544, { flat: false, roughness: 0.8 });
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
  // 灯笼：山门 → 法堂
  makeLanternString(scene, new THREE.Vector3(-2.6, 5.0, 26), new THREE.Vector3(-2.6, 5.0, -6), 9);
  makeLanternString(scene, new THREE.Vector3(2.6, 5.0, 26), new THREE.Vector3(2.6, 5.0, -6), 9);
  makeScatter(scene);
  makeTreeLine(scene);

  // 三处可交互：灯架（右）、香炉（左）、瓦堆（法堂右后）
  const lanternRack = makeLanternRack(7.6, 20.4, -0.30);
  scene.add(lanternRack.group);
  const burner = makeBurner(-7.6, 20.0);
  scene.add(burner.group);
  const tilePile = makeTilePile(10.8, 6.4);
  scene.add(tilePile.group);

  // 灯光
  const hemi = new THREE.HemisphereLight(0x93aacd, 0x6f5539, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd8b6, 2.25);
  sun.position.set(-34, 26, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8fa6c8, 0.5);
  fill.position.set(30, 16, -30);
  scene.add(fill);

  scene.fog = new THREE.Fog(0x9c8d86, 66, 205);

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
    groundHeight: (x, z) => {
      if (Math.abs(x) < 9.4 && z < -6.9 && z > -19.2) {
        const t = z > -8.5 ? (-6.9 - z) / 1.6 : 1;
        return 0.95 * Math.min(1, Math.max(0, t));
      }
      return 0;
    },
    colliders: [
      // 法堂正面台基立面：中间 x ∈ ±2.2 是台阶口，不设墙
      { minX: -10.2, maxX: -2.2, minZ: -8.35, maxZ: -7.75 },
      { minX: 2.2, maxX: 10.2, minZ: -8.35, maxZ: -7.75 },
      // 殿内佛龛与供桌
      { minX: -5.6, maxX: 5.6, minZ: -17.0, maxZ: -10.9 },
      // 殿内后墙、左右山墙
      { minX: -10.2, maxX: 10.2, minZ: -19.3, maxZ: -18.7 },
      { minX: -10.2, maxX: -9.0, minZ: -19.3, maxZ: -7.75 },
      { minX: 9.0, maxX: 10.2, minZ: -19.3, maxZ: -7.75 },
      { minX: 16.4, maxX: 31.6, minZ: 9.4, maxZ: 24.6 },     // 莲池
      { minX: 5.1, maxX: 10.1, minZ: 19.5, maxZ: 21.3 },     // 灯架
      { minX: -8.5, maxX: -6.7, minZ: 19.1, maxZ: 20.9 },    // 香炉
      { minX: 9.8, maxX: 11.8, minZ: 5.9, maxZ: 6.9 },       // 瓦堆
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
