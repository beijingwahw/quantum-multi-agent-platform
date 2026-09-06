const fs = require('fs');
const path = require('path');

const BASE = 'D:/multi-agent/.cluster/code-quality-20260905/chapters';
const OUT = 'D:/multi-agent/DELIVERY/code-quality-audit-report.html';
const SKELETON = 'D:/multi-agent/DELIVERY/code-quality-audit-report.html';

// ---------- 行内元素转换 ----------
function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// 严重度徽章：把单元格或行内独立的 P0/P1/P2/P3 换成语义徽章
function sevBadge(s) {
  return s.replace(/\b(P0|P1|P2|P3)\b/g, '<span class="sev sev-$1">$1</span>');
}

// 「已验证」/「疑点」等验证标注
function verTag(s) {
  return s
    .replace(/【([^】]*(?:已验证|疑点)[^】]*)】/g, '<span class="ver">$1</span>')
    .replace(/(已验证)/g, '<span class="ver">$1</span>');
}

function cellHTML(s, isHeader) {
  let h = inline(s.trim());
  if (!isHeader) { h = sevBadge(h); h = verTag(h); }
  return h;
}

// ---------- 表格解析 ----------
function renderTable(lines) {
  const rows = lines.filter(l => /^\s*\|/.test(l)).map(l => l.trim());
  // 去掉分隔行
  const sepIdx = rows.findIndex(l => /^\|[\s:\-|]+\|$/.test(l));
  let header = null, body = [];
  if (sepIdx > 0) { header = rows[sepIdx - 1]; body = rows.slice(sepIdx + 1); }
  else body = rows;

  const parseCells = r => r.replace(/^\|/, '').replace(/\|$/, '').split('|');

  let html = '<div class="tbl-wrap"><table>';
  if (header) {
    html += '<thead><tr>';
    for (const c of parseCells(header)) html += `<th>${cellHTML(c, true)}</th>`;
    html += '</tr></thead>';
  }
  html += '<tbody>';
  for (const r of body) {
    html += '<tr>';
    for (const c of parseCells(r)) html += `<td>${cellHTML(c, false)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

// ---------- 章节转换 ----------
function convertChapter(md, chNo) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let i = 0;
  let tableBuf = [];
  let inTable = false;
  let firstH1 = true;

  const flushTable = () => {
    if (inTable) { html += renderTable(tableBuf); tableBuf = []; inTable = false; }
  };

  while (i < lines.length) {
    const line = lines[i];
    // 表格累积
    if (/^\s*\|/.test(line)) { inTable = true; tableBuf.push(line); i++; continue; }
    flushTable();

    if (/^#\s/.test(line) && firstH1) {
      // 章标题
      const title = line.replace(/^#\s*第?\s*\d*\s*章?\s*/, '').replace(/^#\s+/, '');
      html += `<section class="chapter" id="ch${chNo}">\n<div class="ch-header"><span class="ch-no">CHAPTER ${chNo}</span><h2>${inline(title)}</h2></div>\n`;
      firstH1 = false; i++; continue;
    }
    if (/^##\s/.test(line)) {
      const t = line.replace(/^##\s+/, '');
      html += `<h3>${inline(t)}</h3>\n`; i++; continue;
    }
    if (/^###\s/.test(line)) {
      const t = line.replace(/^###\s+/, '');
      let ht = inline(t);
      ht = ht.replace(/【([^】]*(?:已验证|疑点)[^】]*)】/g, '<span class="ver">$1</span>');
      ht = sevBadge(ht.replace(/(【P0】|【P1】|【P2】|【P3】)/g, (m) => m)); // 标题里 P0 保留原文再统一徽章化
      html += `<h4>${ht}</h4>\n`; i++; continue;
    }
    if (/^####\s/.test(line)) {
      const t = line.replace(/^####\s+/, '');
      html += `<h4>${inline(t)}</h4>\n`; i++; continue;
    }
    if (/^>\s?/.test(line)) {
      html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>\n`; i++; continue;
    }
    if (/^---+$/.test(line.trim())) {
      html += '<hr class="thin">\n'; i++; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      // ul
      let items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, '')); i++;
      }
      html += '<ul>' + items.map(it => `<li>${verTag(inline(it))}</li>`).join('') + '</ul>\n';
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      let items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, '')); i++;
      }
      html += '<ol>' + items.map(it => `<li>${verTag(inline(it))}</li>`).join('') + '</ol>\n';
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    // 普通段落
    html += `<p>${verTag(inline(line))}</p>\n`;
    i++;
  }
  flushTable();
  html += '</section>\n';
  return html;
}

// ---------- 主流程 ----------
let skeleton = fs.readFileSync(SKELETON, 'utf8');
// 骨架中必须仍有占位标记：交付后的 HTML 已无标记，重跑会是静默无变更的假成功
if (!skeleton.includes('<!-- CHAPTERS -->')) {
  console.error('SKELETON marker <!-- CHAPTERS --> not found in ' + SKELETON);
  process.exit(1);
}
let all = '';
for (let n = 1; n <= 7; n++) {
  const p = path.join(BASE, `ch${n}.md`);
  if (!fs.existsSync(p)) { console.error(`MISSING ch${n}.md`); process.exit(1); }
  all += convertChapter(fs.readFileSync(p, 'utf8'), n) + '\n';
}
const out = skeleton.replace('<!-- CHAPTERS -->', all);
fs.writeFileSync(OUT, out, 'utf8');
console.log('OK chapters inserted, total bytes:', out.length);
// 统计校验
const tableCount = (out.match(/<table>/g) || []).length;
const sevCount = (out.match(/class="sev /g) || []).length;
console.log('tables:', tableCount, 'sev badges:', sevCount);
