/* ------------------------------------------------------------------
 * 在场同步客户端
 * 与服务端 /ws/presence 对接；断线自动重连，异常时静默降级为单机
 * ----------------------------------------------------------------*/

export default class Presence {
  /**
   * @param {object} opt
   * @param {string} opt.url      ws 地址（含 room/name 查询参数）
   * @param {Function} opt.onWelcome  (payload) => void
   * @param {Function} opt.onJoin     (player) => void
   * @param {Function} opt.onLeft     (id) => void
   * @param {Function} opt.onMove     (msg) => void
   * @param {Function} opt.onAct      (msg) => void
   * @param {Function} opt.onCount    (n) => void
   */
  constructor(opt) {
    this.opt = opt;
    this.ws = null;
    this.connected = false;
    this.retry = 0;
    this.closed = false;
    this.lastSent = 0;
    this.pending = [];
  }

  connect() {
    if (this.closed) return;
    try {
      this.ws = new WebSocket(this.opt.url);
    } catch (e) {
      this.scheduleRetry();
      return;
    }
    this.ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.pending.splice(0).forEach((m) => this.ws.send(m));
    };
    this.ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      const o = this.opt;
      if (msg.t === 'welcome') {
        this.id = msg.id;
        (o.onWelcome || (() => {}))(msg);
        (msg.players || []).forEach((p) => (o.onJoin || (() => {}))(p));
      } else if (msg.t === 'join') (o.onJoin || (() => {}))(msg);
      else if (msg.t === 'left') (o.onLeft || (() => {}))(msg.id);
      else if (msg.t === 'move') (o.onMove || (() => {}))(msg);
      else if (msg.t === 'act') (o.onAct || (() => {}))(msg);
      else if (msg.t === 'count') (o.onCount || (() => {}))(msg.n);
      else if (msg.t === 'lantern') (o.onLantern || (() => {}))(msg);
      else if (msg.t === 'tile') (o.onTile || (() => {}))(msg);
      else if (msg.t === 'incense') (o.onIncense || (() => {}))(msg);
      else if (msg.t === 'error') (o.onError || (() => {}))(msg);
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.scheduleRetry();
    };
    this.ws.onerror = () => { /* 交给 onclose 处理 */ };
  }

  scheduleRetry() {
    if (this.closed) return;
    this.retry += 1;
    const wait = Math.min(15000, 1000 * 2 ** Math.min(this.retry, 4));
    setTimeout(() => this.connect(), wait);
  }

  send(obj) {
    const line = JSON.stringify(obj);
    if (this.connected && this.ws && this.ws.readyState === 1) this.ws.send(line);
    else if (this.pending.length < 12) this.pending.push(line);
  }

  /** 位置节流上报，默认 8Hz，够用且省流量 */
  sendMove(x, z, ry) {
    const now = performance.now();
    if (now - this.lastSent < 125) return;
    this.lastSent = now;
    this.send({ t: 'move', x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(2) });
  }

  sendAct(a) { this.send({ t: 'act', a }); }

  close() {
    this.closed = true;
    if (this.ws) this.ws.close();
  }
}
