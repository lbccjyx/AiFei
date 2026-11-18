const fs = require('fs');
const p = 'src/overlay.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace("width: 132px; height: 132px; margin: -66px 0 0 -66px;\n      border-radius: 50%; border: 2px solid rgba(255,255,255,.28);",
  "width: 116px; height: 116px; margin: -58px 0 0 -58px;\n      border-radius: 50%; border: 2px solid rgba(255,255,255,.22);");
s = s.replace("background: radial-gradient(circle at 50% 45%, rgba(255,255,255,.10), rgba(6,14,26,.35) 70%);",
  "background: radial-gradient(circle at 50% 45%, rgba(255,255,255,.06), rgba(6,14,26,.28) 70%);");
s = s.replace("width: 58px; height: 58px; margin: -29px 0 0 -29px;", "width: 52px; height: 52px; margin: -26px 0 0 -26px;");
s = s.replace("background: radial-gradient(circle at 40% 35%, rgba(255,255,255,.85), rgba(160,190,220,.35) 60%, rgba(20,40,70,.55));",
  "background: radial-gradient(circle at 40% 35%, rgba(255,255,255,.75), rgba(150,185,220,.28) 60%, rgba(20,40,70,.45));");
s = s.replace("for (const [btn, top] of [[view, 130], [loop, 66]]) {", "for (const [btn, top] of [[view, 132], [loop, 68]]) {");
s = s.replace("btn.style.right = '150px';", "btn.style.right = '14px';");
fs.writeFileSync(p, s);
console.log('patched overlay');
