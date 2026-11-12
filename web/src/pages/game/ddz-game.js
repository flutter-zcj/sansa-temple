/**
 * @file 斗地主牌桌 Phaser 3 场景。
 * 逻辑分辨率 1334x750（横屏），由 Scale.FIT 适配屏幕。
 * 视觉依据宁波地主实机对局截图逐元素对齐：
 * 酒红木质外框与四角雕花、金黄绒布圆角桌面、顶部地主牌红框、
 * 红青双色分数大字、青绿“不出”印章、叶形牌型标签、大牌面手牌。
 */

import {
  W,
  H,
  CARD_W,
  CARD_H,
  COLOR,
  drawCard,
  drawAvatar,
  drawButton,
  drawCountBadge,
  drawFeltRect,
  drawBean,
  drawScoreText,
  drawStamp,
  drawPatternTag,
  drawWoodFrame,
  drawCornerTrim,
  formatMoney,
  css
} from './ddz-theme.js'

/** 座位布局：索引 0 为自己（左下），1 为右对手，2 为左对手 */
const SEAT_POS = [
  { x: 96, y: 592 },
  { x: 1214, y: 296 },
  { x: 120, y: 296 }
]

/** 座位对应的本局分数显示位置 */
const SCORE_POS = [
  { x: 252, y: 592 },
  { x: 1214, y: 446 },
  { x: 120, y: 446 }
]

/** 自己手牌基线 y */
const HAND_Y = 598

/** 绒布桌面矩形 */
const TABLE = { x: 24, y: 104, w: 1286, h: 560, radius: 44 }

/** 出牌区中心 */
const PLATE = { x: 667, y: 316 }

/** 操作按钮基线 y */
const ACTION_Y = 452

/**
 * 创建牌桌场景类
 * @param {Object} Phaser Phaser 全局对象
 * @param {Object} hooks 交互回调集合
 * @returns {Function} Scene 类
 */
