// 爱菲飞行员 · 老鹰版
// 纯 canvas 像素飞行：展翅滑翔 / 扇翅 / 收翅俯冲，靠热气流爬升。
(() => {
  'use strict';

  // ---------- 基础 ----------
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const W = 360;
  const H = 210;
  const fb = document.createElement('canvas');
  fb.width = W;
  fb.height = H;
  const fctx = fb.getContext('2d');
  const img = fctx.createImageData(W, H);
  const buf = new Uint32Array(img.data.buffer);

  let scale = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    scale = Math.max(1, Math.round((cssW / W) * 10) / 10);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);

  // ---------- 噪声与地形 ----------
  function hash2(x, y) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash2(xi, yi), b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    const u = smooth(xf), v = smooth(yf);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function terrain(x, z) {
    // 米：海平面 0，山最高约 300
    const n = noise2(x * 0.0032, z * 0.0032) * 0.62
      + noise2(x * 0.0091, z * 0.0091) * 0.26
      + noise2(x * 0.028, z * 0.028) * 0.12;
    return (n - 0.46) * 460;
  }

  // ---------- 热气流 ----------
  const CELL = 260;
  function thermalAt(x, z, alt) {
    let sum = 0;
    const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL);
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      for (let i = i0 - 1; i <= i0 + 1; i++) {
        const h = hash2(i * 7 + 1, j * 13 + 3);
        if (h < 0.42) continue;
        const cx = (i + 0.5) * CELL + (hash2(i, j) - 0.5) * 110;
        const cz = (j + 0.5) * CELL + (hash2(i + 3, j + 5) - 0.5) * 110;
        const r = 95 + h * 85;
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r) continue;
        const k = 1 - Math.sqrt(d2) / r;
        sum += (3.2 + h * 4.2) * k * k * Math.min(1, alt / 80);
      }
    }
    return sum;
  }

  // ---------- 状态 ----------
  const G = 9.8;
  const state = {
    x: 0, z: 0, alt: 220,
    yaw: 0, gamma: 0, bank: 0,
    speed: 14, stamina: 100,
    flap: false, tuck: false,
    vy: 0, alive: true, t: 0, best: 0, msg: '', msgT: 0,
  };
  const stick = { x: 0, y: 0, active: false };

  function reset(msg) {
    state.x = 0; state.z = 0; state.alt = 260;
    state.yaw = 0; state.gamma = 0; state.bank = 0;
    state.speed = 15; state.stamina = 100; state.vy = 0;
    state.alive = true;
    if (msg) { state.msg = msg; state.msgT = 2.6; }
  }

  // ---------- 物理 ----------
  function step(dt) {
    const s = state;
    s.t += dt;
    if (s.msgT > 0) s.msgT -= dt;

    const flap = s.flap && s.stamina > 0 && s.alive;
    if (flap) s.stamina = Math.max(0, s.stamina - 19 * dt);
    else s.stamina = Math.min(100, s.stamina + 7 * dt);

    const wantGamma = -stick.y * 0.62;
    s.gamma += (wantGamma - s.gamma) * (1 - Math.exp(-dt * 5));
    const wantBank = stick.x * 1.15;
    s.bank += (wantBank - s.bank) * (1 - Math.exp(-dt * 5));

    const tuck = s.tuck && s.alive;
    const drag = 0.0021 * s.speed * s.speed * (tuck ? 0.45 : 1);
    s.speed += (-G * Math.sin(s.gamma) * 1.15 - drag + (flap ? 5.2 : 0) - (tuck ? 1.5 : 0)) * dt;
    s.speed = Math.max(6.5, Math.min(52, s.speed));

    const stall = s.speed < 10.5 ? (10.5 - s.speed) * 1.1 : 0;
    const therm = thermalAt(s.x, s.z, s.alt);
    s.vy = s.speed * Math.sin(s.gamma)
      - 1.25
      - (tuck ? 6.8 : 0)
      - stall
      + therm
      + (flap ? 3.4 : 0);

    s.alt += s.vy * dt;
    const yawRate = (G * Math.tan(Math.max(-1.2, Math.min(1.2, s.bank)))) / Math.max(10, s.speed);
    s.yaw += yawRate * dt;
    s.x += Math.sin(s.yaw) * s.speed * dt;
    s.z += Math.cos(s.yaw) * s.speed * dt;

    const ground = terrain(s.x, s.z);
    if (s.alt < ground + 2.2) {
      if (s.alive) {
        s.alive = false;
        s.alt = ground + 2.2;
        s.speed = 0;
        s.msg = '落地了 · 点屏幕重来';
        s.msgT = 999;
      }
    }
    if (s.alt > 2400) { s.alt = 2400; s.vy = Math.min(0, s.vy); }
  }

  // ---------- 渲染：天空 + 地形（体素列） ----------
  const FOV = 1.15;
  const focal = W / (2 * Math.tan(FOV / 2));
  const FOG = 1100;

  const pack = (r, g, b) => (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
  // 缓冲区里的颜色是 ABGR：r = 低 8 位
  function mix(c1, c2, k) {
    const r = (c1 & 255) + ((c2 & 255) - (c1 & 255)) * k;
    const g = ((c1 >> 8) & 255) + (((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * k;
    const b = ((c1 >> 16) & 255) + (((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * k;
    return (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
  }
  function dim(c, k) {
    const r = (c & 255) * k, g = ((c >> 8) & 255) * k, b = ((c >> 16) & 255) * k;
    return (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
  }

  const SKY_TOP = pack(64, 132, 206);
  const SKY_BOT = pack(188, 219, 238);
  function skyColor(y, horizon) {
    const k = Math.max(0, Math.min(1, y / Math.max(1, horizon)));
    return mix(SKY_TOP, SKY_BOT, Math.pow(k, 0.75));
  }

  // 云：一片固定的世界坐标，靠近了才画
  const clouds = [];
  (function seedClouds() {
    for (let i = 0; i < 140; i++) {
      const a = hash2(i * 3 + 11, 7) * Math.PI * 2;
      const r = 300 + hash2(i * 5 + 3, 19) * 2600;
      clouds.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        y: 240 + hash2(i * 7 + 5, 23) * 900,
        s: 28 + hash2(i * 11 + 9, 29) * 74,
        k: hash2(i * 13 + 1, 31),
      });
    }
  })();

  // 热气流里的浮尘，帮玩家看见气流柱
  const dust = [];
  for (let i = 0; i < 260; i++) {
    dust.push({ a: Math.random() * 6.283, r: Math.random() * 60, h: Math.random() * 320, cell: null, i: Math.random(), j: Math.random() });
  }

  function project(wx, wy, wz, s, hz, focal, sinY, cosY) {
    const dx = wx - s.x, dz = wz - s.z;
    const rx = dx * cosY - dz * sinY;
    const rz = dx * sinY + dz * cosY;
    if (rz < 3) return null;
    const ry = wy - s.alt;
    const p = s.gamma * 0.55;
    const ry2 = ry * Math.cos(p) - rz * Math.sin(p);
    const rz2 = ry * Math.sin(p) + rz * Math.cos(p);
    if (rz2 < 2) return null;
    return { x: W / 2 + (rx / rz2) * focal, y: hz - (ry2 / rz2) * focal, d: rz2 };
  }

  function render() {
    const s = state;
    const hz = Math.max(8, Math.min(H - 8, H * 0.46 + Math.sin(s.gamma) * 120 - (s.alt - 160) * 0.05));
    const sinY = Math.sin(s.yaw), cosY = Math.cos(s.yaw);
    const camAlt = s.alt;

    // 天空
    for (let y = 0; y < H; y++) {
      const c = skyColor(y, hz);
      const row = y * W;
      for (let x = 0; x < W; x++) buf[row + x] = c;
    }
    // 太阳
    const sunX = W * 0.74, sunY = hz * 0.42;
    for (let y = Math.max(0, sunY - 30); y < Math.min(hz, sunY + 30); y++) {
      for (let x = Math.max(0, sunX - 30); x < Math.min(W, sunX + 30); x++) {
        const d = Math.hypot(x - sunX, y - sunY);
        if (d < 13) buf[(y | 0) * W + (x | 0)] = pack(255, 246, 220);
        else if (d < 22) buf[(y | 0) * W + (x | 0)] = mix(buf[(y | 0) * W + (x | 0)], pack(255, 240, 200), 0.4);
      }
    }

    // 云（远到近）
    const sorted = clouds
      .map((c) => ({ c, p: project(c.x, c.y, c.z, s, hz, focal, sinY, cosY) }))
      .filter((o) => o.p && o.p.d > 180 && o.p.d < 3200)
      .sort((a, b) => b.p.d - a.p.d);
    for (const { c, p } of sorted) {
      const r = (c.s / p.d) * focal * 0.5;
      if (r < 1.5) continue;
      const cx = Math.round(p.x), cy = Math.round(p.y);
      const alpha = Math.max(0, Math.min(1, 1 - p.d / 3200));
      const top = mix(pack(168, 190, 214), pack(252, 253, 255), alpha);
      const bottom = mix(pack(150, 172, 200), pack(214, 224, 238), alpha);
      for (let y = -r; y <= r; y += 1) {
        const w = Math.sqrt(Math.max(0, r * r - y * y)) * 1.35;
        const py = Math.round(cy + y);
        if (py < 0 || py >= hz) continue;
        const k = (y + r) / (2 * r);
        const col = mix(top, bottom, k * k);
        for (let x = -w; x <= w; x += 1) {
          const px = Math.round(cx + x);
          if (px < 0 || px >= W) continue;
          buf[py * W + px] = col;
        }
      }
    }

    // 地形列
    const ybuf = new Int16Array(W).fill(H);
    for (let x = 0; x < W; x++) {
      const a = (x / W - 0.5) * FOV;
      const sa = Math.sin(a), ca = Math.cos(a);
      const dx = sinY * ca + cosY * sa;
      const dz = cosY * ca - sinY * sa;
      let d = 3;
      let prevTh = 0;
      while (d < 1500) {
        const wx = s.x + dx * d;
        const wz = s.z + dz * d;
        const th = terrain(wx, wz);
        const sy = hz + ((camAlt - th) * focal) / d;
        if (sy < ybuf[x]) {
          const top = Math.max(0, Math.round(sy));
          const bot = Math.round(ybuf[x]);
          if (bot > top) {
            let col;
            if (th < -30) col = mix(pack(16, 54, 96), pack(30, 86, 132), Math.min(1, (-th - 30) / 130));
            else if (th < -3) col = mix(pack(34, 96, 144), pack(70, 148, 182), Math.min(1, (th + 30) / 27));
            else if (th < 6) col = pack(202, 190, 140);
            else if (th < 110) col = mix(pack(48, 104, 54), pack(112, 170, 92), (th - 6) / 104);
            else if (th < 200) col = mix(pack(96, 94, 86), pack(150, 146, 136), (th - 110) / 90);
            else col = pack(228, 233, 238);

            const slope = (th - prevTh) / Math.max(1, d * 0.03);
            let shade = 1 + Math.max(-0.3, Math.min(0.36, slope * 0.11));
            shade *= 0.9 + hash2(wx * 0.8, wz * 0.8) * 0.2;
            let lit = dim(col, shade);
            const fog = Math.min(0.5, Math.pow(d / 900, 1.5));
            if (fog > 0.01) lit = mix(lit, pack(176, 206, 228), fog);
            for (let y = top; y < bot; y++) buf[y * W + x] = lit;
          }
          ybuf[x] = top;
        }
        prevTh = th;
        d *= 1.05;
        if (ybuf[x] <= 0) break;
      }
    }

    // 热气流柱子：浮尘往上飘
    for (const p of dust) {
      p.h += 26 * 0.016;
      if (p.h > 340) p.h = 0;
    }
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const ii = Math.floor(s.x / CELL) + i, jj = Math.floor(s.z / CELL) + j;
        const hh = hash2(ii * 7 + 1, jj * 13 + 3);
        if (hh < 0.58) continue;
        const cx = (ii + 0.5) * CELL + (hash2(ii, jj) - 0.5) * 110;
        const cz = (jj + 0.5) * CELL + (hash2(ii + 3, jj + 5) - 0.5) * 110;
        for (let n = 0; n < 26; n++) {
          const ang = (n / 26) * 6.283 + s.t * 0.4;
          const rr = 20 + (n % 5) * 12;
          const wx = cx + Math.cos(ang) * rr;
          const wz = cz + Math.sin(ang) * rr;
          const h = ((n * 37 + s.t * 40) % 300) + 4;
          const p = project(wx, h, wz, s, hz, focal, sinY, cosY);
          if (!p || p.d > 420) continue;
          const px = Math.round(p.x), py = Math.round(p.y);
          if (px < 2 || px > W - 3 || py < 1 || py > H - 2) continue;
          const c = mix(buf[py * W + px], pack(244, 250, 255), 0.75);
          buf[py * W + px] = c;
          buf[py * W + px + 1] = c;
          buf[(py + 1) * W + px] = c;
        }
      }
    }

    fctx.putImageData(img, 0, 0);

    const cw = canvas.width, ch = canvas.height;
    const dpr = cw / (canvas.clientWidth || cw);
    const vw = cw / dpr, vh = ch / dpr;
    const k = Math.max(vw / W, vh / H);
    const dw = W * k, dh = H * k;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fb, (vw - dw) / 2, (vh - dh) / 2, dw, dh);

    drawEagle(ctx, vw / 2, vh * 0.55, k);
  }

  // ---------- 老鹰 ----------
  function wingTuck() { return state.tuck ? 1 : 0; }
  function wingFlapPhase() { return state.flap && state.stamina > 0 ? Math.sin(state.t * 9.5) : 0; }

  function drawEagle(g, cx, cy, k) {
    const s = state;
    const size = Math.min(150, 58 + 26 * (k / 2));
    const flap = wingFlapPhase();
    const tuck = wingTuck();
    const lift = 1 - tuck * 0.82;

    const BODY = '#4a3020';
    const BODY_LIGHT = '#7a5537';
    const WING = '#5d4029';
    const WING_DARK = '#3b2717';
    const HEAD = '#e8e2d6';
    const BEAK = '#e5a93c';

    g.save();
    g.translate(cx, cy);
    g.rotate(s.bank * 0.5);
    // 俯仰：机头随爬升角上下
    g.rotate(-s.gamma * 0.18);

    const wingY = -size * 0.02 + flap * size * 0.16;
    const lift2 = (0.55 - flap * 0.5) * (1 - tuck * 0.85);

    // 尾羽（扇形三片）
    g.fillStyle = WING_DARK;
    for (const dx of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(dx * size * 0.03, size * 0.26);
      g.lineTo(dx * size * 0.13, size * 0.56);
      g.lineTo(dx * size * 0.13 + size * 0.09, size * 0.5);
      g.closePath();
      g.fill();
    }

    // 翅膀
    for (const dir of [-1, 1]) {
      const span = size * (1.05 - 0.62 * tuck);
      const tipX = dir * span;
      const tipY = wingY - span * 0.30 * lift2;
      g.fillStyle = WING;
      g.beginPath();
      g.moveTo(dir * size * 0.07, wingY - size * 0.04);
      g.quadraticCurveTo(dir * span * 0.42, wingY - size * 0.26 * (0.4 + lift2), tipX, tipY);
      // 后缘：四段羽毛
      const feathers = 4;
      for (let i = feathers; i >= 1; i--) {
        const f = i / feathers;
        const bx = dir * span * (0.35 + 0.6 * f);
        const by = tipY + (wingY - tipY) * (1 - f) * 0.55 + size * 0.10;
        g.lineTo(bx, by);
        if (i > 1) g.lineTo(bx - dir * span * 0.06, by - size * 0.05);
      }
      g.quadraticCurveTo(dir * span * 0.3, wingY + size * 0.06, dir * size * 0.07, wingY + size * 0.08);
      g.closePath();
      g.fill();

      // 翼尖深色
      g.fillStyle = WING_DARK;
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(tipX - dir * span * 0.26, tipY + size * 0.10);
      g.lineTo(tipX - dir * span * 0.10, tipY + size * 0.16);
      g.closePath();
      g.fill();
    }

    // 身体
    g.fillStyle = BODY;
    g.beginPath();
    g.ellipse(0, size * 0.02, size * 0.095, size * 0.30, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = BODY_LIGHT;
    g.beginPath();
    g.ellipse(0, size * 0.06, size * 0.055, size * 0.22, 0, 0, Math.PI * 2);
    g.fill();

    // 头
    g.fillStyle = HEAD;
    g.beginPath();
    g.ellipse(0, -size * 0.30, size * 0.072, size * 0.078, 0, 0, Math.PI * 2);
    g.fill();
    // 钩状喙
    g.fillStyle = BEAK;
    g.beginPath();
    g.moveTo(size * 0.005, -size * 0.335);
    g.lineTo(size * 0.075, -size * 0.30);
    g.quadraticCurveTo(size * 0.045, -size * 0.265, size * 0.005, -size * 0.262);
    g.closePath();
    g.fill();
    // 眼
    g.fillStyle = '#241a12';
    g.beginPath();
    g.arc(size * 0.028, -size * 0.315, size * 0.014, 0, Math.PI * 2);
    g.fill();

    g.restore();
  }

  // ---------- 主循环 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.alive) step(dt);
    else if (state.msgT === 999) { /* 等点击 */ }
    render();
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---------- HUD ----------
  const hud = {
    alt: document.getElementById('h-alt'),
    spd: document.getElementById('h-spd'),
    vy: document.getElementById('h-vy'),
    wing: document.getElementById('h-wing'),
    sta: document.getElementById('h-sta'),
    therm: document.getElementById('h-therm'),
    msg: document.getElementById('h-msg'),
  };
  function updateHud() {
    const s = state;
    hud.alt.textContent = Math.round(s.alt) + ' m';
    hud.spd.textContent = Math.round(s.speed * 3.6) + ' km/h';
    const vy = s.vy;
    hud.vy.textContent = (vy >= 0 ? '+' : '') + vy.toFixed(1) + ' m/s';
    hud.vy.style.color = vy > 0.4 ? '#5fe08a' : vy < -4 ? '#ff7a5c' : '#e9f2fa';
    hud.wing.textContent = s.tuck ? '收翅 · 俯冲' : s.flap && s.stamina > 0 ? '扇翅' : '展翅 · 滑翔';
    hud.sta.style.width = s.stamina + '%';
    hud.sta.style.background = s.stamina > 40 ? '#5fe08a' : s.stamina > 15 ? '#ffd45c' : '#ff6b52';
    const therm = thermalAt(s.x, s.z, s.alt);
    hud.therm.textContent = therm > 1.2 ? '热气流 +' + therm.toFixed(1) : '没有气流 · 在掉高度';
    hud.therm.style.color = therm > 1.2 ? '#8fe3ff' : 'rgba(233,242,250,.55)';
    hud.msg.textContent = s.msgT > 0 ? s.msg : '';
    hud.msg.style.opacity = s.msgT > 0 ? 1 : 0;
  }

  // ---------- 输入 ----------
  const layer = document.getElementById('stickLayer');
  const base = document.getElementById('stickBase');
  const knob = document.getElementById('stickKnob');
  const R = 54;
  let active = null, homeX = 0, homeY = 0;

  function setStick(dx, dy) {
    let x = dx / R, y = dy / R;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    stick.x = x; stick.y = y;
    knob.style.transform = `translate(${x * R}px, ${y * R}px)`;
  }

  layer.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId;
    homeX = e.clientX; homeY = e.clientY;
    base.style.left = homeX + 'px';
    base.style.top = homeY + 'px';
    base.classList.add('on');
    setStick(0, 0);
    layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  layer.addEventListener('pointermove', (e) => {
    if (active !== e.pointerId) return;
    setStick(e.clientX - homeX, e.clientY - homeY);
    e.preventDefault();
  });
  const end = (e) => {
    if (active !== e.pointerId) return;
    active = null;
    base.classList.remove('on');
    setStick(0, 0);
    stick.x = 0; stick.y = 0;
    try { layer.releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);

  function bindHold(id, prop) {
    const el = document.getElementById(id);
    const on = (e) => {
      e.preventDefault();
      e.stopPropagation();
      state[prop] = true;
      el.dataset.pressed = '1';
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* 不支持 */ } }
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const off = () => { state[prop] = false; delete el.dataset.pressed; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }
  bindHold('btnFlap', 'flap');
  bindHold('btnTuck', 'tuck');

  document.getElementById('h-msg').addEventListener('pointerdown', () => {
    if (!state.alive) { state.msgT = 0; reset('再来一次'); }
  });
  canvas.addEventListener('pointerdown', () => {
    if (!state.alive) { state.msgT = 0; reset('再来一次'); }
  });

  // ---------- 启动 ----------
  window.__eagle = state;
  resize();
  reset('享受飞行 · 找到热气流就能越飞越高');
  requestAnimationFrame(frame);
})();
