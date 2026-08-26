/**
 * engine.ts — 成就引擎：session/tool 事件监听 → 计数 → 解锁队列 →
 * 持久化（`$DSH_HOME/achievements/state.json`）+ HTTP 路由 + 工具。
 *
 * 隐私纪律：只读叶级标量（工具名/成功标志/session 事件类型/token 数/
 * 当天时刻），绝不读消息正文/文件内容/错误详情。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session/types'
import { ACHIEVEMENTS, checkUnlocks, emptyState, snapshot, type AchieveState } from './rules.ts'

const STATE_SCHEMA_VERSION = 1

interface PersistedState {
  schemaVersion: number
  counters: Record<string, number>
  distinct: Record<string, string[]>
  unlocked: Record<string, number>
}

function stateDir(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'achievements')
}

class StateStore {
  private counters: Record<string, number> = emptyState()
  private distinct: Record<string, Set<string>> = {}
  private unlocked: Record<string, number> = {}
  private file: string

  constructor() {
    this.file = join(stateDir(), 'state.json')
    this.load()
  }

  private load(): void {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<PersistedState>
      const base = emptyState()
      for (const [key, value] of Object.entries(parsed.counters ?? {})) {
        if (typeof value === 'number') this.counters[key] = (this.counters[key] ?? 0) + value
        else this.counters[key] = base[key] ?? 0
      }
      for (const [key, values] of Object.entries(parsed.distinct ?? {})) {
        if (Array.isArray(values)) this.distinct[key] = new Set(values.filter(v => typeof v === 'string'))
      }
      for (const [id, at] of Object.entries(parsed.unlocked ?? {})) {
        if (typeof at === 'number') this.unlocked[id] = at
      }
    } catch {
      this.counters = emptyState()
    }
  }

  save(): void {
    try {
      mkdirSync(stateDir(), { recursive: true })
      const data: PersistedState = {
        schemaVersion: STATE_SCHEMA_VERSION,
        counters: this.counters,
        distinct: Object.fromEntries(Object.entries(this.distinct).map(([k, v]) => [k, [...v]])),
        unlocked: this.unlocked,
      }
      writeFileSync(this.file, JSON.stringify(data, null, 2))
    } catch {
      // 持久化失败不致命：本页会话内存状态继续工作。
    }
  }

  /** 清零并立即落盘（clear 语义：不重读旧档）。 */
  reset(): void {
    this.counters = emptyState()
    this.distinct = {}
    this.unlocked = {}
    this.save()
  }

  bump(key: string, by = 1): void {
    this.counters[key] = (this.counters[key] ?? 0) + by
  }

  addDistinct(key: string, value: string): void {
    let set = this.distinct[key]
    if (set === undefined) { set = new Set(); this.distinct[key] = set }
    if (!set.has(value)) { set.add(value); this.save() }
  }

  get count(): AchieveState { return { ...this.counters } }
  get distinctCounts(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [key, set] of Object.entries(this.distinct)) out[key] = set.size
    return out
  }
  get unlockMap(): Record<string, number> { return { ...this.unlocked } }
  setUnlocked(id: string, at: number): void { this.unlocked[id] = at }
  totalDistinct(key: string): number { return this.distinct[key]?.size ?? 0 }
}

/** family 指纹：记忆类工具（dsh-memory / prompt 模板库）。 */
const MEMORY_TOOLS = new Set([
  'memory_save', 'memory_list', 'memory_search', 'memory_confirm', 'memory_forget', 'memory_update',
  'prompt_search', 'prompt_get', 'prompt_list', 'prompt_add',
])
const CONFIRM_TOOLS = new Set(['memory_confirm'])
const TEMPLATE_TOOLS = new Set(['prompt_search', 'prompt_get', 'prompt_list', 'prompt_add'])
const AUDIT_TOOLS = new Set(['context_audit'])

/** 有成就关联的插件（探测存在性以置灰未装插件的成就）。 */
export const ASSOCIATED_PLUGINS: readonly string[] = [
  '@max-null/dsh-memory',
  'dsh-context-doctor',
  '@changfenhuang/dsh-genui',
]

/** 探测已安装的关联插件：SSID_PROFILE_DIR（壳注入）与常见 profile 目录。 */
 export function installedPlugins(): Set<string> {
  const candidates = [
    process.env.SSID_PROFILE_DIR,
    process.env.DSH_HOME ? join(process.env.DSH_HOME, 'profiles', 'ssid') : undefined,
    join(homedir(), '.dsh', 'profiles', 'ssid'),
  ].filter((dir): dir is string => typeof dir === 'string' && dir !== '')
  const found = new Set<string>()
  for (const dir of candidates) {
    for (const name of ASSOCIATED_PLUGINS) {
      if (existsSync(join(dir, 'node_modules', ...name.split('/')))) found.add(name)
    }
  }
  return found
}

