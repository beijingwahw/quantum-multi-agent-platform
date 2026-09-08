# -*- coding: utf-8 -*-
"""
README 原理图生成器 —— 全部图片由仓内真实工件与公开数字渲染，可复现：

    python docs/diagrams/generate.py

数据来源（无硬编码虚构数字）：
  - out/bench/bench-report.json   —— QuantumSched-Bench 机器可读报告（50 实例 × 7 求解器）
  - README 基准表 / QUANTUM-SCHEDULING.md 的公开实测数字（图中标注出处）
  - 物理示意图（退火能级 / Born 坍缩 / 纤维结构）按公式解析绘制，标注「示意」
"""
import json
import math
import pathlib

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent

# ---------------------------------------------------------------- 统一风格
INDIGO = "#5B5FE9"   # 量子主色
DEEP = "#1F2440"     # 深墨
CYAN = "#00A8CC"     # 强调青
AMBER = "#F5A623"    # 警示琥珀
GREEN = "#10B981"    # 达标绿
RED = "#E4574C"      # 差距红
GRAY = "#8A91A8"
LIGHT = "#EEF0F8"
LIGHT2 = "#F7F8FC"
GRID = "#E3E6F0"

plt.rcParams.update({
    # YaHei 承担中文；DejaVu Sans 兜底数学字形（⟩ ⇒ ₃ ₜ ̂ 等 YaHei 缺字）
    "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans"],
    "axes.unicode_minus": False,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.edgecolor": GRID,
    "axes.labelcolor": DEEP,
    "text.color": DEEP,
    "xtick.color": GRAY,
    "ytick.color": GRAY,
    "axes.grid": True,
    "grid.color": GRID,
    "grid.linewidth": 0.6,
    "font.size": 11,
})


VER = "R7"
OVERFLOWS = []  # (figure-title, text-head, text_w/box_w) —— 框内文本溢出自检记录
PENDING = []    # (fig, text-artist, patch) —— save() 时按最终布局测量


def save(fig, name):
    path = HERE / name
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor="white")
    # 溢出自检：以最终渲染尺寸测量（savefig 后布局已定，重测一次）
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    title = (fig._suptitle.get_text()[:26] if getattr(fig, "_suptitle", None) else fig.axes[0].get_title()[:26]) if fig.axes else "?"
    for f, t, patch in PENDING:
        if f is not fig:
            continue
        tb = t.get_window_extent(renderer)
        pb = patch.get_window_extent(renderer)
        if tb.width > pb.width * 1.02 or tb.height > pb.height * 1.02:
            OVERFLOWS.append((title, t.get_text().split("\n")[0][:16], round(tb.width / pb.width, 2), round(tb.height / pb.height, 2)))
    PENDING[:] = [p for p in PENDING if p[0] is not fig]
    plt.close(fig)
    print("rendered", path.relative_to(ROOT), VER)


def box(ax, x, y, w, h, text, fc=LIGHT, ec=INDIGO, tc=DEEP, fs=10.5, lw=1.4, style="round,pad=0.02,rounding_size=0.025", weight="normal", zorder=3):
    patch = ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=style, fc=fc, ec=ec, lw=lw, zorder=zorder))
    t = ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, color=tc, zorder=zorder + 1, linespacing=1.35, fontweight=weight)
    PENDING.append((ax.figure, t, patch))
    return patch


def arrow(ax, x1, y1, x2, y2, color=GRAY, lw=1.6, style="-|>", ms=14, ls="-", connstyle="arc3,rad=0", zorder=2):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, mutation_scale=ms, color=color, lw=lw, linestyle=ls, connectionstyle=connstyle, zorder=zorder))


def clean(ax):
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_visible(False)


BENCH = json.loads((ROOT / "out" / "bench" / "bench-report.json").read_text(encoding="utf-8"))
ROWS = BENCH["rows"]


