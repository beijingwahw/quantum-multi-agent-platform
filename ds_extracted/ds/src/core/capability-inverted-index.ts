/**
 * capability-inverted-index —— 挂起可达性判定的能力倒排索引＋单点变异的
 * 增量维护与选择性失效律（R19-T 批 2；R18-A 批 3 候选③的实施）。
 *
 * ============ 动机（R18-A 详册设计节定价在案） ============
 *
 * R18 的 classifyPendingBucket 对桶内每个任务做一次全注册表闭包扫描：
 * 每任务访问全部 A 个 agent、每个 (任务,agent) 对至多做 R 次线性
 * includes 扫描——桶判定 Θ(T·A·R·C̄)。而同一快照下所有任务共享同一
 * 注册表：能力→agent 的倒排 posting（调度器自有 capabilityIndex 的
 * 同构结构）只需构建一次，任务级判定降为「最短 posting 遍历＋其余
 * 需求的 O(1) 期望哈希成员检查」。sweep 周期（缺省 5s）内注册表
 * 高频 churn（agent 状态翻转、注册/注销），本模块进一步给出单点
 * 变异的增量维护律与选择性失效律——状态翻转（运行期最常见的变异）
 * 甚至不触碰任何 posting。
 *
 * ============ 精确主张（可证伪） ============
 *
 * 引理 L0（判定的状态投影不变量）：判定 verdict 是三元组
 * (注册表序, 各 agent 能力集, 各 agent 的 idle 资格) 的函数——非 idle
 * 状态的具体字符串（working/overloaded/offline）不进入判定。故一切
 * 保持 (序, 能力集, idle 资格) 的变异使全部判定逐位不变。证明：判定
 * 的三个证人组只用 state==='idle' 划分；分类只用三组长度。∎
 *
 * 定理 M1（增量等价）：对任意单点变异序列（register/unregister/
 * state/capabilities 四类），按本模块更新律维护的索引在每步后与
 * 「以当前快照重建」行为等价——classifyBucketIndexed(增量索引) ≡
 * classifyPendingBucket(任务, snapshotIndexedAgents(索引)) 逐位。
 * 证明（对序列长度归纳）：更新律保持不变量「posting[c].order ＝
 * 具备能力 c 的 agent 按注册表序的列表」。register 把新 agent 追加
 * 到注册表末位，对每个能力 push 到 posting 末尾（恰为注册表序位置）；
 * unregister 摘除（splice/delete 保序）；state 不触碰 posting；
 * capabilities 流失侧摘除、增益侧按注册表序重建该 posting（直接镜像
 * fresh-build）。归纳基例＝buildCapabilityInvertedIndex。∎
 *
 * 定理 F（选择性失效三分律）：设任务 x 判定为 V（matching 组 M、
 * idle 划分 I），M 为单点变异，level＝mutationDirtiness 的输出。则
 * 恰一者成立且成立者可由谓词判定：
 *   F0  level=clean   ⟺ V′=V 逐位（含证人组）；
 *   F1  level=witness ⟺ 证人组变化而分类不变；
 *   F2  level=class   ⟺ 分类翻转（证人组随之变化）。
 * 边界谓词（逐分支）：
 *   state（idle 资格两侧不变 → clean〔L0〕；翻转时：agent∉M → clean；
 *     idle→非idle 翻类 ⟺ I===[a]；非idle→idle 翻类 ⟺ I=∅）；
 *   register（reqs⊄caps → clean；否则 witness 起步——idle 新人翻类
 *     ⟺ 旧类≠schedulable-now；非 idle 新人翻类 ⟺ 旧类=unsatisfiable；
 *     分类只升不降）；
 *   unregister（a∉M → clean；idle 证人翻类 ⟺ I===[a]；非 idle 证人
 *     翻类 ⟺ M===[a]；分类只降不升）；
 *   capabilities（reqs⊆old ⟺ a∈M；与 reqs⊆new 恰同侧 → clean
 *     〔XOR 干净律〕；异侧时按增益/流失分支取 register/unregister 的
 *     边界谓词）。证明：分类是 (M,I) 的函数且仅取三值，其值由
 *   (I≠∅, M≠∅) 二元组决定；单点变异对 M 的增删与对 I 的迁移互相独立
 *   且可枚举，逐分支核对二元组前后取值即得各 ⟺。∎
 *
 * 复杂度主张（确定性口径，禁墙钟）：
 *   - 基线桶判定：agent 访问数＝恰 T·A（R18 循环形状定理——每任务
 *     无条件遍历全体 agent），元素比较最坏 Θ(T·A·R·C̄)；
 *   - 索引桶判定：构建 Θ(Σ|caps|)；每任务 O(R) 定位最短 posting ＋
 *     O(|L_min|·(R−1)) 次 O(1) 期望哈希成员检查；候选探针数＝
 *     Σ_t |L_min(t)| ≤ T·A 恒成立（|L_min|≤A）——稀疏注册表
 *     （能力互异、单需求）下严格降为命中任务数；
 *   - 单点变异维护：register Θ(|caps|)、unregister Θ(|流失 caps|·
 *     posting 长)、state Θ(1)、capabilities 增益侧 Θ(A·|增益|)。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - Set 成员检查 O(1) 是期望口径（V8 字符串哈希）；不主张对抗性
 *   哈希碰撞下的最坏界。
 * - 探针计数是 (任务,候选) 访问度量，不是元素比较度量——基线的
 *   元素比较数因 every 短路而数据依赖；本模块的严格改进主张只在
 *   访问计数口径（T·A → Σ|L_min|）与最坏复杂度比较上成立。
 * - 增量维护不减少「脏任务」的重判成本——失效律是跳过律（哪些
 *   任务无需重判），不是脏任务重判的加速律。
 * - mutationDirtiness 是纯谓词：调用方必须传入真实的变异前状态
 * （fromState/oldCapabilities）——走私假前态会得到错误 level，
 * 这是输入契约面（测试对真前态全量机检）。
 * - 失效律的域是本判定函数（L0 的投影）；真实调度器行为依赖完整
 *   状态串与并发/亲和度面——本模块对调度器行为不主张任何不变量。
 * - 空 posting 条目保留不删（与缺失键同语义：成员资格空），省去
 *   删除/重建的键管理；快照/重建不受影响。
 */
