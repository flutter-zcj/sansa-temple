<template>
  <view class="temple-page">
    <!-- 3D 画布容器：仅 H5 挂载 Three.js -->
    <view id="temple-stage" class="temple-stage"></view>

    <!-- 顶部 -->
    <view class="hud-top">
      <view class="pill-group">
        <view class="icon-btn" @click="openSheet('map')">
          <view class="ico ico-map" />
        </view>
        <view class="pill room-pill" @click="onRoomTap">
          <text class="room-name">山寺 <text class="room-no">{{ roomNo }}</text></text>
          <view class="chev" />
        </view>
      </view>
      <view class="pill-group right">
        <view class="icon-btn" :class="{ 'is-off': soundOff }" @click="toggleSound">
          <view class="ico ico-sound" />
        </view>
        <view class="pill chant-pill" :class="{ 'is-off': !chanting }" @click="toggleChant">
          <view class="wave"><i /><i /><i /></view>
          <text>听诵经</text>
        </view>
      </view>
    </view>

    <!-- 提示 -->
    <view class="hint" :class="{ 'is-hidden': hintHidden }">
      <text>点击地面行走 · 拖动环视 · 滚轮缩放</text>
    </view>
    <view class="toast" :class="{ on: toastOn }">
      <text>{{ toastText }}</text>
    </view>

    <!-- 底部动作 -->
    <view class="dock">
      <view class="dock-btn" :class="{ 'is-active': praying }" @click="onPray">
        <view class="ico ico-pray" />
        <text>合掌</text>
      </view>
      <view class="dock-btn" :class="{ 'is-active': bowing }" @click="onBow">
        <view class="ico ico-bow" />
        <text>跪拜</text>
      </view>
      <view class="dock-btn" :class="{ 'is-active': sheet === 'moktak' }" @click="openSheet('moktak')">
        <view class="ico ico-moktak" />
        <text>木鱼</text>
      </view>
      <view class="dock-btn" :class="{ 'is-active': sheet === 'beads' }" @click="openSheet('beads')">
        <view class="ico ico-beads" />
        <text>念珠</text>
      </view>
    </view>

    <!-- 木鱼 -->
    <view v-if="sheet === 'moktak'" class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">木鱼</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <view class="moktak-stage">
        <view class="moktak" :class="{ hit: moktakHit }" @click="hitMoktak">
          <view class="moktak-body" />
          <view class="moktak-stick" />
          <view class="moktak-ripple" />
        </view>
        <view class="moktak-count"><text class="num">{{ moktakCount }}</text><text> 声</text></view>
        <text class="sheet-note">轻敲，听它回你一声。开自动后，声音会自己走。</text>
      </view>
      <view class="sheet-foot">
        <view class="ghost-btn" :class="{ on: moktakAuto }" @click="toggleAuto">{{ moktakAuto ? '停自动' : '自动' }}</view>
        <view class="ghost-btn" @click="resetMoktak">归零</view>
      </view>
    </view>

    <!-- 念珠 -->
    <view v-if="sheet === 'beads'" class="sheet beads-sheet">
      <view class="sheet-head">
        <text class="sheet-title">念珠</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <view class="beads-count">
        <text class="round">第 {{ beadRound }} 圈</text>
        <text class="detail">本轮 {{ beadIndex % 108 }} 颗 · 共 {{ beadIndex }} 颗</text>
      </view>
      <scroll-view class="beads-track" scroll-x :scroll-left="beadScroll" @scroll="onBeadScroll">
        <view class="beads-line">
          <view
            v-for="i in 108"
            :key="i"
            class="bead"
            :class="{ past: i - 1 < beadIndex % 108, head: i - 1 === beadIndex % 108 }"
          />
        </view>
      </scroll-view>
      <text class="sheet-note">左右轻扫，或滚动。满 108 颗为一圈。</text>
      <view class="sheet-foot">
        <view class="ghost-btn" @click="advanceBead(1)">拨一颗</view>
        <view class="ghost-btn" @click="advanceBead(108)">一圈</view>
      </view>
    </view>

    <!-- 地图 -->
    <view v-if="sheet === 'map'" class="sheet map-sheet">
      <view class="sheet-head">
        <text class="sheet-title">山寺地图</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <view class="map-body">
        <view class="map-canvas">
          <view class="map-hall" />
          <view class="map-path" />
          <view class="map-pond" />
          <view class="map-bamboo" />
          <view class="map-pagoda" />
          <view class="map-bell" />
          <view
            v-for="p in spots"
            :key="p.key"
            class="map-pin"
            :style="{ left: p.x + '%', top: p.y + '%' }"
            @click="go(p.key)"
          >
            <view class="dot" />
            <text class="label">{{ p.label }}</text>
          </view>
        </view>
        <text class="sheet-note">点一个名字，走过去。</text>
      </view>
    </view>

    <!-- 点灯 -->
    <view v-if="sheet === 'lantern'" class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">点一盏灯</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <text class="lantern-hook">第 {{ lanternHook + 1 }} 号钩位</text>
      <view class="lantern-colors">
        <view
          v-for="c in colors"
          :key="c.key"
          class="swatch"
          :class="{ 'is-on': lanternColor === c.key }"
          @click="lanternColor = c.key"
        >
          <view class="dot-c" :style="{ background: c.css, boxShadow: '0 0 10px ' + c.css }" />
          <text>{{ c.label }}</text>
        </view>
      </view>
      <view class="field">
        <textarea v-model="lanternWish" maxlength="40" placeholder="写一句想说的话，最多 40 字" />
        <text class="counter">{{ lanternWish.length }}/40</text>
      </view>
      <view class="sheet-foot">
        <view class="ghost-btn" @click="closeSheet">再想想</view>
        <view class="primary-btn" @click="submitLantern">挂上</view>
      </view>
    </view>

    <!-- 上香 -->
    <view v-if="sheet === 'incense'" class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">上香</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <view class="incense-body">
        <view class="incense-ring" :style="ringStyle">
          <view class="ring-inner" />
          <text class="ring-num">{{ incense.current ? incense.current.remain : '—' }}</text>
        </view>
        <view class="incense-info">
          <text class="incense-line">{{ incenseLine }}</text>
          <text class="incense-sub">{{ incenseSub }}</text>
        </view>
      </view>
      <view class="sheet-foot">
        <view v-if="incense.mine" class="ghost-btn" @click="leaveIncense">离开</view>
        <view v-else class="primary-btn" @click="joinIncense">{{ incense.current ? '排队上香' : '上香' }}</view>
      </view>
      <text class="sheet-note">一人一支，烧完让给下一位。</text>
    </view>

    <!-- 搬瓦 -->
    <view v-if="sheet === 'tiles'" class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">搬瓦修殿</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <view class="tiles-num">
        <text class="tiles-big">{{ tiles.total }}</text>
        <text class="tiles-unit"> / {{ tiles.goal }} 片</text>
      </view>
      <text class="tiles-sub">本室已搬 {{ tiles.own }} 片 · 还差 {{ tilesLeft }} 片</text>
      <view class="progress"><view class="progress-bar" :style="{ width: tiles.percent + '%' }" /></view>
      <view class="sheet-foot">
        <view class="primary-btn" @click="carryTile">搬一块</view>
      </view>
      <text class="sheet-note">一人一片，大殿总会修好的。</text>
    </view>

    <!-- 换房 -->
    <view v-if="sheet === 'rooms'" class="sheet">
      <view class="sheet-head">
        <text class="sheet-title">换一间坐</text>
        <view class="close" @click="closeSheet">×</view>
      </view>
      <view class="room-list">
        <view
          v-for="r in rooms"
          :key="r.room"
          class="room-item"
          :class="{ 'is-current': r.room === roomNo }"
          @click="switchRoom(r.room)"
        >
          <text class="room-id">{{ r.room }}</text>
          <text class="room-meta">{{ r.online }} / {{ r.capacity }} 人</text>
          <text class="room-state" :class="'s-' + r.status">{{ statusLabel(r.status) }}</text>
        </view>
      </view>
      <text class="sheet-note">每间二十人。满了，就去隔壁。</text>
    </view>

    <!-- 加载 -->
    <view class="boot" :class="{ done: bootDone }">
      <view class="boot-mark">
        <view class="boot-glyph" />
      </view>
      <text class="boot-title">山 寺</text>
      <text class="boot-msg">{{ bootMsg }}</text>
      <view class="boot-bar"><view class="boot-fill" :style="{ width: bootProgress + '%' }" /></view>
      <text class="boot-note">片刻之后，可以沿着石路走进去。</text>
    </view>

    <!-- 非 H5 提示 -->
    <!-- #ifndef H5 -->
    <view class="fallback">
      <text>3D 场景需在 H5 端体验</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script>
