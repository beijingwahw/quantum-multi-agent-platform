/**
 * LLM 学习曲线实验 · 任务集
 *
 * 任务：客户评论结构化分类（aspect / sentiment / urgent），输出严格 JSON，可自动判分。
 *
 * 设计要点：规则在 system prompt 中已完整给出，但存在多处"字面可读、应用易错"的
 * 边角规则（urgent 的字面词匹配、反讽判定、多方面优先级）。零样本基线预计处于
 * 中等水平，为"上下文资本（few-shot 案例积累）"留出可测量的提升空间——
 * 这正是真实 Agent 能力的形态：说明书只定义边界，案例才定义行为。
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
