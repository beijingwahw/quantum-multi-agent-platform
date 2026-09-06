/**
 * LLM 学习曲线实验 · 任务集
 *
 * 任务：客户评论结构化分类（aspect / sentiment / urgent），输出严格 JSON，可自动判分。
 *
 * 设计要点：规则在 system prompt 中已完整给出，但存在多处"字面可读、应用易错"的
 * 边角规则（urgent 的字面词匹配、反讽判定、多方面优先级）。零样本基线预计处于
 * 中等水平，为"上下文资本（few-shot 案例积累）"留出可测量的提升空间——
 * 这正是真实 Agent 能力的形态：说明书只定义边界，案例才定义行为。
 *
 * ─── 标注审计与所有者决策项（labelAudit） ────────────────────────────────
 * 本数据集的标注带有已知的类别不平衡与两个 R3 判定争议。**标注本身一律不改**
 * （改标注 = 改变已发表实验的结论，属于实验所有者的决策），但分歧必须
 * 机械可见：`labelAudit()` 基于 `ASPECT_KEYWORDS` 词表推导每张工单
 * "被提及的方面集合"，按 R3 优先级与标注比对。当前快照（由
 * tests/llm-dataset-audit.test.ts 钉住）：
 *
 * 1. 边际分布：sentiment 32 负面 / 10 正面 / 2 中性（多数类基线 72.7%）；
 *    urgent 9/44（多数类基线 79.5%）；aspect 最多的"质量"仅 12/44（27.3%）。
 *    不平衡抬高 exact-match 的朴素基线，学习曲线拟合的 base 参数会吸收
 *    它——解读 q̂0 时须知此背景。
 * 2. R3 一致性（严格读法，争议词不计入提及）：44 张工单中 43 张与
 *    R3 优先级推导完全一致；唯一词法静默的是 #42（"退货"仅是 urgent 词，
 *    无方面关键词）。
 * 3. 争议词 × 所有者决策（含入读法下标注会翻转的工单）：
 *    - "保修" 是否构成"质量"的提及？计入 → #32 从 客服 翻转为 质量
 *      （#14 同含"保修"但已由"坏了"命中质量，不受影响）；
 *    - "App" 是否构成"功能"的提及？计入 → #11 从 客服 翻转为 功能
 *      （#16 同含"App"但已由"闪退"命中功能，不受影响）。
 *    两种读法各有一致性：不计时维持现状即可自洽；计时需同步改 #11/#32
 *    的标注并重跑实验。词表即裁决入口——改 ASPECT_KEYWORDS 的 disputed
 *    标记与测试快照，就是显式做出这个决策的机制。
 */

export const ASPECTS = ['物流', '质量', '客服', '价格', '功能'] as const;
export const SENTIMENTS = ['正面', '负面', '中性'] as const;

export interface Ticket {
  id: number;
  text: string;
  aspect: string;
  sentiment: string;
  urgent: boolean;
}

// ─── R3 提及词法（声明式：每个映射决策都可见、可改、被测试钉住） ─────────

/**
 * 关键词 → 方面 的提及判定词表：R3"只要被提到即计入"的机械可执行形式。
 * 仅覆盖本数据集 44 张工单实际出现的判定性词汇；单字词（坏/贵/价）在本
 * 语料内无歧义命中。disputed: true 的词是否构成"提及"未裁决——两种读法
 * 的审计结果都由 labelAudit 给出（见文件头注释）。
 */
export const ASPECT_KEYWORDS: ReadonlyArray<{
  keywords: readonly string[];
  aspect: (typeof ASPECTS)[number];
  disputed?: boolean;
}> = [
  { keywords: ['物流', '发货', '快递', '包裹', '签收', '驿站', '分拣', '没收到'], aspect: '物流' },
  {
    keywords: [
      '质量',
      '划痕',
      '内胆',
      '堪忧',
      '电池',
      '鼓包',
      '噪音',
      '风扇',
      '手感',
      '做工',
      '缝线',
      '分辨率',
      '品质',
      '尺码',
      '防水',
      '进水',
      '左声道',
      '没声音',
      '坏',
      '好货',
    ],
    aspect: '质量',
  },
  { keywords: ['客服', '发票'], aspect: '客服' },
  { keywords: ['价格', '便宜', '贵', '价', '划算', '折', '原价', '成本', '扣了'], aspect: '价格' },
  {
    keywords: ['功能', '识别', '唤醒', '闪退', '固件', '耗电', '语音助手', '充电'],
    aspect: '功能',
  },
  // ── 争议词（所有者决策项）：计入与否见文件头"所有者决策"说明 ──
  { keywords: ['保修'], aspect: '质量', disputed: true },
  { keywords: ['App'], aspect: '功能', disputed: true },
];

