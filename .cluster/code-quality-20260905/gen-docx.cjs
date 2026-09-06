/**
 * code-quality-audit-report.docx 生成器
 * 依据 docx skill：R1 封面配方 + DS-1 色板 + TOC + 三段页码
 * 内容源：.cluster/code-quality-20260905/chapters/ch1-7.md
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, PageNumber, PageBreak,
  BorderStyle, WidthType, TableOfContents, SectionType, NumberFormat, VerticalAlign,
} = require("docx");
const fs = require("fs");
const path = require("path");

const CH_BASE = "D:/multi-agent/.cluster/code-quality-20260905/chapters";
const OUT = "D:/multi-agent/DELIVERY/code-quality-audit-report.docx";

// ---------- 色板（DS-1 Deep Sea）----------
const PAL = {
  bg: "0B1C2C", primary: "FFFFFF", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", accentLine: "529286", innerLine: "BECFCC", surface: "E8ECEB" },
};
const INK = "182030";       // 正文墨色
const INK_SOFT = "506070";  // 次级
const INK_MUTE = "8A9199";  // 弱化
const SEV_COLOR = { P0: "8C2F24", P1: "A04A20", P2: "7A6420", P3: "5F6A75" };

// ---------- 封面配方辅助（design-system.md 标准实现）----------
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。；：！", ..."的与和及之在为", ..."-_—–", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) {
      breakAt = charsPerLine;
      const prevChar = remaining[breakAt - 1], nextChar = remaining[breakAt];
      if (prevChar && nextChar && !breakAfter.has(prevChar) && !breakAfter.has(nextChar) &&
          /[\u4e00-\u9fff]/.test(prevChar) && /[\u4e00-\u9fff]/.test(nextChar)) breakAt -= 1;
    }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  // 孤字合并
  if (lines.length >= 2 && lines[lines.length - 1].length === 1) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

// ---------- R1 封面（Pure Paragraph Left）----------
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PAL.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PAL.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: PAL.accent,
        font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PAL.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return children;
}

// ---------- Markdown → docx 元素 ----------
function runsFromInline(text, baseOpts = {}) {
  // 解析 **bold**、`code`、[链接](url) → TextRun 数组
  const runs = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  const push = (t, extra) => {
    if (!t) return;
    runs.push(new TextRun({ text: t, size: 21, color: INK, ...baseOpts, ...extra }));
  };
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith("`")) runs.push(new TextRun({ text: tok.slice(1, -1), size: 19,
      color: "3A4A58", font: { ascii: "Consolas", eastAsia: "Microsoft YaHei" },
      shading: { type: "clear", fill: "F2F3F5" } }));
    else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (mm) push(mm[1], { color: "0F5C4F", underline: {} });
    }
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return runs;
}

function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420 },
    spacing: { line: 312, after: 80 },
    children: runsFromInline(text),
  });
}

function h4FromMd(text) {
  // 【P0 · 已验证】等标记转换着色
  const runs = [];
  const re = /(【[^】]*】)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(...runsFromInline(text.slice(last, m.index), { bold: true, size: 22 }));
    const tag = m[0];
    const sevM = /P[0-3]/.exec(tag);
    if (sevM) {
      runs.push(new TextRun({ text: tag, bold: true, size: 20, color: SEV_COLOR[sevM[0]] || INK }));
    } else {
      runs.push(new TextRun({ text: tag, bold: true, size: 20, color: "2D6A4F" }));
    }
    last = m.index + tag.length;
  }
  if (last < text.length) runs.push(...runsFromInline(text.slice(last), { bold: true, size: 22 }));
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 100, line: 312 },
    children: runs.length ? runs : [new TextRun({ text, bold: true, size: 22, color: INK })],
  });
}

const thin = { style: BorderStyle.SINGLE, size: 2, color: "D8DCE0" };
const inner = { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine };

function mdTableToDocx(lines) {
  const rows = lines.filter(l => /^\s*\|/.test(l)).map(l => l.trim());
  const sepIdx = rows.findIndex(l => /^\|[\s:\-|]+\|$/.test(l));
  let header = null, body = [];
  if (sepIdx > 0) { header = rows[sepIdx - 1]; body = rows.slice(sepIdx + 1); }
  else body = rows;
  const parseCells = r => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
  const headerCells = header ? parseCells(header) : null;
  const colCount = Math.max(headerCells ? headerCells.length : 0, ...body.map(r => parseCells(r).length));

  const mkCell = (text, isHeader) => new TableCell({
    verticalAlign: VerticalAlign.TOP,
    shading: isHeader ? { type: "clear", fill: PAL.table.headerBg } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 276 },
      children: isHeader
        ? [new TextRun({ text: text.replace(/\*\*/g, ""), bold: true, size: 18, color: PAL.table.headerText })]
        : cellRuns(text),
    })],
  });

  const cellRuns = (text) => {
    // 单元格内严重度/验证标记着色
    const runs = [];
    const re = /(\bP[0-3]\b|已验证|疑点|【[^】]*】)/g;
    let last = 0, m;
    const pushPlain = (t) => { if (t) runs.push(...runsFromInline(t, { size: 18 })); };
    while ((m = re.exec(text)) !== null) {
      pushPlain(text.slice(last, m.index));
      const tok = m[0];
      if (/^P[0-3]$/.test(tok)) runs.push(new TextRun({ text: tok, bold: true, size: 18, color: SEV_COLOR[tok] }));
      else if (tok === "已验证") runs.push(new TextRun({ text: tok, size: 18, color: "2D6A4F" }));
      else if (tok === "疑点") runs.push(new TextRun({ text: tok, size: 18, color: INK_MUTE }));
      else {
        const sevM = /P[0-3]/.exec(tok);
        runs.push(new TextRun({ text: tok, bold: true, size: 18, color: sevM ? SEV_COLOR[sevM[0]] : "2D6A4F" }));
      }
      last = m.index + tok.length;
    }
    pushPlain(text.slice(last));
    return runs.length ? runs : [new TextRun({ text, size: 18, color: INK })];
  };

  const tRows = [];
  if (headerCells) {
    tRows.push(new TableRow({
      tableHeader: true, cantSplit: true,
      children: headerCells.map(c => mkCell(c, true)),
    }));
  }
  for (const r of body) {
    const cells = parseCells(r);
    while (cells.length < colCount) cells.push("");
    tRows.push(new TableRow({ cantSplit: true, children: cells.map(c => mkCell(c, false)) }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: thin, bottom: thin, left: thin, right: thin,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E7EAEE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E7EAEE" },
    },
    rows: tRows,
  });
}

