/**
 * @file 斗地主视觉主题。
 * 配色与尺寸由宁波地主实机 UI 效果图（1450x864 对局 / 1194x670 大厅）逐像素取色，
 * 等比换算到 1334x750 横屏逻辑分辨率，集中在此处便于统一微调。
 *
 * 对局视觉骨架：酒红木质外框 + 金黄绒布桌面 + 橙金描边 + 顶部地主牌红框。
 * 大厅视觉骨架：淡蓝紫城市剪影 + 左侧排行榜 + 右侧宫格 + 底部深红导航条。
 */

/** 逻辑分辨率宽度（横屏） */
export const W = 1334

/** 逻辑分辨率高度（横屏） */
export const H = 750

/** 手牌尺寸 */
export const CARD_W = 84

/** 手牌高度 */
export const CARD_H = 118

/**
 * 主题色板。命名沿用牌桌语义，不按色值命名，便于整体换肤。
 */
export const COLOR = {
  /** 木框最外层深酒红 */
  woodDark: 0x4a0f09,
  /** 木框主色 */
  woodMain: 0x74220f,
  /** 木框亮部（受光边） */
  woodLight: 0xa53a1c,
  /** 木框雕花金 */
  woodTrim: 0xd9a13a,
  /** 绒布暗部 */
  feltDark: 0xdf9c2c,
  /** 绒布主色 */
  feltMain: 0xecbc52,
  /** 绒布亮部（中心） */
  feltLight: 0xf4cf7e,
  /** 绒布边缘描线 */
  feltEdge: 0xc9761a,
  /** 顶部信息栏底色（深红木条） */
  barBg: 0x6b1d0e,
  /** 主文字 */
  textMain: 0xffffff,
  /** 次要文字 */
  textSub: 0xf6e3bd,
  /** 高亮金色 */
  gold: 0xffd45e,
  /** 深金（文字描边） */
  goldDeep: 0x7a3c0a,
  /** 主操作按钮（橙金渐变起） */
  btnPrimary: 0xff9d21,
  /** 主操作按钮（橙金渐变止） */
  btnPrimaryDeep: 0xe06a0c,
  /** 次操作按钮（蓝） */
  btnSecondary: 0x37a2e0,
  /** 次操作按钮（深蓝） */
  btnSecondaryDeep: 0x1c6fb0,
  /** 拒绝类按钮（灰绿） */
  btnMuted: 0x6d8f7c,
  /** 聊天按钮 */
  btnChat: 0x38c07a,
  /** 亮紫色（切换形象） */
  btnPurple: 0x8b6ad8,
  /** 牌面白 */
  cardFace: 0xfdfbf6,
  /** 牌面描边 */
  cardBorder: 0xc9c2b4,
  /** 牌背主色 */
  cardBack: 0xb02a1c,
  /** 牌背暗纹 */
  cardBackDark: 0x821a10,
  /** 红色点数 */
  red: 0xd81e06,
  /** 黑色点数 */
  black: 0x1a1a1a,
  /** 牌数徽章底（青蓝） */
  badgeBlue: 0x2f8fd6,
  /** 正分青蓝 */
  scoreUp: 0x2f9fd8,
  /** 负分深金 */
  scoreGold: 0xd97c0c,
  /** 负分红 */
  scoreDown: 0xe23b2c,
  /** 不出印章青绿 */
  stamp: 0x35c9a8
}

/** 花色字符，索引与牌数据 suit 对齐：0 方片 1 梅花 2 红桃 3 黑桃 */
export const SUIT_TEXT = ['♦', '♣', '♥', '♠']

/** 花色取色，索引与牌数据 suit 对齐 */
export const SUIT_COLOR = [COLOR.red, COLOR.black, COLOR.red, COLOR.black]

/** 点数展示文案 */
const RANK_TEXT = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
  16: '小',
  17: '大'
}

/**
 * 取点数的展示文案
 * @param {number} rank 点数，11-14 为 JQKA，15 为 2，16/17 为大小王
 * @returns {string} 展示文案
 */
export function rankLabel(rank)
{
  return RANK_TEXT[rank] || String(rank)
}

/**
 * 数值转中文可读金额，超过一万按万/亿收敛，与原版一致
 * @param {number} value 原始数值
 * @returns {string} 展示文案
 */
