<template>
  <view class="stage">
    <view class="hall" :style="hallStyle">
      <view class="hall-sky"></view>
      <view class="hall-city">
        <view class="city-tower"></view>
        <view class="city-tower city-tower--2"></view>
        <view class="city-hall"></view>
        <view class="city-block city-block--1"></view>
        <view class="city-block city-block--2"></view>
        <view class="city-block city-block--3"></view>
        <view class="city-ground"></view>
      </view>

      <view class="top">
        <view class="back" @click="onBack">
          <text class="back-icon">‹</text>
        </view>
        <view class="avatar">
          <view class="avatar-face">
            <view class="avatar-hat"></view>
            <view class="avatar-brow avatar-brow--l"></view>
            <view class="avatar-brow avatar-brow--r"></view>
            <view class="avatar-eye avatar-eye--l"></view>
            <view class="avatar-eye avatar-eye--r"></view>
            <view class="avatar-mouth"></view>
          </view>
          <text class="avatar-lv">{{ level }}</text>
        </view>
        <view class="uid">
          <text class="uid-line">ID-{{ uid }}</text>
          <text class="uid-line uid-line--sub">PH{{ uid }}</text>
        </view>
        <view class="cur cur--gold" @click="onWallet('欢乐豆')">
          <view class="cur-icon cur-icon--bean"></view>
          <text class="cur-num">{{ beansText }}</text>
          <view class="cur-plus">+</view>
        </view>
        <view class="cur cur--red" @click="onWallet('奖券')">
          <view class="cur-icon cur-icon--ticket"></view>
          <text class="cur-num">{{ coupon }}</text>
          <view class="cur-plus">+</view>
        </view>
        <view class="flex1"></view>
        <view class="quick" @click="onEntry('保险箱')">
          <view class="quick-icon quick-icon--safe">
            <view class="safe-dial"></view>
          </view>
          <text class="quick-txt">保险箱</text>
        </view>
        <view class="quick" @click="onEntry('电视赛')">
          <view class="quick-icon quick-icon--tv">
            <view class="tv-screen"></view>
          </view>
          <text class="quick-txt">电视赛</text>
        </view>
        <view class="quick" @click="onEntry('公会')">
          <view class="quick-icon quick-icon--guild">
            <view class="guild-shield"></view>
          </view>
          <text class="quick-txt">公会</text>
        </view>
        <view class="loc" @click="onEntry('定位')">
          <view class="loc-pin"></view>
          <text class="loc-text">宁波</text>
        </view>
      </view>

      <view class="body">
        <view class="side">
          <text class="rank-title">排行榜</text>
          <view v-for="(face, i) in rankFaces" :key="i" class="rank-item" @click="onEntry('排行榜')">
            <view class="rank-face" :class="'rank-face--' + i"></view>
          </view>
          <view class="rank-more" @click="onEntry('排行榜')">
            <text class="rank-more-txt">›</text>
          </view>
          <view class="gift" @click="onEntry('新手礼包')">
            <text class="gift-tag">待领取</text>
            <view class="gift-box">
              <view class="gift-lid"></view>
              <view class="gift-body"></view>
              <view class="gift-band"></view>
            </view>
            <text class="gift-txt">新手礼包</text>
          </view>
        </view>

        <view class="mid">
          <view class="banner" @click="onEntry('活动中心')">
            <view class="banner-glow"></view>
            <view class="skyline">
              <view class="sk sk--1"></view>
              <view class="sk sk--2"></view>
              <view class="sk-tower">
                <view class="tw-mast"></view>
                <view class="tw-arm tw-arm--1"></view>
                <view class="tw-arm tw-arm--2"></view>
                <view class="tw-body"></view>
                <view class="tw-base"></view>
              </view>
              <view class="sk sk--3"></view>
              <view class="sk sk--4"></view>
              <view class="sk sk--5"></view>
            </view>
            <view class="banner-ribbon"></view>
            <text class="banner-title">上电视</text>
            <text class="banner-title banner-title--2">去比赛</text>
            <view class="banner-go">
              <text class="banner-go-txt">›</text>
            </view>
          </view>

          <view class="grid">
            <view class="cell cell--red" @click="enterRoom(rooms[1])">
              <view class="cell-flag">经典</view>
              <view class="cell-face">
                <view class="cf-hat"></view>
                <view class="cf-brow cf-brow--l"></view>
                <view class="cf-brow cf-brow--r"></view>
                <view class="cf-eye cf-eye--l"></view>
                <view class="cf-eye cf-eye--r"></view>
                <view class="cf-stash"></view>
                <view class="cf-mouth"></view>
              </view>
              <view class="cell-foot">
                <text class="cell-name">经典地主</text>
                <text class="cell-hint">底分 100</text>
              </view>
            </view>

            <view class="cell cell--green" @click="enterRoom(rooms[2])">
              <view class="cell-tile">
                <text class="tile-txt">高</text>
              </view>
              <view class="cell-foot">
                <text class="cell-name">高级场</text>
                <text class="cell-hint cell-hint--light">1.9 万在线</text>
              </view>
            </view>

            <view class="cell cell--blue" @click="enterRoom(rooms[0])">
              <view class="cell-medal">
                <text class="medal-txt">新</text>
              </view>
              <view class="cell-foot">
                <text class="cell-name cell-name--sm">新手场</text>
                <text class="cell-hint cell-hint--light">3.2 万在线</text>
              </view>
            </view>

            <view class="cell cell--purple cell--sm" @click="onEntry('比赛')">
              <view class="cell-ico cell-ico--cup"></view>
              <text class="cell-name cell-name--plain">比赛</text>
            </view>
            <view class="cell cell--purple cell--sm" @click="onEntry('好友约战')">
              <view class="cell-free">免费</view>
              <view class="cell-ico cell-ico--friend"></view>
              <text class="cell-name cell-name--plain">好友约战</text>
            </view>
            <view class="cell cell--purple cell--sm" @click="onEntry('更多游戏')">
              <view class="cell-ico cell-ico--grid"></view>
              <text class="cell-name cell-name--plain">更多游戏</text>
            </view>

            <view class="cell cell--purple cell--sm" @click="onEntry('每日签到')">
              <view class="cell-ico cell-ico--sign"></view>
              <text class="cell-name cell-name--plain">每日签到</text>
            </view>
            <view class="cell cell--purple cell--sm" @click="onEntry('幸运转盘')">
              <view class="cell-ico cell-ico--wheel"></view>
              <text class="cell-name cell-name--plain">幸运转盘</text>
            </view>
          </view>
        </view>

        <view class="rooms">
          <text class="rooms-title">选择场次</text>
          <view
            v-for="room in rooms"
            :key="room.id"
            class="room"
            :class="'room--' + room.tone"
            @click="enterRoom(room)"
          >
            <view class="room-head">
              <text class="room-name">{{ room.name }}</text>
              <text class="room-online">{{ room.online }} 在线</text>
            </view>
            <text class="room-desc">{{ room.desc }}</text>
            <view class="room-foot">
              <text class="room-base">底分 {{ room.base }}</text>
              <text class="room-gate">{{ room.gate }}</text>
            </view>
          </view>
          <view class="start" @click="enterRoom(rooms[1])">
            <text class="start-txt">快速开始</text>
            <text class="start-sub">经典地主 · 秒开局</text>
          </view>
        </view>
      </view>

      <view class="nav">
        <view v-for="item in navs" :key="item.key" class="nav-item" @click="onEntry(item.name)">
          <view class="nav-icon" :class="'nav-icon--' + item.key">
            <text class="nav-glyph">{{ item.glyph }}</text>
          </view>
          <text class="nav-txt">{{ item.name }}</text>
        </view>
      </view>

      <view class="hall-rotate">
        <view class="rotate-icon"></view>
        <text class="rotate-txt">请将设备横屏以获得最佳体验</text>
      </view>
    </view>
  </view>