/** R3 优先级（高 → 低），与 SYSTEM_PROMPT 中的声明一致 */
export const R3_PRIORITY: ReadonlyArray<(typeof ASPECTS)[number]> = [
  '质量',
  '价格',
  '功能',
  '物流',
  '客服',
];

/** 工单文本中被提及的方面集合（按词表子串匹配；includeDisputed 控制争议词） */
export function mentionedAspects(
  text: string,
  opts: { includeDisputed?: boolean } = {},
): Set<(typeof ASPECTS)[number]> {
  const hits = new Set<(typeof ASPECTS)[number]>();
  for (const entry of ASPECT_KEYWORDS) {
    if (entry.disputed && opts.includeDisputed !== true) continue;
    if (entry.keywords.some((k) => text.includes(k))) hits.add(entry.aspect);
  }
  return hits;
}

export interface LabelAuditReport {
  total: number;
  /** aspect / sentiment / urgent 的边际计数 */
  aspectCounts: Record<string, number>;
  sentimentCounts: Record<string, number>;
  urgentCount: number;
  /** 多数类朴素基线（exact-match）：不平衡对零样本基线的抬高幅度 */
  majorityBaseRate: { aspect: number; sentiment: number; urgent: number };
  /**
   * R3 不一致工单（严格读法）：按优先级推导的主方面 ≠ 标注。
   * 当前为空——数据集在严格读法下自洽。
   */
  r3Mismatches: Array<{ id: number; labeled: string; derived: string }>;
  /** 词法静默工单：无任何（严格读法）方面关键词命中，审计无法裁决 */
  lexiconSilent: number[];
  /**
   * 争议词影响（含入读法 − 严格读法）：计入争议词后标注会翻转的工单。
   * 每项即一个待所有者裁决的决策，翻转需同步改标注并重跑实验。
   */
  disputedImpact: Array<{
    id: number;
    keyword: string;
    labeled: string;
    underInclusiveReading: string;
  }>;
}

/** 标注审计：类别不平衡 + R3 一致性 + 争议词影响，一次计算全量可见 */
export function labelAudit(): LabelAuditReport {
  const aspectCounts: Record<string, number> = {};
  const sentimentCounts: Record<string, number> = {};
  let urgentCount = 0;
  for (const t of TICKETS) {
    aspectCounts[t.aspect] = (aspectCounts[t.aspect] ?? 0) + 1;
    sentimentCounts[t.sentiment] = (sentimentCounts[t.sentiment] ?? 0) + 1;
    if (t.urgent) urgentCount++;
  }

  const priorityOf = (a: string): number => R3_PRIORITY.indexOf(a as (typeof ASPECTS)[number]);
  const r3Mismatches: LabelAuditReport['r3Mismatches'] = [];
  const lexiconSilent: number[] = [];
  for (const t of TICKETS) {
    const hits = [...mentionedAspects(t.text)];
    if (hits.length === 0) {
      lexiconSilent.push(t.id);
      continue;
    }
    hits.sort((a, b) => priorityOf(a) - priorityOf(b));
    const derived = hits[0]!;
    if (derived !== t.aspect) r3Mismatches.push({ id: t.id, labeled: t.aspect, derived });
  }

  const disputedImpact: LabelAuditReport['disputedImpact'] = [];
  for (const t of TICKETS) {
    const strict = [...mentionedAspects(t.text)];
    const inclusive = [...mentionedAspects(t.text, { includeDisputed: true })];
    if (strict.length === 0 || inclusive.length === 0) continue;
    strict.sort((a, b) => priorityOf(a) - priorityOf(b));
    inclusive.sort((a, b) => priorityOf(a) - priorityOf(b));
    const derivedStrict = strict[0]!;
    const derivedInclusive = inclusive[0]!;
    if (derivedInclusive !== derivedStrict && derivedInclusive !== t.aspect) {
      // 找出引发翻转的争议词（该工单文本命中的第一个 disputed 词）
      const kw = ASPECT_KEYWORDS.find(
        (e) =>
          e.disputed && e.keywords.some((k) => t.text.includes(k)) && e.aspect === derivedInclusive,
      );
      disputedImpact.push({
        id: t.id,
        keyword: kw?.keywords[0] ?? '?',
        labeled: t.aspect,
        underInclusiveReading: derivedInclusive,
      });
    }
  }

  const maxOf = (o: Record<string, number>): number => Math.max(...Object.values(o));
  return {
    total: TICKETS.length,
    aspectCounts,
    sentimentCounts,
    urgentCount,
    majorityBaseRate: {
      aspect: maxOf(aspectCounts) / TICKETS.length,
      sentiment: maxOf(sentimentCounts) / TICKETS.length,
      urgent: Math.max(urgentCount, TICKETS.length - urgentCount) / TICKETS.length,
    },
    r3Mismatches,
    lexiconSilent,
    disputedImpact,
  };
}

