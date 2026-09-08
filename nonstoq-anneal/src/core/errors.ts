/**
 * 全仓具名错误 —— 每个公共入口的非法输入以机器可检查的错误码被驳回
 * （0.3.0 错误面硬化：此前 10 个 throw 都是裸 Error 字符串，测试只能
 * 对消息文本做脆弱匹配；现在走私审判按 code 定罪，消息漂移不脱罪）。
 *
 * 约定：code 是封闭联合（编译期穷尽）；message 保持人类可读并携带
 * 违规值。审判测试断言 code 精确相等——错误的 code 与缺失的 code
 * 同罪。
 */
export type NonstoqErrorCode =
  /** pspinEnergies：p 必须是 ≥ 2 的整数。 */
  | "PSpinDomain"
  /** antiferroRing：n 必须是 ≥ 3 的整数。 */
  | "AfRingDomain"
  /** maxcut3Reg：n 必须是 ≥ 4 的偶数。 */
  | "Maxcut3RegDomain"
  /** maxcut3Reg：200 次尝试内未构造出避开环边的完美匹配。 */
  | "Maxcut3RegMatchFailed"
  /** denseRotatedMatrix：稠密 2^n 裁判上限 n = 10。 */
  | "DenseRefereeCap"
  /** uniformPairDichotomy：定理陈述要求 Γ > 0 且 κ > 0。 */
  | "DichotomyDomain"
  /** 判定器内部：NO 证书未通过独立重推（不变量破坏，不是用户输入错）。 */
  | "InternalNoGoReverifyFailed"
  /** 实验/报告层：YES 证书未通过复核（不变量破坏，不是用户输入错）。 */
  | "CertificateVerificationFailed";

export class NonstoqError extends Error {
  readonly code: NonstoqErrorCode;

  constructor(code: NonstoqErrorCode, message: string) {
    super(message);
    this.name = "NonstoqError";
    this.code = code;
  }
}
