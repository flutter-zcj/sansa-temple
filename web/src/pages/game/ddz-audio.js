/**
 * @file 斗地主音效。
 * 原版音效资源随 AssetBundle 加密下发，无法直接提取，这里以 Web Audio 实时合成等效音色：
 * 纸牌摩擦用白噪声过带通模拟，炸弹用低频冲击叠加噪声爆发，王炸用三段递进，
 * 春天与胜负用和声琶音。全部惰性创建，符合浏览器自动播放策略。
 */

export default class DdzAudio
{
  constructor()
  {
    this.ctx = null
    this.enabled = true
    this.noiseBuffer = null
  }

  /**
   * 确保 AudioContext 已创建并处于运行态
   * @returns {Object|null} AudioContext
   */
  ensure()
  {
    if (typeof window === 'undefined')
    {
      return null
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx)
    {
      return null
    }
    if (!this.ctx)
    {
      this.ctx = new Ctx()
      this.noiseBuffer = this.makeNoise(1.2)
    }
    if (this.ctx.state === 'suspended')
    {
      this.ctx.resume()
    }
    return this.ctx
  }

  /**
   * 生成白噪声缓冲，供纸牌摩擦与爆炸复用
   * @param {number} seconds 时长（秒）
   * @returns {Object|null} AudioBuffer
   */
  makeNoise(seconds)
  {
    const ctx = this.ctx
    if (!ctx)
    {
      return null
    }
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i += 1)
    {
      data[i] = Math.random() * 2 - 1
    }
    return buf
  }

  /**
   * 播放单个音符
   * @param {number} freq 频率
   * @param {number} duration 时长（秒）
   * @param {string} type 波形
   * @param {number} gain 音量
   * @param {number} delay 延迟（秒）
   * @returns {void}
   */
  tone(freq, duration, type, gain, delay)
  {
    const ctx = this.ensure()
    if (!ctx || !this.enabled)
    {
      return
    }
    const t0 = ctx.currentTime + (delay || 0)
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type || 'triangle'
    osc.frequency.setValueAtTime(freq, t0)
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  /**
   * 播放一段带通滤波的白噪声，用于纸牌摩擦、爆炸与人群声
   * @param {number} duration 时长（秒）
   * @param {number} freq 带通中心频率
   * @param {number} q 品质因数
   * @param {number} gain 音量
   * @param {number} delay 延迟（秒）
   * @param {number} sweepTo 频率滑向值，0 表示不滑
   * @returns {void}
   */
  noise(duration, freq, q, gain, delay, sweepTo)
  {
    const ctx = this.ensure()
    if (!ctx || !this.enabled || !this.noiseBuffer)
    {
      return
    }
    const t0 = ctx.currentTime + (delay || 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(freq, t0)
    bp.Q.setValueAtTime(q || 1.2, t0)
    if (sweepTo)
    {
      bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration)
    }
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(gain || 0.1, t0 + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(bp)
    bp.connect(amp)
    amp.connect(ctx.destination)
    src.start(t0)
    src.stop(t0 + duration + 0.05)
  }

  /** 按钮点击：短促木质叩击 */
  click()
  {
    this.tone(760, 0.05, 'square', 0.045)
    this.noise(0.045, 2400, 1.6, 0.05)
  }

  /** 面板弹出：上扬提示音 */
  open()
  {
    this.tone(520, 0.08, 'triangle', 0.05)
    this.tone(780, 0.1, 'triangle', 0.045, 0.07)
  }

  /** 选牌：清脆挑牌声 */
  select()
  {
    this.noise(0.05, 3200, 2.4, 0.07)
    this.tone(1180, 0.045, 'sine', 0.03)
  }

  /** 发牌：连发纸牌摩擦 */
  deal()
  {
    for (let i = 0; i < 9; i += 1)
    {
      this.noise(0.07, 2600 + Math.random() * 900, 2.2, 0.085, i * 0.055, 1800)
    }
  }

  /** 出牌：牌拍桌面的闷响加轻微脆声 */
  play()
  {
    this.noise(0.1, 1500, 1.1, 0.13, 0, 700)
    this.tone(220, 0.09, 'sine', 0.07)
    this.noise(0.06, 4200, 3, 0.05, 0.01)
  }

  /** 不出：低沉短音 */
  pass()
  {
    this.tone(180, 0.16, 'sine', 0.075)
    this.tone(140, 0.2, 'sine', 0.05, 0.05)
  }

  /** 炸弹：低频冲击 + 噪声爆发 + 玻璃碎 */
  bomb()
  {
    this.tone(90, 0.36, 'sawtooth', 0.16)
    this.tone(55, 0.5, 'sine', 0.14, 0.02)
    this.noise(0.42, 900, 0.7, 0.22, 0, 160)
    this.noise(0.3, 5200, 1.2, 0.1, 0.04, 2600)
  }

  /** 王炸：三段递进，音量与频率逐级抬升 */
  rocket()
  {
    for (let i = 0; i < 3; i += 1)
    {
      const d = i * 0.19
      this.tone(70 + i * 26, 0.3, 'sawtooth', 0.12 + i * 0.03, d)
      this.noise(0.34, 700 + i * 500, 0.8, 0.16 + i * 0.04, d, 200)
    }
    this.tone(1046, 0.5, 'triangle', 0.09, 0.58)
    this.noise(0.5, 6000, 1, 0.08, 0.56, 3000)
  }

  /** 春天：上行欢快五声音阶 */
  spring()
  {
    [523, 587, 659, 784, 880, 1047].forEach((f, i) =>
    {
      this.tone(f, 0.16, 'triangle', 0.07, i * 0.085)
    })
    this.noise(0.6, 4800, 1, 0.05, 0.5, 7000)
  }

  /** 胜利：明亮大调琶音加金币声 */
  win()
  {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
    {
      this.tone(f, 0.22, 'triangle', 0.075, i * 0.1)
    })
    this.tone(1568, 0.5, 'sine', 0.06, 0.52)
    this.noise(0.18, 7000, 2, 0.05, 0.6, 5200)
  }

  /** 失败：下行小调 */
  lose()
  {
    [440, 392, 330, 262, 220].forEach((f, i) =>
    {
      this.tone(f, 0.26, 'sine', 0.07, i * 0.14)
    })
    this.tone(147, 0.6, 'sine', 0.05, 0.62)
  }

  /** 倒计时滴答 */
  tick()
  {
    this.tone(1500, 0.03, 'square', 0.035)
  }

  /** 语音气泡：以短促共振峰序列模拟人声节奏 */
  voice()
  {
    this.tone(420, 0.06, 'sine', 0.05)
    this.tone(520, 0.05, 'sine', 0.045, 0.07)
    this.tone(460, 0.07, 'sine', 0.04, 0.13)
  }
}