export function formatMoney(value)
{
  const n = Number(value) || 0
  if (n >= 100000000)
  {
    return (n / 100000000).toFixed(1) + '亿'
  }
  if (n >= 10000)
  {
    return (n / 10000).toFixed(2) + '万'
  }
  return String(Math.round(n))
}

/**
 * 十六进制色转 CSS 颜色串
 * @param {number} hex 颜色值
 * @returns {string} CSS 颜色
 */
export function css(hex)
{
  return '#' + hex.toString(16).padStart(6, '0')
}

/**
 * 按比例提亮或压暗一个颜色
 * @param {number} hex 原始颜色
 * @param {number} ratio 大于 1 提亮，0-1 压暗
 * @returns {number} 结果颜色
 */
function shade(hex, ratio)
{
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * ratio))
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * ratio))
  const b = Math.min(255, Math.round((hex & 0xff) * ratio))
  return (r << 16) | (g << 8) | b
}

/**
 * 绘制金元宝图标，用作欢乐豆符号
 * @param {Object} scene Phaser 场景
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {number} size 尺寸
 * @returns {Object} Graphics 对象
 */
export function drawBean(scene, x, y, size)
{
  const g = scene.add.graphics({ x, y })
  const s = size / 2
  g.fillStyle(0xffcf3f, 1)
  g.fillEllipse(0, s * 0.35, s * 1.9, s * 0.95)
  g.fillStyle(0xffe07a, 1)
  g.fillTriangle(-s * 0.55, s * 0.05, s * 0.55, s * 0.05, 0, -s * 0.85)
  g.fillStyle(0xfff3c4, 1)
  g.fillCircle(0, -s * 0.28, s * 0.24)
  g.lineStyle(1.5, 0xb47a12, 0.7)
  g.strokeEllipse(0, s * 0.35, s * 1.9, s * 0.95)
  return g
}

/**
 * 绘制一张扑克牌。牌面为暖白底细灰边，左上角大点数 + 小花色，
 * 中央大花色，与实机牌面比例一致。
 * @param {Object} scene Phaser 场景
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {Object} card 牌数据，含 suit 与 rank
 * @param {boolean} faceUp 是否亮牌
 * @param {number} scale 缩放
 * @returns {Object} 容器
 */
