// 手机增强层：左侧虚拟摇杆（王者荣耀式）+ 中文界面
// 通过 scene.stickMove/stickLeave 直接驱动飞行，不再靠“点哪飞哪”。

const ZH = {
  INTEL: '操作',
  TUTORIAL: '教学',
  VIEW: '视角',
  LOOP: '筋斗',
  BOOST: '加力',
  GUN: '机炮',
  MISSILE: '导弹',
  KILLS: '击落',
  HULL: '机体',
  AMMO: '弹药',
  MSL: '导弹',
  ALT: '高度',
  SPD: '速度',
  TAP: '点一下开始',
  Tap: '双击',
  'Press Space': '按空格',
  FLY: '飞行',
  TRICKS: '特技',
  FIGHT: '空战',
  'BAIL OUT': '跳伞',
  CLOSE: '关闭',
  PAUSED: '暂停',
  ROLL: '横滚',
  'LOOP, FLOWN FOR YOU': '自动筋斗',
  CANNON: '机炮',
  'LOCK ON': '锁定',
  'DODGE A MISSILE': '躲导弹',
  COUNTER: '反击',
  'MOUSE + KEYS': '键鼠',
  CONTROLLER: '手柄',
  TOUCH: '触屏',
  'Tap outside to shut this. Tutorial flies you through it all.': '点空白处关闭。教学会带你飞一遍。',
  'Roll as the two rings meet': '两圈将重合时横滚',
  'Missile straight after a dodge fires three, and costs none': '躲完立刻放导弹，一次三发、不消耗',
  'Full climb with thrusters, held': '加力 + 满舵拉升，按住',
};

function translate(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const raw = node.nodeValue;
    const text = raw?.trim();
    if (!text) continue;
    const zh = ZH[text] || ZH[text.toUpperCase()];
    if (!zh) continue;
    node.nodeValue = raw.replace(text, zh);
  }
}

