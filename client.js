window.__ModuleLoader__.load({
  id: "@max-null/dsh-achievements",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  AchievementsView: () => AchievementsView,
  apply: () => apply,
  inject: () => inject,
  mountToastLayer: () => mountToastLayer
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
async function api(method, body) {
  try {
    const response = await fetch(`/achievements/api/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const payload = await response.json();
    return payload.value ?? null;
  } catch {
    return null;
  }
}
var STRINGS = {
  zh: {
    title: "\u6210\u5C31",
    desc: "SSiD \u5168\u5BB6\u6876\u8FDB\u5EA6\uFF1A\u5DE5\u5177/\u8BB0\u5FC6/\u5BA1\u8BA1/GenUI \u4F7F\u7528\u6210\u5C31\uFF0C\u89E3\u9501\u53EF\u9886 toast\u3002",
    refresh: "\u5237\u65B0",
    locked: "\u672A\u89E3\u9501",
    unlocked: "\u5DF2\u89E3\u9501"
  },
  en: {
    title: "Achievements",
    desc: "SSiD family progress: tool/memory/audit/GenUI usage trophies with unlock toasts.",
    refresh: "Refresh",
    locked: "Locked",
    unlocked: "Unlocked"
  }
};
var GENUI_LS_KEY = "dsh.genui.achievements";
function readGenUI() {
  try {
    const raw = localStorage.getItem(GENUI_LS_KEY);
    if (raw === null) return { unlockedCount: 0, fences: 0 };
    const parsed = JSON.parse(raw);
    return {
      unlockedCount: Object.keys(parsed.unlocked ?? {}).length,
      fences: parsed.state?.fences ?? 0
    };
  } catch {
    return { unlockedCount: 0, fences: 0 };
  }
}
function lang() {
  return typeof document !== "undefined" && (document.documentElement.lang || "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
}
function AchievementsView(_props) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [category, setCategory] = (0, import_react.useState)("\u5168\u90E8");
  const [note, setNote] = (0, import_react.useState)("");
  const t = STRINGS[lang()];
  const reload = (0, import_react.useCallback)(async () => {
    const genui = readGenUI();
    await api("genui-merge", genui);
    const data = await api("list");
    if (data !== null) setSnapshot(data);
  }, []);
  (0, import_react.useEffect)(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 15e3);
    return () => window.clearInterval(timer);
  }, []);
  const categories = snapshot === null ? ["\u5168\u90E8"] : ["\u5168\u90E8", ...new Set(snapshot.achievements.map((a) => a.category))];
  const items = snapshot?.achievements.filter((a) => category === "\u5168\u90E8" || a.category === category) ?? [];
  return (0, import_react.createElement)(
    "div",
    { className: "ach", "data-dsh-achievements-view": "" },
    (0, import_react.createElement)(
      "div",
      { className: "achHead" },
      (0, import_react.createElement)("span", { className: "achTitle" }, t.title),
      (0, import_react.createElement)("span", { className: "achMeta" }, snapshot !== null ? `${snapshot.unlocked} / ${snapshot.total}` : "\u2026"),
      (0, import_react.createElement)("button", {
        type: "button",
        className: "achBtn",
        onClick: () => {
          void reload();
          setNote("\u5DF2\u5237\u65B0");
          window.setTimeout(() => setNote(""), 1500);
        }
      }, t.refresh)
    ),
    (0, import_react.createElement)("div", { className: "achDesc" }, t.desc),
    (0, import_react.createElement)(
      "div",
      { className: "achCats" },
      categories.map((c) => (0, import_react.createElement)("button", {
        key: c,
        type: "button",
        className: `achCat${category === c ? " achCatOn" : ""}`,
        onClick: () => setCategory(c)
      }, c))
    ),
    (0, import_react.createElement)(
      "div",
      { className: "achList" },
      items.map((a) => (0, import_react.createElement)(
        "div",
        { key: a.id, className: `achRow${a.locked ? "" : " achRowOn"}` },
        (0, import_react.createElement)("span", { className: "achIcon", "aria-hidden": "" }, a.icon),
        (0, import_react.createElement)(
          "div",
          { className: "achBody" },
          (0, import_react.createElement)(
            "div",
            { className: "achName" },
            a.name,
            (0, import_react.createElement)(
              "span",
              { className: `achRarity achRarity-${a.rarity}` },
              a.rarity === "legendary" ? "\u4F20\u8BF4" : a.rarity === "epic" ? "\u53F2\u8BD7" : a.rarity === "rare" ? "\u7A00\u6709" : "\u666E\u901A"
            )
          ),
          (0, import_react.createElement)("div", { className: "achDesc2" }, a.desc),
          (0, import_react.createElement)(
            "div",
            { className: "achProgRow" },
            (0, import_react.createElement)(
              "div",
              { className: "achProg" },
              (0, import_react.createElement)("div", {
                className: "achProgFill",
                style: { width: `${Math.min(100, Math.round(a.progress.current / a.progress.target * 100))}%` }
              })
            ),
            (0, import_react.createElement)("span", { className: "achProgNum" }, `${a.progress.current} / ${a.progress.target}`)
          )
        ),
        (0, import_react.createElement)("span", { className: `achState${a.locked ? "" : " achStateOn"}` }, a.locked ? t.locked : t.unlocked)
      ))
    ),
    note !== "" ? (0, import_react.createElement)("div", { className: "achNote" }, note) : null
  );
}
function mountToastLayer() {
  if (typeof document === "undefined") return () => {
  };
  const host = document.createElement("div");
  host.dataset.dshAchievementsToast = "1";
  document.body.appendChild(host);
  const render = () => {
    void api("recent").then((data) => {
      if (data === null || data.length === 0) return;
      host.textContent = "";
      for (const u of data) {
        const row = document.createElement("div");
        row.className = "at-row";
        row.textContent = `\u{1F3C6} \u6210\u5C31\u89E3\u9501\uFF1A${u.name}`;
        host.appendChild(row);
      }
      window.setTimeout(() => {
        host.textContent = "";
      }, 4200);
    });
  };
  const first = window.setTimeout(render, 2500);
  const interval = window.setInterval(render, 8e3);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(interval);
    host.remove();
  };
}
var inject = ["slots"];
function apply(ctx) {
  const disposers = [];
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "ssid-achievements",
    order: 90,
    label: () => STRINGS[lang()].title
  }, () => (0, import_react.createElement)(AchievementsView, { visible: true })));
  disposers.push(mountToastLayer());
  return () => {
    for (const dispose of disposers) dispose();
  };
}
if (typeof document !== "undefined" && document.querySelector("style[data-dsh-achievements-css]") === null) {
  const tag = document.createElement("style");
  tag.dataset.dshAchievementsCss = "1";
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
var CSS = [
  ".ach{display:flex;flex-direction:column;gap:10px;padding:4px 0}",
  ".achHead{display:flex;align-items:center;gap:10px}",
  ".achTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}",
  ".achMeta{font-size:13px;color:var(--dsw-alias-label-secondary,inherit)}",
  ".achBtn{margin-left:auto;padding:4px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.4));border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,inherit);font-size:12px;cursor:pointer}",
  ".achDesc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit)}",
  ".achCats{display:flex;flex-wrap:wrap;gap:6px}",
  ".achCat{padding:3px 10px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.4));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;cursor:pointer}",
  ".achCatOn{border-color:var(--dsw-alias-state-business-primary,#4f8ef7);color:var(--dsw-alias-state-business-primary,#4f8ef7)}",
  ".achList{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto}",
  ".achRow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:12px}",
  ".achRowOn{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 35%,transparent)}",
  ".achIcon{font-size:20px;line-height:1}",
  ".achBody{flex:1;min-width:0}",
  ".achName{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}",
  ".achRarity{font-size:11px;padding:0 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-state-business-primary,#4f8ef7)}",
  ".achRarity-rare{background:color-mix(in srgb,#f59e0b 14%,transparent);color:#f59e0b}",
  ".achRarity-epic{background:color-mix(in srgb,#a78bfa 14%,transparent);color:#a78bfa}",
  ".achRarity-legendary{background:color-mix(in srgb,#f43f5e 14%,transparent);color:#f43f5e}",
  ".achDesc2{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,inherit)}",
  ".achProgRow{display:flex;align-items:center;gap:8px;margin-top:4px}",
  ".achProg{flex:1;height:4px;border-radius:999px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.3));overflow:hidden}",
  ".achProgFill{height:100%;background:var(--dsw-alias-state-business-primary,#4f8ef7)}",
  ".achProgNum{font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}",
  ".achState{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}",
  ".achStateOn{color:var(--dsw-alias-state-success-primary,#6ccb5f)}",
  ".achNote{font-size:12px;color:var(--dsw-alias-state-success-primary,#6ccb5f)}",
  ".at-row{position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;padding:10px 12px;border:1px solid var(--dsw-alias-state-business-primary,#4f8ef7);border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.85));color:var(--dsw-alias-state-business-primary,#4f8ef7);font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25)}"
].join("");
    return module.exports;
  },
});