/**
 * @file 山寺 · 线上寺庙（3D）
 * 场景由 Three.js 渲染，UI 由 Vue 模板渲染。
 * H5 端动态挂载舞台；其他端给出降级提示。
 */
export default {
  data() {
    return {
      roomNo: '02',
      peerCount: 1,
      sheet: '',
      praying: false,
      bowing: false,
      hintHidden: false,
      soundOff: false,
      chanting: false,
      toastText: '',
      toastOn: false,
      moktakCount: 0,
      moktakHit: false,
      moktakAuto: false,
      beadIndex: Number(uni.getStorageSync('sansa.beads') || 0),
      beadScroll: 0,
      bootDone: false,
      bootProgress: 0,
      bootMsg: '正在铺开山路。',
      stage: null,
      toastTimer: null,
      moktakTimer: null,
      lastScroll: 0,
      lanterns: { items: [], hooks: 24, total: 0, free: 0 },
      lanternHook: -1,
      lanternColor: 'jin',
      lanternWish: '',
      incense: { current: null, queue: [], hold: 20, mine: null, size: 0 },
      tiles: { total: 0, goal: 1080, percent: 0, own: 0 },
      rooms: [],
      colors: [
        { key: 'jin', label: '祈愿', css: '#ffcf94' },
        { key: 'zhu', label: '平安', css: '#f08a6a' },
        { key: 'qing', label: '追思', css: '#8fc6c0' },
        { key: 'bai', label: '无言', css: '#efe6d2' },
      ],
      spots: [
        { key: 'gate', label: '入口', x: 50, y: 78 },
        { key: 'hall', label: '法堂', x: 48, y: 30 },
        { key: 'pagoda', label: '石塔', x: 26, y: 55 },
        { key: 'bell', label: '梵钟', x: 68, y: 45 },
        { key: 'pond', label: '莲池', x: 78, y: 60 },
        { key: 'bamboo', label: '竹林', x: 16, y: 40 },
      ],
    };
  },
  computed: {
    /** 香炉环形进度：用 conic-gradient 画，避免在 uni 里引入 SVG */
    ringStyle() {
      const hold = this.incense.hold || 20;
      const remain = this.incense.current ? this.incense.current.remain : 0;
      const deg = Math.round(Math.max(0, Math.min(1, remain / hold)) * 360);
      return {
        background: `conic-gradient(#e6c98a 0deg ${deg}deg, rgba(255,255,255,.10) ${deg}deg 360deg)`,
      };
    },
    incenseLine() {
      const cur = this.incense.current;
      if (!cur) return '香炉空着';
      return this.incense.mine && this.incense.mine.position === 1 ? '你的香正燃着' : `${cur.name} 在上香`;
    },
    incenseSub() {
      const cur = this.incense.current;
      const mine = this.incense.mine;
      if (mine && mine.position > 1) return `前面还有 ${mine.position - 1} 人，约 ${mine.wait} 秒。`;
      if (!cur) return '点一支，等它自己烧完。';
      if (mine && mine.position === 1) return '不必做什么，看它烧完。';
      return `还需约 ${cur.remain} 秒。`;
    },
    tilesLeft() {
      return Math.max(0, this.tiles.goal - this.tiles.total);
    },
    beadRound() {
      return Math.floor(this.beadIndex / 108) + 1;
    },
  },
  mounted() {
    this.bootProgress = 12;
    // #ifdef H5
    const q = new URLSearchParams(location.search);
    this.roomNo = (q.get('room') || '02').padStart(2, '0');
    this.clearPcAdapt();
    this.$nextTick(() => this.initStage());
    // #endif
  },
  beforeUnmount() {
    const el = document.querySelector('uni-adapt-pc');
    if (el) el.style.display = '';
    if (this.stage) this.stage.destroy();
    clearInterval(this.moktakTimer);
    clearTimeout(this.toastTimer);
  },
  methods: {
    /**
     * 解除宿主模板的 PC 宽屏模拟框，让 3D 场景铺满视口
     * @returns {void}
     */
    clearPcAdapt() {
      document.body.removeAttribute('adapt');
      const el = document.querySelector('uni-adapt-pc');
      if (el) el.style.display = 'none';
    },
    /**
     * 动态加载场景模块，避免非 H5 端加载 Three.js
     * @returns {Promise<void>}
     */
    async initStage() {
      try {
        const { mountStage } = await import('./scene/stage.js');
        const el = document.getElementById('temple-stage');
        if (!el) return;
        this.bootProgress = 48;
        this.bootMsg = '正在立起山门。';
        this.stage = mountStage(el, {
          room: this.roomNo,
          onToast: (m) => this.toast(m),
          onPeerCount: (n) => { this.peerCount = n; },
          onLanterns: (st) => { this.lanterns = st; },
          onIncense: (st) => { this.incense = st; },
          onTiles: (st) => { this.tiles = st; },
          onRooms: (list) => { this.rooms = list; },
          onPickHook: (hook) => this.openLantern(hook),
          onOpenSheet: (name) => this.openSheet(name),
        });
        setTimeout(() => { this.bootProgress = 82; this.bootMsg = '正在点灯。'; }, 500);
        setTimeout(() => { this.bootProgress = 100; this.bootMsg = '正在等你。'; }, 1100);
        setTimeout(() => { this.bootDone = true; }, 1700);
        // #ifdef H5
        // 仅在 ?debug=1 时暴露实例，便于排查；正常访问不留全局引用
        if (new URLSearchParams(location.search).has('debug')) window.__temple = this;
        // #endif
      } catch (e) {
        console.error('[temple] 场景加载失败', e);
        this.bootMsg = '场景加载失败，请刷新重试';
      }
    },
    toast(msg, ms = 2200) {
      this.toastText = msg;
      this.toastOn = true;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toastOn = false; }, ms);
    },
    openSheet(name) {
      this.hintHidden = true;
      this.sheet = this.sheet === name ? '' : name;
      if (this.sheet && this.stage) {
        // 只有木鱼、念珠、上香需要合掌；点灯/搬瓦/换房保持走动姿态
        const praying = ['moktak', 'beads', 'incense'].indexOf(this.sheet) >= 0;
        this.praying = praying;
        this.stage.pray(praying);
      }
      if (this.stage) this.stage.click();
    },
    closeSheet() {
      this.sheet = '';
      this.praying = false;
      if (this.stage) this.stage.pray(false);
    },
    onPray() {
      this.hintHidden = true;
      this.praying = !this.praying;
      this.sheet = '';
      if (this.stage) {
        this.stage.pray(this.praying);
        this.stage.click();
      }
      this.toast(this.praying ? '合掌。呼吸慢一点。' : '');
    },
    onBow() {
      this.hintHidden = true;
      if (!this.stage) return;
      this.bowing = true;
      this.stage.bow(() => {
        this.bowing = false;
        const total = Number(uni.getStorageSync('sansa.bow') || 0) + 1;
        uni.setStorageSync('sansa.bow', total);
        this.toast(total % 25 === 0 ? `已拜 ${total} 拜 · 满 25 拜可换一杯茶` : `已拜 ${total} 拜`);
      });
    },
    hitMoktak() {
      if (!this.stage) return;
      this.moktakCount += 1;
      this.moktakHit = true;
      setTimeout(() => { this.moktakHit = false; }, 130);
      this.stage.hitMoktak();
    },
    toggleAuto() {
      this.moktakAuto = !this.moktakAuto;
      clearInterval(this.moktakTimer);
      if (this.moktakAuto) {
        this.hitMoktak();
        this.moktakTimer = setInterval(() => this.hitMoktak(), 620);
        this.toast('自动木鱼已开始');
      } else {
        this.toast('已停');
      }
    },
    resetMoktak() {
      this.moktakCount = 0;
    },
    advanceBead(n = 1) {
      this.beadIndex = Math.max(0, this.beadIndex + n);
      uni.setStorageSync('sansa.beads', this.beadIndex);
      this.beadScroll = Math.max(0, (this.beadIndex % 108) * 18 - 160);
      if (this.beadIndex && this.beadIndex % 108 === 0) {
        this.stage && this.stage.bell();
        this.toast(`圆满 ${this.beadIndex / 108} 圈 · 共 ${this.beadIndex} 颗`, 3000);
      } else {
        this.stage && this.stage.click();
      }
    },
    onBeadScroll(e) {
      const left = e.detail.scrollLeft;
      if (Math.abs(left - this.lastScroll) > 12) {
        this.advanceBead(left > this.lastScroll ? 1 : -1);
        this.lastScroll = left;
      }
    },
    go(key) {
      this.closeSheet();
      if (this.stage) this.stage.teleport(key);
      this.toast('沿着石路走过去。');
    },
    toggleSound() {
      this.soundOff = !this.soundOff;
      if (this.stage) this.stage.setMuted(this.soundOff);
      this.toast(this.soundOff ? '声音已关' : '声音已开');
    },
    toggleChant() {
      this.chanting = !this.chanting;
      if (this.stage) {
        this.stage.ambience(this.chanting);
        if (this.chanting) this.stage.bell();
      }
      this.toast(this.chanting ? '风声起，钟声落。' : '已静。');
    },
    onRoomTap() {
      this.openSheet('rooms');
      if (this.stage) this.stage.loadRooms();
    },
    /** 点了灯架上的空钩位 */
    openLantern(hook) {
      const taken = (this.lanterns.items || []).find((i) => i.hook === hook);
      if (taken) {
        this.toast(`这盏已有人挂上：\n「${taken.wish}」`, 3400);
        return;
      }
      this.lanternHook = hook;
      this.lanternWish = '';
      this.hintHidden = true;
      this.sheet = 'lantern';
      this.praying = false;
      if (this.stage) {
        this.stage.pray(false);
        this.stage.click();
      }
    },
    async submitLantern() {
      const wish = (this.lanternWish || '').trim();
      if (!wish) { this.toast('写一句再挂。'); return; }
      if (this.lanternHook < 0 || !this.stage) return;
      try {
        await this.stage.bookLantern(this.lanternHook, this.lanternColor, wish);
        this.closeSheet();
        this.toast('灯亮了。');
      } catch (e) {
        this.toast(e.message || '挂不上，再试一次。');
      }
    },
    async joinIncense() {
      if (!this.stage) return;
      try {
        const r = await this.stage.joinIncense();
        this.toast(r.position === 1 ? '香点着了。' : `排第 ${r.position} 位，约 ${r.wait} 秒。`);
      } catch (e) {
        this.toast(e.message || '排不上，再试一次。');
      }
    },
    async leaveIncense() {
      if (!this.stage) return;
      try {
        await this.stage.leaveIncense();
        this.toast('下次再来。');
      } catch (e) {
        this.toast(e.message || '离开失败');
      }
    },
    async carryTile() {
      if (!this.stage) return;
      try {
        const r = await this.stage.carryTile();
        if (r.total % 100 === 0) this.toast(`已搬 ${r.total} 片，还差 ${r.goal - r.total} 片。`, 3000);
        else this.toast('放上去一片。');
      } catch (e) {
        this.toast(e.message || '搬不动，再试一次。');
      }
    },
    statusLabel(status) {
      return status === 'full' ? '已满' : status === 'busy' ? '将满' : '清静';
    },
    switchRoom(code) {
      if (code === this.roomNo) { this.closeSheet(); return; }
      // #ifdef H5
      const url = new URL(location.href);
      url.searchParams.set('room', code);
      location.href = url.toString();
      // #endif
      // #ifndef H5
      this.roomNo = code;
      this.closeSheet();
      this.toast(`已换到 ${code} 号院`);
      // #endif
    },
  },
};
</script>