export default function createDdzScene(Phaser, hooks)
{
  return class DdzScene extends Phaser.Scene {
    constructor()
    {
      super({ key: 'DdzScene' })
      this.handNodes = []
      this.selected = new Set()
      this.state = null
      this.seatNodes = []
      this.buttons = {}
    }

    /**
     * 构建静态场景骨架
     * @returns {void}
     */
    create()
    {
      this.drawTable()
      this.buildTopBar()
      this.buildSideInfo()
      this.buildSeats()
      this.buildCenter()
      this.buildHandArea()
      this.buildActionButtons()
      this.buildBottomBar()
      this.buildChatPanel()
      this.buildToast()
      if (hooks.onReady)
      {
        hooks.onReady(this)
      }
    }

    /**
     * 绘制牌桌：酒红木框 + 金黄绒布圆角桌面 + 四角雕花 + 云纹暗花
     * @returns {void}
     */
    drawTable()
    {
      drawWoodFrame(this)
      drawCornerTrim(this, 56)
      drawFeltRect(this, TABLE)

      const deco = this.add.graphics()
      deco.lineStyle(2, 0xfff0c4, 0.18)
      deco.strokeRoundedRect(TABLE.x + 34, TABLE.y + 34, TABLE.w - 68, TABLE.h - 68, 28)
      deco.lineStyle(1.5, 0xfff0c4, 0.12)
      deco.strokeRoundedRect(TABLE.x + 46, TABLE.y + 46, TABLE.w - 92, TABLE.h - 92, 24)

    }

    /**
     * 顶部木条：地主牌框居中，左侧礼盒与表情，右侧房间号与设置退出
     * @returns {void}
     */
    buildTopBar()
    {
      const g = this.add.graphics()
      g.fillStyle(0x5e1809, 1)
      g.fillRect(0, 0, W, 88)
      g.fillStyle(COLOR.barBg, 1)
      g.fillRect(0, 0, W, 82)
      g.fillStyle(0x8a2c14, 1)
      g.fillRect(0, 0, W, 38)
      g.fillStyle(0xffffff, 0.08)
      g.fillRect(0, 0, W, 10)
      g.lineStyle(3, COLOR.woodTrim, 0.9)
      g.lineBetween(0, 82, W, 82)
      g.lineStyle(1.5, 0x3a0c06, 0.6)
      g.lineBetween(0, 86, W, 86)

      this.buildIconButton(46, 44, 'gift', () => this.toast('每日礼包待领取'))
      this.buildIconButton(104, 44, 'smile', () => this.toggleChat())

      this.roomText = this.add
        .text(156, 28, '经典场 · 1/3', {
          fontFamily: 'sans-serif',
          fontSize: '23px',
          color: '#ffe9c4',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
      this.roomText.setShadow(0, 2, '#3a0c06', 2)
      this.baseText = this.add
        .text(156, 60, '底分 0', {
          fontFamily: 'sans-serif',
          fontSize: '21px',
          color: '#ffcf8a'
        })
        .setOrigin(0, 0.5)

      const frame = this.add.graphics()
      frame.fillStyle(0x3a0c06, 0.9)
      frame.fillRoundedRect(592, 8, 150, 68, 12)
      frame.fillStyle(0x9c2a12, 1)
      frame.fillRoundedRect(596, 12, 142, 60, 10)
      frame.lineStyle(2.5, COLOR.woodTrim, 1)
      frame.strokeRoundedRect(596, 12, 142, 60, 10)
      frame.lineStyle(1.5, 0xfff0c4, 0.35)
      frame.strokeRoundedRect(602, 18, 130, 48, 8)

      this.bottomSlot = this.add.container(667, 42)

      this.buildIconButton(1222, 44, 'gear', () => this.toast('设置'))
      this.buildIconButton(1280, 44, 'door', () =>
      {
        if (hooks.onAction)
        {
          hooks.onAction('quit', [])
        }
      })
    }

    /**
     * 顶部与底部的圆形图标按钮，图标用矢量几何绘制
     * @param {number} x 中心 x
     * @param {number} y 中心 y
     * @param {string} kind 图标类型 gift/smile/gear/door
     * @param {Function} onClick 点击回调
     * @returns {void}
     */
    buildIconButton(x, y, kind, onClick)
    {
      const box = this.add.container(x, y)
      const g = this.add.graphics()
      g.fillStyle(0x3a0c06, 0.55)
      g.fillCircle(0, 2, 26)
      g.fillStyle(0xc8873a, 1)
      g.fillCircle(0, 0, 25)
      g.fillStyle(0xeab05c, 1)
      g.fillCircle(0, -2, 22)
      g.lineStyle(2, 0xfff0c4, 0.7)
      g.strokeCircle(0, 0, 25)

      const ic = this.add.graphics()
      ic.lineStyle(3, 0x6b3a10, 1)
      ic.fillStyle(0x6b3a10, 1)
      if (kind === 'gift')
      {
        ic.fillRoundedRect(-13, -4, 26, 16, 3)
        ic.fillRect(-15, -10, 30, 7)
        ic.fillRect(-2, -10, 4, 22)
        ic.lineStyle(0, 0, 0)
        ic.beginPath()
        ic.arc(-7, -13, 6, Math.PI, Math.PI * 2, false)
        ic.strokePath()
        ic.beginPath()
        ic.arc(7, -13, 6, Math.PI, Math.PI * 2, false)
        ic.strokePath()
      }
      else if (kind === 'smile')
      {
        ic.strokeCircle(0, 0, 14)
        ic.fillCircle(-5, -4, 2.4)
        ic.fillCircle(5, -4, 2.4)
        ic.beginPath()
        ic.arc(0, 1, 8, Math.PI * 0.15, Math.PI * 0.85, false)
        ic.strokePath()
      }
      else if (kind === 'gear')
      {
        ic.strokeCircle(0, 0, 12)
        ic.strokeCircle(0, 0, 4)
        for (let i = 0; i < 8; i += 1)
        {
          const a = (Math.PI / 4) * i
          ic.lineBetween(Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * 16, Math.sin(a) * 16)
        }
      }
      else
      {
        ic.lineBetween(-12, -13, -12, 13)
        ic.lineBetween(12, -13, 12, 13)
        ic.lineBetween(-12, -13, 12, -13)
        ic.fillCircle(7, 2, 2.6)
      }
      box.add([g, ic])
      box.setSize(52, 52)
      box.setInteractive({ useHandCursor: true })
      box.on('pointerdown', onClick)
    }

    /**
     * 右侧常驻信息：时间、胜局、对局，取自实机右侧信息列
     * @returns {void}
     */
    buildSideInfo()
    {
      this.clockText = this.add
        .text(W - 54, 152, '--:--', {
          fontFamily: 'sans-serif',
          fontSize: '26px',
          color: '#9a5a18'
        })
        .setOrigin(1, 0.5)
      this.winText = this.add
        .text(W - 54, 192, '胜局 0/0', {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: '#b07a34'
        })
        .setOrigin(1, 0.5)
      this.roundText = this.add
        .text(W - 54, 226, '对局 0/0', {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: '#b07a34'
        })
        .setOrigin(1, 0.5)
    }

    /**
     * 构建三个座位节点：卡通头像 + 昵称 + 欢乐豆 + 牌数徽章 + 分数大字 + 印章
     * @returns {void}
     */
    buildSeats()
    {
      this.seatNodes = []
      SEAT_POS.forEach((pos, i) =>
      {
        const box = this.add.container(pos.x, pos.y)
        const avatar = drawAvatar(this, 0, 0, 46, '', i)
        const nameText = this.add
          .text(0, 60, '', {
            fontFamily: 'sans-serif',
            fontSize: '22px',
            color: '#5a2c08',
            fontStyle: 'bold'
          })
          .setOrigin(0.5, 0)
        const coinIcon = this.add.container(0, 90)
        const coinBg = this.add.graphics()
        coinBg.fillStyle(0x7a3c0a, 0.14)
        coinBg.fillRoundedRect(-48, -12, 96, 24, 12)
        coinIcon.add(coinBg)
        const bean = drawBean(this, -34, 0, 18)
        const coinText = this.add
          .text(-22, 0, '0', { fontFamily: 'sans-serif', fontSize: '18px', color: '#6b3a10' })
          .setOrigin(0, 0.5)
        coinIcon.add([bean, coinText])

        const lordTag = this.add.container(0, -58)
        const lg = this.add.graphics()
        lg.fillStyle(0xd8352a, 1)
        lg.fillRoundedRect(-33, -14, 66, 28, 8)
        lg.lineStyle(2, 0xffe9a8, 1)
        lg.strokeRoundedRect(-33, -14, 66, 28, 8)
        const lt = this.add
          .text(0, 0, '地主', {
            fontFamily: 'sans-serif',
            fontSize: '18px',
            color: '#ffe9a8',
            fontStyle: 'bold'
          })
          .setOrigin(0.5)
        lordTag.add([lg, lt])
        lordTag.setVisible(false)

        const badge = drawCountBadge(this, 56, -34, 26)
        if (i === 0)
        {
          nameText.setVisible(false)
          coinIcon.setVisible(false)
          badge.setPosition(60, -32)
          lordTag.setPosition(-56, -46)
        }
        box.add([avatar, nameText, coinIcon, lordTag, badge])
        this.seatNodes.push({ box, avatar, nameText, coinText, lordTag, badge, role: i })
      })

      this.scoreNodes = SCORE_POS.map((p) =>
      {
        const t = drawScoreText(this, p.x, p.y, '', COLOR.scoreUp, 46)
        t.setAlpha(0)
        return t
      })

      this.stampNodes = SCORE_POS.map((p, i) =>
      {
        const sx = i === 0 ? p.x + 150 : p.x
        const sy = i === 0 ? p.y - 96 : p.y + 88
        const s = drawStamp(this, sx, sy, '不出')
        s.setAlpha(0)
        return s
      })
    }

    /**
     * 中央区域：上一手牌、牌型标签、炸弹特效层
     * @returns {void}
     */
    buildCenter()
    {
      this.playSlot = this.add.container(PLATE.x, PLATE.y)
      this.patternSlot = this.add.container(PLATE.x, PLATE.y + 96)
      this.effectLayer = this.add.container(PLATE.x, PLATE.y - 20)
    }

    /**
     * 手牌区容器：底部深色托底 + 选中提示
     * @returns {void}
     */
    buildHandArea()
    {
      const tray = this.add.graphics()
      tray.fillStyle(0x3a0c06, 0.55)
      tray.fillRect(144, HAND_Y - CARD_H / 2 - 30, W - 174, CARD_H / 2 + 66)
      tray.fillStyle(COLOR.woodTrim, 0.45)
      tray.fillRect(144, HAND_Y - CARD_H / 2 - 30, W - 174, 3)
      this.handContainer = this.add.container(0, 0)
      this.selectedLabel = this.add
        .text(262, HAND_Y - 128, '', {
          fontFamily: 'sans-serif',
          fontSize: '24px',
          color: '#fff0c4',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
      this.selectedLabel.setShadow(0, 2, '#3a0c06', 3)
    }

    /**
     * 右下角操作按钮组：提示 / 不出 / 出牌，叫分与加倍复用同一组
     * @returns {void}
     */
    buildActionButtons()
    {
      this.buttons = {}
      const mk = (key, text, x, fill, w) =>
      {
        const btn = drawButton(this, {
          x,
          y: ACTION_Y,
          w: w || 118,
          h: 66,
          text,
          fill,
          fontSize: 28
        })
        btn.setDepth(30)
        btn.on('pointerdown', () =>
        {
          if (hooks.onAction)
          {
            hooks.onAction(key, this.collectSelected())
          }
        })
        this.buttons[key] = btn
      }
      mk('hint', '提示', 523, COLOR.btnSecondary, 116)
      mk('pass', '不出', 663, COLOR.btnSecondary, 116)
      mk('play', '出牌', 803, COLOR.btnPrimary, 124)
      this.setButtonsEnabled(false)
    }

    /**
     * 底部常驻条：倍数、欢乐豆、切换形象、托管、聊天
     * @returns {void}
     */
    buildBottomBar()
    {
      const g = this.add.graphics()
      g.fillStyle(0x4a0f09, 1)
      g.fillRect(0, H - 74, W, 74)
      g.fillStyle(COLOR.barBg, 1)
      g.fillRect(0, H - 70, W, 70)
      g.lineStyle(3, COLOR.woodTrim, 0.9)
      g.lineBetween(0, H - 74, W, H - 74)

      this.multiText = this.add
        .text(36, H - 36, '倍数 x1', {
          fontFamily: 'sans-serif',
          fontSize: '25px',
          color: '#ffe9a8',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
      this.multiText.setShadow(0, 2, '#3a0c06', 3)

      drawBean(this, 180, H - 36, 24)
      this.beanText = this.add
        .text(196, H - 36, '0', {
          fontFamily: 'sans-serif',
          fontSize: '23px',
          color: '#ffd9a0'
        })
        .setOrigin(0, 0.5)

      const swap = drawButton(this, {
        x: 1046,
        y: H - 36,
        w: 140,
        h: 54,
        text: '切换形象',
        fill: COLOR.btnPurple,
        fontSize: 23
      })
      swap.on('pointerdown', () => this.toast('形象切换开放中'))

      const auto = drawButton(this, {
        x: 1214,
        y: H - 36,
        w: 104,
        h: 54,
        text: '托管',
        fill: COLOR.btnMuted,
        fontSize: 23
      })
      auto.on('pointerdown', () =>
      {
        if (hooks.onAction)
        {
          hooks.onAction('auto', [])
        }
      })
      this.autoButton = auto

      const chat = drawButton(this, {
        x: 1294,
        y: H - 36,
        w: 74,
        h: 54,
        text: '聊天',
        fill: COLOR.btnChat,
        fontSize: 23
      })
      chat.on('pointerdown', () => this.toggleChat())
    }

    /**
     * 聊天面板，快捷短语取自原版 GameTalkConfigCfg
     * @returns {void}
     */
    buildChatPanel()
    {
      this.chatPanel = this.add.container(W / 2, H / 2).setDepth(60).setVisible(false)
      const mask = this.add
        .rectangle(0, 0, W, H, 0x000000, 0.58)
        .setInteractive()
        .on('pointerdown', () => this.toggleChat())
      this.chatPanel.add(mask)

      const g = this.add.graphics()
      g.fillStyle(0x4a0f09, 1)
      g.fillRoundedRect(-318, -262, 636, 524, 20)
      g.fillStyle(0x74220f, 1)
      g.fillRoundedRect(-312, -256, 624, 512, 16)
      g.lineStyle(3, COLOR.woodTrim, 0.95)
      g.strokeRoundedRect(-312, -256, 624, 512, 16)
      this.chatPanel.add(g)

      const title = this.add
        .text(0, -220, '快捷语音', {
          fontFamily: 'sans-serif',
          fontSize: '28px',
          color: '#ffe9a8',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
      title.setShadow(0, 2, '#3a0c06', 3)
      this.chatPanel.add(title)

      const phrases = [
        '炸他！',
        '压他',
        '让他出',
        '出单牌',
        '出对子',
        '出三带',
        '不要出，让我来！',
        '出小牌，让我顺一手',
        '顺牌给我，这局让我先走'
      ]
      phrases.forEach((p, i) =>
      {
        const row = Math.floor(i / 2)
        const col = i % 2
        const x = i === 8 ? 0 : (col === 0 ? -152 : 152)
        const y = -172 + row * 84
        const btn = drawButton(this, {
          x,
          y,
          w: 292,
          h: 62,
          text: p,
          fill: 0xb8792a,
          fillDeep: 0x7a4a10,
          fontSize: p.length > 7 ? 20 : 24
        })
        btn.on('pointerdown', () =>
        {
          this.toggleChat()
          this.say(p)
          if (hooks.onChat)
          {
            hooks.onChat(p)
          }
        })
        this.chatPanel.add(btn)
      })
    }

    /**
     * 切换聊天面板显隐
     * @returns {void}
     */
    toggleChat()
    {
      const willShow = !this.chatPanel.visible
      this.chatPanel.setVisible(willShow)
      if (willShow && hooks.onPanelOpen)
      {
        hooks.onPanelOpen()
      }
    }

    /**
     * 在自己座位旁弹出语音气泡
     * @param {string} text 台词
     * @returns {void}
     */
    say(text)
    {
      this.bubble(text, 0)
    }

    /**
     * 在指定座位旁显示浮动气泡
     * @param {string} text 文案
     * @param {number} seatIdx 座位置
     * @returns {void}
     */
    bubble(text, seatIdx)
    {
      const pos = SEAT_POS[seatIdx] || SEAT_POS[0]
      const dir = seatIdx === 0 ? 1 : (seatIdx === 1 ? -1 : 1)
      const box = this.add.container(pos.x + dir * 120, pos.y - 96).setDepth(50)
      const label = this.add
        .text(0, 0, text, {
          fontFamily: 'sans-serif',
          fontSize: '22px',
          color: '#5a2c08'
        })
        .setOrigin(0.5)
      const w = Math.max(120, label.width + 36)
      const bg = this.add.graphics()
      bg.fillStyle(0xfff4d0, 1)
      bg.fillRoundedRect(-w / 2, -26, w, 52, 16)
      bg.lineStyle(2, 0xd8a13a, 1)
      bg.strokeRoundedRect(-w / 2, -26, w, 52, 16)
      box.add([bg, label])
      this.tweens.add({
        targets: box,
        alpha: 0,
        delay: 1400,
        duration: 500,
        onComplete: () => box.destroy()
      })
    }

    /**
     * 轻提示
     * @returns {void}
     */
    buildToast()
    {
      this.toastText = this.add
        .text(W / 2, H / 2 - 180, '', {
          fontFamily: 'sans-serif',
          fontSize: '30px',
          color: '#ffffff',
          backgroundColor: '#000000cc',
          padding: { x: 26, y: 14 }
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(70)
    }

    /**
     * 显示浮动提示
     * @param {string} msg 文案
     * @returns {void}
     */
    toast(msg)
    {
      this.toastText.setText(msg).setAlpha(1)
      this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1200, duration: 600 })
    }

    /**
     * 批量设置操作按钮可用状态
     * @param {boolean} enabled 是否可点
     * @returns {void}
     */
    setButtonsEnabled(enabled)
    {
      Object.keys(this.buttons).forEach((k) =>
      {
        const btn = this.buttons[k]
        if (btn && btn.setEnabled)
        {
          btn.setEnabled(enabled)
        }
      })
    }

    /**
     * 切换按钮组合：出牌阶段 / 叫分阶段 / 加倍阶段
     * @param {number} phaseCode 阶段码
     * @returns {void}
     */
    applyPhaseButtons(phaseCode)
    {
      const layout = {
        1: [
          { key: 'bid0', text: '不叫', fill: COLOR.btnMuted },
          { key: 'bid1', text: '1分', fill: COLOR.btnSecondary },
          { key: 'bid2', text: '2分', fill: COLOR.btnSecondary },
          { key: 'bid3', text: '3分', fill: COLOR.btnPrimary }
        ],
        2: [
          { key: 'nodouble', text: '不加倍', fill: COLOR.btnMuted },
          { key: 'double', text: '加倍', fill: COLOR.btnPrimary }
        ],
        3: [
          { key: 'hint', text: '提示', fill: COLOR.btnSecondary },
          { key: 'pass', text: '不出', fill: COLOR.btnSecondary },
          { key: 'play', text: '出牌', fill: COLOR.btnPrimary }
        ]
      }
      const seq = layout[phaseCode] || layout[3]
      const sig = seq.map((s) => s.key).join(',')
      if (this.phaseSig === sig)
      {
        return
      }
      this.phaseSig = sig
      Object.keys(this.buttons).forEach((k) =>
      {
        if (this.buttons[k])
        {
          this.buttons[k].destroy()
        }
      })
      this.buttons = {}
      const n = seq.length
      const w = n >= 4 ? 104 : n === 3 ? 116 : 140
      const gap = 10
      const total = n * w + (n - 1) * gap
      const start = Math.round(W / 2 - total / 2 + w / 2)
      seq.forEach((s, i) =>
      {
        const btn = drawButton(this, {
          x: start + i * (w + gap),
          y: ACTION_Y,
          w,
          h: 66,
          text: s.text,
          fill: s.fill,
          fontSize: n >= 4 ? 25 : 28
        })
        btn.setDepth(30)
        btn.on('pointerdown', () =>
        {
          if (hooks.onAction)
          {
            hooks.onAction(s.key, this.collectSelected())
          }
        })
        this.buttons[s.key] = btn
      })
      this.setButtonsEnabled(false)
    }

    /**
     * 按服务端状态刷新整个牌桌
     * @param {Object} state 状态快照
     * @returns {void}
     */
    renderState(state)
    {
      this.state = state
      this.baseText.setText('底分 ' + (state.base_score || 0))
      this.multiText.setText('倍数 x' + (state.multiplier || 1))
      this.beanText.setText(formatMoney(state.my_coin || 0))
      if (typeof state.room_name === 'string' && state.room_name)
      {
        this.roomText.setText(state.room_name)
      }
      this.renderSeats(state)
      this.renderBottom(state)
      this.renderPlayed(state)
      this.applyPhaseButtons(state.phase_code)
      this.renderHand(state)

      const myTurn = state.your_turn && state.phase_code >= 1 && state.phase_code <= 3
      this.setButtonsEnabled(myTurn)
      if (myTurn && state.phase_code === 1)
      {
        this.toast('轮到你叫分')
      }
      if (myTurn && state.phase_code === 2)
      {
        this.toast('是否加倍')
      }
      if (state.phase_code === 4)
      {
        this.showResult(state)
      }
    }

    /**
     * 刷新座位信息与实时分数
     * @param {Object} state 状态快照
     * @returns {void}
     */
    renderSeats(state)
    {
      const players = state.players || []
      const lastCards = state.last_cards || []
      const passedSeat = lastCards.length === 0 && typeof state.last_seat === 'number'
        ? state.last_seat
        : -1
      players.forEach((p) =>
      {
        const idx = p.seat
        if (idx < 0 || idx > 2)
        {
          return
        }
        const node = this.seatNodes[idx]
        node.nameText.setText(p.nickname || '座位' + p.seat)
        node.avatar.setLabel(p.nickname || '玩家')
        node.coinText.setText(formatMoney(p.bid_score ? p.bid_score * 100 : 0))
        node.lordTag.setVisible(Boolean(p.is_landlord))
        node.badge.setVisible(true)
        node.badge.setText(p.card_count || 0)

        const scoreNode = this.scoreNodes[idx]
        const val = Number(p.score || 0)
        if (val === 0)
        {
          scoreNode.setAlpha(0)
        }
        else
        {
          scoreNode
            .setText((val > 0 ? '+' : '') + val)
            .setColor(css(val > 0 ? COLOR.scoreUp : COLOR.scoreGold))
            .setAlpha(1)
        }
        const showStamp = state.phase_code === 3 && passedSeat === idx
        this.stampNodes[idx].setAlpha(showStamp ? 1 : 0)
      })
      this.seatNodes.forEach((node, i) =>
      {
        const has = players.some((p) => p.seat === i)
        node.box.setVisible(has)
        if (!has)
        {
          this.scoreNodes[i].setAlpha(0)
          this.stampNodes[i].setAlpha(0)
        }
      })
    }

    /**
     * 刷新顶部三张地主牌
     * @param {Object} state 状态快照
     * @returns {void}
     */
    renderBottom(state)
    {
      this.bottomSlot.removeAll(true)
      const cards = state.bottom || []
      if (!cards.length)
      {
        return
      }
      const reveal = state.phase_code >= 2 || state.landlord === state.my_seat
      cards.forEach((card, i) =>
      {
        const c = drawCard(this, (i - 1) * 48, 0, card, reveal, 0.44)
        this.bottomSlot.add(c)
      })
    }

    /**
     * 刷新中央出牌区与叶形牌型标签
     * @param {Object} state 状态快照
     * @returns {void}
     */
    renderPlayed(state)
    {
      this.playSlot.removeAll(true)
      this.patternSlot.removeAll(true)
      const cards = state.last_cards || []
      if (!cards.length)
      {
        return
      }
      const n = cards.length
      const step = Math.min(CARD_W * 0.7, (W - 560) / Math.max(n, 1))
      cards.forEach((card, i) =>
      {
        const offset = (i - (n - 1) / 2) * step
        const c = drawCard(this, offset, 0, card, true, 0.94)
        this.playSlot.add(c)
      })
      if (state.last_type)
      {
        this.patternSlot.add(drawPatternTag(this, 0, 0, state.last_type))
      }
    }

    /**
     * 刷新手牌
     * @param {Object} state 状态快照
     * @returns {void}
     */
    renderHand(state)
    {
      this.handContainer.removeAll(true)
      this.handNodes = []
      this.selected.clear()
      const cards = state.my_cards || []
      this.selectedLabel.setText('')
      if (!cards.length)
      {
        return
      }
      const n = cards.length
      const maxSpan = W - 210
      const step = n > 1 ? Math.min(CARD_W * 0.62, (maxSpan - CARD_W) / (n - 1)) : 0
      const totalW = step * (n - 1) + CARD_W
      const startX = (W - totalW) / 2 + CARD_W / 2
      cards.forEach((card, i) =>
      {
        const x = startX + i * step
        const node = drawCard(this, x, HAND_Y, card, true, 1, false)
        node.setDepth(10 + i)
        node.setInteractive(
          new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
          Phaser.Geom.Rectangle.Contains
        )
        const key = card.suit + '-' + card.rank + '-' + i
        node.on('pointerdown', () =>
        {
          if (this.selected.has(key))
          {
            this.selected.delete(key)
            node.y = HAND_Y
          }
          else
          {
            this.selected.add(key)
            node.y = HAND_Y - 28
          }
          this.selectedLabel.setText(this.selected.size ? '已选 ' + this.selected.size + ' 张' : '')
          if (hooks.onSelect)
          {
            hooks.onSelect(this.selected.size)
          }
        })
        this.handContainer.add(node)
        this.handNodes.push({ node, card, key, baseY: HAND_Y })
      })
    }

    /**
     * 收集当前选中的牌
     * @returns {Array} 牌数据数组
     */
    collectSelected()
    {
      return this.handNodes.filter((n) => this.selected.has(n.key)).map((n) => n.card)
    }

    /**
     * 清空选中状态
     * @returns {void}
     */
    clearSelection()
    {
      this.selected.clear()
      this.handNodes.forEach((n) =>
      {
        n.node.y = n.baseY
      })
      this.selectedLabel.setText('')
    }

    /**
     * 播放牌型特效：金色爆炸 + 牌型大字
     * @param {string} type 牌型名称
     * @param {boolean} isBomb 是否炸弹类
     * @returns {void}
     */
    playEffect(type, isBomb)
    {
      this.effectLayer.removeAll(true)
      const g = this.add.graphics()
      const rays = isBomb ? 14 : 8
      g.fillStyle(0xffd45e, 0.8)
      for (let i = 0; i < rays; i += 1)
      {
        const a = ((Math.PI * 2) / rays) * i
        const len = isBomb ? 230 : 160
        g.fillTriangle(
          Math.cos(a) * len,
          Math.sin(a) * len,
          Math.cos(a + 0.18) * 38,
          Math.sin(a + 0.18) * 38,
          Math.cos(a - 0.18) * 38,
          Math.sin(a - 0.18) * 38
        )
      }
      const glow = this.add.graphics()
      glow.fillStyle(0xffb830, 0.5)
      glow.fillCircle(0, 0, isBomb ? 126 : 92)
      const txt = this.add
        .text(0, 0, type, {
          fontFamily: 'sans-serif',
          fontSize: isBomb ? '72px' : '58px',
          color: '#fff6c8',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
      txt.setStroke('#8a3a00', 8)
      this.effectLayer.add([g, glow, txt])
      this.effectLayer.setScale(0.6).setAlpha(1)
      this.tweens.add({
        targets: this.effectLayer,
        scale: 1.15,
        duration: 220,
        ease: 'Back.easeOut'
      })
      this.tweens.add({
        targets: this.effectLayer,
        alpha: 0,
        delay: 700,
        duration: 400,
        onComplete: () => this.effectLayer.removeAll(true)
      })
    }

    /**
     * 结算浮层
     * @param {Object} state 状态快照
     * @returns {void}
     */
    showResult(state)
    {
      if (this.resultShown)
      {
        return
      }
      this.resultShown = true
      const my = (state.players || []).find((p) => p.seat === state.my_seat)
      const won = my ? my.score > 0 : false
      const box = this.add.container(W / 2, H / 2).setDepth(80)
      const mask = this.add.rectangle(0, 0, W, H, 0x000000, 0.62).setInteractive()
      const g = this.add.graphics()
      g.fillStyle(0x4a0f09, 1)
      g.fillRoundedRect(-300, -222, 600, 444, 24)
      g.fillStyle(0x74220f, 1)
      g.fillRoundedRect(-292, -214, 584, 428, 18)
      g.lineStyle(4, COLOR.woodTrim, 0.95)
      g.strokeRoundedRect(-292, -214, 584, 428, 18)
      const title = this.add
        .text(0, -150, won ? '胜利' : '失败', {
          fontFamily: 'sans-serif',
          fontSize: '76px',
          color: won ? '#ffd45e' : '#ff8a7a',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
      title.setStroke('#3a0c06', 8)
      const detail = this.add
        .text(
          0,
          -30,
          '底分 ' +
            state.base_score +
            '   倍数 x' +
            state.multiplier +
            '\n本局得分 ' +
            ((my && my.score) || 0),
          {
            fontFamily: 'sans-serif',
            fontSize: '30px',
            color: '#ffe9c4',
            align: 'center',
            lineSpacing: 14
          }
        )
        .setOrigin(0.5)
      const back = drawButton(this, {
        x: 0,
        y: 148,
        w: 240,
        h: 74,
        text: '返回大厅',
        fill: COLOR.btnPrimary,
        fontSize: 30
      })
      back.on('pointerdown', () =>
      {
        if (hooks.onAction)
        {
          hooks.onAction('quit', [])
        }
      })
      box.add([mask, g, title, detail, back])
    }

    /**
     * 重置结算态，用于进入下一局
     * @returns {void}
     */
    resetResult()
    {
      this.resultShown = false
    }

    /**
     * 炸弹震屏
     * @returns {void}
     */
    shake()
    {
      this.cameras.main.shake(260, 0.008)
    }

    /**
     * 每帧刷新时钟，保持与原版一致的常驻信息
     * @returns {void}
     */
    update()
    {
      const d = new Date()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      if (this.clockText && this.clockText.text !== hh + ':' + mm)
      {
        this.clockText.setText(hh + ':' + mm)
      }
    }
  }
}