# ================================================================ 01 架构分层
def fig_architecture():
    fig, ax = plt.subplots(figsize=(11.4, 7.8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 10.6)
    clean(ax)
    ax.set_title("量子多Agent开发调度平台 · 四层架构", fontsize=15, fontweight="bold", pad=14)

    L, R = 0.3, 11.7
    CW = R - L

    def row(y, label, items, bg, boxfc="white"):
        """items: list of (text, width_ratio); 等距排布并返回 [(cx, x, w)]"""
        ax.add_patch(FancyBboxPatch((L, y - 0.12), CW, 1.66, boxstyle="round,pad=0.02,rounding_size=0.06",
                                    fc=bg, ec=GRID, lw=1.0, zorder=1))
        ax.text(L + 0.16, y + 1.32, label, fontsize=11.5, fontweight="bold", color=INDIGO, zorder=4)
        n = len(items)
        gap = 0.28
        total_w = CW - 0.4 - gap * (n - 1)
        placed = []
        x = L + 0.2
        for text, wr in items:
            w = total_w * wr
            box(ax, x, y, w, 1.12, text, fc=boxfc, ec=INDIGO, fs=9.0)
            placed.append((x + w / 2, x, w))
            x += w + gap
        return placed

    l4 = row(8.85, "L4 接口层", [
        ("Web 控制台\n单文件 HTML · 实时快照", 1),
        ("SDK / CLI\nTypeScript 严格模式", 1),
        ("QuantumBus WebSocket 总线\n:8080 · 487,448 msgs/s\n鉴权 · 背压三道防线", 1),
    ], LIGHT)
    l3 = row(6.75, "L3 平台层", [
        ("QuantumMultiAgentPlatform —— 事件编排 · 快照节流广播 · 控制台协议 · 总线鉴权（SHA-256 常数时间比较）", 1),
    ], LIGHT2)
    l2 = row(4.55, "L2 调度核心", [
        ("QuantumScheduler\n优先级分桶 · 能力倒排索引\n并发背压 · 多轮调度", 1),
        ("AgentManager\n生命周期 · 纠缠网络\n健康检查去重", 1),
        ("任务生命周期\n依赖就绪 · 挂起重调度", 1),
    ], LIGHT)
    l1 = row(1.75, "L1 量子引擎层（三路互证）", [
        ("全空间态矢量引擎\nQAOA · 绝热退火\nIsing 导出（单块≤12比特）", 1),
        ("约束子空间引擎\n纤维闭式混合器 · 零罚项\nP(n,m) ≤ 2²¹ 维", 1),
        ("经典认证基线\n匈牙利 O(n³) · 局部搜索\n穷举裁判", 1),
        ("真 QPU 后端\nD-Wave Leap · Qiskit\nFTQC 执行分级", 1),
    ], LIGHT2)

    for cx, _, _ in l4:
        arrow(ax, cx, 8.7, cx, 8.55, color=INDIGO)
    for cx, _, _ in l3:
        arrow(ax, cx, 6.6, cx, 5.75, color=INDIGO)
    arrow(ax, l2[0][0], 4.4, l1[0][0], 2.95, color=INDIGO, lw=1.8)
    arrow(ax, l2[0][0], 4.4, l1[1][0], 2.95, color=INDIGO, lw=1.8)
    arrow(ax, l1[1][1] + l1[1][2], 2.3, l1[2][1], 2.3, color=CYAN, lw=1.8, ls="--", style="<|-|>")
    ax.text((l1[1][0] + l1[2][0]) / 2, 2.42, "最优率对照", fontsize=8.8, color=CYAN, ha="center")
    ax.text(R - 0.05, 0.5, "研究线（CompoundBrain · 批量VCG · 增长市场 · 主动智能）经 MarketBrain 接口接入",
            fontsize=8.8, color=GRAY, ha="right")
    save(fig, "01-architecture.png")


# ================================================================ 02 调度管线
def fig_pipeline():
    fig, ax = plt.subplots(figsize=(13.6, 5.2))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 5)
    clean(ax)
    ax.set_title("量子调度管线：从任务批到 Born 坍缩读出", fontsize=15, fontweight="bold", pad=12)

    steps = [
        ("① 任务批\n挂起任务按\n优先级排序", LIGHT, GRAY),
        ("② 能力过滤\n空闲 Agent 池\n亲和度矩阵", LIGHT, GRAY),
        ("③ 哈密顿量\n编码\nw=优先级·亲和度\nJ=纠缠耦合", LIGHT, INDIGO),
        ("④ 子空间枚举\nP(n,m) 合法分配\n零罚项", LIGHT, INDIGO),
        ("⑤ 均匀叠加\n$|s\\rangle=\\Sigma\\sqrt{1/D}\\,|x\\rangle$", LIGHT, INDIGO),
        ("⑥ 演化\n绝热/QAOA\n闭式·精确", LIGHT, INDIGO),
        ("⑦ Born 坍缩\n$P(x)=|\\psi(x)|^2$\n真实量子概率", LIGHT, CYAN),
        ("⑧ 联合决策\n分配+概率\n+最优对照", LIGHT, GREEN),
    ]
    n = len(steps)
    L, R, gap = 0.18, 13.82, 0.30
    bw = (R - L - gap * (n - 1)) / n
    for i, (t, fc, ec) in enumerate(steps):
        x = L + i * (bw + gap)
        box(ax, x, 1.95, bw, 2.0, t, fc=fc, ec=ec, fs=9.2,
            weight="bold" if ec in (INDIGO, CYAN, GREEN) else "normal")
        if i:
            arrow(ax, x - gap + 0.02, 2.95, x - 0.02, 2.95, color=GRAY, ms=13)
    ax.text(7.0, 4.55, "调度器视角：每一批都是一次「编码 → 演化 → 观测」的完整量子过程", fontsize=11.5, ha="center", color=INDIGO, fontweight="bold")
    ax.text(7.0, 1.15, "关键点：约束不靠罚项——合法分配集合本身就是希尔伯特空间的基；\n演化算符在纤维上有闭式解（O(dim) 精确施加，零 Trotter 误差）",
            fontsize=9.5, ha="center", color=GRAY, linespacing=1.6)
    save(fig, "02-pipeline.png")


# ================================================================ 03 哈密顿量编码
def fig_hamiltonian():
    import numpy as np
    rng = np.random.default_rng(7)
    m, n = 6, 8
    w = rng.uniform(0.25, 1.0, (m, n))
    w = np.round(w, 2)
    fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(12.4, 4.5), gridspec_kw={"width_ratios": [1.15, 0.8, 1.25]})
    fig.suptitle("调度问题 → 物理问题：哈密顿量编码（示例实例 6任务×8agent，种子 7）", fontsize=14, fontweight="bold")

    im = a1.imshow(w, cmap="Purples", aspect="auto")
    a1.set_xticks(range(n), [f"A{j + 1}" for j in range(n)], fontsize=8.5)
    a1.set_yticks(range(m), [f"T{i + 1}" for i in range(m)], fontsize=8.5)
    a1.set_title("亲和度矩阵 w（优先级×能力匹配）", fontsize=11)
    for i in range(m):
        for j in range(n):
            a1.text(j, i, f"{w[i, j]:.2f}", ha="center", va="center", fontsize=7.2, color="white" if w[i, j] > 0.72 else DEEP)
    fig.colorbar(im, ax=a1, fraction=0.045)

    a2.set_xlim(0, 10); a2.set_ylim(0, 10); clean(a2)
    a2.set_title("纠缠 = 物理耦合", fontsize=11)
    pts = {"A1": (2.2, 7.4), "A3": (7.0, 7.9), "A5": (3.0, 2.4), "A7": (7.8, 2.9)}
    for k, (x, y) in pts.items():
        a2.add_patch(Circle((x, y), 0.55, fc=INDIGO, ec="none", zorder=3))
        a2.text(x, y - 1.15, k, ha="center", fontsize=9, color=DEEP)
    arrow(a2, 2.75, 7.4, 6.45, 7.85, color=AMBER, lw=2.6, style="<|-|>")
    a2.text(4.7, 8.6, "J>0 协作增益", fontsize=9.5, color=AMBER, ha="center")
    arrow(a2, 3.55, 2.4, 7.25, 2.85, color=RED, lw=2.6, style="<|-|>")
    a2.text(5.5, 1.35, "J<0 冲突惩罚", fontsize=9.5, color=RED, ha="center")
    a2.text(5.0, 4.9, "耦合项进入哈密顿量\n可实测翻转联合最优解\n（测试钉住的对照面）", fontsize=9, ha="center", color=GRAY)

    a3.set_xlim(0, 10); a3.set_ylim(0, 10); clean(a3)
    a3.set_title("代价哈密顿量 C（对角编码）", fontsize=11)
    a3.text(5, 8.6, r"$C\,|x\rangle = \left(\sum_{i,j} w_{ij}\,x_{ij} + \sum_{(i,k)\in E} J_{ik}\,x_{i}x_{k}\right)|x\rangle$", fontsize=12.5, ha="center")
    a3.text(5, 6.1, "基态 = 最优联合分配\n（能量取负福利：E(x) = −W(x)）", fontsize=10, ha="center", color=DEEP)
    a3.text(5, 3.4, "无耦合 → 线性分配问题\n匈牙利 O(n³) 可精确求解（互证面）\n有耦合 → QAP 型 NP-hard\n子空间精确演化主场", fontsize=9.5, ha="center", color=GRAY, linespacing=1.7)
    save(fig, "03-hamiltonian.png")