export interface EngineSnapshot {
  state: AchieveState
  distinct: Record<string, number>
  unlocked: Record<string, number>
  recent: Array<{ id: string, name: string, rarity: string, icon: string }>
}

/** 引擎（带事件源的宿主注入）。 */
export class AchievementsEngine {
  private store = new StateStore()
  private queue: Array<{ id: string, name: string, rarity: string, icon: string }> = []
  /** 回合中间状态（agent key → 工具计数）。 */
  private turnTools = new Map<string, number>()

  get count(): AchieveState { return this.store.count }

  recordTool(name: string): void {
    this.store.bump('tools')
    this.store.addDistinct('toolsUsed', name)
    if (MEMORY_TOOLS.has(name)) this.store.bump('memoryTools')
    if (CONFIRM_TOOLS.has(name)) this.store.bump('memoryConfirmed')
    if (TEMPLATE_TOOLS.has(name)) this.store.bump('templateTools')
    if (AUDIT_TOOLS.has(name)) this.store.bump('audits')
    if (name === 'list_achievements') this.store.bump('selfQueries')
  }

  recordTurnStart(agentKey: string): void {
    this.turnTools.set(agentKey, 0)
  }

  recordTurnTool(agentKey: string): void {
    const current = (this.turnTools.get(agentKey) ?? 0) + 1
    this.turnTools.set(agentKey, current)
    if (current >= 10) this.store.bump('marathonTurns') // 单回合 10 次工具（一次性语义靠解锁幂等）
  }

  recordTurnEnd(agentKey: string): void {
    this.turnTools.delete(agentKey)
  }

  recordSession(): void { this.store.bump('sessions') }
  recordTurn(): void { this.store.bump('turns') }
  recordMidnight(): void { this.store.bump('midnightTurns') }
  recordTokens(amount: number): void { if (amount > 0) this.store.bump('tokens', amount) }

  /** GenUI 计数合并（client 写入；host 侧直接写计数键）。 */
  mergeGenUI(unlockedCount: number, fences: number): void {
    this.store.bump('genuiUnlocked', Math.max(0, unlockedCount))
    this.store.bump('genuiFences', Math.max(0, fences))
  }

  /** 检查解锁；返回新解锁（进队列 + 持久化；计数每次落盘）。 */
  flush(): void {
    const state = this.count
    const fresh = checkUnlocks(state, this.store.unlockMap)
    for (const achievement of fresh) {
      const at = Date.now()
      this.store.setUnlocked(achievement.id, at)
      this.queue.push({ id: achievement.id, name: achievement.name, rarity: achievement.rarity, icon: achievement.icon })
    }
    this.store.save()
  }

  snapshot(): EngineSnapshot {
    return {
      state: this.count,
      distinct: this.store.distinctCounts,
      unlocked: this.store.unlockMap,
      recent: [...this.queue].slice(-5),
    }
  }

  drainRecent(): Array<{ id: string, name: string, rarity: string, icon: string }> {
    const queue = this.queue
    this.queue = []
    return queue
  }

  fullSnapshot(): Record<string, unknown> {
    const installed = installedPlugins()
    return {
      ...snapshot(this.count, this.store.unlockMap, installed),
      recent: this.snapshot().recent,
      distinct: this.store.distinctCounts,
    }
  }

  clear(): void {
    this.store.reset()
    this.queue = []
  }
}

/** 事件监听接线（0.1.1-rc.2 宿主事件面）。 */
export function attachListeners(ctx: Context, engine: AchievementsEngine): void {
  // tools/result：工具执行完成（冻结的最终结果）。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx.on('tools/result' as never, ((exec: { name?: unknown, agent?: { id?: unknown } }, result: { isError?: unknown }) => {
    const name = typeof exec?.name === 'string' ? exec.name : ''
    if (name === '') return
    engine.recordTool(name)
    engine.recordTurnTool(agentKeyOf(exec))
    if (result?.isError !== true) {
      // 成功即可；失败也计入 tools（recordTool 已计）
    }
    engine.flush()
  }) as never)

  // session/event：usage / header / user 消息 / 会话首事件（叶级标量）。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx.on('session/event' as never, ((session: { id?: unknown }, event: { type?: unknown, data?: any }) => {
    if (event?.type === 'assistant/message') {
      const usage = event.data?.usage as Record<string, unknown> | undefined
      if (usage !== undefined && typeof usage === 'object') {
        let total = 0
        for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens'] as const) {
          const value = usage[key]
          if (typeof value === 'number') total += value
        }
        engine.recordTokens(total)
        engine.flush()
      }
      return
    }
    if (event?.type === 'user/message') {
      const hour = new Date().getHours()
      if (hour >= 0 && hour < 5) engine.recordMidnight()
      engine.flush()
      return
    }
    if (event?.type === 'session/start') {
      engine.recordSession()
      engine.recordTurn()
      engine.flush()
    }
  }) as never)
}