</template>

<script>
/**
 * 游戏大厅页（横屏）。
 * 版式依据宁波地主实机大厅效果图：淡蓝紫城市剪影背景、顶部方形头像与双货币、
 * 左侧排行榜浮条、中部活动横幅与游戏宫格、右侧场次列表、底部八项功能导航。
 * 功能名取自原版 SceneTopTitleCfg3D，场次沿用新手场 / 普通场 / 高级场三档。
 * 页面按 1334x750 设计稿布局，运行时按窗口等比缩放适配。
 */

/** 设计稿宽度（横屏） */
const DESIGN_W = 1334;

/** 设计稿高度（横屏） */
const DESIGN_H = 750;

export default
{
  data()
  {
    return {
      nickname: '玩家',
      uid: '5105996',
      level: 12,
      beans: 3680000,
      coupon: 0,
      rankFaces: [0, 1, 2],
      scale: 1,
      rooms: [
        {
          id: 'novice',
          name: '新手场',
          desc: '底分低，先熟悉规则再上桌',
          base: 10,
          gate: '0 豆',
          online: '3.2 万',
          tone: 'blue'
        },
        {
          id: 'normal',
          name: '经典场',
          desc: '标准三人斗地主，赢豆主战场',
          base: 100,
          gate: '1,000 豆',
          online: '8.6 万',
          tone: 'red'
        },
        {
          id: 'senior',
          name: '高级场',
          desc: '高底分对局，一局定输赢',
          base: 1000,
          gate: '10,000 豆',
          online: '1.9 万',
          tone: 'green'
        }
      ],
      navs: [
        { key: 'shop', name: '商城', glyph: '商' },
        { key: 'act', name: '活动', glyph: '活' },
        { key: 'task', name: '任务', glyph: '任' },
        { key: 'award', name: '领奖', glyph: '奖' },
        { key: 'mail', name: '邮件', glyph: '邮' },
        { key: 'pvp', name: '约战', glyph: '战' },
        { key: 'service', name: '客服', glyph: '服' },
        { key: 'more', name: '更多', glyph: '更' }
      ]
    };
  },

  computed:
  {
    /**
     * 欢乐豆展示文案
     * @returns {string} 文案
     */
    beansText()
    {
      const n = Number(this.beans) || 0;
      if (n >= 10000)
      {
        return (n / 10000).toFixed(1) + '万';
      }
      return String(n);
    },

    /**
     * 设计稿等比缩放样式
     * @returns {Object} transform 样式
     */
    hallStyle()
    {
      return {
        transform: 'scale(' + this.scale + ')',
        transformOrigin: 'center center'
      };
    }
  },

  mounted()
  {
    this.clearPcAdapt();
    this.fit();
    window.addEventListener('resize', this.fit);
    const saved = uni.getStorageSync('ddz_nickname');
    if (saved)
    {
      this.nickname = saved;
    }
    const coin = uni.getStorageSync('ddz_coin');
    if (coin)
    {
      this.beans = coin;
    }
    const uid = uni.getStorageSync('ddz_uid');
    if (uid)
    {
      this.uid = String(uid);
    }
    else
    {
      const gen = String(Math.floor(Math.random() * 9000000 + 1000000));
      uni.setStorageSync('ddz_uid', gen);
      this.uid = gen;
    }
  },

  beforeDestroy()
  {
    window.removeEventListener('resize', this.fit);
    this.restorePcAdapt();
  },

  methods:
  {
    /**
     * 解除宿主工程的 PC 宽屏适配，避免横屏页面被装入竖屏模拟框
     * @returns {void}
     */
    clearPcAdapt()
    {
      document.body.removeAttribute('adapt');
      const el = document.querySelector('uni-adapt-pc');
      if (el)
      {
        el.style.display = 'none';
      }
    },

    /**
     * 离开页面时恢复 PC 宽屏适配
     * @returns {void}
     */
    restorePcAdapt()
    {
      const el = document.querySelector('uni-adapt-pc');
      if (el)
      {
        el.style.display = '';
      }
      if (window.innerWidth >= 768)
      {
        document.body.setAttribute('adapt', 'pc');
      }
    },
    /**
     * 按窗口尺寸计算设计稿缩放比
     * @returns {void}
     */
    fit()
    {
      const w = window.innerWidth / DESIGN_W;
      const h = window.innerHeight / DESIGN_H;
      this.scale = Math.min(w, h);
    },

    /**
     * 进入指定场次的牌桌
     * @param {Object} room 场次配置
     * @returns {void}
     */
    enterRoom(room)
    {
      uni.setStorageSync('ddz_room', room.id);
      uni.setStorageSync('ddz_base', room.base);
      uni.navigateTo({ url: '/pages/game/ddz' });
    },

    /**
     * 返回上一页
     * @returns {void}
     */
    onBack()
    {
      const stack = getCurrentPages();
      if (stack.length > 1)
      {
        uni.navigateBack();
      }
      else
      {
        uni.showToast({ title: '已在大厅首页', icon: 'none' });
      }
    },

    /**
     * 统一的功能入口点击反馈
     * @param {string} name 入口名称
     * @returns {void}
     */
    onEntry(name)
    {
      uni.showToast({ title: name + '开放中', icon: 'none' });
    },

    /**
     * 货币入口点击
     * @param {string} name 货币名称
     * @returns {void}
     */
    onWallet(name)
    {
      uni.showToast({ title: '获取' + name, icon: 'none' });
    }
  }
};
</script>

