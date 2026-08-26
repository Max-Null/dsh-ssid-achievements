/**
 * rules.ts — SSiD 全家桶成就定义（纯数据/纯函数，零依赖可测）。
 *
 * 计数语义只含「工具名/事件类型/时间」级别的标量：工具调用名与成功与否、
 * 会话/回合计数、usage token 数（叶级标量）、当天时刻。绝不读取消息正文、
 * 文件内容或错误详情。GenUI 类别由 client 侧读取 genui 插件的计数
 * localStorage 合并（见 client/index.tsx）。
 */
export type Category = '启程' | '记忆' | '审计' | 'GenUI' | '工具' | '行为' | '隐藏';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface AchievementDef {
    id: string;
    name: string;
    desc: string;
    icon: string;
    category: Category;
    rarity: Rarity;
    hidden?: boolean;
    /** 阈值规则：计数器键 → 目标值。 */
    threshold: {
        counter: string;
        target: number;
    };
}
/** 计数键（leaf scalars only）。 */
export declare const KEYS: {
    readonly sessions: "sessions";
    readonly turns: "turns";
    readonly tools: "tools";
    readonly toolsUsed: "toolsUsed";
    readonly memoryTools: "memoryTools";
    readonly memorySaved: "memorySaved";
    readonly memoryConfirmed: "memoryConfirmed";
    readonly templateTools: "templateTools";
    readonly audits: "audits";
    readonly genuiUnlocked: "genuiUnlocked";
    readonly genuiFences: "genuiFences";
    readonly marathonTurns: "marathonTurns";
    readonly midnightTurns: "midnightTurns";
    readonly selfQueries: "selfQueries";
    readonly tokens: "tokens";
};
/** SSiD 全家桶成就表。 */
export declare const ACHIEVEMENTS: readonly AchievementDef[];
/** 成就状态数据（纯标量）。 */
export interface AchieveState {
    [index: string]: number;
}
export declare function emptyState(): AchieveState;
/** 检查新解锁（不看 hidden——hidden 仅影响展示）。 */
export declare function checkUnlocks(state: AchieveState, unlocked: Record<string, number>): AchievementDef[];
/** 视图行（client 渲染用）。 */
export declare function viewOf(achievement: AchievementDef, state: AchieveState, unlocked: Record<string, number>): Record<string, unknown>;
/** 快照（HTTP / 工具共用）。 */
export declare function snapshot(state: AchieveState, unlocked: Record<string, number>): Record<string, unknown>;