# ================================================================ 04 子空间维度对比
def fig_subspace():
    import numpy as np
    fig, ax = plt.subplots(figsize=(9.8, 5.6))
    cases = ["5任务×6agent", "6×8", "7×9", "8×10"]
    full = [float(2 ** e) for e in (30, 48, 63, 80)]
    sub = [float(math.perm(n_, m_)) for m_, n_ in ((5, 6), (6, 8), (7, 9), (8, 10))]
    x = np.arange(4)
    ax.bar(x - 0.2, full, 0.38, color=RED, alpha=0.85, label="全空间维度 2^(m·n)")
    ax.bar(x + 0.2, sub, 0.38, color=INDIGO, label="约束子空间维度 P(n,m)")
    ax.set_yscale("log")
    ax.set_xticks(x, cases)
    ax.set_ylabel("希尔伯特空间维度（对数刻度）")
    ax.set_title("为什么「等效 80 量子比特」是可能的：约束即基", fontsize=14, fontweight="bold", pad=12)
    for i, (f, s) in enumerate(zip(full, sub)):
        ax.text(i - 0.2, f * 1.6, f"2^{[30, 48, 63, 80][i]}", ha="center", fontsize=9, color=RED)
        ax.text(i + 0.2, s * 1.6, f"{s:,}", ha="center", fontsize=8.6, color=INDIGO, rotation=0)
    ax.annotate("$2^{80}\\approx1.2\\times10^{24}$ 维\n≈ 10¹⁵ TB 内存（不可行）", xy=(3 - 0.2, full[3]), xytext=(1.35, 1e18),
                fontsize=9.5, color=RED, arrowprops=dict(arrowstyle="->", color=RED))
    ax.annotate("1,814,400 维 ≈ 150 MB\n42 秒端到端精确解（实测）", xy=(3 + 0.2, sub[3]), xytext=(2.1, 3e2),
                fontsize=9.5, color=INDIGO, arrowprops=dict(arrowstyle="->", color=INDIGO))
    ax.legend(loc="upper left", frameon=False)
    ax.text(0.01, -0.16, "P(n,m) = n!/(n−m)!：每任务占一个不同 agent 的所有排列——「每行恰一个 1」的约束直接长在基上，罚项为零。",
            transform=ax.transAxes, fontsize=9, color=GRAY)
    save(fig, "04-subspace.png")


# ================================================================ 05 纤维混合器
def fig_fiber():
    fig, ax = plt.subplots(figsize=(11.2, 6.2))
    ax.set_xlim(0, 12); ax.set_ylim(0, 8.6)
    clean(ax)
    ax.set_title("纤维混合器：约束子空间上的闭式幺正（示意：5 agent · 3 任务）", fontsize=14, fontweight="bold", pad=12)

    tasks = {"T1": (2.0, 7.5), "T2": (5.4, 7.5), "T3": (8.8, 7.5)}
    agents = {"A2": (1.4, 3.4), "A4": (4.8, 3.4), "A1": (8.2, 3.4), "A3": (10.8, 3.4)}
    for k, (x, y) in tasks.items():
        ax.add_patch(Circle((x, y), 0.42, fc=DEEP, ec="none", zorder=4))
        ax.text(x, y + 0.85, k, ha="center", fontsize=10.5, color=DEEP, fontweight="bold")
    for k, (x, y) in agents.items():
        fixed = k in ("A2", "A4")
        ax.add_patch(Circle((x, y), 0.42, fc=(AMBER if fixed else INDIGO), ec="none", zorder=4))
        ax.text(x, y - 0.78, k, ha="center", fontsize=10, color=(AMBER if fixed else INDIGO), fontweight="bold")

    # 纤维固定部分：T2→A2、T3→A4（橙色）
    arrow(ax, 5.4, 7.05, 4.95, 3.9, color=AMBER, lw=2.4)
    arrow(ax, 8.8, 7.05, 5.0, 3.9, color=AMBER, lw=2.4)
    ax.text(7.35, 5.75, "纤维固定部分\nT2→A2 · T3→A4", fontsize=9.8, color=AMBER, ha="left")

    # T1 的三个自由落点（靛蓝虚线）
    for tx, ty in ((8.2, 3.4), (10.8, 3.4), (1.4, 3.4)):
        arrow(ax, 2.0, 7.05, tx, 3.95, color=INDIGO, lw=1.5, ls="--")
    ax.text(2.35, 5.8, "T1 的自由落点\n（其余任务固定）", fontsize=9.8, color=INDIGO, ha="left")

    # 完全图 K3（底部，避开标签）
    for (x1, y1), (x2, y2) in [((8.2, 2.25), (10.8, 2.25)), ((8.2, 2.25), (1.4, 2.25)), ((10.8, 2.25), (1.4, 2.25))]:
        arrow(ax, x1, y1, x2, y2, color=INDIGO, lw=1.8, style="<|-|>", ms=10)
    ax.text(9.5, 2.62, "完全图 $K_3$", fontsize=10.5, color=INDIGO, fontweight="bold", ha="center")

    box(ax, 0.35, 0.25, 11.3, 1.30,
        "单任务移动算符 $A_t$ 在每条纤维上限制为完全图 $K_k = J - I$\n"
        "$\\Rightarrow$ $\\exp(i\\theta A_t)$ 有闭式解：逐纤维精确施加，$O(\\mathrm{dim})$ 完成，零 Trotter 误差；$n=m$ 时切换换位混合器",
        fc=LIGHT2, ec=INDIGO, fs=9.6)
    save(fig, "05-fiber.png")


