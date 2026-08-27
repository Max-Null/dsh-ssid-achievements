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
  unlocked: boolean
  plugin: string | null
  pluginInstalled: boolean
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
    pluginMissing: '插件未装',
    growing: '更多组件的成就持续增加中 —— Guardian / Habit / 润色 / 审查等插件将陆续加入。',
    builtin: '内置',
  },
  en: {
    title: 'Achievements',
    desc: 'SSiD family progress: tool/memory/audit/GenUI usage trophies with unlock toasts.',
    refresh: 'Refresh',
    locked: 'Locked',
    unlocked: 'Unlocked',
    pluginMissing: 'plugin not installed',
    growing: 'More component achievements are on the way — Guardian / Habit / Polish / Review and more will join soon.',
    builtin: 'built-in',
  },
}

/** 插件短名（卡片标签）。 */
const PLUGIN_SHORT: Record<string, string> = {
  '@max-null/dsh-memory': '记忆',
  'dsh-context-doctor': '审计',
  '@changfenhuang/dsh-genui': 'GenUI',
  '@max-null/dsh-chat-rail': '收藏',
}

function pluginLabel(plugin: string | null): string | null {
  if (plugin === null) return null
  return PLUGIN_SHORT[plugin] ?? plugin.split('/').pop() ?? plugin
}

/** chat-rail 收藏总数（Record<sessionId, messageId[]> —— 只读叶级标量，不读内容）。 */
function readChatRail(): number {
  try {
    const raw = localStorage.getItem(CHAT_RAIL_LS_KEY)
    if (raw === null) return 0
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 0
    let total = 0
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) total += value.filter((id): id is string => typeof id === 'string' && id !== '').length
    }
    return total
  } catch {
    return 0
  }
}

