/**
 * dsh-achievements browser half: a settings section ("成就") rendering the
 * SSiD family achievement board, unlock toasts (polled from the host queue),
 * and the GenUI merge — the client reads the genui plugin's own counter store
 * (dsh.genui.achievements) and posts the counts so the board shows the GenUI
 * category alongside host-side counters.
 */
import { createElement, useCallback, useEffect, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-runtime/client'

/** POST to the achievements API (route-per-method paths, same convention as /memory/api). */
async function api<T>(method: string, body?: unknown): Promise<T | null> {
  try {
    const response = await fetch(`/achievements/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const payload = await response.json() as { ok: boolean, value?: unknown }
    return (payload.value ?? null) as T | null
  } catch {
    return null
  }
}

interface RecentUnlock {
  id: string
  name: string
  rarity: string
  icon: string
}

interface AchievementView {
  id: string
  name: string
  desc: string
  icon: string
  category: string
  rarity: string
  locked: boolean
  progress: { current: number, target: number }
}

interface Snapshot {
  total: number
  unlocked: number
  achievements: AchievementView[]
  recent: RecentUnlock[]
}

const STRINGS: Record<string, Record<string, string>> = {
  zh: {
    title: '成就',
    desc: 'SSiD 全家桶进度：工具/记忆/审计/GenUI 使用成就，解锁可领 toast。',
    refresh: '刷新',
    locked: '未解锁',
    unlocked: '已解锁',
  },
  en: {
    title: 'Achievements',
    desc: 'SSiD family progress: tool/memory/audit/GenUI usage trophies with unlock toasts.',
    refresh: 'Refresh',
    locked: 'Locked',
    unlocked: 'Unlocked',
  },
}

const GENUI_LS_KEY = 'dsh.genui.achievements'

function readGenUI(): { unlockedCount: number, fences: number } {
  try {
    const raw = localStorage.getItem(GENUI_LS_KEY)
    if (raw === null) return { unlockedCount: 0, fences: 0 }
    const parsed = JSON.parse(raw) as { unlocked?: Record<string, number>, state?: { fences?: number } }
    return {
      unlockedCount: Object.keys(parsed.unlocked ?? {}).length,
      fences: parsed.state?.fences ?? 0,
    }
  } catch {
    return { unlockedCount: 0, fences: 0 }
  }
}

function lang(): 'zh' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** 成就设置页视图。 */
export function AchievementsView(_props: { visible: boolean }): ReturnType<typeof createElement> {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [category, setCategory] = useState('全部')
  const [note, setNote] = useState('')
  const t = STRINGS[lang()]

  const reload = useCallback(async (): Promise<void> => {
    // GenUI 融合：先上报 genui 计数，再取全景快照
    const genui = readGenUI()
    await api('genui-merge', genui)
    const data = await api<Snapshot>('list')
    if (data !== null) setSnapshot(data)
  }, [])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => void reload(), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const categories = snapshot === null
    ? ['全部']
    : ['全部', ...new Set(snapshot.achievements.map(a => a.category))]
  const items = snapshot?.achievements.filter(a => category === '全部' || a.category === category) ?? []

  return createElement('div', { className: 'ach', 'data-dsh-achievements-view': '' },
    createElement('div', { className: 'achHead' },
      createElement('span', { className: 'achTitle' }, t.title),
      createElement('span', { className: 'achMeta' }, snapshot !== null ? `${snapshot.unlocked} / ${snapshot.total}` : '…'),
      createElement('button', {
        type: 'button', className: 'achBtn',
        onClick: () => {
          void reload()
          setNote('已刷新')
          window.setTimeout(() => setNote(''), 1500)
        },
      }, t.refresh)),
    createElement('div', { className: 'achDesc' }, t.desc),
    createElement('div', { className: 'achCats' },
      categories.map(c => createElement('button', {
        key: c, type: 'button',
        className: `achCat${category === c ? ' achCatOn' : ''}`,
        onClick: () => setCategory(c),
      }, c))),
    createElement('div', { className: 'achList' },
      items.map(a => createElement('div', { key: a.id, className: `achRow${a.locked ? '' : ' achRowOn'}` },
        createElement('span', { className: 'achIcon', 'aria-hidden': '' }, a.icon),
        createElement('div', { className: 'achBody' },
          createElement('div', { className: 'achName' },
            a.name,
            createElement('span', { className: `achRarity achRarity-${a.rarity}` },
              a.rarity === 'legendary' ? '传说' : a.rarity === 'epic' ? '史诗' : a.rarity === 'rare' ? '稀有' : '普通')),
          createElement('div', { className: 'achDesc2' }, a.desc),
          createElement('div', { className: 'achProgRow' },
            createElement('div', { className: 'achProg' },
              createElement('div', {
                className: 'achProgFill',
                style: { width: `${Math.min(100, Math.round(a.progress.current / a.progress.target * 100))}%` },
              })),
            createElement('span', { className: 'achProgNum' }, `${a.progress.current} / ${a.progress.target}`))),
        createElement('span', { className: `achState${a.locked ? '' : ' achStateOn'}` }, a.locked ? t.locked : t.unlocked)))),
    note !== '' ? createElement('div', { className: 'achNote' }, note) : null,
  )
}

/** Toast 层（页面右下角；独立 root，不依赖面板）。 */
export function mountToastLayer(): () => void {
  if (typeof document === 'undefined') return () => {}
  const host = document.createElement('div')
  host.dataset.dshAchievementsToast = '1'
  document.body.appendChild(host)
  const render = (): void => {
    void api<RecentUnlock[]>('recent').then(data => {
      if (data === null || data.length === 0) return
      host.textContent = ''
      for (const u of data) {
        const row = document.createElement('div')
        row.className = 'at-row'
        row.textContent = `🏆 成就解锁：${u.name}`
        host.appendChild(row)
      }
      window.setTimeout(() => { host.textContent = '' }, 4200)
    })
  }
  const first = window.setTimeout(render, 2500)
  const interval = window.setInterval(render, 8000)
  return () => {
    window.clearTimeout(first)
    window.clearInterval(interval)
    host.remove()
  }
}

/** Cordis client entry. */
export const inject = ['slots']

export function apply(ctx: { slots: { inject(name: string, fn: () => unknown): void, register(descriptor: Record<string, unknown>, component: unknown): () => void } }): () => void {
  const disposers: Array<() => void> = []
  ;(ctx.slots as unknown as { inject(name: string, fn: () => unknown): void }).inject('settings.section', () => (
    (ctx.slots as unknown as { register(descriptor: Record<string, unknown>, component: unknown): () => void }).register({
      name: 'settings.section',
      id: 'ssid-achievements',
      order: 90,
      label: () => STRINGS[lang()].title,
    }, () => createElement(AchievementsView, { visible: true }))
  ))
  disposers.push(mountToastLayer())
  return () => { for (const dispose of disposers) dispose() }
}

/** 样式注入（一次）。 */
if (typeof document !== 'undefined' && document.querySelector('style[data-dsh-achievements-css]') === null) {
  const tag = document.createElement('style')
  tag.dataset.dshAchievementsCss = '1'
  tag.textContent = CSS
  document.head.appendChild(tag)
}

const CSS = [
  '.ach{display:flex;flex-direction:column;gap:10px;padding:4px 0}',
  '.achHead{display:flex;align-items:center;gap:10px}',
  '.achTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
  '.achMeta{font-size:13px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.achBtn{margin-left:auto;padding:4px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.4));border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,inherit);font-size:12px;cursor:pointer}',
  '.achDesc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit)}',
  '.achCats{display:flex;flex-wrap:wrap;gap:6px}',
  '.achCat{padding:3px 10px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.4));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;cursor:pointer}',
  '.achCatOn{border-color:var(--dsw-alias-state-business-primary,#4f8ef7);color:var(--dsw-alias-state-business-primary,#4f8ef7)}',
  '.achList{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto}',
  '.achRow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:12px}',
  '.achRowOn{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 35%,transparent)}',
  '.achIcon{font-size:20px;line-height:1}',
  '.achBody{flex:1;min-width:0}',
  '.achName{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
  '.achRarity{font-size:11px;padding:0 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-state-business-primary,#4f8ef7)}',
  '.achRarity-rare{background:color-mix(in srgb,#f59e0b 14%,transparent);color:#f59e0b}',
  '.achRarity-epic{background:color-mix(in srgb,#a78bfa 14%,transparent);color:#a78bfa}',
  '.achRarity-legendary{background:color-mix(in srgb,#f43f5e 14%,transparent);color:#f43f5e}',
  '.achDesc2{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,inherit)}',
  '.achProgRow{display:flex;align-items:center;gap:8px;margin-top:4px}',
  '.achProg{flex:1;height:4px;border-radius:999px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.3));overflow:hidden}',
  '.achProgFill{height:100%;background:var(--dsw-alias-state-business-primary,#4f8ef7)}',
  '.achProgNum{font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}',
  '.achState{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}',
  '.achStateOn{color:var(--dsw-alias-state-success-primary,#6ccb5f)}',
  '.achNote{font-size:12px;color:var(--dsw-alias-state-success-primary,#6ccb5f)}',
  '.at-row{position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;padding:10px 12px;border:1px solid var(--dsw-alias-state-business-primary,#4f8ef7);border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.85));color:var(--dsw-alias-state-business-primary,#4f8ef7);font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25)}',
].join('')