import { SchedulingError } from '../utils/errors.js';

/** 索引消费的 agent 视图（与 pending-reachability 的 ReachabilityAgentView 结构同构） */
export interface IndexedAgentView {
  readonly id: string;
  readonly capabilities: readonly string[];
  readonly state: string;
}

/** 索引消费的任务视图（与 ReachabilityTaskView 结构同构） */
export interface IndexedTaskView {
  readonly id: string;
  readonly requiredCapabilities: readonly string[];
}

/** 三分类（与 ReachabilityClass 同字面量集） */
export type IndexedReachabilityClass = 'schedulable-now' | 'awaiting-release' | 'unsatisfiable';

/** 判定输出（与 ReachabilityVerdict 字段逐一同构——位同构义务面） */
export interface IndexedReachabilityVerdict {
  readonly task: string;
  readonly classification: IndexedReachabilityClass;
  readonly matchingAgents: readonly string[];
  readonly idleMatches: readonly string[];
  readonly busyMatches: readonly string[];
}

/** 失效三级：clean=逐位不变；witness=证人组变而分类不变；class=分类翻转 */
export type DirtinessLevel = 'clean' | 'witness' | 'class';

/** 单点变异的四类形状（谓词要求真实的变异前状态/能力） */
export type RegistryMutation =
  | { readonly kind: 'register'; readonly agent: IndexedAgentView }
  | { readonly kind: 'unregister'; readonly agentId: string; readonly agentState: string }
  | {
      readonly kind: 'state';
      readonly agentId: string;
      readonly fromState: string;
      readonly toState: string;
    }
  | {
      readonly kind: 'capabilities';
      readonly agentId: string;
      readonly agentState: string;
      readonly oldCapabilities: readonly string[];
      readonly newCapabilities: readonly string[];
    };