/**
 * 隐式模式：分类口径（urgent 词表、优先级、反讽等）完全不告知，
 * 历史案例是唯一的知识来源。这才是"上下文资本 ≈ 技能积累"的公平检验。
 */
export const IMPLICIT_PROMPT = `你是电商平台工单组的分类专员。对每条客户评论输出分类 JSON。

分类口径以组内沉淀的历史案例为准——请从案例中归纳标准并严格保持一致。
- aspect：[物流, 质量, 客服, 价格, 功能]
- sentiment：[正面, 负面, 中性]
- urgent：true / false

只输出一个 JSON，不要输出任何其他文字。格式：{"aspect":"...","sentiment":"...","urgent":true}`;

export const SYSTEM_PROMPT = `你是电商平台工单组的分类专员。对每条客户评论输出分类 JSON。

分类字段：
- aspect：主方面，取值 [物流, 质量, 客服, 价格, 功能]
- sentiment：[正面, 负面, 中性]
- urgent：true / false

分类规则（必须严格执行）：
R1. urgent=true 当且仅当原文出现以下任一字符串：退款、退货、换货、投诉、曝光、12315、客服介入。按字面匹配判断，语气强弱不影响。
R2. 明贬暗讽（褒义词带引号后接实际抱怨，或明显反话）→ sentiment=负面。
R3. 评论同时涉及多个方面时，主方面按优先级（高→低）：质量 > 价格 > 功能 > 物流 > 客服。只要被提到即计入，无论褒贬。
R4. 纯咨询、无明确情绪 → sentiment=中性。
R5. 只输出一个 JSON，不要输出任何其他文字。格式：{"aspect":"...","sentiment":"...","urgent":true}`;

