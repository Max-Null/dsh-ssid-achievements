import { AchievementsEngine, attachListeners, registerRoutes, registerTool } from "./engine.js";
export const name = '@max-null/dsh-achievements';
export const inject = ['tools', 'webServer', 'webRuntime'];
export function apply(ctx) {
    const engine = new AchievementsEngine();
    attachListeners(ctx, engine);
    registerRoutes(ctx, engine);
    registerTool(ctx, engine);
    ctx.on('agent/session-start', (() => {
        engine.recordSession();
        engine.flush();
    }));
    ctx.on('agent/turn-stopping', (() => {
        engine.recordTurn();
        engine.flush();
    }));
}
export { AchievementsEngine } from "./engine.js";
export { ACHIEVEMENTS, checkUnlocks, emptyState, snapshot, viewOf } from "./rules.js";
