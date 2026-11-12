<template>
  <view class="ddz-page">
    <view id="ddz-canvas" class="ddz-canvas"></view>
    <view v-if="tips" class="ddz-tips">{{ tips }}</view>
    <view class="ddz-rotate">
      <view class="rotate-icon"></view>
      <text class="rotate-txt">请将设备横屏以获得最佳体验</text>
    </view>
  </view>
</template>

<script>
/**
 * @file 斗地主牌桌页面。
 * 负责初始化 Phaser 场景、建立长连接、把服务端状态灌入场景，
 * 并按照状态差异驱动音效与特效。
 */

import DdzNet, { PHASE } from './ddz-net.js';
import DdzAudio from './ddz-audio.js';
import createDdzScene from './ddz-game.js';

/** 判定牌型是否属于炸弹类，用于触发震屏与爆炸音 */
const BOMB_TYPES = ['炸弹', '王炸', '四带二', '飞机带翅膀'];

export default
{
  data()
  {
    return {
      tips: '',
      net: null,
      audio: null,
      prevBomb: 0,
      prevCount: 0,
      prevPhase: -1,
      game: null,
      scene: null,
      state: null,
      phase: PHASE
    };
  },


  beforeDestroy()
  {
    this.restorePcAdapt();
  },

  mounted()
  {
    this.audio = new DdzAudio();
    this.boot();
  },

  beforeUnmount()
  {
    this.shutdown();
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
     * 初始化 Phaser 与网络连接
     * @returns {void}
     */
    boot()
    {
      const Phaser = typeof window !== 'undefined' ? window.Phaser : null;
      if (!Phaser)
      {
        this.tips = '游戏引擎未加载';
        return;
      }
      this.clearPcAdapt();
      this.$nextTick(() =>
      {
        const SceneClass = createDdzScene(Phaser, {
          onAction: this.onAction,
          onChat: (text) => this.audio && this.audio.voice(),
          onPanelOpen: () => this.audio && this.audio.open(),
          onSelect: () => this.audio && this.audio.select(),
          onReady: (scene) =>
          {
            this.scene = scene;
          }
        });
        this.game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: 'ddz-canvas',
          width: 1334,
          height: 750,
          backgroundColor: '#4a0f09',
          scale:
          {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
          },
          scene: [SceneClass]
        });
        this.connect();
      });
    },

    /**
     * 建立 WebSocket 并注册消息处理
     * @returns {void}
     */
    connect()
    {
      const url = this.resolveUrl();
      const net = new DdzNet(url);
      net.on('enter', () =>
      {
        net.send('join');
        setTimeout(() => net.send('ready'), 300);
      });
      net.on('state', (data) =>
      {
        data.my_coin = uni.getStorageSync('ddz_coin') || 12000;
        const roomNames = { novice: '新手场 · 1/3', normal: '普通场 · 2/3', senior: '高级场 · 3/3' };
        data.room_name = roomNames[uni.getStorageSync('ddz_room')] || '经典场 · 1/3';
        this.playStateSound(data);
        this.state = data;
        this.tips = '';
        if (this.scene)
        {
          this.scene.renderState(data);
        }
      });
      net.on('error', (data) =>
      {
        this.tips = data.message || '操作失败';
        if (this.scene)
        {
          this.scene.toast(this.tips);
        }
      });
      this.net = net;
      net.connect().then(() =>
      {
        net.send('login', { nickname: '玩家' + Math.floor(Math.random() * 900 + 100) });
      }).catch(() =>
      {
        this.tips = '连接服务器失败';
      });
    },

    /**
     * 依据状态差异播放对应音效与牌型特效
     * @param {Object} data 最新状态
     * @returns {void}
     */
    playStateSound(data)
    {
      if (!this.audio)
      {
        return;
      }
      const my = data.players.find((p) => p.seat === data.my_seat);
      const count = my ? my.card_count : 0;
      const type = data.last_type || '';
      const isBomb = BOMB_TYPES.some((t) => type.indexOf(t) >= 0);

      if (data.phase_code === 4 && this.prevPhase !== 4)
      {
        if (my && my.score > 0)
        {
          this.audio.win();
        }
        else
        {
          this.audio.lose();
        }
        if (this.scene)
        {
          this.scene.shake();
        }
      }
      else if (data.phase_code === 3 && !(this.prevPhase > 2))
      {
        this.audio.deal();
      }
      else if (data.bomb > this.prevBomb)
      {
        if (type.indexOf('王炸') >= 0)
        {
          this.audio.rocket();
        }
        else
        {
          this.audio.bomb();
        }
        if (this.scene && data.last_cards && data.last_cards.length)
        {
          this.scene.playEffect(type || '炸弹', true);
          this.scene.shake();
        }
      }
      else if (this.prevCount > count)
      {
        this.audio.play();
        if (this.scene && data.last_cards && data.last_cards.length && this.prevBomb === data.bomb)
        {
          this.scene.playEffect(type || '出牌', isBomb);
        }
      }
      else if (data.phase_code === 3 && this.prevPhase === 3 && data.last_cards && !data.last_cards.length)
      {
        this.audio.pass();
      }

      this.prevBomb = data.bomb;
      this.prevCount = count;
      this.prevPhase = data.phase_code;
    },

    /**
     * 按当前页面地址推导 WebSocket 地址
     * @returns {string} WebSocket 地址
     */
    resolveUrl()
    {
      if (typeof window === 'undefined')
      {
        return 'ws://127.0.0.1:9104';
      }
      const loc = window.location;
      if (loc.protocol === 'https:')
      {
        return 'wss://' + loc.host + '/ddz-ws/';
      }
      if (loc.port && loc.port !== '80')
      {
        return 'ws://' + loc.hostname + ':9104';
      }
      return 'ws://' + loc.hostname + ':9104';
    },

    /**
     * 处理场景按钮事件
     * @param {string} key 按钮标识
     * @param {Array} cards 选中的牌
     * @returns {void}
     */
    onAction(key, cards)
    {
      if (key === 'quit')
      {
        this.goBack();
        return;
      }
      if (!this.net || !this.state)
      {
        return;
      }
      if (this.audio)
      {
        this.audio.click();
      }
      if (key === 'auto')
      {
        if (this.scene)
        {
          this.scene.toast('托管已开启');
        }
        this.autoPlay();
        return;
      }
      if (key === 'bid0' || key === 'bid1' || key === 'bid2' || key === 'bid3')
      {
        this.net.send('bid', { score: Number(key.slice(3)) });
        return;
      }
      if (key === 'double' || key === 'nodouble')
      {
        this.net.send('double', { double: key === 'double' });
        return;
      }
      if (key === 'play')
      {
        if (!cards || !cards.length)
        {
          this.tips = '请先选择要出的牌';
          if (this.scene)
          {
            this.scene.toast(this.tips);
          }
          return;
        }
        this.net.send('play', { cards });
        return;
      }
      if (key === 'pass')
      {
        this.net.send('pass');
        return;
      }
      if (key === 'hint')
      {
        this.hint();
      }
    },

    /**
     * 托管：自动选出最小的一手可出牌
     * @returns {void}
     */
    autoPlay()
    {
      if (!this.state || !this.state.your_turn || !this.net)
      {
        return;
      }
      const code = this.state.phase_code;
      if (code === 1)
      {
        this.net.send('bid', { score: 3 });
        return;
      }
      if (code === 2)
      {
        this.net.send('double', { double: true });
        return;
      }
      if (code === 3)
      {
        this.hint();
        setTimeout(() =>
        {
          const picked = this.scene ? this.scene.collectSelected() : [];
          if (picked.length)
          {
            this.net.send('play', { cards: picked });
          }
          else
          {
            this.net.send('pass');
          }
        }, 260);
      }
    },

    /**
     * 选出一张能出的最小单张作为提示
     * @returns {void}
     */
    hint()
    {
      if (!this.scene || !this.state || !this.state.my_cards.length)
      {
        return;
      }
      const sorted = this.state.my_cards.slice().sort((a, b) => a.rank - b.rank);
      const target = sorted[0];
      const node = this.scene.handNodes.find(
        (n) => n.card.rank === target.rank && n.card.suit === target.suit
      );
      if (node)
      {
        this.scene.clearSelection();
        this.scene.selected.add(node.key);
        node.node.y = node.baseY - 30;
        this.scene.selectedLabel.setText('已选 1 张');
      }
    },

    /**
     * 释放场景与连接
     * @returns {void}
     */
    shutdown()
    {
      if (this.game)
      {
        this.game.destroy(true);
        this.game = null;
      }
      if (this.net && this.net.ws)
      {
        this.net.ws.close();
      }
    },

    /**
     * 返回大厅
     * @returns {void}
     */
    goBack()
    {
      uni.navigateBack({ delta: 1, fail: () => uni.reLaunch({ url: '/pages/game/hall' }) });
    }
  }
};
</script>