/** 44 条人工构造的工单，覆盖 5 个方面 × 3 种情绪 × 边角规则 */
export const TICKETS: Ticket[] = [
  {
    id: 1,
    text: '发货太慢了，等了十天还没到，太失望了。',
    aspect: '物流',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 2,
    text: '收到的电饭煲内胆有划痕，质量堪忧，我要求换货。',
    aspect: '质量',
    sentiment: '负面',
    urgent: true,
  },
  {
    id: 3,
    text: '客服回复很快，问题一下就解决了，点赞！',
    aspect: '客服',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 4,
    text: '真是"太棒了"，用了一周电池就鼓包。',
    aspect: '质量',
    sentiment: '负面',
    urgent: false,
  },
  { id: 5, text: '请问我的订单什么时候发货？', aspect: '物流', sentiment: '中性', urgent: false },
  {
    id: 6,
    text: '价格贵了一倍，隔壁店便宜多了，不划算。',
    aspect: '价格',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 7,
    text: '客服态度恶劣，还威胁我，我要投诉到12315。',
    aspect: '客服',
    sentiment: '负面',
    urgent: true,
  },
  {
    id: 8,
    text: '物流很快，第二天就到了，赞一个。',
    aspect: '物流',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 9,
    text: '价格是真便宜，功能也对得起这个价。',
    aspect: '价格',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 10,
    text: '智能唤醒功能识别不了我的声音，体验很差。',
    aspect: '功能',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 11,
    text: '我在你们App申请退货，五天了没人处理，客服也不回消息。',
    aspect: '客服',
    sentiment: '负面',
    urgent: true,
  },
  { id: 12, text: '散热噪音大，风扇像直升机。', aspect: '质量', sentiment: '负面', urgent: false },
  { id: 13, text: '客服帮我催了物流，很负责。', aspect: '物流', sentiment: '正面', urgent: false },
  {
    id: 14,
    text: '刚买一个月就坏了，保修还要收我钱，我要曝光你们。',
    aspect: '质量',
    sentiment: '负面',
    urgent: true,
  },
  {
    id: 15,
    text: '比官网贵了两百，找客服退差价，客服说没法退。',
    aspect: '价格',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 16,
    text: 'App闪退三次了，重新安装也没用。',
    aspect: '功能',
    sentiment: '负面',
    urgent: false,
  },
  { id: 17, text: '键盘手感很棒，值这个价。', aspect: '质量', sentiment: '正面', urgent: false },
  {
    id: 18,
    text: '快递员把包裹放驿站没打电话，差点丢件。',
    aspect: '物流',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 19,
    text: '耳机左声道没声音，客服只会让我重启，问题还在。',
    aspect: '质量',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 20,
    text: '这价格能买到这种做工，"真是赚到了"——缝线三天就开。',
    aspect: '质量',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 21,
    text: '物流信息三天不更新，客服电话打不通。',
    aspect: '物流',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 22,
    text: '充电十分钟断四次，什么破功能。',
    aspect: '功能',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 23,
    text: '发票开错了，客服说重新开要等七天。',
    aspect: '客服',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 24,
    text: '价格比双11还低，果断下单，很满意。',
    aspect: '价格',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 25,
    text: '你们的客服是我见过"最专业"的——问了三遍还在踢皮球。',
    aspect: '客服',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 26,
    text: '滤网两个月就得换，耗材成本太高。',
    aspect: '价格',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 27,
    text: '屏幕分辨率很好，看视频很爽。',
    aspect: '质量',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 28,
    text: '客服承诺的赠品一直不发，追问就装死。',
    aspect: '客服',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 29,
    text: '便宜没好货，这话在这款上应验了。',
    aspect: '质量',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 30,
    text: '物流显示已签收但我没收到包裹，要求客服介入处理。',
    aspect: '物流',
    sentiment: '负面',
    urgent: true,
  },
  {
    id: 31,
    text: '固件更新后耗电翻倍，一天两充。',
    aspect: '功能',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 32,
    text: '客服说是我自己摔的，不给保修，我要投诉。',
    aspect: '客服',
    sentiment: '负面',
    urgent: true,
  },
  { id: 33, text: '尺码偏小，我穿不下，郁闷。', aspect: '质量', sentiment: '负面', urgent: false },
  {
    id: 34,
    text: '会员价格说好打八折，结账还是原价。',
    aspect: '价格',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 35,
    text: '第二次购买了，品质依旧稳定。',
    aspect: '质量',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 36,
    text: '客服机器人只会复读"亲亲"，气死人了。',
    aspect: '客服',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 37,
    text: '手表说好防水，洗手就进水了，我要换货。',
    aspect: '质量',
    sentiment: '负面',
    urgent: true,
  },
  { id: 38, text: '物流暴力分拣，箱子都瘪了。', aspect: '物流', sentiment: '负面', urgent: false },
  {
    id: 39,
    text: '语音助手听不懂方言，识别率感人。',
    aspect: '功能',
    sentiment: '负面',
    urgent: false,
  },
  {
    id: 40,
    text: '差评！东西没收到还扣了我钱，我要曝光这家黑店。',
    aspect: '价格',
    sentiment: '负面',
    urgent: true,
  },
  {
    id: 41,
    text: '客服小姐姐特别耐心，教我完成了绑定。',
    aspect: '客服',
    sentiment: '正面',
    urgent: false,
  },
  { id: 42, text: '请问支持七天无理由退货吗？', aspect: '客服', sentiment: '中性', urgent: true },
  {
    id: 43,
    text: '按摩椅功能很多，老人一学就会。',
    aspect: '功能',
    sentiment: '正面',
    urgent: false,
  },
  {
    id: 44,
    text: '客服让我等"48小时"，等了五天也没人联系我。',
    aspect: '客服',
    sentiment: '负面',
    urgent: false,
  },
];