# ================================================================ 06 QAOA 电路
def fig_qaoa():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.2, 4.9), gridspec_kw={"width_ratios": [1.35, 1]})
    fig.suptitle("QAOA 变分电路与两种角度布局（layer / ma-QAOA）", fontsize=14, fontweight="bold")

    a = a1
    a.set_xlim(0, 13); a.set_ylim(0, 8); clean(a)
    a.set_title("交替层 QAOA（p 层）", fontsize=11.5)
    for i in range(4):
        y = 6.4 - i * 1.5
        a.plot([0.8, 12.2], [y, y], color=DEEP, lw=1.4, zorder=1)
        a.text(0.35, y, f"q{i + 1}", fontsize=9, ha="center", color=GRAY)
    a.text(6.5, 7.5, "$|s\\rangle$ = 均匀叠加（或纤维初态）", fontsize=9.5, ha="center", color=GRAY)
    box(a, 1.7, 1.4, 2.25, 6.3, "代价层\n$U_C(\\gamma)$\n\n$e^{-i\\gamma C}$\n哈密顿量编码", fc="#E8EAFB", ec=INDIGO, fs=8.8)
    box(a, 4.25, 1.4, 2.25, 6.3, "混合层\n$U_M(\\beta)$\n\n纤维旋转 / X 旋转\n探索合法解", fc="#E4F6FA", ec=CYAN, fs=7.8)
    box(a, 6.8, 1.4, 2.25, 6.3, "代价层\n$U_C(\\gamma_2)$", fc="#E8EAFB", ec=INDIGO, fs=8.8)
    box(a, 9.35, 1.4, 2.25, 6.3, "混合层\n$U_M(\\beta_2)$", fc="#E4F6FA", ec=CYAN, fs=8.8)
    box(a, 11.9, 1.4, 0.95, 6.3, "测量\n⟨E⟩", fc=LIGHT, ec=GREEN, fs=8.6)
    a.text(6.5, 0.55, "角度 (γ, β) 由坐标下降离线优化；末态 Born 坍缩读出分配", fontsize=9, ha="center", color=GRAY)

    b = a2
    b.set_xlim(0, 10); b.set_ylim(0, 10); clean(b)
    b.set_title("角度布局：layer vs multi（v1.10）", fontsize=11.5)
    box(b, 0.4, 5.6, 4.2, 3.6, "layer 模式\n\n每层一对角度\n$(\\gamma_1,\\dots,\\gamma_p;\\ \\beta_1,\\dots,\\beta_p)$\n2p 个参数", fc=LIGHT2, ec=GRAY, fs=9.5)
    box(b, 5.2, 5.6, 4.4, 3.6, "multi 模式（ma-QAOA）\n\n每个混合算子独立角度\n逐量子比特 / 逐纤维组\n代价角仍逐层", fc="#E8EAFB", ec=INDIGO, fs=9.5)
    arrow(b, 4.65, 7.4, 5.15, 7.4, color=INDIGO, lw=2)
    box(b, 0.4, 0.5, 9.2, 4.5,
        "支配性是构造性定理（非经验观察）：\nmulti 以 layer 最优角的展开为种子（末态逐位相同），\n种子化坐标下降只接受严格改进\n$\\Rightarrow$ 同一变分目标下 $\\langle E\\rangle_{multi}\\leq\\langle E\\rangle_{layer}$ 恒成立\n\n实测 6×6 命中率 17→29/40 (p=1)、27→35/40 (p=2)",
        fc="white", ec=GREEN, fs=9.3)
    save(fig, "06-qaoa.png")


# ================================================================ 07 绝热退火
def fig_annealing():
    import numpy as np
    s = np.linspace(0, 1, 400)
    gap = 0.55 + 0.45 * np.cos(np.pi * s) ** 2
    e0 = -(0.5 + 0.5 * np.cos(np.pi * s)) - 0.5 * gap
    e1 = e0 + gap
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11.6, 4.6))
    fig.suptitle("绝热退火：慢过临界点，基态全程跟随（能级为示意图）", fontsize=14, fontweight="bold")

    a1.plot(s, e0, color=INDIGO, lw=2.6, label="基态 E₀(s)")
    a1.plot(s, e1, color=AMBER, lw=2.2, ls="--", label="第一激发态 E₁(s)")
    a1.fill_between(s, e0, e1, color=INDIGO, alpha=0.06)
    imin = int(np.argmin(gap))
    a1.annotate("最小 gap（临界点）\n步长在此最细", xy=(s[imin], (e0[imin] + e1[imin]) / 2), xytext=(0.28, 0.42),
                fontsize=9.5, color=RED, arrowprops=dict(arrowstyle="->", color=RED))
    a1.set_xlabel("演化进度 s：H(s) = (1−s)·(−ΣA) + s·C")
    a1.set_ylabel("能量")
    a1.set_title("能级随 s 的演化（避免交叉）", fontsize=11.5)
    a1.legend(frameon=False, loc="center left")

    a2.set_xlim(0, 10); a2.set_ylim(0, 10); clean(a2)
    a2.set_title("本仓的执行口径", fontsize=11.5)
    box(a2, 0.5, 6.4, 9.0, 2.9,
        "初态：均匀叠加 |s⟩\n(Perron–Frobenius：非负邻接阵的顶本征矢\n恰为 −ΣA 的基态——初态即基态，无制备缺口)",
        fc="#E4F6FA", ec=CYAN, fs=9.8)
    box(a2, 0.5, 3.3, 9.0, 2.6,
        "离散 s 网格数值积分（默认 τ=20、steps=150）\n代价相位走复乘递推：$\gamma_t$ 线性 $\Rightarrow$ ph(t)=ph(t−1)·z\n纤维旋转闭式施加——每步都是精确幺正",
        fc="#E8EAFB", ec=INDIGO, fs=9.8)
    box(a2, 0.5, 0.4, 9.0, 2.4,
        "8×10 实例（1,814,400 维）实测：\n退火最优率 100.0%（穷举枚举裁判）",
        fc="#E9F9F1", ec=GREEN, fs=9.8)
    save(fig, "07-annealing.png")