interface AgentRecord {
  capabilities: Set<string>;
  state: string;
}

interface Posting {
  /** 具备该能力的 agent 按注册表序（M1 不变量的承重面） */
  order: string[];
  members: Set<string>;
}

export interface CapabilityInvertedIndex {
  /** 注册表（Map 插入序＝注册序；注销保序、同 id 重注册移末位） */
  readonly agents: Map<string, AgentRecord>;
  readonly postings: Map<string, Posting>;
  /** 确定性度量（评估计数，非墙钟） */
  readonly stats: { candidateProbes: number; membershipEvaluations: number };
}

/**
 * 构建倒排索引。重复 agent id 具名拒绝——message 与
 * classifyPendingTask 逐字节相同（classifyPendingBucket 置换后的
 * 错误面位同构义务，测试钉板）。agent 能力数组内的重复条目静默去重
 * （includes 语义下不改变匹配；不去重会使 posting 出现重复成员）。
 */
export function buildCapabilityInvertedIndex(
  agents: readonly IndexedAgentView[],
): CapabilityInvertedIndex {
  const index: CapabilityInvertedIndex = {
    agents: new Map(),
    postings: new Map(),
    stats: { candidateProbes: 0, membershipEvaluations: 0 },
  };
  const seenAgent = new Set<string>();
  for (const agent of agents) {
    if (seenAgent.has(agent.id)) {
      throw new SchedulingError(
        `classifyPendingTask: duplicate agent id in snapshot: ${agent.id} ` +
          `(the registry closure must be a set — duplicated members would skew the witness sets)`,
      );
    }
    seenAgent.add(agent.id);
  }
  for (const agent of agents) {
    registerIndexedAgent(index, agent);
  }
  return index;
}

/**
 * 单任务判定（索引驱动）。重复需求具名拒绝——message 与
 * classifyPendingTask 逐字节同（同上义务）。
 */
export function classifyTaskIndexed(
  task: IndexedTaskView,
  index: CapabilityInvertedIndex,
): IndexedReachabilityVerdict {
  const seenReq = new Set<string>();
  for (const req of task.requiredCapabilities) {
    if (seenReq.has(req)) {
      throw new SchedulingError(
        `classifyPendingTask: task '${task.id}' lists capability '${req}' twice ` +
          `(deduplicate requirements — duplicates do not change the match but corrupt the input contract)`,
      );
    }
    seenReq.add(req);
  }

  const matching: string[] = [];
  const idle: string[] = [];
  const busy: string[] = [];

  if (task.requiredCapabilities.length === 0) {
    // 空需求：全注册表匹配（含零能力 agent）——与基线 includes 语义同
    for (const [id, record] of index.agents) {
      matching.push(id);
      if (record.state === 'idle') idle.push(id);
      else busy.push(id);
    }
    index.stats.candidateProbes += index.agents.size;
  } else {
    // 定位最短 posting（并列时任取——输出与计数都不受选择影响：交集中
    // 的成员必在每条 posting 中且各 posting 均为注册表序）
    let shortest: Posting | undefined = undefined;
    for (const req of task.requiredCapabilities) {
      const posting = index.postings.get(req);
      if (posting === undefined || posting.order.length === 0) {
        shortest = undefined; // 任一需求无人具备 → 全闭包为空
        break;
      }
      if (shortest === undefined || posting.order.length < shortest.order.length) {
        shortest = posting;
      }
    }
    if (shortest !== undefined) {
      const others: Posting[] = [];
      for (const req of task.requiredCapabilities) {
        const posting = index.postings.get(req);
        if (posting !== undefined && posting !== shortest) others.push(posting);
      }
      for (const candidate of shortest.order) {
        index.stats.candidateProbes++;
        let match = true;
        for (const posting of others) {
          index.stats.membershipEvaluations++;
          if (!posting.members.has(candidate)) {
            match = false;
            break;
          }
        }
        if (!match) continue;
        matching.push(candidate);
        const record = index.agents.get(candidate);
        if (record?.state === 'idle') idle.push(candidate);
        else busy.push(candidate);
      }
    }
  }

  const classification: IndexedReachabilityClass =
    idle.length > 0
      ? 'schedulable-now'
      : matching.length > 0
        ? 'awaiting-release'
        : 'unsatisfiable';

  return {
    task: task.id,
    classification,
    matchingAgents: matching,
    idleMatches: idle,
    busyMatches: busy,
  };
}

