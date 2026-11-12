import * as THREE from 'three';

/* ------------------------------------------------------------------
 * 小沙弥：软陶质感低模角色
 * 参照原型：亮白僧袍 + 斜披浅黄袈裟、大圆头、短腿小手、无鞋
 * 动作：idle / walk / pray（合掌）/ bow（跪拜）/ strike（敲击）
 * ----------------------------------------------------------------*/

const SKIN = 0xe2b189;        // 暖米肤色
const SKIN_DARK = 0xcf9c73;   // 耳窝、颈影
const ROBE = 0xd9dbd4;        // 浅灰白僧袍
const ROBE_SHADE = 0xc2c5be;  // 袍褶暗部
const APRON = 0xeed177;       // 浅黄袈裟
const APRON_DEEP = 0xd9b657;
const INK = 0x4a3a2e;

// 所有角色共享同一张柔影贴图，避免多人场景重复生成纹理
let SHADOW_TEX = null;
function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(28,20,12,.50)');
  grd.addColorStop(0.55, 'rgba(28,20,12,.22)');
  grd.addColorStop(1, 'rgba(28,20,12,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  SHADOW_TEX = new THREE.CanvasTexture(c);
  return SHADOW_TEX;
}

/** 软陶材质：全平滑、高粗糙、零金属，避免低模高光的塑料感 */
function clay(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.97, metalness: 0, flatShading: false, ...opts,
  });
}