# ================================================================ 08 Born 坍缩
def fig_born():
    import numpy as np
    xs = np.arange(12)
    amp = np.cos((xs - 3.2) * 0.55) * np.exp(-((xs - 3.2) ** 2) / 26) + 0.32
    amp = amp / np.sqrt((amp ** 2).sum())
    prob = amp ** 2
    labels = [f"$|x_{{{i}}}\\rangle$" for i in xs]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11.8, 4.4), gridspec_kw={"width_ratios": [1, 1]})
    fig.suptitle("Born 规则坍缩：概率就是末态振幅的模方（12 基态玩具示例，示意）", fontsize=13.5, fontweight="bold")

    a1.bar(xs, amp, color=INDIGO, alpha=0.85)
    a1.set_xticks(xs, labels, fontsize=8.5)
    a1.set_ylabel("复振幅 ψ(x)（实部示意）")
    a1.set_title("末态叠加：全部合法分配共存", fontsize=11.5)

    a2.bar(xs, prob, color=CYAN, alpha=0.9)
    top = np.argsort(prob)[-3:]
    for i in top:
        a2.text(i, prob[i] + 0.004, f"top-{list(top).index(i) + 1}", ha="center", fontsize=8.6, color=GREEN, fontweight="bold")
    a2.set_xticks(xs, labels, fontsize=8.5)
    a2.set_ylabel("概率 P(x) = |ψ(x)|²")
    a2.set_title("观测量子概率 → 决策读出（top-K 候选）", fontsize=11.5)
    a2.text(0.02, -0.2, "调度器的 decision.probability 是真实量子概率，不是分数归一化；top-K 用线性选择（O(dim)）取代全量排序。",
            transform=a2.transAxes, fontsize=8.8, color=GRAY)
    save(fig, "08-born.png")


# ================================================================ 09 规模阶梯
def fig_ladder():
    import numpy as np
    cases = ["5×6", "6×8", "7×9", "8×10"]
    dims = [720, 20160, 181440, 1814400]
    build = [4, 49, 575, 8700]
    anneal = [9, 296, 2900, 32600]
    x = np.arange(4)
    fig, ax = plt.subplots(figsize=(10.2, 5.8))
    ax.bar(x, dims, 0.5, color=INDIGO, alpha=0.9)
    ax.set_yscale("log")
    ax.set_xticks(x, [f"{c}\n（{d:,} 维）" for c, d in zip(cases, dims)])
    ax.set_ylabel("子空间维度（对数刻度）")
    ax.set_title("子空间规模阶梯：等效 30→80 量子比特，最优率全程 100%（实测）", fontsize=14, fontweight="bold", pad=12)
    for i, d in enumerate(dims):
        ax.text(i, d * 1.25, f"{d:,}", ha="center", fontsize=9, color=INDIGO)
    ax2 = ax.twinx()
    ax2.plot(x, build, "o-", color=AMBER, lw=2, ms=6, label="构建时间")
    ax2.plot(x, anneal, "s-", color=CYAN, lw=2, ms=6, label="退火时间")
    ax2.set_yscale("log")
    ax2.set_ylabel("时间（ms，对数刻度）")
    ax2.grid(False)
    for i, (b, an) in enumerate(zip(build, anneal)):
        ax2.text(i + 0.06, b * 1.3, f"{b}ms" if b < 1000 else f"{b / 1000:g}s", fontsize=8.6, color=AMBER)
        ax2.text(i + 0.06, an * 1.3, f"{an}ms" if an < 1000 else f"{an / 1000:g}s", fontsize=8.6, color=CYAN)
    eq = [30, 48, 63, 80]
    for i, e in enumerate(eq):
        ax.text(i, dims[i] * 0.45, f"等效 {e} qubit", ha="center", fontsize=8.6, color="white", fontweight="bold")
    h1, l1 = ax2.get_legend_handles_labels()
    ax2.legend(h1, l1, loc="upper left", frameon=False)
    ax.text(0.01, -0.22, "贪心差距 14.1% / 16.5% / 5.2% / 6.7%；退火最优率四档全部 100.0%（穷举裁判）。时间口径：同机同状态实测，绝对值随热状态浮动。",
            transform=ax.transAxes, fontsize=9, color=GRAY)
    save(fig, "09-ladder.png")


# ================================================================ 10 线性赛道（真实数据）
def fig_linear():
    import numpy as np
    lin = [r for r in ROWS if r["track"] == "linear"]
    solvers = [("subspace-exact", "量子子空间引擎", INDIGO), ("hungarian", "匈牙利 O(n³)", AMBER)]
    fig, axes = plt.subplots(1, 2, figsize=(11.6, 4.9), sharey=True, sharex=True)
    fig.suptitle("线性赛道（25 实例，真实 bench 报告）：量子 × 匈牙利 逐点一致（独立算法互证）", fontsize=13.5, fontweight="bold")
    allv = []
    for r in lin:
        allv.append(float(r["optimal"]))
    lo, hi = min(allv), max(allv)
    for ax, (solver, label, color) in zip(axes, solvers):
        pts = [(float(r["optimal"]), float(r["welfare"])) for r in lin if r["solver"] == solver]
        hits = sum(1 for r in lin if r["solver"] == solver and r["hit"])
        ax.plot([lo, hi], [lo, hi], color=GRID, lw=1.2, ls="--", zorder=1)
        ax.scatter([p[0] for p in pts], [p[1] for p in pts], s=46, color=color, alpha=0.85, zorder=3, edgecolor="white", lw=0.6)
        ax.set_title(f"{label} — {hits}/25 命中最优", fontsize=11.5)
        ax.set_xlabel("穷举枚举最优福利（裁判）")
        ax.set_aspect("equal")
    axes[0].set_ylabel("求解器福利")
    fig.text(0.5, 0.015, "数据：out/bench/bench-report.json（npm run bench 一键重建，公开种子）；两种独立算法落在同一条对角线上。",
             ha="center", fontsize=9, color=GRAY)
    save(fig, "10-bench-linear.png")


