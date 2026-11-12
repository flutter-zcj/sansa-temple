import * as THREE from 'three';

/* ------------------------------------------------------------------
 * 小和尚：低模角色 + 程序化动作
 * 动作：idle / walk / pray（合掌）/ bow（跪拜）/ strike（敲击）
 * ----------------------------------------------------------------*/

const SKIN = 0xdc8f61;
const ROBE = 0xc7c6bd;
const ROBE_DARK = 0xb0afa6;
const APRON = 0xe6cf8b;
const INK = 0x2a2620;

// 所有角色共享同一张柔影贴图，避免多人场景重复生成纹理
let SHADOW_TEX = null;
function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(30,20,10,.55)');
  grd.addColorStop(1, 'rgba(30,20,10,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  SHADOW_TEX = new THREE.CanvasTexture(c);
  return SHADOW_TEX;
}

function m(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...opts });
}

export default class Actor {
  constructor(scene, x = 0, z = 34) {
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    scene.add(this.root);

    this.rig = new THREE.Group();
    this.root.add(this.rig);

    const robeMat = m(ROBE);
    const skinMat = m(SKIN);
    const apronMat = m(APRON);

    // 腿
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.52, 6), m(0xdedcd2));
      thigh.position.y = -0.26;
      leg.add(thigh);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.26), m(0x3a352c));
      foot.position.set(0, -0.54, 0.05);
      leg.add(foot);
      leg.position.set(s * 0.14, 0.58, 0);
      leg.castShadow = true;
      this.rig.add(leg);
      this.legs.push(leg);
    }

    // 身体
    this.torso = new THREE.Group();
    this.torso.position.y = 0.6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.62, 8), robeMat);
    body.position.y = 0.31;
    body.castShadow = true;
    this.torso.add(body);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.245, 8, 6), robeMat);
    shoulder.position.y = 0.6; shoulder.scale.y = 0.7;
    this.torso.add(shoulder);
    // 围裙
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06), apronMat);
    apron.position.set(0, 0.3, 0.245);
    apron.rotation.x = -0.05;
    this.torso.add(apron);
    // 腰带
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.42), m(0xd8c07a));
    belt.position.y = 0.06;
    this.torso.add(belt);
    this.rig.add(this.torso);

    // 手臂
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.46, 6), robeMat);
      sleeve.position.y = -0.23;
      arm.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), skinMat);
      hand.position.y = -0.48;
      arm.add(hand);
      arm.position.set(s * 0.28, 1.19, 0);
      arm.rotation.z = s * 0.1;
      this.rig.add(arm);
      this.arms.push(arm);
    }

    // 头
    this.head = new THREE.Group();
    this.head.position.y = 1.42;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.265, 14, 12), skinMat);
    skull.castShadow = true;
    this.head.add(skull);
    // 耳
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.062, 6, 5), skinMat);
      ear.position.set(s * 0.255, -0.01, 0.01);
      ear.scale.set(0.6, 1, 0.8);
      this.head.add(ear);
    }
    // 眼（极简两点）
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), m(INK));
      eye.position.set(s * 0.09, 0.03, 0.245);
      eye.scale.set(1, 1.25, 0.6);
      this.head.add(eye);
    }
    this.rig.add(this.head);

    // 脚下阴影（柔和贴片）
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.34, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.root.add(blob);

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
    let legL = 0, legR = 0, armLX = 0, armRX = 0, armLZ = -0.1, armRZ = 0.1;
    let bodyX = 0, bodyY = 0, headX = 0, rigY = 0;

    if (this.action === 'walk') {
      this.walkPhase += dt * 9;
      const s = Math.sin(this.walkPhase);
      legL = s * 0.55; legR = -s * 0.55;
      armLX = -s * 0.45; armRX = s * 0.45;
      bodyY = Math.abs(Math.cos(this.walkPhase)) * 0.035;
      bodyX = 0.06;
    } else if (this.action === 'pray') {
      armLX = -1.15; armRX = -1.15;
      armLZ = 0.42; armRZ = -0.42;
      headX = 0.12;
      bodyX = 0.05;
      rigY = Math.sin(t * 1.6) * 0.012;
    } else if (this.action === 'bow') {
      // 0-0.5 下蹲前倾，0.5-1.1 叩首，1.1-1.9 起身
      const p = Math.min(t, 2.0);
      let k;
      if (p < 0.55) k = p / 0.55;
      else if (p < 1.25) k = 1;
      else k = Math.max(0, 1 - (p - 1.25) / 0.7);
      const e = k * k * (3 - 2 * k);
      bodyX = e * 1.15;
      rigY = -e * 0.42;
      legL = e * 1.0; legR = e * 1.0;
      armLX = -e * 1.5; armRX = -e * 1.5;
      armLZ = e * 0.1; armRZ = -e * 0.1;
      headX = e * 0.3;
      if (t > 2.05 && this.action === 'bow') {
        this.setAction('idle');
        const f = this.bowDone; this.bowDone = null;
        if (f) f();
      }
    } else {
      // idle 呼吸
      bodyY = Math.sin(t * 1.5) * 0.008;
      armLZ = -0.1 + Math.sin(t * 1.5) * 0.02;
      armRZ = 0.1 - Math.sin(t * 1.5) * 0.02;
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
