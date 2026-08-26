/**
 * rules.ts — SSiD 全家桶成就定义（纯数据/纯函数，零依赖可测）。
 *
 * 计数语义只含「工具名/事件类型/时间」级别的标量：工具调用名与成功与否、
 * 会话/回合计数、usage token 数（叶级标量）、当天时刻。绝不读取消息正文、
 * 文件内容或错误详情。GenUI 类别由 client 侧读取 genui 插件的计数
 * localStorage 合并（见 client/index.tsx）。
 */

export type Category = '启程' | '记忆' | '审计' | 'GenUI' | '工具' | '行为' | '隐藏'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  icon: string
  category: Category
  rarity: Rarity
  hidden?: boolean
  /** 阈值规则：计数器键 → 目标值。 */
  threshold: { counter: string; target: number }
}

/** 计数键（leaf scalars only）。 */
export const KEYS = {
  sessions: 'sessions',
  turns: 'turns',
  tools: 'tools',
  toolsUsed: 'toolsUsed',
  memoryTools: 'memoryTools',
  memorySaved: 'memorySaved',
  memoryConfirmed: 'memoryConfirmed',
  templateTools: 'templateTools',
  audits: 'audits',
  genuiUnlocked: 'genuiUnlocked',
  genuiFences: 'genuiFences',
  marathonTurns: 'marathonTurns',
  midnightTurns: 'midnightTurns',
  selfQueries: 'selfQueries',
  tokens: 'tokens',
} as const

/** SSiD 全家桶成就表。 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ── 启程 ──
  { id: 'first-session', name: '启程', desc: '第一个会话开跑。', icon: '🚀', category: '启程', rarity: 'common', threshold: { counter: KEYS.sessions, target: 1 } },
  { id: 'first-turn', name: '初试身手', desc: '完成第一轮对话。', icon: '👋', category: '启程', rarity: 'common', threshold: { counter: KEYS.turns, target: 1 } },
  { id: 'first-tool', name: '工具初体验', desc: '第一次调用工具。', icon: '🛠️', category: '启程', rarity: 'common', threshold: { counter: KEYS.tools, target: 1 } },
  // ── 记忆 ──
  { id: 'memory-first-save', name: '落笔成忆', desc: '第一次使用记忆工具（memory_*）。', icon: '📝', category: '记忆', rarity: 'common', threshold: { counter: KEYS.memoryTools, target: 1 } },
  { id: 'memory-10', name: '记忆织工', desc: '累计 10 次记忆工具调用。', icon: '🧵', category: '记忆', rarity: 'rare', threshold: { counter: KEYS.memoryTools, target: 10 } },
  { id: 'memory-first-confirm', name: '审核人', desc: '第一次人工确认（memory_confirm）。', icon: '✅', category: '记忆', rarity: 'rare', threshold: { counter: KEYS.memoryConfirmed, target: 1 } },
  { id: 'template-user', name: '模板常客', desc: '第一次使用模板库工具（prompt_*）。', icon: '🗂️', category: '记忆', rarity: 'rare', threshold: { counter: KEYS.templateTools, target: 1 } },
  // ── 审计 ──
  { id: 'audit-first', name: '上下文审计官', desc: '第一次跑 context_audit。', icon: '🔍', category: '审计', rarity: 'rare', threshold: { counter: KEYS.audits, target: 1 } },
  { id: 'audit-10', name: '注审老手', desc: '累计 10 次上下文审计。', icon: '🕵️', category: '审计', rarity: 'epic', threshold: { counter: KEYS.audits, target: 10 } },
  // ── GenUI（client 侧合并 genui 计数）──
  { id: 'genui-first', name: '第一块面板', desc: 'GenUI 渲染了第一块界面。', icon: '🎨', category: 'GenUI', rarity: 'common', threshold: { counter: KEYS.genuiUnlocked, target: 1 } },
  { id: 'genui-5', name: '界面收藏家', desc: 'GenUI 解锁 5 个成就。', icon: '🖼️', category: 'GenUI', rarity: 'rare', threshold: { counter: KEYS.genuiUnlocked, target: 5 } },
  { id: 'genui-25', name: '界面编织者', desc: 'GenUI 渲染过 25 个界面。', icon: '🧶', category: 'GenUI', rarity: 'epic', threshold: { counter: KEYS.genuiFences, target: 25 } },
  // ── 工具 ──
  { id: 'tool-10', name: '工具新手', desc: '累计调用 10 次工具。', icon: '🔧', category: '工具', rarity: 'common', threshold: { counter: KEYS.tools, target: 10 } },
  { id: 'tool-50', name: '工具达人', desc: '累计调用 50 次工具。', icon: '⚙️', category: '工具', rarity: 'rare', threshold: { counter: KEYS.tools, target: 50 } },
  { id: 'five-tools', name: '多面手', desc: '使用过 5 种不同工具。', icon: '🧰', category: '工具', rarity: 'rare', threshold: { counter: KEYS.toolsUsed, target: 5 } },
  // ── 行为 ──
  { id: 'marathon', name: '马拉松', desc: '单回合内调用 10 次工具。', icon: '🏃', category: '行为', rarity: 'rare', hidden: true, threshold: { counter: KEYS.marathonTurns, target: 1 } },
  { id: 'night-owl', name: '夜猫子', desc: '在凌晨 0-5 点发过消息。', icon: '🦉', category: '行为', rarity: 'rare', hidden: true, threshold: { counter: KEYS.midnightTurns, target: 1 } },
  // ── 隐藏 ──
  { id: 'self-ref', name: '自我指涉', desc: '用成就工具查询自己。', icon: '🪞', category: '隐藏', rarity: 'rare', hidden: true, threshold: { counter: KEYS.selfQueries, target: 1 } },
  { id: 'billionaire', name: '亿万富翁', desc: '累计消耗一亿 token。', icon: '💰', category: '隐藏', rarity: 'legendary', hidden: true, threshold: { counter: KEYS.tokens, target: 100000000 } },
]

/** 成就状态数据（纯标量）。 */
export interface AchieveState {
  [index: string]: number
}