# ================================================================ 11 耦合赛道（真实数据）
def fig_nphard():
    import numpy as np
    sub = [r for r in ROWS if r["instanceId"].startswith("np-hard-m6n8")]
    order = [("greedy", "贪心"), ("greedy+local-search", "局部搜索"), ("simulated-annealing", "模拟退火"), ("hungarian", "匈牙利(耦合外行)"), ("subspace-exact", "量子子空间")]
    hits = [sum(1 for r in sub if r["solver"] == s and r["hit"]) for s, _ in order]
    labels = [l for _, l in order]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.0, 4.8), gridspec_kw={"width_ratios": [1.05, 1]})
    fig.suptitle("NP-hard 耦合赛道（6×8 × 5 公开种子，统一记账，真实 bench 报告）", fontsize=13.5, fontweight="bold")

    colors = [GRAY, GRAY, AMBER, CYAN, INDIGO]
    bars = a1.bar(labels, hits, 0.58, color=colors, alpha=0.92)
    a1.axhline(5, color=GRID, lw=1, ls="--")
    a1.set_ylim(0, 5.8)
    a1.set_ylabel("命中最优实例数（/5）")
    a1.set_title("命中数：量子 5/5 全胜", fontsize=11.5)
    for b, h in zip(bars, hits):
        a1.text(b.get_x() + b.get_width() / 2, h + 0.12, f"{h}/5", ha="center", fontsize=11, fontweight="bold",
                color=INDIGO if h == 5 else DEEP)
    a1.tick_params(axis="x", labelsize=9)

    data, cols, labs = [], [], []
    for s, l in order:
        gaps = [float(r["gap"]) for r in sub if r["solver"] == s]
        data.append(gaps)
        cols.append(colors[order.index((s, l))])
        labs.append(l)
    vp = a2.violinplot(data, showmedians=True, widths=0.85)
    for body, c in zip(vp["bodies"], cols):
        body.set_facecolor(c)
        body.set_alpha(0.35)
    for part in ("cmins", "cmaxes", "cbars", "cmedians"):
        vp[part].set_color(DEEP)
        vp[part].set_linewidth(1.1)
    a2.set_xticks(range(1, 6), labs, fontsize=9)
    a2.set_ylabel("福利差距 gap（对最优）")
    a2.set_title("差距分布：量子全部贴 0", fontsize=11.5)
    fig.text(0.5, 0.015, "数据：out/bench/bench-report.json；裁判＝穷举枚举，双方同一本账（v1.11 勘误后的统一记账）。",
             ha="center", fontsize=9, color=GRAY)
    save(fig, "11-bench-nphard.png")


# ================================================================ 12 确定性并行
def fig_parallel():
    import numpy as np
    fig, ax = plt.subplots(figsize=(9.6, 5.2))
    names = ["v1.5 串行基线", "v1.6 串行内核", "v1.6 16 线程并行"]
    times = [285.8, 56.2, 12.2]
    colors = [GRAY, AMBER, INDIGO]
    bars = ax.bar(names, times, 0.52, color=colors, alpha=0.92)
    ax.set_yscale("log")
    ax.set_ylabel("演化阶段耗时（秒，对数刻度）")
    ax.set_title("v1.6 确定性并行演化：8×10 实例（1,814,400 维）同机同状态实测", fontsize=13.5, fontweight="bold", pad=12)
    mult = [1, "5.1×", "23.5×"]
    for b, t, mm in zip(bars, times, mult):
        ax.text(b.get_x() + b.get_width() / 2, t * 1.18, f"{t}s" + (f"  ({mm})" if mm != 1 else ""), ha="center",
                fontsize=11, fontweight="bold", color=DEEP)
    ax.text(0.5, 0.06, "并行＝确定性：worker_threads + SharedArrayBuffer + Atomics 屏障，每条纤维完整归属单线程，"
                       "与串行路径共享同一份内核源码——结果逐位一致（测试逐位断言钉死）",
            transform=ax.transAxes, ha="center", fontsize=9.3, color=GRAY,
            bbox=dict(boxstyle="round,pad=0.45", fc=LIGHT2, ec=GRID))
    save(fig, "12-parallel.png")


# ================================================================ 13 ma-QAOA 支配
def fig_ma_qaoa():
    import numpy as np
    fig, ax = plt.subplots(figsize=(9.4, 5.0))
    x = np.arange(2)
    layer = [17, 27]
    multi = [29, 35]
    ax.bar(x - 0.18, layer, 0.34, color=GRAY, alpha=0.9, label="layer 角度布局")
    ax.bar(x + 0.18, multi, 0.34, color=INDIGO, alpha=0.92, label="multi 角度布局（ma-QAOA）")
    ax.axhline(40, color=GRID, lw=1, ls="--")
    ax.text(1.42, 40.5, "共 40 实例", fontsize=8.8, color=GRAY)
    for i in range(2):
        ax.text(i - 0.18, layer[i] + 0.6, f"{layer[i]}/40", ha="center", fontsize=10, color=DEEP)
        ax.text(i + 0.18, multi[i] + 0.6, f"{multi[i]}/40", ha="center", fontsize=10.5, color=INDIGO, fontweight="bold")
    ax.set_xticks(x, ["p = 1", "p = 2"])
    ax.set_ylim(0, 44)
    ax.set_ylabel("命中最优实例数（/40）")
    ax.set_title("ma-QAOA 构造性支配（6×6 子空间变分区，实测）", fontsize=13.5, fontweight="bold", pad=12)
    ax.legend(frameon=False, loc="upper left")
    ax.text(0.5, -0.16, "支配是定理：multi 以 layer 最优角展开态为种子（逐位相同）＋只接受严格改进 ⇒ ⟨E⟩_multi ≤ ⟨E⟩_layer；"
                        "全空间坍缩读数已饱和、welfare 增益边际——如实不宣称。", transform=ax.transAxes, ha="center", fontsize=8.8, color=GRAY)
    save(fig, "13-ma-qaoa.png")


