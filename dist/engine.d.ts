import type { Context } from '@deepseek-ai/cordis';
import { type AchieveState } from './rules.ts';
/** 有成就关联的插件（探测存在性以置灰未装插件的成就）。 */
export declare const ASSOCIATED_PLUGINS: readonly string[];
/** 探测已安装的关联插件：SSID_PROFILE_DIR（壳注入）与常见 profile 目录。 */
export declare function installedPlugins(): Set<string>;
export interface EngineSnapshot {
    state: AchieveState;
    distinct: Record<string, number>;
    unlocked: Record<string, number>;
    recent: Array<{
        id: string;
        name: string;
        rarity: string;
        icon: string;
    }>;
}
/** 引擎（带事件源的宿主注入）。 */
export declare class AchievementsEngine {
    private store;
    private queue;
    /** 回合中间状态（agent key → 工具计数）。 */
    private turnTools;
    get count(): AchieveState;
    recordTool(name: string): void;
    recordTurnStart(agentKey: string): void;
    recordTurnTool(agentKey: string): void;
    recordTurnEnd(agentKey: string): void;
    recordSession(): void;
    recordTurn(): void;
    recordMidnight(): void;
    recordTokens(amount: number): void;
    /** GenUI 计数合并（client 写入；host 侧直接写计数键）。 */
    mergeGenUI(unlockedCount: number, fences: number): void;
    /** 检查解锁；返回新解锁（进队列 + 持久化；计数每次落盘）。 */
    flush(): void;
    snapshot(): EngineSnapshot;
    drainRecent(): Array<{
        id: string;
        name: string;
        rarity: string;
        icon: string;
    }>;
    fullSnapshot(): Record<string, unknown>;
    clear(): void;
}
/** 事件监听接线（0.1.1-rc.2 宿主事件面）。 */
export declare function attachListeners(ctx: Context, engine: AchievementsEngine): void;
/** HTTP 路由（/achievements/api，POST）——仿 dsh-memory 的 /memory/api 信任围栏。 */
export declare function registerRoutes(ctx: Context, engine: AchievementsEngine): void;
/** 工具：list_achievements（模型侧查询进度；只读）。 */
export declare function registerTool(ctx: Context, engine: AchievementsEngine): void;