function init() {
  const scene = () => window.__fighterScene;
  if (!scene()) {
    window.setTimeout(init, 200);
    return;
  }

  // ---------- 样式 ----------
  const style = document.createElement('style');
  style.textContent = `
    #stickLayer { position: fixed; left: 0; top: 0; width: 50%; height: 100%;
      touch-action: none; z-index: 20; -webkit-tap-highlight-color: transparent; }
    #stickBase { position: fixed; width: 116px; height: 116px; margin: -58px 0 0 -58px;
      border-radius: 50%; border: 2px solid rgba(255,255,255,.22);
      background: radial-gradient(circle at 50% 45%, rgba(255,255,255,.06), rgba(6,14,26,.28) 70%);
      box-shadow: 0 6px 24px rgba(0,0,0,.35) inset; opacity: 0; transition: opacity .12s ease;
      pointer-events: none; z-index: 21; }
    #stickBase.on { opacity: 1; }
    #stickKnob { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px;
      border-radius: 50%; border: 2px solid rgba(255,255,255,.75);
      background: radial-gradient(circle at 40% 35%, rgba(255,255,255,.75), rgba(150,185,220,.28) 60%, rgba(20,40,70,.45));
      box-shadow: 0 4px 14px rgba(0,0,0,.45); }
    #stickHint { position: fixed; left: 22px; bottom: 152px; padding: 6px 10px; border-radius: 999px;
      background: rgba(11,18,32,.45); color: rgba(233,242,250,.85);
      font: 11px/1 system-ui, -apple-system, "PingFang SC", sans-serif; letter-spacing: .08em;
      pointer-events: none; z-index: 21; transition: opacity .3s ease; }
    #fighterAlt { position: fixed; left: 12px; top: 160px; width: 12px; height: 150px; z-index: 22;
      border-radius: 3px; border: 1px solid rgba(255,255,255,.28); background: rgba(8,18,32,.45);
      overflow: hidden; pointer-events: none; }
    #fighterAltFill { position: absolute; left: 0; right: 0; bottom: 0; height: 0%;
      background: linear-gradient(180deg, #8fe3ff, #2b8cff); }
    #fighterAltText { position: fixed; left: 4px; top: 314px; z-index: 22; pointer-events: none;
      color: rgba(233,242,250,.9); font: 10px/1.2 ui-monospace, monospace; letter-spacing: .06em; }
    #fighterHp { position: fixed; left: 50%; top: 10px; transform: translateX(-50%); width: 150px; height: 10px;
      z-index: 22; border-radius: 5px; border: 1px solid rgba(255,255,255,.3); background: rgba(8,18,32,.5);
      overflow: hidden; pointer-events: none; }
    #fighterHpFill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: #57d98a; transition: width .15s linear; }
    #fighterHpText { position: fixed; left: 50%; top: 24px; transform: translateX(-50%); z-index: 22; pointer-events: none;
      color: rgba(233,242,250,.85); font: 10px/1 ui-monospace, monospace; letter-spacing: .08em; }
    /* 按钮：更实的底色 + 按下反馈 */
    #root button {
      background-color: rgba(11,26,51,.78) !important;
      border-color: rgba(255,255,255,.42) !important;
      transition: transform .07s ease, background-color .07s ease, box-shadow .12s ease, border-color .07s ease;
    }
    #root button[data-pressed="1"] {
      transform: scale(.93) !important;
      background-color: rgba(255,255,255,.3) !important;
      border-color: #fff !important;
      box-shadow: 0 0 16px rgba(140,210,255,.85);
    }
    #fighterFs { position: fixed; left: 12px; bottom: 12px; width: 40px; height: 40px; z-index: 24;
      border-radius: 8px; border: 1px solid rgba(255,255,255,.45); background: rgba(11,26,51,.7);
      color: #e9f2fa; font: 18px/1 system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
      touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    #fighterRotate { position: fixed; inset: 0; z-index: 23; display: none; align-items: center; justify-content: center;
      pointer-events: none; }
    #fighterRotate span { padding: 10px 16px; border-radius: 999px; background: rgba(11,18,32,.6);
      color: #e9f2fa; font: 14px/1.4 system-ui, -apple-system, "PingFang SC", sans-serif; letter-spacing: .08em; }
    #fighterToast { position: fixed; left: 50%; bottom: 66px; transform: translateX(-50%); z-index: 24;
      padding: 8px 14px; border-radius: 999px; background: rgba(11,18,32,.75); color: #e9f2fa;
      font: 12px/1.4 system-ui, -apple-system, "PingFang SC", sans-serif; letter-spacing: .06em;
      opacity: 0; transition: opacity .2s ease; pointer-events: none; }
    #fighterToast.on { opacity: 1; }
    #fighterMap { position: fixed; left: 12px; top: 58px; width: 92px; height: 92px; z-index: 22;
      border-radius: 6px; border: 1px solid rgba(255,255,255,.22); background: rgba(8,18,32,.42);
      pointer-events: none; image-rendering: pixelated; }
    /* 把左侧的 视角/筋斗 挪到右边，给摇杆让位 */
    .fighter-sidebtn { left: auto !important; }
  `;
  document.head.appendChild(style);

  const layer = document.createElement('div');
  layer.id = 'stickLayer';
  const base = document.createElement('div');
  base.id = 'stickBase';
  const knob = document.createElement('div');
  knob.id = 'stickKnob';
  base.appendChild(knob);
  const hint = document.createElement('div');
  hint.id = 'stickHint';
  hint.textContent = '左侧拖动 · 摇杆飞行';
  document.body.append(layer, base, hint);

  // ---------- 把左侧按钮挪到右侧 ----------
  function redistribute() {
    const buttons = [...document.querySelectorAll('button')];
    const byText = (t) => buttons.find((b) => b.innerText.trim().toUpperCase() === t);
    const view = byText('VIEW') || byText('视角');
    const loop = byText('LOOP') || byText('筋斗');
    for (const [btn, top] of [[view, 132], [loop, 68]]) {
      if (!btn || btn.dataset.moved) continue;
      btn.dataset.moved = '1';
      btn.style.left = 'auto';
      btn.style.right = '14px';
      btn.style.top = top + 'px';
    }
  }

  // ---------- 摇杆 ----------
  const R = 56;
  let active = null;
  let homeX = 0, homeY = 0;
  let tapAt = 0, tapX = 0, tapY = 0, tapMoved = false, lastTap = 0;

  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onDown = (e) => {
    if (active !== null) return;
    active = e.pointerId;
    homeX = e.clientX;
    homeY = e.clientY;
    tapAt = Date.now();
    tapX = e.clientX;
    tapY = e.clientY;
    tapMoved = false;
    base.style.left = homeX + 'px';
    base.style.top = homeY + 'px';
    base.classList.add('on');
    setKnob(0, 0);
    hint.style.opacity = '0';
    layer.setPointerCapture(e.pointerId);
    scene()?.stickMove(0, 0);
    e.preventDefault();
  };

  const onMove = (e) => {
    if (active !== e.pointerId) return;
    let dx = e.clientX - homeX;
    let dy = e.clientY - homeY;
    const len = Math.hypot(dx, dy);
    if (Math.hypot(e.clientX - tapX, e.clientY - tapY) > 12) tapMoved = true;
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    setKnob(dx, dy);
    // 屏幕 y 向下，飞行 y 向上
    scene()?.stickMove(dx / R, -dy / R);
    e.preventDefault();
  };

  const onUp = (e) => {
    if (active !== e.pointerId) return;
    active = null;
    base.classList.remove('on');
    setKnob(0, 0);
    scene()?.stickLeave();
    try { layer.releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
    const now = Date.now();
    if (!tapMoved && now - tapAt < 260) {
      if (now - lastTap < 320) {
        lastTap = 0;
        scene()?.press();
        scene()?.release(); // 双击横滚
      } else {
        lastTap = now; // 单击不横滚
      }
    }
  };

  layer.addEventListener('pointerdown', onDown);
  layer.addEventListener('pointermove', onMove);
  layer.addEventListener('pointerup', onUp);
  layer.addEventListener('pointercancel', onUp);

  // ---------- 按钮按下反馈 ----------
  const flash = (el, on) => {
    if (!el) return;
    // 用 data 属性而不是 class：React 重渲染会重置 className，但不会动 data-*
    if (on) el.dataset.pressed = '1';
    else delete el.dataset.pressed;
    if (on && navigator.vibrate) { try { navigator.vibrate(12); } catch { /* 有的浏览器不支持 */ } }
  };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (b && b.id !== 'fighterFs') flash(b, true);
  }, true);
  const unflash = (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (b) setTimeout(() => flash(b, false), 90);
  };
  document.addEventListener('pointerup', unflash, true);
  document.addEventListener('pointercancel', unflash, true);

  // ---------- 全屏 / 横屏 ----------
  const toast = document.createElement('div');
  toast.id = 'fighterToast';
  document.body.appendChild(toast);
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('on'), 2600);
  };

  const fsBtn = document.createElement('button');
  fsBtn.id = 'fighterFs';
  fsBtn.type = 'button';
  fsBtn.title = '全屏';
  fsBtn.textContent = '⛶';
  fsBtn.addEventListener('click', async () => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    try { await req?.call(el); } catch { /* 忽略 */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* iPhone 不支持 */ }
    if (!document.fullscreenElement) say('当前浏览器不支持网页全屏/强制横屏，请手动把手机横过来');
  });
  document.body.appendChild(fsBtn);

  const rot = document.createElement('div');
  rot.id = 'fighterRotate';
  rot.innerHTML = '<span>↻ 把手机横过来玩</span>';
  document.body.appendChild(rot);
  let rotTimer = 0;
  const checkOrient = () => {
    const portrait = window.innerHeight > window.innerWidth;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (portrait && coarse) {
      rot.style.display = 'flex';
      rot.style.opacity = '1';
      clearTimeout(rotTimer);
      rotTimer = setTimeout(() => { rot.style.transition = 'opacity .6s ease'; rot.style.opacity = '0'; }, 6000);
    } else {
      rot.style.display = 'none';
    }
  };
  checkOrient();
  window.addEventListener('resize', checkOrient);
  window.addEventListener('orientationchange', () => setTimeout(checkOrient, 200));

  // ---------- 高度条 / 血量条 ----------
  const altBox = document.createElement('div');
  altBox.id = 'fighterAlt';
  const altFill = document.createElement('div');
  altFill.id = 'fighterAltFill';
  altBox.appendChild(altFill);
  const altText = document.createElement('div');
  altText.id = 'fighterAltText';
  altText.textContent = '高度 0';
  const hpBox = document.createElement('div');
  hpBox.id = 'fighterHp';
  const hpFill = document.createElement('div');
  hpFill.id = 'fighterHpFill';
  hpBox.appendChild(hpFill);
  const hpText = document.createElement('div');
  hpText.id = 'fighterHpText';
  hpText.textContent = '机体';
  document.body.append(altBox, altText, hpBox, hpText);

  const updateBars = () => {
    const sc = scene();
    const me = sc?.radar?.me;
    if (!me) return;
    const z = me.z;
    const top = Math.max(300, z * 1.15);
    altFill.style.height = Math.max(2, Math.min(100, (z / top) * 100)) + '%';
    altText.textContent = '高度 ' + Math.round(z);
    const hull = sc.hull ?? 0;
    const max = sc.hullMax || 1;
    const r = Math.max(0, Math.min(1, hull / max));
    hpFill.style.width = r * 100 + '%';
    hpFill.style.background = r > 0.6 ? '#57d98a' : r > 0.3 ? '#ffd45c' : '#ff5a47';
    hpText.textContent = '机体 ' + hull + ' / ' + max;
  };
  setInterval(updateBars, 200);

  // ---------- 小地图 ----------
  const mapCanvas = document.createElement('canvas');
  mapCanvas.id = 'fighterMap';
  mapCanvas.width = 128;
  mapCanvas.height = 128;
  document.body.appendChild(mapCanvas);
  const mapCtx = mapCanvas.getContext('2d');
  let world = null;

  const drawMap = () => {
    const sc = scene();
    if (!sc) return;
    if (!world) world = sc.mapInfo ? sc.mapInfo() : null;
    if (!world) return;
    const { size, data, spawnX, spawnY } = world;
    const r = sc.radar;
    mapCtx.clearRect(0, 0, 128, 128);
    mapCtx.fillStyle = 'rgba(30,70,120,.55)';
    mapCtx.fillRect(0, 0, 128, 128);
    mapCtx.fillStyle = 'rgba(96,168,96,.85)';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[y * size + x]) mapCtx.fillRect(x, y, 1, 1);
      }
    }
    const px = (v) => ((v % 2048) + 2048) % 2048 / 2048 * 128;
    // 出生点
    mapCtx.fillStyle = 'rgba(120,220,255,.95)';
    mapCtx.fillRect(px(spawnX) - 1.5, px(spawnY) - 1.5, 3, 3);
    // 敌机
    if (r?.foes) {
      mapCtx.fillStyle = 'rgba(255,90,70,.95)';
      for (const f of r.foes) if (f.state === 0) mapCtx.fillRect(px(f.x) - 1, px(f.y) - 1, 2, 2);
    }
    // 自己
    if (r?.me) {
      const mx = px(r.me.x), my = px(r.me.y);
      mapCtx.save();
      mapCtx.translate(mx, my);
      mapCtx.rotate(-r.me.yaw + Math.PI / 2);
      mapCtx.fillStyle = 'rgba(255,255,255,.95)';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -4);
      mapCtx.lineTo(2.6, 3);
      mapCtx.lineTo(-2.6, 3);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    }
  };
  setInterval(drawMap, 350);

  // ---------- 中文 ----------
  translate();
  redistribute();
  const mo = new MutationObserver(() => {
    translate();
    redistribute();
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