<style lang="scss">
@import './ui.scss';

.temple-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #20251f;
  /* 设计变量在页面根节点重新声明：uni-app 构建后 :root 作用域不可靠 */
  --paper:#f3efe5;
  --ink:#34382f;
  --muted:#9d9b8c;
  --glass:rgba(17,24,19,.40);
  --glass-edge:rgba(255,255,255,.16);
  --warm:#f6f1e4;
  --gold:#e6c98a;
  --ease:cubic-bezier(.22,1,.36,1);
}
.temple-stage {
  position: absolute;
  inset: 0;
}

/* 极简线性图标（CSS 绘制，跨端一致） */
.ico { position: relative; width: 20px; height: 20px; }
.ico-map {
  background:
    linear-gradient(currentColor, currentColor) 0 4px / 20px 1.4px no-repeat,
    linear-gradient(currentColor, currentColor) 0 9.3px / 20px 1.4px no-repeat,
    linear-gradient(currentColor, currentColor) 0 14.6px / 20px 1.4px no-repeat,
    linear-gradient(currentColor, currentColor) 8.8px 0 / 1.4px 20px no-repeat;
  opacity: 0.92;
}
.ico-sound {
  &::before {
    content: '';
    position: absolute;
    left: 1px; top: 6px;
    width: 6px; height: 8px;
    border: 1.4px solid currentColor; border-right: 0;
  }
  &::after {
    content: '';
    position: absolute;
    left: 6px; top: 4px;
    width: 0; height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 7px solid currentColor;
    opacity: .9;
  }
}
.ico-pray {
  &::before, &::after {
    content: '';
    position: absolute;
    top: 1px; width: 5px; height: 18px;
    border: 1.3px solid currentColor;
    border-radius: 3px 3px 1px 1px;
  }
  &::before { left: 5px; transform: rotate(9deg); }
  &::after { right: 5px; transform: rotate(-9deg); }
}
.ico-bow {
  &::before {
    content: '';
    position: absolute;
    left: 7px; top: 1px; width: 6px; height: 6px;
    border: 1.3px solid currentColor; border-radius: 50%;
  }
  &::after {
    content: '';
    position: absolute;
    left: 2px; top: 10px; width: 16px; height: 7px;
    border: 1.3px solid currentColor;
    border-radius: 8px 8px 2px 2px;
  }
}
.ico-moktak {
  &::before {
    content: '';
    position: absolute;
    left: 1px; top: 7px; width: 18px; height: 11px;
    border: 1.3px solid currentColor;
    border-radius: 50% 50% 46% 46% / 62% 62% 38% 38%;
  }
  &::after {
    content: '';
    position: absolute;
    right: 0; top: 1px; width: 8px; height: 1.4px;
    background: currentColor;
    transform: rotate(-32deg);
  }
}
.ico-beads {
  &::before {
    content: '';
    position: absolute;
    inset: 2px;
    border: 1.3px solid currentColor;
    border-radius: 50%;
  }
  &::after {
    content: '';
    position: absolute;
    left: 8.6px; top: -1px;
    width: 3.4px; height: 3.4px;
    background: currentColor;
    border-radius: 50%;
  }
}

