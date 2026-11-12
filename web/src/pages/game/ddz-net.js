/**
 * @file 斗地主 WebSocket 客户端。
 * 与后端约定：每条消息为一行 JSON，形如 {"cmd":"play","data":{...}}。
 */

/** 牌局阶段枚举，与后端 Phase 对齐 */
export const PHASE = {
  WAITING: 0,
  BIDDING: 1,
  DOUBLING: 2,
  PLAYING: 3,
  SETTLED: 4
};

/**
 * 牌局网络客户端，负责连接、重连与消息分发。
 */
export default class DdzNet {
  /**
   * @param {string} url WebSocket 地址
   */
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = {};
    this.queue = [];
    this.connected = false;
    this.retry = 0;
  }

  /**
   * 注册消息处理器
   * @param {string} cmd 指令名
   * @param {Function} fn 回调，入参为 data
   * @returns {DdzNet} 支持链式调用
   */
  on(cmd, fn) {
    this.handlers[cmd] = fn;
    return this;
  }

  /**
   * 建立连接
   * @returns {Promise<void>} 连接成功后 resolve
   */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.retry = 0;
        this.queue.splice(0).forEach((line) => ws.send(line));
        resolve();
      };
      ws.onmessage = (evt) => this.handleMessage(evt.data);
      ws.onclose = () => {
        this.connected = false;
        this.scheduleReconnect();
      };
      ws.onerror = () => reject(new Error('连接失败'));
    });
  }

  /**
   * 断线后按指数退避重连，最多 6 次
   */
  scheduleReconnect() {
    if (this.retry >= 6) {
      return;
    }
    this.retry += 1;
    const delay = Math.min(1000 * this.retry, 5000);
    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  /**
   * 解析下行消息并派发
   * @param {string|Blob} raw 原始消息
   */
  async handleMessage(raw) {
    let text = raw;
    if (raw instanceof Blob) {
      text = await raw.text();
    }
    if (typeof text !== 'string') {
      return;
    }
    text.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      let msg = null;
      try {
        msg = JSON.parse(trimmed);
      } catch (err) {
        return;
      }
      const fn = this.handlers[msg.cmd];
      if (fn) {
        fn(msg.data);
      }
    });
  }

  /**
   * 发送指令
   * @param {string} cmd 指令名
   * @param {Object} data 载荷
   */
  send(cmd, data = {}) {
    const line = JSON.stringify({ cmd, data }) + '\n';
    if (this.connected && this.ws && this.ws.readyState === 1) {
      this.ws.send(line);
      return;
    }
    this.queue.push(line);
  }
}
