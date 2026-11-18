const fs = require('fs');
const p = 'src/components/fighter-jet-eject.js';
let s = fs.readFileSync(p, 'utf8');
const pairs = [
  ['children: ["Kills "', 'children: ["击落 "'],
  ["'aria-label': `Hull ", "'aria-label': `机体 "],
  ["['Turn', 'Drag left or right']", "['转向', '左右拖动摇杆']"],
  ["['Climb / dive', o.stick ? 'Drag down to climb, up to dive' : 'Drag up to climb, down to dive']", "['拉升 / 俯冲', '摇杆上推拉升，下推俯冲']"],
  ["['Thrusters', 'Hold Boost']", "['加力', '按住「加力」']"],
  ["['Change view', 'View']", "['切换视角', '「视角」按钮']"],
  ["touch ? 'Tap' : 'Click'", "touch ? '轻点屏幕' : '点击'"],
  ["['Back flip', 'Full climb with thrusters, held']", "['后空翻', '加力 + 满舵拉升，按住']"],
  ["['Front flip', 'Full dive with thrusters, held. Needs height.']", "['前空翻', '加力 + 满舵俯冲，按住（要有高度）']"],
  ["touch ? 'Loop' : 'F back · G forward'", "touch ? '筋斗' : 'F 后翻 · G 前翻'"],
  ["['Eject', 'Hold a dive into the ground, thrusters off']", "['弹射', '收加力，俯冲撞地']"],
  ["touch ? 'Hold Gun' : 'Hold right mouse'", "touch ? '按住「机炮」' : '按住右键'"],
  ["['Lock on', 'Keep an enemy ahead until the box turns red']", "['锁定', '敌机保持在正前方，框变红就是锁上了']"],
  ["touch ? 'Missile' : 'M'", "touch ? '「导弹」' : 'M'"],
  ["['Ammo', `${load}. Run out and it takes ${+o.reload.toFixed(1)} s to reload`]", "['弹药', `${load}。打空后 ${+o.reload.toFixed(1)} 秒装填`]"],
];
let n = 0;
for (const [from, to] of pairs) {
  if (s.includes(from)) { s = s.split(from).join(to); n++; } else console.log('MISS:', from.slice(0, 50));
}
fs.writeFileSync(p, s);
console.log('replaced', n, 'of', pairs.length);
