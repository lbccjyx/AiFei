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