function convertChapter(md, chNo, chTitle) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  let first = true;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#\s/.test(line) && first) {
      out.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
        children: [new TextRun({ text: chTitle, bold: true, size: 32, color: "0F172A",
          font: { eastAsia: "SimHei", ascii: "Arial" } })],
      }));
      first = false; i++; continue;
    }
    if (/^##\s/.test(line)) {
      out.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        children: runsFromInline(line.replace(/^##\s+/, ""), { bold: true, size: 26, color: "0F172A" }),
      }));
      i++; continue;
    }
    if (/^###\s/.test(line)) {
      out.push(h4FromMd(line.replace(/^###\s+/, "")));
      i++; continue;
    }
    if (/^####\s/.test(line)) {
      out.push(h4FromMd(line.replace(/^####\s+/, "")));
      i++; continue;
    }
    if (/^\s*\|/.test(line)) {
      const tbl = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { tbl.push(lines[i]); i++; }
      out.push(mdTableToDocx(tbl));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      continue;
    }
    if (/^>\s?/.test(line)) {
      out.push(new Paragraph({
        indent: { left: 400 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: PAL.accent, space: 12 } },
        spacing: { line: 312, before: 120, after: 160 },
        children: runsFromInline(line.replace(/^>\s?/, ""), { color: "3A4A58", italics: true }),
      }));
      i++; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      for (const it of items) {
        out.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { line: 312, after: 40 },
          children: runsFromInline(it),
        }));
      }
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      items.forEach((it, n) => {
        out.push(new Paragraph({
          spacing: { line: 312, after: 40 },
          children: [new TextRun({ text: `${n + 1}. `, size: 21, color: INK }), ...runsFromInline(it)],
        }));
      });
      continue;
    }
    if (/^---+$/.test(line.trim())) { i++; continue; }
    if (line.trim() === "") { i++; continue; }
    out.push(bodyPara(line));
    i++;
  }
  return out;
}