# ================================================================ 14 市场机制
def fig_market():
    import numpy as np
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.4, 5.2), gridspec_kw={"width_ratios": [1.15, 1]})
    fig.suptitle("市场机制研究线：智力资本市场 + 在线校准（真实 LLM 实验，n=2112）", fontsize=13.5, fontweight="bold")

    a = a1
    a.set_xlim(0, 12); a.set_ylim(0, 10); clean(a)
    a.set_title("增广 WDP + Clarke 支付闭环", fontsize=11.5)
    box(a, 0.3, 7.6, 3.2, 1.7, "任务批 + 报价 bids\n（DSIC 域）", fc=LIGHT, ec=GRAY, fs=9.0)
    box(a, 8.55, 7.6, 3.15, 1.7, "联合分配 X*", fc="#E9F9F1", ec=GREEN, fs=9.3)
    box(a, 3.75, 7.6, 4.55, 1.7, "增广 WDP\nargmax Σ(v·q̂ − b) + Σg", fc="#E8EAFB", ec=INDIGO, fs=9.0)
    box(a, 4.15, 5.0, 3.6, 1.6, "Clarke pivot 支付\nDSIC 定理成立", fc="#E4F6FA", ec=CYAN, fs=9.3)
    box(a, 0.3, 2.2, 5.3, 2.0, "在线校准：结算流 →\nBernoulli 极大似然 $(\\hat\\alpha,\\hat\\beta,R^2)$", fc=LIGHT2, ec=AMBER, fs=9.3)
    box(a, 6.6, 2.2, 5.1, 2.0, "$\\hat q(k)$ 学习曲线 + g 增长影子价值\n级数和天然有界", fc=LIGHT2, ec=AMBER, fs=9.3)
    arrow(a, 3.55, 8.45, 3.7, 8.45, color=GRAY)
    arrow(a, 8.35, 8.45, 8.5, 8.45, color=GRAY)
    arrow(a, 5.95, 7.55, 5.95, 6.65, color=GRAY)
    arrow(a, 7.2, 5.8, 8.5, 7.55, color=GRAY)
    arrow(a, 4.6, 4.95, 2.9, 4.25, color=AMBER, ls="--")
    arrow(a, 8.9, 4.25, 6.6, 4.95, color=AMBER, ls="--")
    arrow(a, 2.9, 4.25, 4.5, 5.0, color=AMBER, ls="--")
    a.text(6, 0.9, "advise() 相变定律顾问：K_min · δ_max · β_min（培训 vs 雇佣的封闭相变口袋）", fontsize=9, ha="center", color=GRAY)

    b = a2
    k = np.linspace(0, 60, 300)
    base, alpha, beta = 0.458, 0.58, 0.09
    q = base + alpha * (1 - base) * (1 - np.exp(-beta * k))
    b.plot(k, q, color=INDIGO, lw=2.6, label="健康案例库：$\hat q(k)$ 拟合")
    b.axhline(0.747, color=INDIGO, lw=1, ls=":")
    b.text(41, 0.757, "实测 0.458→0.747（+0.289）", fontsize=8.8, color=INDIGO)
    qp = 0.129 + (0.747 - 0.129) * np.exp(-0.35 * (k - 30))
    mask = k >= 30
    b.plot(k[mask], qp[mask], color=RED, lw=2.2, ls="--", label="案例库污染：q 坍缩 0.129")
    b.axhline(0.129, color=RED, lw=1, ls=":")
    b.text(40, 0.145, "污染 = 负资本（增益 −0.704）", fontsize=8.8, color=RED)
    b.set_xlabel("累积案例数 k")
    b.set_ylabel("隐性技能 q̂")
    b.set_title("学习曲线与污染坍缩（30 例后污染，示意重建）", fontsize=11)
    b.set_ylim(0, 0.9)
    b.legend(frameon=False, fontsize=9, loc="lower right")
    save(fig, "14-market.png")


# ================================================================ 15 执行分级路由
def fig_execution_tier():
    fig, ax = plt.subplots(figsize=(11.2, 5.6))
    ax.set_xlim(0, 12); ax.set_ylim(0, 9)
    clean(ax)
    ax.set_title("v1.11 执行层级路由：提交前先过 FTQC 资源估算器", fontsize=14, fontweight="bold", pad=12)

    box(ax, 0.3, 6.7, 3.3, 1.6, "新任务提交\n（电路画像：比特数 / 深度 / T 数）", fc=LIGHT, ec=GRAY, fs=9.3)
    box(ax, 4.2, 6.7, 3.6, 1.6, "FTQC 资源估算器\nqLDPC gross [[144,12,12]] / surface\n码目录 · 显式假设表", fc="#E8EAFB", ec=INDIGO, fs=9.2)
    arrow(ax, 3.7, 7.5, 4.15, 7.5, color=GRAY)

    box(ax, 8.6, 7.2, 3.1, 1.2, "① NISQ 直发\n资源在容错预算内", fc="#E9F9F1", ec=GREEN, fs=9.3)
    box(ax, 8.6, 5.4, 3.1, 1.4, "② FTQC 等待队列\nFtqcDeferredError\n携带完整资源画像", fc="#FFF4E0", ec=AMBER, fs=9.3)
    box(ax, 8.6, 3.6, 3.1, 1.2, "③ 经典精确引擎回退\n功能不中断", fc=LIGHT, ec=GRAY, fs=9.3)
    arrow(ax, 7.85, 7.7, 8.55, 7.8, color=GREEN)
    arrow(ax, 7.85, 7.5, 8.55, 6.1, color=AMBER)
    arrow(ax, 7.85, 7.3, 8.55, 4.2, color=GRAY)

    box(ax, 0.3, 3.4, 7.2, 2.4,
        "估算器输出（显式假设，不外推）：\n逻辑比特数 · 物理比特数 · 码距 d · T 工厂台数 · 运行时长\n—— 每个数字都带来源与假设注释，随 FtqcDeferredError 交给排队方",
        fc=LIGHT2, ec=INDIGO, fs=9.3)
    arrow(ax, 5.0, 6.65, 5.0, 5.85, color=INDIGO, lw=1.8)
    ax.text(6, 1.6, "边界如实：估算是资源画像不是硬件声明；三态路由本身由 execution-tier 测试钉住（14 用例：数值内核 · 三态 · 接缝）",
            fontsize=9, ha="center", color=GRAY)
    save(fig, "15-execution-tier.png")