function agentKeyOf(exec: { agent?: { id?: unknown } } | undefined): string {
  const id = exec?.agent?.id
  return typeof id === 'string' ? id : 'root'
}

/** HTTP 路由（/achievements/api，POST）——仿 dsh-memory 的 /memory/api 信任围栏。 */
export function registerRoutes(ctx: Context, engine: AchievementsEngine): void {
  const webServer = (ctx as unknown as {
    webServer: { register(descriptor: { kind: string, path: string, handler: (req: unknown, res: unknown) => Promise<void> | void }): () => void }
  }).webServer
  const webRuntime = (ctx as unknown as { webRuntime: { trustedHosts: readonly string[] } }).webRuntime

  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/achievements/api',
    handler: async (req: unknown, res: unknown) => {
      const request = req as { headers: Record<string, string | string[] | undefined>, method?: string, url?: string }
      if (!isTrusted(request, webRuntime.trustedHosts)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (request.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      const pathname = new URL(request.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/achievements/api/') ? pathname.slice('/achievements/api/'.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown achievement API method' } })
        return
      }
      try {
        switch (method) {
          case 'list':
            writeJson(res, 200, { ok: true, value: engine.fullSnapshot() })
            return
          case 'recent':
            writeJson(res, 200, { ok: true, value: engine.drainRecent() })
            return
          case 'clear':
            engine.clear()
            writeJson(res, 200, { ok: true, value: engine.fullSnapshot() })
            return
          case 'genui-merge': {
            const body = (await readJsonBody(req as AsyncIterable<string | Uint8Array>)) as {
              unlockedCount?: unknown, fences?: unknown
            }
            engine.mergeGenUI(
              typeof body.unlockedCount === 'number' ? body.unlockedCount : 0,
              typeof body.fences === 'number' ? body.fences : 0,
            )
            engine.flush()
            writeJson(res, 200, { ok: true, value: engine.fullSnapshot() })
            return
          }
          default:
            writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `unknown method "${method}"` } })
        }
      } catch (error) {
        writeJson(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }), '@max-null/dsh-achievements: /achievements/api routes')
}

const MAX_BODY_BYTES = 1 << 20

async function readJsonBody(req: AsyncIterable<string | Uint8Array>): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    return {}
  }
}

/** 工具：list_achievements（模型侧查询进度；只读）。 */
export function registerTool(ctx: Context, engine: AchievementsEngine): void {
  ctx.tools.register(defineTool({
    name: 'list_achievements',
    description: '查询 SSiD 成就系统状态：已解锁成就、总成就数、最近解锁与各项进度。只读，不影响会话。',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    },
    execute: (_args: unknown): Promise<JsonValue> => Promise.resolve(engine.fullSnapshot() as JsonValue),
  }))
}

/* ---- 路由辅助（与 dsh-memory routes.ts 同款） ---- */

function writeJson(res: unknown, status: number, body: unknown): void {
  const r = res as { writeHead(status: number, headers: Record<string, string>): void; end(data: string): void }
  try {
    r.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    r.end(JSON.stringify(body))
  } catch {
    // 流已关闭/非法响应：忽略
  }
}

/** loopback / trustedHosts 围栏（与 /memory/api 一致）。 */
function isTrusted(request: { headers: Record<string, string | string[] | undefined> }, trustedHosts: readonly string[]): boolean {
  const host = request.headers['host']
  const hostValue = typeof host === 'string' ? host : ''
  const authority = typeof request.headers[':authority'] === 'string' ? request.headers[':authority'] : hostValue
  if (authority !== '') {
    try {
      const u = new URL(`http://${authority}`)
      if (u.hostname === 'localhost' || u.hostname === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return true
      if (trustedHosts.includes(u.hostname)) return true
    } catch { /* fall through */ }
    return false
  }
  return trustedHosts.length > 0 ? trustedHosts.includes('*') : true
}