/** 桶判定的索引驱动入口（输出序＝输入任务序）。 */
export function classifyBucketIndexed(
  tasks: readonly IndexedTaskView[],
  index: CapabilityInvertedIndex,
): readonly IndexedReachabilityVerdict[] {
  return tasks.map((task) => classifyTaskIndexed(task, index));
}

/** 注册新 agent（追加到注册表末位）。重复 id 具名拒绝。 */
export function registerIndexedAgent(
  index: CapabilityInvertedIndex,
  agent: IndexedAgentView,
): void {
  if (index.agents.has(agent.id)) {
    throw new SchedulingError(
      `CapabilityInvertedIndex: registerIndexedAgent: duplicate agent id: ${agent.id} ` +
        `(the index registry is a set — re-registering would corrupt posting lists)`,
    );
  }
  const caps = new Set(agent.capabilities); // agent 内重复能力静默去重
  index.agents.set(agent.id, { capabilities: caps, state: agent.state });
  for (const cap of caps) {
    let posting = index.postings.get(cap);
    if (posting === undefined) {
      posting = { order: [], members: new Set<string>() };
      index.postings.set(cap, posting);
    }
    posting.order.push(agent.id); // 末位 agent → push 恰为注册表序
    posting.members.add(agent.id);
  }
}

/** 注销 agent（注册表保序摘除）。未知 id 具名拒绝。 */
export function unregisterIndexedAgent(index: CapabilityInvertedIndex, agentId: string): void {
  const record = index.agents.get(agentId);
  if (record === undefined) {
    throw new SchedulingError(
      `CapabilityInvertedIndex: unregisterIndexedAgent: unknown agent id: ${agentId} ` +
        `(nothing to remove from the index registry)`,
    );
  }
  index.agents.delete(agentId);
  for (const cap of record.capabilities) {
    const posting = index.postings.get(cap);
    if (posting === undefined) continue;
    const at = posting.order.indexOf(agentId);
    if (at >= 0) posting.order.splice(at, 1); // 摘除保序
    posting.members.delete(agentId);
  }
}

/** 状态单点变异（Θ(1)，不触碰任何 posting——L0）。未知 id 具名拒绝。 */
export function setIndexedAgentState(
  index: CapabilityInvertedIndex,
  agentId: string,
  state: string,
): void {
  const record = index.agents.get(agentId);
  if (record === undefined) {
    throw new SchedulingError(
      `CapabilityInvertedIndex: setIndexedAgentState: unknown agent id: ${agentId} ` +
        `(state changes require a registered agent)`,
    );
  }
  record.state = state;
}

/**
 * 能力集单点变异。未知 id 具名拒绝。流失能力外科摘除（保序）；增益
 * 能力按注册表序重建该 posting（agent 不在注册表末位时追加会破坏
 * M1 序不变量——重建直接镜像 fresh-build，Θ(A) 每增益能力）。
 */
export function setIndexedAgentCapabilities(
  index: CapabilityInvertedIndex,
  agentId: string,
  capabilities: readonly string[],
): void {
  const record = index.agents.get(agentId);
  if (record === undefined) {
    throw new SchedulingError(
      `CapabilityInvertedIndex: setIndexedAgentCapabilities: unknown agent id: ${agentId} ` +
        `(capability changes require a registered agent)`,
    );
  }
  const oldCaps = record.capabilities;
  const newCaps = new Set(capabilities);
  record.capabilities = newCaps; // 先更新：增益侧重建的过滤器收录本 agent
  for (const cap of oldCaps) {
    if (newCaps.has(cap)) continue;
    const posting = index.postings.get(cap);
    if (posting === undefined) continue;
    const at = posting.order.indexOf(agentId);
    if (at >= 0) posting.order.splice(at, 1);
    posting.members.delete(agentId);
  }
  for (const cap of newCaps) {
    if (oldCaps.has(cap)) continue;
    let posting = index.postings.get(cap);
    if (posting === undefined) {
      posting = { order: [], members: new Set<string>() };
      index.postings.set(cap, posting);
    }
    posting.order = [...index.agents.keys()].filter((id) =>
      index.agents.get(id)!.capabilities.has(cap),
    );
    posting.members = new Set(posting.order);
  }
}

