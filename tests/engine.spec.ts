/**
 * engine.spec.ts — 规则与引擎纯逻辑测试（计数/解锁/持久化/路由快照）。
 * 用 DSH_HOME 指向临时目录隔离状态文件。
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ACHIEVEMENTS, checkUnlocks, emptyState, snapshot, viewOf } from '../src/rules.ts'
import { AchievementsEngine } from '../src/engine.ts'

function withHome(fn: (home: string) => void): void {
  const home = mkdtempSync(join(tmpdir(), 'achv-'))
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    fn(home)
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
    rmSync(home, { recursive: true, force: true })
  }
}

describe('规则', () => {
  it('成就表：id 唯一、覆盖全家桶类别', () => {
    const ids = new Set(ACHIEVEMENTS.map(a => a.id))
    expect(ids.size).toBe(ACHIEVEMENTS.length)
    const categories = new Set(ACHIEVEMENTS.map(a => a.category))
    for (const c of ['启程', '记忆', '审计', 'GenUI', '工具', '行为', '隐藏']) {
      expect(categories.has(c), `缺类别 ${c}`).toBe(true)
    }
  })

  it('阈值解锁：到目标才发', () => {
    const state = emptyState()
    expect(checkUnlocks(state, {})).toEqual([])
    state['tools'] = 10
    const fresh = checkUnlocks(state, {})
    expect(fresh.map(a => a.id)).toContain('tool-10')
    expect(fresh.map(a => a.id)).not.toContain('tool-50')
  })

  it('已解锁不重复', () => {
    const state = emptyState()
    state['tools'] = 50
    const once = checkUnlocks(state, { 'tool-10': 1 })
    expect(once.map(a => a.id)).not.toContain('tool-10')
  })

  it('隐藏成就不解锁前显示 ？？', () => {
    const state = emptyState()
    const hidden = ACHIEVEMENTS.find(a => a.id === 'night-owl')!
    const lockedView = viewOf(hidden, state, {})
    expect(lockedView.name).toBe('？？')
    const unlockedView = viewOf(hidden, state, { 'night-owl': 1 })
    expect(unlockedView.name).toBe('夜猫子')
  })
})

describe('引擎', () => {
  it('工具计数与家族归类 + 解锁队列', () => {
    withHome(() => {
      const allRecent: Array<{ id: string }> = []
      for (let i = 0; i <10; i++) {
        const engine = new AchievementsEngine()
        engine.recordTool('memory_save')
        engine.flush()
        allRecent.push(...engine.drainRecent())
      }
      const engine = new AchievementsEngine()
      expect(engine.snapshot().state['tools']).toBe(10)
      expect(engine.snapshot().state['memoryTools']).toBe(10)
      // 队列是实例内存态：累计各实例的解锁
      expect(allRecent.map(u => u.id)).toContain('tool-10')
      expect(allRecent.map(u => u.id)).toContain('memory-10')
      expect(allRecent.map(u => u.id)).toContain('memory-first-save')
    })
  })

  it('持久化：新引擎实例恢复计数', () => {
    withHome(() => {
      const engine = new AchievementsEngine()
      engine.recordTool('context_audit')
      engine.recordTool('context_audit')
      engine.flush()
      // 新实例（同 DSH_HOME）恢复
      const fresh = new AchievementsEngine()
      expect(fresh.snapshot().state['audits']).toBe(2)
    })
  })

  it('GenUI 合并计数', () => {
    withHome(() => {
      const engine = new AchievementsEngine()
      engine.mergeGenUI(5, 25)
      engine.flush()
      const state = engine.snapshot().state
      expect(state['genuiUnlocked']).toBeGreaterThanOrEqual(5)
      expect(state['genuiFences']).toBeGreaterThanOrEqual(25)
    })
  })

  it('快照形状（HTTP/工具共用）', () => {
    withHome(() => {
      const engine = new AchievementsEngine()
      engine.recordTool('memory_save')
      engine.flush()
      const full = engine.fullSnapshot() as Record<string, any>
      expect(typeof full.total).toBe('number')
      expect(typeof full.unlocked).toBe('number')
      expect(Array.isArray(full.achievements)).toBe(true)
      expect(full.achievements[0]).toHaveProperty('progress')
    })
  })

  it('clear 重置', () => {
    withHome(() => {
      const engine = new AchievementsEngine()
      engine.recordTool('memory_save')
      engine.flush()
      engine.clear()
      expect(engine.snapshot().state['tools']).toBe(0)
      expect(Object.keys(engine.snapshot().unlocked)).toHaveLength(0)
    })
  })
})

describe('快照', () => {
  it('snapshot 汇总', () => {
    const state = emptyState()
    state['tools'] = 3
    const snap = snapshot(state, { 'first-tool': 1 })
    expect(snap.total).toBe(ACHIEVEMENTS.length)
    expect(snap.unlocked).toBe(1)
  })
})
