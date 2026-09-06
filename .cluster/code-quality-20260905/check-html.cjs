const fs = require('fs');
const h = fs.readFileSync('D:/multi-agent/DELIVERY/code-quality-audit-report.html', 'utf8');
const c = (re) => (h.match(re) || []).length;
const checks = {
  sections: c(/<section class="chapter"/g),
  h2: c(/<h2/g), h3: c(/<h3/g), h4: c(/<h4/g),
  tables: c(/<table>/g), tablesClosed: c(/<\/table>/g),
  divOpen: c(/<div[\s>]/g), divClose: c(/<\/div>/g),
  sectionClose: c(/<\/section>/g),
  links: c(/<a href/g),
  scripts: c(/<script/g),
  sevBadges: c(/class="sev /g),
  verTags: c(/class="ver/g),
};
console.log(JSON.stringify(checks));
const bad = [];
if (checks.sections !== 7) bad.push('sections!=7 got ' + checks.sections);
if (checks.tables !== checks.tablesClosed) bad.push('table tag mismatch');
if (checks.divOpen !== checks.divClose) bad.push(`div mismatch ${checks.divOpen}/${checks.divClose}`);
if (checks.sectionClose !== 7) bad.push('section close != 7');
if (checks.scripts !== 0) bad.push('has <script>');
console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'STRUCTURE OK');
let missing = 0;
// 抽验锚点
for (const id of ['ch1','ch2','ch3','ch4','ch5','ch6','ch7']) {
  if (!h.includes(`id="${id}"`)) { console.log('MISSING anchor ' + id); missing++; }
}
// 抽验关键内容存在
for (const kw of ['已验证', 'overloaded 吸收态', '四波次', 'Wave 1', 'Top 10', 'strictTypeChecked']) {
  if (!h.includes(kw)) { console.log('MISSING content: ' + kw); missing++; }
}
console.log('content spot-check done');
// 校验失败时以非零退出码结束（原版只打印 FAIL 但退出码恒为 0）
if (bad.length || missing) process.exitCode = 1;