/* 地图（CSS 版平面图） */
.map-canvas {
  position: relative;
  width: 100%;
  height: 210px;
  border-radius: 14px;
  overflow: hidden;
  background: #efeade;
  border: 1px solid rgba(120, 110, 90, 0.2);
}
.map-hall {
  position: absolute;
  left: 33%; top: 16%;
  width: 32%; height: 26%;
  background: #e3d9bf;
  border: 1px solid #b8ab8c;
}
.map-hall::before {
  content: '';
  position: absolute;
  left: -8%; top: -24%;
  width: 116%; height: 26%;
  background: #8c8778;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.map-path {
  position: absolute;
  left: 48%; top: 42%;
  width: 9px; height: 58%;
  background: #cdc4ad;
  border-radius: 4px;
}
.map-pond {
  position: absolute;
  right: 12%; top: 48%;
  width: 16%; height: 24%;
  border-radius: 50%;
  background: #d5e2dd;
  border: 1px solid #a9bdb6;
}
.map-bamboo {
  position: absolute;
  left: 8%; top: 34%;
  width: 12%; height: 18%;
  border-radius: 50%;
  background: #cfd9c4;
  border: 1px solid #a4b096;
}
.map-pagoda {
  position: absolute;
  left: 22%; top: 48%;
  width: 8%; height: 12%;
  background: #d8ccb2;
  border: 1px solid #b3a687;
}
.map-bell {
  position: absolute;
  right: 24%; top: 36%;
  width: 9%; height: 14%;
  background: #d8ccb2;
  border: 1px solid #b3a687;
}
.map-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  .dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #8a6a3f;
    border: 2px solid #f6f1e6;
  }
  .label {
    margin-top: 2px;
    font-size: 10px;
    color: #41423a;
    background: rgba(247, 242, 230, 0.82);
    padding: 0 3px;
    border-radius: 3px;
    letter-spacing: 0.06em;
  }
}

