/**
 * @max-null/dsh-achievements host half: the achievements engine for the SSiD
 * family. Observes the session/tool event plane, folds leaf scalars into
 * durable counters, unlocks trophies (toast queue + HTTP + tool view), and
 * serves /achievements/api to the browser half. Privacy: counters only —
 * tool names, event kinds, token counts; message/file/error content is never
 * read. The GenUI category is merged by the client reading the genui
 * plugin's own localStorage counters.
 */
import type { Context } from '@deepseek-ai/cordis'
import { AchievementsEngine, attachListeners, registerRoutes, registerTool } from './engine.ts'

export const name = '@max-null/dsh-achievements'
export const inject = ['tools', 'webServer', 'webRuntime']

export function apply(ctx: Context): void {
  const engine = new AchievementsEngine()
  attachListeners(ctx, engine)
  registerRoutes(ctx, engine)
  registerTool(ctx, engine)
  ctx.on('agent/session-start' as never, (() => {
    engine.recordSession()
    engine.flush()
  }) as never)
  ctx.on('agent/turn-stopping' as never, (() => {
    engine.recordTurn()
    engine.flush()
  }) as never)
}

export { AchievementsEngine } from './engine.ts'
export { ACHIEVEMENTS, checkUnlocks, emptyState, snapshot, viewOf } from './rules.ts'
export type { AchieveState, AchievementDef, Category, Rarity } from './rules.ts'