export function emptyState(): AchieveState {
  const state: AchieveState = {}
  for (const achievement of ACHIEVEMENTS) state[achievement.threshold.counter] = 0
  return state
}

/** 检查新解锁（不看 hidden——hidden 仅影响展示）。 */
export function checkUnlocks(state: AchieveState, unlocked: Record<string, number>): AchievementDef[] {
  return ACHIEVEMENTS.filter(achievement =>
    unlocked[achievement.id] === undefined
    && (state[achievement.threshold.counter] ?? 0) >= achievement.threshold.target,
  )
}

/** 视图行（client 渲染用）。 */
export function viewOf(achievement: AchievementDef, state: AchieveState, unlocked: Record<string, number>): Record<string, unknown> {
  const current = Math.min(state[achievement.threshold.counter] ?? 0, achievement.threshold.target)
  return {
    id: achievement.id,
    name: achievement.hidden && unlocked[achievement.id] === undefined ? '？？' : achievement.name,
    desc: achievement.hidden && unlocked[achievement.id] === undefined ? '继续探索以揭示' : achievement.desc,
    icon: achievement.icon,
    category: achievement.category,
    rarity: achievement.rarity,
    hidden: achievement.hidden === true,
    unlocked: unlocked[achievement.id] !== undefined,
    progress: { current, target: achievement.threshold.target },
  }
}

/** 快照（HTTP / 工具共用）。 */
export function snapshot(state: AchieveState, unlocked: Record<string, number>): Record<string, unknown> {
  return {
    total: ACHIEVEMENTS.length,
    unlocked: Object.keys(unlocked).length,
    achievements: ACHIEVEMENTS.map(achievement => viewOf(achievement, state, unlocked)),
  }
}