/** 注册表快照（注册序；能力由 Set 物化＝去重序，语义与 includes 同）。 */
export function snapshotIndexedAgents(index: CapabilityInvertedIndex): IndexedAgentView[] {
  const out: IndexedAgentView[] = [];
  for (const [id, record] of index.agents) {
    out.push({ id, capabilities: [...record.capabilities], state: record.state });
  }
  return out;
}

/** 读取确定性度量（副本）。 */
export function readIndexStats(index: CapabilityInvertedIndex): {
  candidateProbes: number;
  membershipEvaluations: number;
} {
  return { ...index.stats };
}

/** 度量清零（分相位断言用）。 */
export function resetIndexStats(index: CapabilityInvertedIndex): void {
  index.stats.candidateProbes = 0;
  index.stats.membershipEvaluations = 0;
}

/**
 * 选择性失效三分律的谓词（定理 F）。输入契约：mutation 携带真实的
 * 变异前状态（fromState/oldCapabilities/agentState）与变异内容。
 */
export function mutationDirtiness(
  task: IndexedTaskView,
  verdict: IndexedReachabilityVerdict,
  mutation: RegistryMutation,
): DirtinessLevel {
  switch (mutation.kind) {
    case 'register': {
      const matches = task.requiredCapabilities.every((req) =>
        mutation.agent.capabilities.includes(req),
      );
      if (!matches) return 'clean';
      const classDirty =
        mutation.agent.state === 'idle'
          ? verdict.classification !== 'schedulable-now'
          : verdict.classification === 'unsatisfiable';
      return classDirty ? 'class' : 'witness';
    }
    case 'unregister': {
      if (!verdict.matchingAgents.includes(mutation.agentId)) return 'clean';
      const classDirty =
        mutation.agentState === 'idle'
          ? verdict.idleMatches.length === 1 && verdict.idleMatches[0] === mutation.agentId
          : verdict.matchingAgents.length === 1 && verdict.matchingAgents[0] === mutation.agentId;
      return classDirty ? 'class' : 'witness';
    }
    case 'state': {
      if (!verdict.matchingAgents.includes(mutation.agentId)) return 'clean';
      const fromIdle = mutation.fromState === 'idle';
      const toIdle = mutation.toState === 'idle';
      if (fromIdle === toIdle) return 'clean'; // L0：idle 资格双侧不变
      const classDirty = fromIdle
        ? verdict.idleMatches.length === 1 && verdict.idleMatches[0] === mutation.agentId
        : verdict.idleMatches.length === 0;
      return classDirty ? 'class' : 'witness';
    }
    case 'capabilities': {
      const inOld = task.requiredCapabilities.every((req) =>
        mutation.oldCapabilities.includes(req),
      );
      const inNew = task.requiredCapabilities.every((req) =>
        mutation.newCapabilities.includes(req),
      );
      if (inOld === inNew) return 'clean'; // XOR 干净律：同侧 ⟹ 证人组不变
      const classDirty = inNew
        ? mutation.agentState === 'idle'
          ? verdict.classification !== 'schedulable-now'
          : verdict.classification === 'unsatisfiable'
        : mutation.agentState === 'idle'
          ? verdict.idleMatches.length === 1 && verdict.idleMatches[0] === mutation.agentId
          : verdict.matchingAgents.length === 1 && verdict.matchingAgents[0] === mutation.agentId;
      return classDirty ? 'class' : 'witness';
    }
  }
}