<style lang="scss" scoped>
.stage { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #93aed2; overflow: hidden; }
.hall { position: relative; width: 1334px; height: 750px; overflow: hidden; flex-shrink: 0; }
.flex1 { flex: 1; }

.hall-sky { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, #eaf2fc 0%, #d6e3f6 30%, #bfd2ec 58%, #a6bfdf 82%, #93aed2 100%); }
.hall-city { position: absolute; left: 0; right: 0; bottom: 96px; height: 240px; opacity: 0.6; -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, #000000 46%, #000000 100%); }

.city-tower { position: absolute; left: 430px; bottom: 70px; width: 52px; height: 96px; background: #8ba7cb; border-radius: 4px 4px 0 0; }
.city-tower::before { content: ''; position: absolute; left: -14px; top: -16px; width: 80px; height: 22px; background: #7d9ac0; border-radius: 8px 8px 2px 2px; }
.city-tower::after { content: ''; position: absolute; left: 22px; top: -40px; width: 8px; height: 26px; background: #7d9ac0; }
.city-tower--2 { left: 492px; bottom: 66px; width: 38px; height: 78px; background: #9ab4d4; }
.city-tower--2::before { left: -10px; width: 58px; height: 18px; background: #8aa6c9; }
.city-tower--2::after { display: none; }

.city-hall { position: absolute; left: 360px; bottom: 54px; width: 280px; height: 64px; background: #93aecd; border-radius: 8px 8px 0 0; }
.city-hall::before { content: ''; position: absolute; left: -22px; top: -14px; width: 324px; height: 20px; background: #829dc0; border-radius: 10px 10px 0 0; }

.city-block { position: absolute; bottom: 50px; background: #a2bada; border-radius: 6px 6px 0 0; }
.city-block--1 { left: 664px; width: 92px; height: 116px; }
.city-block--2 { left: 770px; width: 128px; height: 80px; }
.city-block--3 { left: 912px; width: 104px; height: 138px; }
.city-ground { position: absolute; left: 0; bottom: 0; width: 100%; height: 36px; background: linear-gradient(180deg, #93aed2 0%, #a6bfdf 100%); }

.top { position: absolute; top: 0; left: 0; width: 100%; height: 92px; padding: 0 20px; box-sizing: border-box; display: flex; align-items: center; z-index: 6; }

.back { width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(180deg, #ffe08a, #f0a518); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 0 #c07a0c, 0 6px 12px rgba(120, 70, 0, 0.18); flex-shrink: 0; }
.back-icon { font-size: 42px; line-height: 42px; color: #7a4400; font-weight: bold; margin-top: -8px; }

.avatar { position: relative; width: 72px; height: 72px; margin-left: 12px; border-radius: 14px; background: linear-gradient(180deg, #fff6dd, #f2cf92); border: 4px solid #f7d67a; box-shadow: 0 3px 0 #c9932c; flex-shrink: 0; }
.avatar-face { position: absolute; left: 4px; top: 4px; right: 4px; bottom: 4px; border-radius: 9px; background: linear-gradient(180deg, #dceafb, #aac7e8); overflow: hidden; }
.avatar-hat { position: absolute; left: 10px; top: 5px; width: 40px; height: 15px; border-radius: 10px 10px 3px 3px; background: linear-gradient(180deg, #f0553c, #c62b1c); }
.avatar-brow { position: absolute; top: 25px; width: 10px; height: 4px; border-radius: 3px; background: #6b3a16; }
.avatar-brow--l { left: 13px; }
.avatar-brow--r { right: 13px; }
.avatar-eye { position: absolute; top: 32px; width: 6px; height: 6px; border-radius: 50%; background: #2a1608; }
.avatar-eye--l { left: 15px; }
.avatar-eye--r { right: 15px; }
.avatar-mouth { position: absolute; left: 19px; top: 43px; width: 22px; height: 7px; border-radius: 0 0 9px 9px; background: #a8402e; }
.avatar-lv { position: absolute; left: -8px; bottom: -13px; padding: 0 8px; height: 22px; line-height: 22px; border-radius: 11px; background: #e8452c; border: 2px solid #fff2c8; color: #fff6d8; font-size: 15px; font-weight: bold; }

.uid { margin-left: 14px; margin-right: 16px; }
.uid-line { display: block; font-size: 22px; color: #27476e; font-weight: bold; letter-spacing: 1px; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.95), 0 0 8px rgba(255, 255, 255, 0.8); }
.uid-line--sub { margin-top: 2px; font-size: 17px; color: #5b7ea6; font-weight: normal; }

.cur { display: flex; align-items: center; height: 46px; padding: 0 8px; margin-right: 10px; border-radius: 23px; box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.55), 0 3px 8px rgba(50, 80, 130, 0.16); flex-shrink: 0; }
.cur--gold { background: linear-gradient(180deg, #8fc4f0, #5b9ed8); }
.cur--red { background: linear-gradient(180deg, #f0928a, #d8554a); }
.cur-icon { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; }
.cur-icon--bean { background: radial-gradient(circle at 34% 28%, #fff8d8, #ffc21a 58%, #c88200); box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55); }
.cur-icon--ticket { background: radial-gradient(circle at 34% 28%, #ffe3a8, #f0a020 58%, #a86400); box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55); }
.cur-num { min-width: 60px; margin-left: 8px; font-size: 21px; color: #ffffff; font-weight: bold; text-shadow: 0 2px 3px rgba(20, 60, 110, 0.35); }
.cur-plus { width: 32px; height: 32px; line-height: 29px; text-align: center; border-radius: 50%; background: linear-gradient(180deg, #ffe07a, #f0a518); color: #7a4400; font-size: 23px; font-weight: bold; }

.quick { display: flex; flex-direction: column; align-items: center; margin-left: 18px; }
.quick-icon { position: relative; width: 42px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 0 rgba(60, 20, 0, 0.35); }
.quick-icon--safe { background: linear-gradient(180deg, #ffd45e, #e08a10); }
.quick-icon--tv { background: linear-gradient(180deg, #7fd0ff, #2f8fd6); }
.quick-icon--guild { background: linear-gradient(180deg, #ff9a6a, #d8452c); }
.safe-dial { width: 16px; height: 16px; border-radius: 50%; border: 3px solid #8a5200; }
.tv-screen { width: 26px; height: 18px; border-radius: 3px; background: rgba(255, 255, 255, 0.85); }
.guild-shield { width: 18px; height: 22px; background: rgba(255, 255, 255, 0.9); border-radius: 4px 4px 50% 50%; }
.quick-txt { margin-top: 4px; font-size: 15px; color: #46688f; }

.loc { display: flex; align-items: center; height: 42px; padding: 0 14px 0 10px; margin-left: 18px; border-radius: 21px; background: rgba(255, 255, 255, 0.9); box-shadow: 0 3px 8px rgba(50, 80, 130, 0.16); }
.loc-pin { width: 14px; height: 14px; border-radius: 50% 50% 50% 0; background: #3f8fd6; transform: rotate(-45deg); }
.loc-text { margin-left: 7px; font-size: 19px; color: #2f6fb4; font-weight: bold; }

.body { position: absolute; top: 92px; bottom: 96px; left: 0; right: 0; display: flex; padding: 10px 18px 12px; box-sizing: border-box; z-index: 4; }

.side { width: 108px; display: flex; flex-direction: column; align-items: center; padding-top: 6px; flex-shrink: 0; }
.rank-title { padding: 3px 10px; border-radius: 9px; background: rgba(95, 130, 180, 0.42); font-size: 16px; color: #ffffff; text-shadow: 0 1px 2px rgba(30, 60, 110, 0.6); }
.rank-item { width: 62px; height: 62px; margin-top: 12px; border-radius: 12px; background: linear-gradient(180deg, #fff3d0, #e8b95e); border: 3px solid #fff8e0; box-shadow: 0 3px 0 #b8822c; overflow: hidden; }
.rank-face { width: 100%; height: 100%; }
.rank-face--0 { background: radial-gradient(circle at 50% 36%, #ffe3c2 0%, #ffd08a 44%, #e8452c 45%, #c9301f 100%); }
.rank-face--1 { background: radial-gradient(circle at 50% 36%, #e8f4ff 0%, #a8d4f5 44%, #2f8fd6 45%, #1a5f96 100%); }
.rank-face--2 { background: radial-gradient(circle at 50% 36%, #fff5d6 0%, #ffd97a 44%, #3fc9a6 45%, #1fa383 100%); }
.rank-more { width: 48px; height: 34px; margin-top: 12px; border-radius: 17px; background: rgba(255, 255, 255, 0.82); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(50, 80, 130, 0.14); }
.rank-more-txt { font-size: 24px; color: #4a6b96; line-height: 24px; margin-top: -4px; }

.gift { margin-top: 22px; display: flex; flex-direction: column; align-items: center; }
.gift-tag { padding: 0 8px; height: 22px; line-height: 22px; border-radius: 8px; background: #ffd45e; color: #7a4400; font-size: 14px; font-weight: bold; box-shadow: 0 2px 4px rgba(120, 70, 0, 0.25); }
.gift-box { position: relative; width: 56px; height: 52px; margin-top: 6px; }
.gift-lid { position: absolute; left: -2px; top: 0; width: 60px; height: 15px; border-radius: 5px; background: linear-gradient(180deg, #ff8a6a, #e8452c); }
.gift-body { position: absolute; left: 4px; top: 13px; width: 48px; height: 38px; border-radius: 0 0 5px 5px; background: linear-gradient(180deg, #ff7a5a, #cf2f1c); }
.gift-band { position: absolute; left: 23px; top: 0; width: 11px; height: 51px; background: #ffd45e; opacity: 0.9; }
.gift-txt { margin-top: 5px; font-size: 15px; color: #ffffff; font-weight: bold; text-shadow: 0 2px 3px rgba(40, 70, 120, 0.5); }

.mid { flex: 1; min-width: 0; margin: 0 16px; display: flex; flex-direction: column; }

.banner { position: relative; width: 100%; height: 208px; border-radius: 16px; overflow: hidden; background: linear-gradient(160deg, #f2e2ff 0%, #cfb4f0 40%, #9a7ad8 100%); border: 3px solid rgba(255, 255, 255, 0.9); box-shadow: 0 6px 16px rgba(70, 50, 130, 0.2); flex-shrink: 0; }
.banner-glow { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: radial-gradient(80% 60% at 50% 0%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 70%); }

.skyline { position: absolute; left: 0; right: 0; bottom: 56px; height: 156px; display: flex; align-items: flex-end; justify-content: space-around; padding: 0 10px; box-sizing: border-box; }
.sk { width: 54px; border-radius: 5px 5px 0 0; background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(206, 196, 240, 0.75)); }
.sk--1 { height: 84px; width: 62px; }
.sk--2 { height: 120px; width: 48px; }
.sk--3 { height: 100px; width: 58px; }
.sk--4 { height: 136px; width: 44px; }
.sk--5 { height: 74px; width: 64px; }

.sk-tower { position: relative; width: 40px; height: 150px; }
.tw-mast { position: absolute; left: 18px; top: 0; width: 4px; height: 24px; background: rgba(255, 255, 255, 0.95); }
.tw-arm { position: absolute; left: 2px; width: 36px; height: 4px; background: rgba(255, 255, 255, 0.9); }
.tw-arm--1 { top: 24px; }
.tw-arm--2 { top: 40px; left: 8px; width: 24px; }
.tw-body { position: absolute; left: 12px; top: 48px; width: 16px; height: 80px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(216, 206, 245, 0.8)); }
.tw-base { position: absolute; left: 2px; bottom: 0; width: 36px; height: 26px; border-radius: 5px 5px 0 0; background: rgba(255, 255, 255, 0.9); }

.banner-ribbon { position: absolute; left: 0; bottom: 0; width: 100%; height: 76px; background: linear-gradient(180deg, rgba(110, 64, 190, 0) 0%, rgba(88, 46, 160, 0.8) 62%, rgba(72, 36, 140, 0.92) 100%); }
.banner-title { position: absolute; left: 22px; bottom: 40px; font-size: 34px; color: #ffffff; font-weight: bold; letter-spacing: 3px; text-shadow: 0 4px 0 #5a2e9c, 0 6px 10px rgba(50, 24, 90, 0.45); }
.banner-title--2 { bottom: 8px; left: 40px; font-size: 30px; }
.banner-go { position: absolute; right: 14px; bottom: 20px; width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(180deg, #ffd45e, #f0a518); display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 0 #b06a00; }
.banner-go-txt { font-size: 28px; color: #7a4400; line-height: 28px; margin-top: -4px; margin-left: 2px; }

.grid { flex: 1; display: flex; flex-wrap: wrap; justify-content: space-between; margin-top: 12px; }
.cell { position: relative; width: 32.4%; height: calc((100% - 20px) / 3); margin-bottom: 10px; border-radius: 14px; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; border: 3px solid rgba(255, 255, 255, 0.92); box-shadow: 0 5px 0 rgba(60, 50, 100, 0.2); box-sizing: border-box; }
.cell--sm { }
.cell--red { background: linear-gradient(165deg, #ffd45e 0%, #f57a2a 36%, #e5381f 100%); }
.cell--green { background: linear-gradient(165deg, #7ff0d0 0%, #2fc9a6 45%, #128a70 100%); }
.cell--blue { background: linear-gradient(165deg, #8fd0ff 0%, #3f97e8 45%, #1e5fb0 100%); }
.cell--purple { background: linear-gradient(165deg, #c8b8ff 0%, #9a86e8 45%, #6e58c8 100%); }

.cell-foot { position: relative; width: 100%; padding-bottom: 6px; display: flex; flex-direction: column; align-items: center; }
.cell-name { font-size: 21px; color: #ffffff; font-weight: bold; letter-spacing: 1px; text-shadow: 0 3px 0 rgba(90, 40, 0, 0.45), 0 4px 8px rgba(0, 0, 0, 0.18); }
.cell-name--sm { font-size: 19px; }
.cell-name--plain { font-size: 19px; text-shadow: 0 3px 0 rgba(70, 50, 130, 0.55); }
.cell-hint { margin-top: 2px; font-size: 12px; color: rgba(255, 255, 255, 0.86); }
.cell-hint--light { color: rgba(255, 255, 255, 0.8); }

.cell-flag { position: absolute; right: 0; top: 0; padding: 0 10px; height: 26px; line-height: 26px; background: #e5381f; border-radius: 0 0 0 12px; color: #fff2c8; font-size: 14px; font-weight: bold; }

.cell-face { position: absolute; left: 50%; top: 0; width: 84px; height: 84px; margin-left: -42px; transform: scale(0.5); transform-origin: center top; }
.cf-hat { position: absolute; left: 15px; top: 0; width: 54px; height: 23px; border-radius: 13px 13px 4px 4px; background: #ffd45e; box-shadow: 0 2px 0 #b06a00; }
.cf-brow { position: absolute; top: 33px; width: 18px; height: 5px; border-radius: 4px; background: #7a3c0a; }
.cf-brow--l { left: 16px; transform: rotate(-12deg); }
.cf-brow--r { right: 16px; transform: rotate(12deg); }
.cf-eye { position: absolute; top: 43px; width: 9px; height: 9px; border-radius: 50%; background: #5a2c08; }
.cf-eye--l { left: 21px; }
.cf-eye--r { right: 21px; }
.cf-stash { position: absolute; left: 18px; top: 55px; width: 48px; height: 11px; border-radius: 8px 8px 4px 4px; background: #7a3c0a; }
.cf-mouth { position: absolute; left: 33px; top: 66px; width: 18px; height: 7px; border-radius: 0 0 9px 9px; background: #a8402e; }

.cell-tile { position: absolute; left: 50%; top: 0; width: 66px; height: 76px; margin-left: -33px; transform: scale(0.5); transform-origin: center top; border-radius: 10px; background: linear-gradient(180deg, #fffdf4, #e8dfc8); box-shadow: 0 3px 0 #b8a480; display: flex; align-items: center; justify-content: center; }
.tile-txt { font-size: 40px; color: #d8352a; font-weight: bold; }

.cell-medal { position: absolute; left: 50%; top: 0; width: 74px; height: 74px; margin-left: -37px; transform: scale(0.5); transform-origin: center top; border-radius: 50%; background: radial-gradient(circle at 38% 30%, #ffe9a8, #f0a020 62%, #c06a00); border: 4px solid #fff3c8; display: flex; align-items: center; justify-content: center; }
.medal-txt { font-size: 34px; color: #7a2c00; font-weight: bold; }

.cell-ico { position: absolute; left: 50%; top: 10px; width: 42px; height: 42px; margin-left: -21px; transform: scale(0.6); transform-origin: center top; }
.cell-ico--cup { background: linear-gradient(180deg, #fff3c8, #ffd45e); border-radius: 6px 6px 50% 50%; }
.cell-ico--friend { border-radius: 50%; background: linear-gradient(180deg, #ffffff, #d8e0f5); }
.cell-ico--grid { background: linear-gradient(180deg, #ffffff, #d8e0f5); border-radius: 6px; box-shadow: inset 13px 0 0 -8px #9a86e8, inset -13px 0 0 -8px #9a86e8, inset 0 13px 0 -8px #9a86e8, inset 0 -13px 0 -8px #9a86e8; }
.cell-ico--sign { background: linear-gradient(180deg, #fffdf4, #e8dfc8); border-radius: 6px; box-shadow: inset 0 -12px 0 -6px #9a86e8; }
.cell-ico--wheel { border-radius: 50%; background: conic-gradient(#ffd45e 0deg 60deg, #ffffff 60deg 120deg, #ffd45e 120deg 180deg, #ffffff 180deg 240deg, #ffd45e 240deg 300deg, #ffffff 300deg 360deg); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9); }
.cell--purple .cell-name--plain { color: #ffffff; }
.cell-free { position: absolute; left: 0; top: 0; padding: 0 10px; height: 24px; line-height: 24px; background: #e5381f; border-radius: 0 0 12px 0; color: #fff2c8; font-size: 14px; font-weight: bold; }

.rooms { width: 288px; display: flex; flex-direction: column; flex-shrink: 0; }
.rooms-title { font-size: 20px; font-weight: bold; color: #27476e; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9); margin-bottom: 8px; }
.room { position: relative; border-radius: 14px; padding: 10px 14px 8px; margin-bottom: 10px; color: #ffffff; border: 3px solid rgba(255, 255, 255, 0.92); box-shadow: 0 4px 0 rgba(40, 60, 90, 0.22); box-sizing: border-box; overflow: hidden; }
.room--blue { background: linear-gradient(165deg, #8fd0ff 0%, #3f97e8 45%, #1e5fb0 100%); }
.room--red { background: linear-gradient(165deg, #ffb26a 0%, #f57a2a 40%, #e5381f 100%); }
.room--green { background: linear-gradient(165deg, #7ff0d0 0%, #2fc9a6 45%, #128a70 100%); }
.room-head { display: flex; align-items: center; justify-content: space-between; }
.room-name { font-size: 24px; font-weight: bold; text-shadow: 0 3px 0 rgba(60, 30, 0, 0.4); }
.room-online { font-size: 14px; color: rgba(255, 255, 255, 0.85); }
.room-desc { display: block; margin-top: 3px; font-size: 14px; color: rgba(255, 255, 255, 0.92); }
.room-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.room-base { padding: 1px 10px; border-radius: 12px; background: rgba(255, 255, 255, 0.24); font-size: 14px; font-weight: bold; }
.room-gate { font-size: 14px; color: rgba(255, 255, 255, 0.9); }

.start { flex: 1; border-radius: 16px; background: linear-gradient(180deg, #ffd85e 0%, #f5930f 52%, #dd6a0c 100%); border: 3px solid #fff6d8; box-shadow: 0 6px 0 #a84e06, 0 0 22px rgba(255, 176, 40, 0.55); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.start-txt { font-size: 30px; color: #ffffff; font-weight: bold; letter-spacing: 2px; text-shadow: 0 3px 0 #a84e06; }
.start-sub { margin-top: 6px; font-size: 14px; color: #fff0c8; text-shadow: 0 2px 0 rgba(150, 70, 0, 0.5); }

.nav { position: absolute; left: 0; bottom: 0; width: 100%; height: 96px; display: flex; align-items: center; justify-content: space-around; padding: 0 10px; box-sizing: border-box; background: linear-gradient(180deg, #a8301f 0%, #7a1c10 100%); border-top: 3px solid #e8a13a; z-index: 6; }
.nav-item { display: flex; flex-direction: column; align-items: center; width: 90px; }
.nav-icon { width: 48px; height: 48px; border-radius: 13px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 0 rgba(60, 10, 0, 0.45); }
.nav-icon--shop { background: linear-gradient(180deg, #ffe08a, #f0a518); }
.nav-icon--act { background: linear-gradient(180deg, #ffb07a, #e8602c); }
.nav-icon--task { background: linear-gradient(180deg, #9fe0ff, #2f8fd6); }
.nav-icon--award { background: linear-gradient(180deg, #ffe9a8, #e8b030); }
.nav-icon--mail { background: linear-gradient(180deg, #c8e8ff, #4a9ee0); }
.nav-icon--pvp { background: linear-gradient(180deg, #ffd0b0, #e8703c); }
.nav-icon--service { background: linear-gradient(180deg, #b8f0e0, #2fc9a6); }
.nav-icon--more { background: linear-gradient(180deg, #ffe08a, #e08a10); }
.nav-glyph { font-size: 23px; color: #6b2c00; font-weight: bold; }
.nav-txt { margin-top: 4px; font-size: 15px; color: #ffe9c0; }

.hall-rotate { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 999; background: #93aed2; flex-direction: column; align-items: center; justify-content: center; }
.rotate-icon { width: 110px; height: 70px; border: 8px solid #f0a518; border-radius: 14px; margin-bottom: 28px; animation: ddz-turn 1.6s ease-in-out infinite; }
.rotate-txt { color: #27476e; font-size: 28px; text-align: center; padding: 0 60px; font-weight: bold; }
@keyframes ddz-turn { 0% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } 100% { transform: rotate(90deg); } }
@media (orientation: portrait) { .hall-rotate { display: flex; } }
</style>