export default class Actor {
  constructor(scene, x = 0, z = 34) {
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    scene.add(this.root);

    this.rig = new THREE.Group();
    this.root.add(this.rig);

    const robeMat = clay(ROBE, { side: THREE.DoubleSide });
    const robeShadeMat = clay(ROBE_SHADE);
    const skinMat = clay(SKIN);
    const apronMat = clay(APRON, { side: THREE.DoubleSide });
    const apronDeepMat = clay(APRON_DEEP);

    /* ---- 双腿：只从袍摆下露出很短一截 + 圆脚，脚底贴 y=0 ---- */
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.115, 0.34, 12), robeMat);
      shin.position.y = -0.17;
      shin.castShadow = true;
      leg.add(shin);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), robeShadeMat);
      foot.scale.set(1.04, 0.58, 1.34);
      foot.position.set(0, -0.33, 0.05);
      foot.castShadow = true;
      leg.add(foot);
      leg.position.set(s * 0.145, 0.40, 0);
      this.rig.add(leg);
      this.legs.push(leg);
    }

    /* ---- 身体：一体成型的 Lathe 袍身（无接缝，下摆微张、腰略收、肩圆） ---- */
    this.torso = new THREE.Group();
    this.torso.position.y = 0.16;
    const profile = [
      [0.30, 0.0], [0.358, 0.15], [0.352, 0.40],
      [0.318, 0.62], [0.302, 0.80], [0.292, 0.90],
      [0.24, 0.965], [0.135, 1.005], [0.0, 1.01],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 26), robeMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.torso.add(body);

    /* ---- 袈裟：从右肩斜披到左腰的一整片（Lathe 开口壳，贴合体形） ---- */
    const sashProfile = profile.map((v) => new THREE.Vector2(v.x + 0.024, v.y));
    const sash = new THREE.Mesh(
      new THREE.LatheGeometry(sashProfile, 26, -1.5, 3.0), apronMat);
    sash.rotation.z = -0.2;
    sash.position.y = 0.02;
    sash.castShadow = true;
    this.torso.add(sash);
    // 肩头搭角：右肩上的一小片布端
    const shoulderCloth = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 1.2, 0, Math.PI * 0.6), apronMat);
    shoulderCloth.scale.set(1.3, 0.95, 1.15);
    shoulderCloth.position.set(-0.15, 0.93, 0.03);
    shoulderCloth.rotation.z = -0.34;
    this.torso.add(shoulderCloth);
    // 腰际束带
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.322, 0.07, 24), apronDeepMat);
    belt.position.y = 0.66;
    this.torso.add(belt);
    this.rig.add(this.torso);

    /* ---- 手臂：细袖筒贴身体 + 露出的小手 ---- */
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const cap2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), robeMat);
      cap2.position.y = 0.005;
      cap2.scale.set(1, 0.85, 1);
      arm.add(cap2);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.086, 0.38, 14), robeMat);
      sleeve.position.y = -0.19;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.018, 6, 16), robeShadeMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.375;
      arm.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), skinMat);
      hand.scale.set(1, 1.06, 0.94);
      hand.position.y = -0.445;
      hand.castShadow = true;
      arm.add(hand);
      arm.position.set(s * 0.285, 0.9, 0.01);
      arm.rotation.z = s * 0.1;
      this.rig.add(arm);
      this.arms.push(arm);
    }

    /* ---- 头：大圆头 + 短颈 ---- */
    this.head = new THREE.Group();
    this.head.position.y = 1.14;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.155, 0.12, 14), clay(SKIN_DARK));
    neck.position.y = 0.03;
    this.head.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.285, 24, 18), skinMat);
    skull.scale.set(1, 0.98, 0.98);
    skull.position.y = 0.28;
    skull.castShadow = true;
    this.head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), skinMat);
    jaw.scale.set(0.97, 0.82, 0.93);
    jaw.position.set(0, 0.185, 0.028);
    this.head.add(jaw);
    // 眼：两个小点，暖褐色
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 8), clay(INK));
      eye.position.set(s * 0.095, 0.29, 0.263);
      eye.scale.set(1, 1.35, 0.45);
      this.head.add(eye);
    }
    this.rig.add(this.head);

    /* ---- 脚下接触阴影 ---- */
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.42, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.014;
    this.root.add(blob);
    this.blob = blob;

    // 状态
    this.action = 'idle';
    this.actionT = 0;
    this.target = null;
    this.speed = 2.9;
    this.walkPhase = 0;
    this.bowCount = 0;
    this.strikePhase = 0;
    this.onArrive = null;
    this.blocked = false;
  }

  get position() { return this.root.position; }

  setAction(name) {
    if (this.action === name) return;
    this.action = name;
    this.actionT = 0;
  }

  moveTo(point, onArrive) {
    this.target = point.clone();
    this.target.y = 0;
    this.onArrive = onArrive || null;
    this.setAction('walk');
  }

  stop() {
    this.target = null;
    this.setAction('idle');
  }

  /** 跪拜：一次完整起-跪-叩，回位后回调 */
  bow(done) {
    if (this.action === 'bow') return;
    this.setAction('bow');
    this.bowDone = done;
  }

  strike() {
    this.strikePhase = 1;
  }

  update(dt, colliders = []) {
    this.actionT += dt;

    /* ---- 移动 ---- */
    if (this.target) {
      const dx = this.target.x - this.root.position.x;
      const dz = this.target.z - this.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.18) {
        this.target = null;
        this.setAction('idle');
        if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
      } else {
        const step = Math.min(this.speed * dt, dist);
        const nx = this.root.position.x + (dx / dist) * step;
        const nz = this.root.position.z + (dz / dist) * step;
        if (!this.hits(nx, nz, colliders)) {
          this.root.position.x = nx;
          this.root.position.z = nz;
        } else {
          this.target = null;
          this.setAction('idle');
        }
        const want = Math.atan2(dx, dz);
        let diff = want - this.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.root.rotation.y += diff * Math.min(1, dt * 9);
      }
    }
    // 场地边界
    const r = Math.hypot(this.root.position.x, this.root.position.z);
    if (r > 46) {
      this.root.position.multiplyScalar(46 / r);
      this.target = null;
    }

    // 地面高度（台阶 / 台基），平滑贴合避免上下抖动
    if (typeof this.groundFn === 'function') {
      const gy = this.groundFn(this.root.position.x, this.root.position.z);
      this.root.position.y += (gy - this.root.position.y) * Math.min(1, dt * 11);
    }

    /* ---- 动作驱动 ---- */
    const t = this.actionT;
    const lerp = (a, b, k) => a + (b - a) * Math.min(1, k);

    // 默认姿态目标
    let legL = 0, legR = 0, armLX = 0, armRX = 0, armLZ = -0.13, armRZ = 0.13;
    let bodyX = 0, bodyY = 0, headX = 0, rigY = 0, twist = 0;

    if (this.action === 'walk') {
      this.walkPhase += dt * 8.4;
      const s = Math.sin(this.walkPhase);
      legL = s * 0.52; legR = -s * 0.52;
      armLX = -s * 0.4; armRX = s * 0.4;
      bodyY = Math.abs(Math.cos(this.walkPhase)) * 0.032;
      bodyX = 0.055;
      // 左右轻晃，软陶角色的笨拙感
      twist = Math.sin(this.walkPhase) * 0.06;
      headX = -0.03;
    } else if (this.action === 'pray') {
      armLX = -1.15; armRX = -1.15;
      armLZ = 0.44; armRZ = -0.44;
      headX = 0.13;
      bodyX = 0.05;
      rigY = Math.sin(t * 1.6) * 0.012;
    } else if (this.action === 'bow') {
      // 0-0.55 下蹲前倾，0.55-1.25 叩首，1.25-1.95 起身
      const p = Math.min(t, 2.0);
      let k;
      if (p < 0.55) k = p / 0.55;
      else if (p < 1.25) k = 1;
      else k = Math.max(0, 1 - (p - 1.25) / 0.7);
      const e = k * k * (3 - 2 * k);
      bodyX = e * 1.12;
      rigY = -e * 0.4;
      legL = e * 0.95; legR = e * 0.95;
      armLX = -e * 1.45; armRX = -e * 1.45;
      armLZ = e * 0.12; armRZ = -e * 0.12;
      headX = e * 0.28;
      if (t > 2.05 && this.action === 'bow') {
        this.setAction('idle');
        const f = this.bowDone; this.bowDone = null;
        if (f) f();
      }
    } else {
      // idle 呼吸
      bodyY = Math.sin(t * 1.5) * 0.008;
      armLZ = -0.13 + Math.sin(t * 1.5) * 0.022;
      armRZ = 0.13 - Math.sin(t * 1.5) * 0.022;
      headX = Math.sin(t * 0.7) * 0.02;
    }

    // 敲击叠加
    if (this.strikePhase > 0) {
      this.strikePhase = Math.max(0, this.strikePhase - dt * 2.6);
      const s = Math.sin((1 - this.strikePhase) * Math.PI);
      armRX = armRX - s * 1.0;
      headX += s * 0.05;
    }

    const k = Math.min(1, dt * 12);
    this.legs[0].rotation.x = lerp(this.legs[0].rotation.x, legL, k);
    this.legs[1].rotation.x = lerp(this.legs[1].rotation.x, legR, k);
    this.arms[0].rotation.x = lerp(this.arms[0].rotation.x, armLX, k);
    this.arms[1].rotation.x = lerp(this.arms[1].rotation.x, armRX, k);
    this.arms[0].rotation.z = lerp(this.arms[0].rotation.z, armLZ, k);
    this.arms[1].rotation.z = lerp(this.arms[1].rotation.z, armRZ, k);
    this.rig.rotation.x = lerp(this.rig.rotation.x, bodyX, k);
    this.rig.rotation.z = lerp(this.rig.rotation.z, twist, k);
    this.rig.position.y = lerp(this.rig.position.y, rigY + bodyY, k);
    this.head.rotation.x = lerp(this.head.rotation.x, headX, k);
  }

  hits(x, z, colliders) {
    const pad = 0.35;
    for (const c of colliders) {
      if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  }
}