// ---------- 组装 ----------
const chTitles = [
  "第 1 章 总览与结论",
  "第 2 章 前沿对标：2026-09 的世界基线",
  "第 3 章 P0/P1 发现详解",
  "第 4 章 P2/P3 精选与模式归纳",
  "第 5 章 升级路线图",
  "第 6 章 值得保留的世界级优点",
  "第 7 章 已知边界与后续",
];

const bodyChildren = [];
// 执行摘要段（正文最前）
bodyChildren.push(new Paragraph({
  spacing: { line: 312, after: 200 },
  children: [
    new TextRun({ text: "本报告对 quantum-multi-agent-platform v1.10.0（约 21,000 行 TypeScript）执行全量代码审计：", size: 21, color: INK }),
    new TextRun({ text: "9 路并行深审 + 主线交叉复核", size: 21, bold: true, color: INK }),
    new TextRun({ text: "，覆盖调度内核、量子优化器、主动智能、通信边界、测试与工程基建六个域，产出约 190 条分级发现（P0×1、P1×15、P2×60、P3×110），其中三条 P0/P1 经源码回读复核确认。总评：内核严谨、外围欠账——升级路线图分四波次，Wave 1 止损项全部为小时级至天级修复。", size: 21, color: INK }),
  ],
}));
for (let n = 1; n <= 7; n++) {
  const md = fs.readFileSync(path.join(CH_BASE, `ch${n}.md`), "utf8");
  bodyChildren.push(...convertChapter(md, n, chTitles[n - 1]));
}

// 页脚构建
const footerBody = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: INK_MUTE })],
  })],
});
const footerRoman = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: INK_MUTE })],
  })],
});

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 21, color: INK },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // 封面（margin 0）
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCoverR1({
        title: "全量代码遍历与前沿升级方案",
        subtitle: "quantum-multi-agent-platform v1.10.0 · 代码质量审计报告",
        englishLabel: "CODE QUALITY AUDIT REPORT",
        metaLines: [
          "审计对象：quantum-multi-agent-platform v1.10.0（约 21,000 行 TypeScript）",
          "审计方式：9 路并行深审 + 主线交叉复核 + 源码回读验证",
          "审计日期：2026-09-05",
          "发现规模：约 190 条（P0×1 · P1×15 · P2×60 · P3×110）",
        ],
        footerLeft: "AUDIT SERIES",
        footerRight: "2026-09-05",
        palette: PAL.cover,
      }),
    },
    // TOC 段（罗马页码）
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
        },
      },
      footers: { default: footerRoman },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: "目 录", bold: true, size: 32, color: "0F172A", font: { eastAsia: "SimHei", ascii: "Arial" } })],
        }),
        new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "（提示：在 Word/WPS 中右键目录 → 更新域，可刷新页码）", italics: true, size: 18, color: INK_MUTE })],
        }),
      ],
    },
    // 正文段（阿拉伯页码从 1 起）
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      footers: { default: footerBody },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("DOCX written:", OUT, buf.length, "bytes");
}).catch(err => {
  // 打包失败时显式报错并以非零退出，避免未处理的 Promise 拒绝被吞
  console.error("DOCX pack failed:", err);
  process.exit(1);
});