/* 页面级覆盖 */
.dock-btn { border-radius: 999px; }
.sheet-title { color: #f4efe2; font-family: 'Songti SC', 'Noto Serif CJK SC', serif; font-size: 17px; letter-spacing: 0.14em; }
.sheet { color: #f4efe2; overflow: hidden; }
.ghost-btn { color: rgba(246,241,228,.92); }
.boot-title { letter-spacing: 0.4em; font-family: 'Songti SC', serif; }
.boot-glyph {
  width: 26px; height: 26px;
  border: 1px solid #8a8068;
  border-radius: 50% 50% 4px 4px;
  border-bottom-width: 3px;
}
.beads-line { display: flex; align-items: center; gap: 5px; padding: 0 16px; height: 74px; overflow: hidden; }
/* 窄屏：胶囊与 dock 不换行、不收挤 */
.hud-top { flex-wrap: nowrap; gap: 8px; }
.pill { white-space: nowrap; flex: 0 0 auto; }
.room-pill { padding: 0 11px; }
.chant-pill { padding: 0 11px; }
.hint text { white-space: nowrap; }
@media screen and (max-width: 420px) {
  .hud-top { padding-left: 10px; padding-right: 10px; gap: 6px; }
  .pill { height: 36px; font-size: 12px; padding: 0 10px; }
  .icon-btn { width: 36px; height: 36px; flex-basis: 36px; }
  .dock-btn { width: 62px; font-size: 11px; }
  .hint { font-size: 10.5px; padding: 6px 10px; }
}
.fallback {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #f3efe5; font-size: 14px;
  background: #20251f;
}

/* ---------- 点灯 / 上香 / 搬瓦 / 换房 ---------- */
.primary-btn {
  flex: 1.4;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(230, 201, 138, 0.42);
  background: linear-gradient(180deg, rgba(230, 201, 138, 0.26), rgba(230, 201, 138, 0.14));
  color: #fbefd4;
  font-size: 12.5px;
  letter-spacing: 0.12em;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lantern-hook {
  display: block;
  margin: 2px 0 12px;
  font-size: 11.5px;
  color: rgba(246, 241, 228, 0.62);
  letter-spacing: 0.1em;
}
.lantern-colors {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.swatch {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 9px 0 7px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(246, 241, 228, 0.72);
  font-size: 11px;
  letter-spacing: 0.1em;
}
.swatch.is-on {
  border-color: rgba(230, 201, 138, 0.55);
  background: rgba(230, 201, 138, 0.14);
  color: #f8ecd2;
}
.dot-c {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}
.field {
  position: relative;
}
.field textarea {
  width: 100%;
  height: 74px;
  padding: 14px 12px 20px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  color: #f3efe5;
  font-size: 13px;
  line-height: 1.7;
  box-sizing: border-box;
}
.counter {
  position: absolute;
  right: 11px;
  bottom: 8px;
  font-size: 10.5px;
  color: rgba(246, 241, 228, 0.42);
}
.incense-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0 4px;
}
.incense-ring {
  position: relative;
  width: 78px;
  height: 78px;
  flex: 0 0 78px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ring-inner {
  position: absolute;
  left: 6px;
  top: 6px;
  right: 6px;
  bottom: 6px;
  border-radius: 50%;
  background: #12180f;
}
.ring-num {
  position: relative;
  font-family: 'Songti SC', 'Noto Serif CJK SC', serif;
  font-size: 20px;
  color: #f6e7c8;
}
.incense-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.incense-line {
  font-size: 13.5px;
  color: #f4efe2;
  letter-spacing: 0.06em;
}
.incense-sub {
  font-size: 11.5px;
  line-height: 1.65;
  color: rgba(246, 241, 228, 0.58);
}
.tiles-num {
  display: flex;
  align-items: baseline;
  margin: 6px 0 2px;
}
.tiles-big {
  font-family: 'Songti SC', 'Noto Serif CJK SC', serif;
  font-size: 30px;
  color: #f6e7c8;
}
.tiles-unit {
  font-size: 12px;
  color: rgba(246, 241, 228, 0.55);
}
.tiles-sub {
  display: block;
  margin-bottom: 10px;
  font-size: 11.5px;
  color: rgba(246, 241, 228, 0.55);
}
.progress {
  height: 6px;
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  min-width: 3px;
  border-radius: 99px;
  background: linear-gradient(90deg, #b98f4e, #e6c98a);
  transition: width 0.8s ease;
}
.room-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 8px 0 2px;
}
.room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(246, 241, 228, 0.84);
  font-size: 12.5px;
}
.room-item.is-current {
  border-color: rgba(230, 201, 138, 0.5);
  background: rgba(230, 201, 138, 0.12);
}
.room-id {
  font-family: 'Songti SC', 'Noto Serif CJK SC', serif;
  font-size: 16px;
  color: #f2e4c6;
  letter-spacing: 0.12em;
  width: 34px;
}
.room-meta {
  flex: 1;
  font-size: 11.5px;
  color: rgba(246, 241, 228, 0.55);
}
.room-state {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  padding: 3px 9px;
  border-radius: 99px;
  border: 1px solid transparent;
}
.room-state.s-open { color: #9fd3b4; border-color: rgba(159, 211, 180, 0.32); background: rgba(159, 211, 180, 0.1); }
.room-state.s-busy { color: #e8c98a; border-color: rgba(232, 201, 138, 0.32); background: rgba(232, 201, 138, 0.1); }
.room-state.s-full { color: #d99a8a; border-color: rgba(217, 154, 138, 0.32); background: rgba(217, 154, 138, 0.1); }
</style>
