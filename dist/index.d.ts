/**
 * @max-null/dsh-achievements host half: the achievements engine for the SSiD
 * family. Observes the session/tool event plane, folds leaf scalars into
 * durable counters, unlocks trophies (toast queue + HTTP + tool view), and
 * serves /achievements/api to the browser half. Privacy: counters only —
 * tool names, event kinds, token counts; message/file/error content is never
 * read. The GenUI category is merged by the client reading the genui
 * plugin's own localStorage counters.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "@max-null/dsh-achievements";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
export { AchievementsEngine } from './engine.ts';
export { ACHIEVEMENTS, checkUnlocks, emptyState, snapshot, viewOf } from './rules.ts';
export type { AchieveState, AchievementDef, Category, Rarity } from './rules.ts';