# ================================================================ 16 质量门禁
def fig_quality():
    import numpy as np
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.0, 4.7), gridspec_kw={"width_ratios": [1.1, 1]})
    fig.suptitle("质量门禁体系：六道门禁 + 覆盖率棘轮（2026-09 全量绿）", fontsize=13.5, fontweight="bold")

    a = a1
    a.set_xlim(0, 10); a.set_ylim(0, 10); clean(a)
    gates = [
        ("npm test", "520 用例 · 0 失败\n48 文件 / 152 套件", GREEN),
        ("npm run typecheck", "strict + noUncheckedIndexedAccess\n全仓 0 错", GREEN),
        ("npm run lint", "类型感知 strict 集\n18 条抓 bug 规则 · 0 红", GREEN),
        ("npm run coverage", "94.2% 语句 / 86.2% 分支\n92/82/92/92 防回归门槛", INDIGO),
        ("npm run knip", "死代码 / 未用导出 / 未用依赖\n0 发现", GREEN),
        ("npm run format:check", "Prettier 全仓绿", GREEN),
    ]
    for i, (name, desc, color) in enumerate(gates):
        y = 8.6 - i * 1.42
        lines = desc.split("\n")
        a.add_patch(FancyBboxPatch((0.2, y - 0.5), 4.0, 1.15, boxstyle="round,pad=0.02,rounding_size=0.05", fc="white", ec=color, lw=1.5))
        a.text(2.2, y + 0.08, name, ha="center", fontsize=9.6, fontweight="bold", color=DEEP)
        a.text(2.2, y - 0.27, lines[0], ha="center", fontsize=7.8, color=GRAY)
        a.add_patch(Circle((4.75, y + 0.08), 0.16, fc=color, ec="none"))
        a.text(5.9, y + 0.08, lines[1] if len(lines) > 1 else lines[0], ha="center", fontsize=8.6, color=GRAY)

    b = a2
    names = ["语句", "分支", "函数", "行"]
    cov = [94.19, 86.24, 94.86, 94.19]
    thr = [92, 82, 92, 92]
    x = np.arange(4)
    b.bar(x, cov, 0.5, color=INDIGO, alpha=0.9, label="实测覆盖率")
    for i, (c, t) in enumerate(zip(cov, thr)):
        b.plot([i - 0.32, i + 0.32], [t, t], color=RED, lw=2.2)
        b.text(i, c + 0.5, f"{c:.2f}%", ha="center", fontsize=9.5, color=DEEP, fontweight="bold")
        b.text(i, t - 2.2, f"门槛 {t}%", ha="center", fontsize=8, color=RED)
    b.set_xticks(x, names)
    b.set_ylim(75, 100)
    b.set_ylabel("覆盖率（%）")
    b.set_title("c8 覆盖率 vs 防回归门槛", fontsize=11.5)
    b.legend(frameon=False, loc="lower right")
    save(fig, "16-quality.png")


# ================================================================ 17 热路径
def fig_hotpath():
    import numpy as np
    fig, ax = plt.subplots(figsize=(10.0, 5.0))
    names = ["Agent 注册", "调度吞吐\n(200 Agent 并发)", "通信总线", "DSH 集成"]
    vals = [28500, 2702, 487448, 4791]
    mult = ["4.7×", "83×", "4.3×", "3.2×"]
    colors = [GRAY, INDIGO, CYAN, AMBER]
    bars = ax.bar(names, vals, 0.52, color=colors, alpha=0.92)
    ax.set_yscale("log")
    ax.set_ylabel("吞吐（ops/s · msgs/s，对数刻度）")
    ax.set_title("平台热路径性能（经典 hybrid 模式，npm run performance 一键复现）", fontsize=13.5, fontweight="bold", pad=12)
    for b, v, m in zip(bars, vals, mult):
        ax.text(b.get_x() + b.get_width() / 2, v * 1.25, f"{v:,}\n优化 {m}", ha="center", fontsize=9.3, color=DEEP, fontweight="bold")
    ax.text(0.5, -0.24, "实测环境 Node.js v24 / Windows / 2026-08；绝对吞吐随机器与热状态浮动，相对优化倍数是稳定口径。"
                        ">10³ tasks/s 的高吞吐热路径仍走经典启发式（诚实边界）。", transform=ax.transAxes, ha="center", fontsize=8.8, color=GRAY)
    save(fig, "17-hotpath.png")


# ================================================================ 18 版本时间线
def fig_timeline():
    fig, ax = plt.subplots(figsize=(12.2, 5.8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 10)
    clean(ax)
    ax.set_title("量子调度核心演进时间线（v1.0 → v1.12）", fontsize=15, fontweight="bold", pad=14)
    ax.plot([0.5, 11.5], [5, 5], color=GRID, lw=3, zorder=1)
    marks = [
        (1.15, "v1.0", "平台基座\n经典启发式调度\n+83× 性能优化", 1),
        (2.55, "v1.1", "真实量子物理\n复振幅态矢量 · QAOA\n绝热退火 · Born 坍缩", -1),
        (3.95, "v1.2", "约束子空间\n纤维闭式混合器\n等效 80 量子比特", 1),
        (5.35, "v1.3", "认证基线\n匈牙利逐点互证\nNP-hard 5/5 全胜", -1),
        (6.55, "v1.4", "真 QPU 后端\nD-Wave · Qiskit\n三道闸门", 1),
        (7.75, "v1.6", "确定性并行\n演化 23.5×\n逐位一致", -1),
        (8.95, "v1.9/10", "CVaR 目标\nma-QAOA 构造支配\n（定理级）", 1),
        (10.15, "v1.11", "QuantumSched-Bench\n可复现基准 + FTQC\n执行分级路由", -1),
        (11.15, "v1.12", "质量交付波\n错误面 · 单源化\n守卫 · 文档对账", 1),
    ]
    for x, v, desc, side in marks:
        ax.add_patch(Circle((x, 5), 0.14, fc=INDIGO, ec="white", lw=1.5, zorder=4))
        y = 6.3 if side > 0 else 2.5
        ax.plot([x, x], [5, y - 0.65 if side > 0 else y + 1.35], color=GRID, lw=1.1, zorder=2)
        ax.text(x, y + 0.75 if side > 0 else y + 1.25, v, ha="center", fontsize=10.5, fontweight="bold", color=INDIGO)
        ax.text(x, y - 0.15 if side > 0 else y, desc, ha="center", fontsize=8.2, color=DEEP, va="top" if side > 0 else "bottom", linespacing=1.5)
    save(fig, "18-timeline.png")


if __name__ == "__main__":
    fig_architecture()
    fig_pipeline()
    fig_hamiltonian()
    fig_subspace()
    fig_fiber()
    fig_qaoa()
    fig_annealing()
    fig_born()
    fig_ladder()
    fig_linear()
    fig_nphard()
    fig_parallel()
    fig_ma_qaoa()
    fig_market()
    fig_execution_tier()
    fig_quality()
    fig_hotpath()
    fig_timeline()
    print("all diagrams rendered ->", HERE, VER)
    if OVERFLOWS:
        print("!! OVERFLOW WARNINGS (text wider/taller than box):")
        for o in OVERFLOWS:
            print("   ", o)
    else:
        print("overflow self-check: no box text exceeds its box (<=102%)")