<style lang="scss" scoped>
.ddz-page { position: absolute; top: 0; left: 0; width: 100%; height: 100vh; overflow: hidden; background: #07291a; }
.ddz-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.ddz-tips { position: absolute; bottom: 120rpx; left: 50%; transform: translateX(-50%); padding: 12rpx 28rpx; border-radius: 32rpx; background: rgba(0, 0, 0, 0.6); color: #ffe9a8; font-size: 26rpx; }
.ddz-back { position: absolute; top: 40rpx; left: 24rpx; padding: 10rpx 24rpx; border-radius: 28rpx; background: rgba(0, 0, 0, 0.45); color: #ffffff; font-size: 26rpx; }
.ddz-rotate { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999; background: #4a0f09; flex-direction: column; align-items: center; justify-content: center; }
.rotate-icon { width: 120rpx; height: 76rpx; border: 8rpx solid #ffd45e; border-radius: 14rpx; margin-bottom: 30rpx; animation: ddz-turn 1.6s ease-in-out infinite; }
.rotate-txt { color: #ffe9a8; font-size: 30rpx; text-align: center; padding: 0 60rpx; }
@keyframes ddz-turn { 0% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } 100% { transform: rotate(90deg); } }
@media (orientation: portrait) { .ddz-rotate { display: flex; } }
</style>