export function drawCard(scene, x, y, card, faceUp, scale, compact)
{
  const k = scale || 1
  const showCenter = compact !== false
  const w = CARD_W * k
  const h = CARD_H * k
  const box = scene.add.container(x, y)

  if (!faceUp)
  {
    const back = scene.add.graphics()
    back.fillStyle(0xf7ecd4, 1)
    back.fillRoundedRect(-w / 2, -h / 2, w, h, 7 * k)
    back.fillStyle(COLOR.cardBack, 1)
    back.fillRoundedRect(-w / 2 + 3 * k, -h / 2 + 3 * k, w - 6 * k, h - 6 * k, 5 * k)
    back.fillStyle(COLOR.cardBackDark, 1)
    back.fillRoundedRect(-w / 2 + 9 * k, -h / 2 + 9 * k, w - 18 * k, h - 18 * k, 4 * k)
    back.lineStyle(1.5, 0xf2c14e, 0.85)
    back.strokeRoundedRect(-w / 2 + 12 * k, -h / 2 + 12 * k, w - 24 * k, h - 24 * k, 3 * k)
    back.fillStyle(0xf2c14e, 0.8)
    back.fillTriangle(0, -14 * k, 14 * k, 0, 0, 14 * k)
    back.fillTriangle(0, -14 * k, -14 * k, 0, 0, 14 * k)
    box.add(back)
    return box
  }

  const face = scene.add.graphics()
  face.fillStyle(0x000000, 0.16)
  face.fillRoundedRect(-w / 2 + 1, -h / 2 + 2 * k, w, h, 7 * k)
  face.fillStyle(COLOR.cardFace, 1)
  face.fillRoundedRect(-w / 2, -h / 2, w, h, 7 * k)
  face.lineStyle(1.5, COLOR.cardBorder, 1)
  face.strokeRoundedRect(-w / 2, -h / 2, w, h, 7 * k)
  box.add(face)

  const rank = card.rank
  const isJoker = rank >= 16
  const tone = isJoker ? (rank === 17 ? COLOR.red : COLOR.black) : SUIT_COLOR[card.suit] || COLOR.black
  const label = rankLabel(rank)

  if (isJoker)
  {
    const letters = scene.add
      .text(-w / 2 + 9 * k, -h / 2 + 26 * k, 'JOKER', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: String(Math.round(13 * k)) + 'px',
        color: css(tone),
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setAngle(-90)
    box.add(letters)
    const mark = scene.add
      .text(w / 2 - 9 * k, h / 2 - 18 * k, rank === 17 ? '大' : '小', {
        fontFamily: 'sans-serif',
        fontSize: String(Math.round(18 * k)) + 'px',
        color: css(tone),
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
    box.add(mark)
    const star = scene.add
      .text(0, 0, '★', {
        fontFamily: 'sans-serif',
        fontSize: String(Math.round(30 * k)) + 'px',
        color: css(tone)
      })
      .setOrigin(0.5)
    box.add(star)
    return box
  }

  const rankSize = label.length > 1 ? 26 : 31
  const corner = scene.add
    .text(-w / 2 + 8 * k, -h / 2 + 3 * k, label, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: String(Math.round(rankSize * k)) + 'px',
      color: css(tone),
      fontStyle: 'bold'
    })
    .setOrigin(0, 0)
  box.add(corner)

  const smallSuit = scene.add
    .text(-w / 2 + 11 * k, -h / 2 + 36 * k, SUIT_TEXT[card.suit] || '', {
      fontFamily: 'sans-serif',
      fontSize: String(Math.round(21 * k)) + 'px',
      color: css(tone)
    })
    .setOrigin(0, 0)
  box.add(smallSuit)

  if (showCenter)
  {
    const bigSuit = scene.add
      .text(0, h * 0.2, SUIT_TEXT[card.suit] || '', {
        fontFamily: 'sans-serif',
        fontSize: String(Math.round(44 * k)) + 'px',
        color: css(tone)
      })
      .setOrigin(0.5)
    box.add(bigSuit)
  }

  return box
}

/**
 * 绘制卡通头像。按座位区分形象：0 财神（红袍官帽）、1 白帽工人、2 商人，
 * 对应实机截图中的三个主角形象。
 * @param {Object} scene Phaser 场景
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {number} radius 半径
 * @param {string} nickname 昵称，未指定形象时用于取首字
 * @param {number} role 形象编号 0/1/2
 * @returns {Object} 容器
 */
export function drawAvatar(scene, x, y, radius, nickname, role)
{
  const box = scene.add.container(x, y)
  const g = scene.add.graphics()
  const r = radius

  g.fillStyle(0x000000, 0.22)
  g.fillCircle(0, 3, r + 3)
  g.fillStyle(0xf7ecd4, 1)
  g.fillCircle(0, 0, r)
  g.fillStyle(0xe8d3a8, 1)
  g.fillCircle(0, 0, r - 3)

  if (role === 0)
  {
    g.fillStyle(0xc9301f, 1)
    g.fillCircle(0, r * 0.72, r * 0.82)
    g.fillStyle(0xf2c14e, 1)
    g.fillRect(-r * 0.46, -r * 0.2, r * 0.92, r * 0.14)
    g.fillStyle(0xf6d6a8, 1)
    g.fillCircle(0, r * 0.06, r * 0.58)
    g.fillStyle(0x9a1a10, 1)
    g.fillRoundedRect(-r * 0.52, -r * 0.66, r * 1.04, r * 0.3, r * 0.1)
    g.fillStyle(0xf2c14e, 1)
    g.fillRect(-r * 0.08, -r * 0.9, r * 0.16, r * 0.28)
    g.fillStyle(0x2a1206, 1)
    g.fillCircle(-r * 0.22, r * 0.02, r * 0.07)
    g.fillCircle(r * 0.22, r * 0.02, r * 0.07)
    g.fillStyle(0x2a1206, 1)
    g.fillRoundedRect(-r * 0.2, r * 0.3, r * 0.4, r * 0.1, r * 0.05)
  }
  else if (role === 1)
  {
    g.fillStyle(0x2f5f9e, 1)
    g.fillCircle(0, r * 0.74, r * 0.8)
    g.fillStyle(0xf6d6a8, 1)
    g.fillCircle(0, r * 0.08, r * 0.56)
    g.fillStyle(0x1f1a14, 1)
    g.fillRoundedRect(-r * 0.34, r * 0.16, r * 0.68, r * 0.34, r * 0.14)
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(-r * 0.44, -r * 0.64, r * 0.88, r * 0.34, r * 0.16)
    g.fillStyle(0xe8e2d4, 1)
    g.fillRoundedRect(-r * 0.46, -r * 0.34, r * 0.92, r * 0.12, r * 0.06)
    g.fillStyle(0x2a1206, 1)
    g.fillCircle(-r * 0.2, 0, r * 0.06)
    g.fillCircle(r * 0.2, 0, r * 0.06)
  }
  else
  {
    g.fillStyle(0x2f7f5e, 1)
    g.fillCircle(0, r * 0.74, r * 0.8)
    g.fillStyle(0xf6d6a8, 1)
    g.fillCircle(0, r * 0.08, r * 0.56)
    g.fillStyle(0x3a2a14, 1)
    g.fillRoundedRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.26, r * 0.12)
    g.fillStyle(0x6b4a22, 1)
    g.fillRoundedRect(-r * 0.5, -r * 0.72, r, r * 0.4, r * 0.18)
    g.fillStyle(0x2a1206, 1)
    g.fillCircle(-r * 0.2, 0, r * 0.06)
    g.fillCircle(r * 0.2, 0, r * 0.06)
  }

  g.lineStyle(3, 0xf7ecd4, 0.95)
  g.strokeCircle(0, 0, r)
  box.add(g)

  box.setLabel = () =>
  {
  }
  return box
}

/**
 * 绘制橙金渐变主按钮。顶部高光 + 深色底边 + 白描边，与实机按钮一致。
 * @param {Object} scene Phaser 场景
 * @param {Object} opts 配置，含 x/y/w/h/text/fill/fillDeep/fontSize/radius
 * @returns {Object} 容器，附带 setEnabled 方法
 */
export function drawButton(scene, opts)
{
  const { x, y, w, h, text, fontSize } = opts
  const fill = opts.fill === undefined ? COLOR.btnPrimary : opts.fill
  const fillDeep = opts.fillDeep === undefined ? shade(fill, 0.66) : opts.fillDeep
  const radius = opts.radius === undefined ? Math.min(h / 2, 18) : opts.radius
  const box = scene.add.container(x, y)
  const g = scene.add.graphics()

  g.fillStyle(0x3a1206, 0.45)
  g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, radius)
  g.fillStyle(fillDeep, 1)
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
  g.fillStyle(fill, 1)
  g.fillRoundedRect(-w / 2, -h / 2, w, h - 5, radius)
  g.fillStyle(0xffffff, 0.3)
  g.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, h * 0.34, radius * 0.7)
  g.lineStyle(2, 0xfff4d6, 0.7)
  g.strokeRoundedRect(-w / 2, -h / 2, w, h - 5, radius)
  box.add(g)

  const label = scene.add
    .text(0, -2, text, {
      fontFamily: 'sans-serif',
      fontSize: String(fontSize || 28) + 'px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  label.setShadow(0, 2, '#5c2600', 3)
  box.add(label)

  box.setSize(w, h)
  box.label = label
  box.setEnabled = (enabled) =>
  {
    box.setAlpha(enabled ? 1 : 0.5)
    if (enabled)
    {
      box.setInteractive({ useHandCursor: true })
    }
    else
    {
      box.disableInteractive()
    }
  }
  box.setEnabled(true)
  return box
}

/**
 * 绘制六边形牌数徽章
 * @param {Object} scene Phaser 场景
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {number} size 半径
 * @returns {Object} 容器，含 setText 方法
 */
export function drawCountBadge(scene, x, y, size)
{
  const box = scene.add.container(x, y)
  const g = scene.add.graphics()
  const walk = () =>
  {
    g.beginPath()
    for (let i = 0; i < 6; i += 1)
    {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const px = Math.cos(a) * size
      const py = Math.sin(a) * size
      if (i === 0)
      {
        g.moveTo(px, py)
      }
      else
      {
        g.lineTo(px, py)
      }
    }
    g.closePath()
  }
  g.fillStyle(0x104a72, 1)
  walk()
  g.fillPath()
  g.fillStyle(0x2f8fd6, 1)
  walk()
  g.fillPath()
  g.fillStyle(0x6cc4f5, 1)
  g.beginPath()
  g.moveTo(-size * 0.5, -size * 0.5)
  g.lineTo(size * 0.5, -size * 0.5)
  g.lineTo(size * 0.24, 0)
  g.lineTo(-size * 0.24, 0)
  g.closePath()
  g.fillPath()
  g.lineStyle(2, 0xbfe8ff, 0.95)
  walk()
  g.strokePath()
  box.add(g)
  const t = scene.add
    .text(0, 0, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: String(Math.round(size * 0.92)) + 'px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  t.setShadow(0, 2, '#062a45', 3)
  box.add(t)
  box.setText = (v) => t.setText(String(v))
  return box
}

/**
 * 绘制绒布径向渐变，用于桌面
 * @param {Object} scene Phaser 场景
 * @param {number} cx 中心 x
 * @param {number} cy 中心 y
 * @param {number} rw 椭圆半宽
 * @param {number} rh 椭圆半高
 * @param {number} base 亮部基色
 * @param {number} steps 叠加层数
 * @returns {void}
 */
export function drawFeltGradient(scene, cx, cy, rw, rh, base, steps)
{
  const g = scene.add.graphics()
  const n = steps || 16
  const r0 = (base >> 16) & 0xff
  const g0 = (base >> 8) & 0xff
  const b0 = base & 0xff
  for (let i = n; i >= 1; i -= 1)
  {
    const t = i / n
    const k = 1 - t * 0.16
    const color = (Math.round(r0 * k) << 16) | (Math.round(g0 * k) << 8) | Math.round(b0 * k)
    g.fillStyle(color, 1)
    g.fillEllipse(cx, cy, rw * 2 * t, rh * 2 * t)
  }
}

/**
 * 绘制圆角矩形的绒布桌面（实机为圆角矩形而非椭圆）
 * @param {Object} scene Phaser 场景
 * @param {Object} rect 含 x/y/w/h/radius
 * @returns {void}
 */
export function drawFeltRect(scene, rect)
{
  const { x, y, w, h, radius } = rect
  const g = scene.add.graphics()
  const n = 14
  for (let i = n; i >= 1; i -= 1)
  {
    const t = i / n
    const color = shade(COLOR.feltLight, 0.88 + (1 - t) * 0.12)
    g.fillStyle(color, 1)
    const iw = w - (1 - t) * 26
    const ih = h - (1 - t) * 26
    g.fillRoundedRect(x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, radius)
  }
  g.lineStyle(4, COLOR.feltEdge, 1)
  g.strokeRoundedRect(x, y, w, h, radius)
  g.lineStyle(2, 0xfff0c4, 0.5)
  g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, radius - 4)
}

/**
 * 绘制带描边的大号分数文字。-带动画：青色正分、红色负分。
 * @param {Object} scene Phaser 场景
 * @param {number} x 位置 x
 * @param {number} y 位置 y
 * @param {string} text 文案
 * @param {number} tone 主色
 * @param {number} size 字号
 * @returns {Object} Text 对象
 */
export function drawScoreText(scene, x, y, text, tone, size)
{
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: String(size || 44) + 'px',
      color: css(tone),
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  t.setStroke('#ffffff', 5)
  t.setShadow(0, 3, 'rgba(60,26,0,0.55)', 4)
  return t
}

/**
 * 绘制青绿色椭圆印章，用于“不出 / 过”状态
 * @param {Object} scene Phaser 场景
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {string} text 文案
 * @returns {Object} 容器
 */
export function drawStamp(scene, x, y, text)
{
  const box = scene.add.container(x, y)
  const g = scene.add.graphics()
  g.fillStyle(0x0e6b58, 0.28)
  g.fillEllipse(0, 4, 132, 62)
  g.fillStyle(0xf6fbf8, 0.92)
  g.fillEllipse(0, 0, 128, 58)
  g.fillStyle(COLOR.stamp, 1)
  g.fillEllipse(0, 0, 120, 50)
  g.fillStyle(0x7fe6cf, 1)
  g.fillEllipse(0, -6, 104, 30)
  g.lineStyle(2.5, 0xffffff, 0.85)
  g.strokeEllipse(0, 0, 120, 50)
  box.add(g)
  const t = scene.add
    .text(0, 0, text, {
      fontFamily: 'sans-serif',
      fontSize: '30px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  t.setShadow(0, 2, '#0a5245', 3)
  box.add(t)
  box.setText = (v) => t.setText(v)
  return box
}

/**
 * 绘制绿色叶形牌型标签，实机“顺子 / 炸弹”等标签为叶片状
 * @param {Object} scene Phaser 场景
 * @param {number} x 中心 x
 * @param {number} y 中心 y
 * @param {string} text 牌型名
 * @returns {Object} 容器
 */
export function drawPatternTag(scene, x, y, text)
{
  const box = scene.add.container(x, y)
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  const w = Math.max(96, label.width + 52)
  const h = 46
  const g = scene.add.graphics()
  g.fillStyle(0x1d7a1a, 0.9)
  g.fillEllipse(0, 0, w, h)
  g.fillStyle(0x46b83c, 1)
  g.fillEllipse(0, -2, w - 6, h - 8)
  g.fillStyle(0x7dd96e, 1)
  g.fillEllipse(-w * 0.16, -8, w * 0.42, h * 0.34)
  g.lineStyle(2, 0xffffff, 0.7)
  g.strokeEllipse(0, 0, w - 4, h - 4)
  box.add(g)
  label.setShadow(0, 2, '#145010', 3)
  box.add(label)
  return box
}

/**
 * 绘制木质外框：四层描边营造雕花木料厚度
 * @param {Object} scene Phaser 场景
 * @returns {void}
 */
export function drawWoodFrame(scene)
{
  const g = scene.add.graphics()
  g.fillStyle(COLOR.woodDark, 1)
  g.fillRect(0, 0, W, H)
  g.fillStyle(COLOR.woodMain, 1)
  g.fillRect(8, 8, W - 16, H - 16)
  g.fillStyle(COLOR.woodLight, 1)
  g.fillRect(14, 14, W - 28, H - 28)
  g.fillStyle(COLOR.woodMain, 1)
  g.fillRect(20, 20, W - 40, H - 40)

  g.lineStyle(2, 0x4a0f09, 0.6)
  const woodLines = Math.floor((H - 24) / 52)
  for (let i = 1; i < woodLines; i += 1)
  {
    const y = 12 + i * 52
    g.lineBetween(10, y, W - 10, y)
  }

  g.lineStyle(3, COLOR.woodTrim, 0.9)
  g.strokeRect(24, 24, W - 48, H - 48)
  g.lineStyle(1.5, 0x3a0c06, 0.55)
  g.strokeRect(28, 28, W - 56, H - 56)
}

/**
 * 绘制四角木框雕花，实机四角有金色卷草纹
 * @param {Object} scene Phaser 场景
 * @param {number} size 纹样边长
 * @returns {void}
 */
export function drawCornerTrim(scene, size)
{
  const s = size || 54
  const corners = [
    { x: 30, y: 30, sx: 1, sy: 1 },
    { x: W - 30, y: 30, sx: -1, sy: 1 },
    { x: 30, y: H - 30, sx: 1, sy: -1 },
    { x: W - 30, y: H - 30, sx: -1, sy: -1 }
  ]
  corners.forEach((c) =>
  {
    const g = scene.add.graphics({ x: c.x, y: c.y })
    g.scaleX = c.sx
    g.scaleY = c.sy
    g.lineStyle(3, COLOR.woodTrim, 0.9)
    g.beginPath()
    g.moveTo(0, s)
    g.lineTo(0, s * 0.3)
    g.arc(0, s * 0.3, s * 0.3, Math.PI, Math.PI * 1.5, false)
    g.lineTo(s, 0)
    g.strokePath()
    g.fillStyle(COLOR.woodTrim, 0.95)
    g.fillCircle(s * 0.18, s * 0.18, 4)
  })
}

/**
 * 生成容器内的纯色文字
 * @param {Object} scene Phaser 场景
 * @param {number} x 位置 x
 * @param {number} y 位置 y
 * @param {string} text 文案
 * @param {Object} style 文本样式
 * @returns {Object} Text 对象
 */
export function makeText(scene, x, y, text, style)
{
  return scene.add.text(x, y, text, style)
}