// ---- 奖杯图标（Lucide trophy，设置页 nav 图标替换——照 dsh-memory 大脑模式） ----
const TROPHY_PATHS = [
  'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
  'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
  'M4 22h16',
  'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
  'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
  'M18 2H6v7a6 6 0 0 0 12 0V2Z',
]
const SETTINGS_NAV_MARKER = 'data-dsh-achievements-settings-nav'
const TROPHY_MASK_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${TROPHY_PATHS.map(d => `<path d='${d}'/>`).join('')}</svg>`,
)
      .replace(/'/g, '%27').replace(/\//g, '%2F').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/#/g, '%23')

const NAV_ICON_CSS = `
[data-dsh-achievements-settings-nav] > svg:first-child { display: none; }
[data-dsh-achievements-settings-nav]::before {
  content: '';
  flex: none;
  width: 16px;
  height: 16px;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml,${TROPHY_MASK_SVG}") center / contain no-repeat;
  mask: url("data:image/svg+xml,${TROPHY_MASK_SVG}") center / contain no-repeat;
}
`
let navCssInjected = false
function injectNavCss(): void {
  if (navCssInjected || typeof document === 'undefined') return
  navCssInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-plugin', '@max-null/dsh-achievements')
  style.textContent = NAV_ICON_CSS
  document.head.append(style)
}

/** 标记设置对话框里本插件的导航行（照 dsh-memory 同款，HMR-safe）。 */
function registerSettingsNavIcon(label: () => string): () => void {
  let disposed = false
  const sync = (): void => {
    if (disposed) return
    const currentLabel = label().trim()
    const buttons = document.querySelectorAll<HTMLButtonElement>('[role="dialog"] nav button')
    for (const button of buttons) {
      const matches = currentLabel.length > 0 && button.textContent?.trim() === currentLabel
      if (matches) button.setAttribute(SETTINGS_NAV_MARKER, '')
      else button.removeAttribute(SETTINGS_NAV_MARKER)
    }
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return () => { disposed = true; observer.disconnect() }
}

const GENUI_LS_KEY = 'dsh.genui.achievements'
const CHAT_RAIL_LS_KEY = '@max-null/dsh-chat-rail:favorites'

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
    // 融合：先上报外部插件计数（genui / chat-rail 收藏——绝对值，host setMax 防虚增），再取全景快照
    const genui = readGenUI()
    await api('genui-merge', genui)
    await api('chat-rail-merge', { total: readChatRail() })
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
      createElement('div', { className: 'achHeadLeft' },
        createElement('span', { className: 'achTitle' }, t.title),
        createElement('span', { className: 'achDesc' }, t.desc)),
      createElement('div', { className: 'achScore', 'data-locked': snapshot === null ? undefined : String(snapshot.unlocked) },
        createElement('span', { className: 'achScoreNum' }, snapshot !== null ? `${snapshot.unlocked}` : '…'),
        createElement('span', { className: 'achScoreTotal' }, snapshot !== null ? `/ ${snapshot.total}` : '')),
      createElement('button', {
        type: 'button', className: 'achBtn',
        onClick: () => {
          void reload()
          setNote('已刷新')
          window.setTimeout(() => setNote(''), 1500)
        },
      }, t.refresh)),
    createElement('div', { className: 'achCats' },
      categories.map(c => createElement('button', {
        key: c, type: 'button',
        className: `achCat${category === c ? ' achCatOn' : ''}`,
        onClick: () => setCategory(c),
      }, c))),
    createElement('div', { className: 'achGrowing' },
      createElement('span', { className: 'achGrowingIcon', 'aria-hidden': '' }, '🧩'),
      createElement('span', null, t.growing)),
    createElement('div', { className: 'achList' },
      items.map(a => createElement('div', { key: a.id, className: `achRow${a.unlocked ? ' achRowOn' : ''}${a.pluginInstalled ? '' : ' achRowMuted'}` },
        createElement('span', { className: `achIconWrap achIconWrap-${a.rarity}`, 'aria-hidden': '' },
          createElement('span', { className: 'achIcon' }, a.icon)),
        createElement('div', { className: 'achBody' },
          createElement('div', { className: 'achName' },
            a.name,
            createElement('span', { className: `achRarity achRarity-${a.rarity}` },
              a.rarity === 'legendary' ? '传说' : a.rarity === 'epic' ? '史诗' : a.rarity === 'rare' ? '稀有' : '普通'),
            a.plugin !== null ? createElement('span', { className: 'achPlugin' }, pluginLabel(a.plugin)) : null),
          createElement('div', { className: 'achDesc2' }, a.desc),
          createElement('div', { className: 'achProgRow' },
            createElement('div', { className: 'achProg' },
              createElement('div', {
                className: 'achProgFill',
                style: { width: `${Math.min(100, Math.round(a.progress.current / a.progress.target * 100))}%` },
              })),
            createElement('span', { className: 'achProgNum' }, `${a.progress.current} / ${a.progress.target}`))),
        createElement('span', {
          className: `achState${a.pluginInstalled ? (a.unlocked ? ' achStateOn' : '') : ' achStateOff'}`,
        }, a.pluginInstalled ? (a.unlocked ? t.unlocked : t.locked) : t.pluginMissing)))),
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
  injectNavCss()
  disposers.push(registerSettingsNavIcon(() => STRINGS[lang()].title))
  return () => { for (const dispose of disposers) dispose() }
}

/** 样式常量（必须先于注入块声明：CJS 编译下 var 提升会造成 TDZ 赋值 undefined）。 */
const CSS = [
  /* ---- 视图容器 ---- */
  '.ach{display:flex;flex-direction:column;gap:14px;padding:8px 0 4px}',
  /* ---- 头部：标题+进度徽章+刷新 ---- */
  '.achHead{display:flex;align-items:center;gap:14px}',
  '.achHeadLeft{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
  '.achTitle{font-size:16px;font-weight:600;letter-spacing:.01em;color:var(--dsw-alias-label-primary,inherit)}',
  '.achDesc{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,inherit)}',
  '.achScore{flex:none;display:flex;align-items:baseline;gap:2px;padding:8px 14px;border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 10%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 25%,transparent)}',
  '.achScoreNum{font-size:20px;font-weight:700;color:var(--dsw-alias-state-business-primary,#4f8ef7);font-variant-numeric:tabular-nums}',
  '.achScoreTotal{font-size:13px;color:var(--dsw-alias-label-secondary,inherit);font-variant-numeric:tabular-nums}',
  '.achBtn{flex:none;padding:5px 14px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.4));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;cursor:pointer;transition:background .15s}',
  '.achBtn:hover{background:var(--dsw-alias-fill-hover,rgba(127,127,127,.12))}',
  /* ---- 类别 tabs ---- */
  '.achCats{display:flex;flex-wrap:wrap;gap:6px}',
  '.achCat{padding:3px 11px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;line-height:1.6;cursor:pointer;transition:all .15s}',
  '.achCat:hover{color:var(--dsw-alias-label-primary,inherit)}',
  '.achCatOn{border-color:var(--dsw-alias-state-business-primary,#4f8ef7);color:var(--dsw-alias-state-business-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 10%,transparent)}',
  /* ---- 成就列表 ---- */
  '.achList{display:flex;flex-direction:column;gap:8px;max-height:480px;overflow:auto;padding-right:2px}',
  '.achRow{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:14px;background:var(--dsw-alias-bg-layer-2,transparent);transition:border-color .15s}',
  '.achRowOn{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 6%,transparent)}',
  /* icon 圆底（稀有度 tint） */
  '.achIconWrap{flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:20px;line-height:1;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 18%,transparent)}',
  '.achIconWrap-rare{background:color-mix(in srgb,#f59e0b 12%,transparent);border-color:color-mix(in srgb,#f59e0b 20%,transparent)}',
  '.achIconWrap-epic{background:color-mix(in srgb,#a78bfa 12%,transparent);border-color:color-mix(in srgb,#a78bfa 20%,transparent)}',
  '.achIconWrap-legendary{background:color-mix(in srgb,#f43f5e 12%,transparent);border-color:color-mix(in srgb,#f43f5e 20%,transparent)}',
  '.achIcon{filter:saturate(1.05)}',
  /* 行正文 */
  '.achBody{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
  '.achName{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
  '.achRarity{font-size:10px;line-height:1.6;padding:0 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-state-business-primary,#4f8ef7);font-weight:500}',
  '.achRarity-rare{background:color-mix(in srgb,#f59e0b 12%,transparent);color:#d97706}',
  '.achRarity-epic{background:color-mix(in srgb,#a78bfa 12%,transparent);color:#7c3aed}',
  '.achRarity-legendary{background:color-mix(in srgb,#f43f5e 12%,transparent);color:#e11d48}',
  /* 所属插件标签 */
  '.achPlugin{font-size:10px;line-height:1.6;padding:0 7px;border-radius:999px;background:var(--dsw-alias-fill-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,inherit);font-weight:500;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25))}',
  /* 成就持续增加中提示卡 */
  '.achGrowing{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-bg-layer-1,transparent);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,inherit)}',
  '.achGrowingIcon{flex:none;font-size:15px;line-height:1.4}',
  /* 插件未装置灰 */
  '.achRowMuted{opacity:.55;filter:grayscale(.6)}',
  '.achStateOff{color:var(--dsw-alias-label-tertiary,inherit);background:var(--dsw-alias-fill-hover,rgba(127,127,127,.08))}',
  '.achDesc2{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,inherit)}',
  '.achProgRow{display:flex;align-items:center;gap:8px;margin-top:2px}',
  '.achProg{flex:1;height:5px;border-radius:999px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.28));overflow:hidden}',
  '.achProgFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-business-primary,#4f8ef7);transition:width .3s}',
  '.achProgNum{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit);font-variant-numeric:tabular-nums}',
  /* 状态徽章 */
  '.achState{flex:none;font-size:11px;line-height:1.6;padding:0 8px;border-radius:999px;color:var(--dsw-alias-label-tertiary,inherit);background:var(--dsw-alias-fill-hover,rgba(127,127,127,.1))}',
  '.achStateOn{color:var(--dsw-alias-state-success-primary,#16a34a);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#16a34a) 12%,transparent)}',
  '.achNote{font-size:12px;color:var(--dsw-alias-state-success-primary,#16a34a)}',
  /* toast */
  '.at-row{position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;padding:10px 12px;border:1px solid var(--dsw-alias-state-business-primary,#4f8ef7);border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.85));color:var(--dsw-alias-state-business-primary,#4f8ef7);font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25)}',
].join('')

/** 样式注入（一次；必须位于 CSS 常量声明之后——CJS 下 var 提升否则 undefined）。 */
if (typeof document !== 'undefined' && document.querySelector('style[data-dsh-achievements-css]') === null) {
  const tag = document.createElement('style')
  tag.dataset.dshAchievementsCss = '1'
  tag.textContent = CSS
  document.head.appendChild(tag)
}
