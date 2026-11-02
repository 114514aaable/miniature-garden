// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 从代码与语言包生成模块文档（docs/modules/）。
 *
 * 为什么生成而不是手写：
 *   手写的文档迟早和代码分叉；生成的永远一致。
 *   名字/介绍来自语言包，参数来自签名，组件来自包里的 schema。
 *
 * 用法：
 *   node tools/gen-docs.mjs
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { RULE_TABLE } from "../game/systems/rules/index.ts";

const LOCALE = JSON.parse(readFileSync("game/locales/zh-CN.json", "utf8"));
const OUT = "docs/modules";

const label = (kind, id) => LOCALE[`${kind}.${id}.name`] ?? id;
const describe = (kind, id) => LOCALE[`${kind}.${id}.desc`] ?? "";

function json(value) {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

function readJson(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const data = JSON.parse(readFileSync(`${dir}/${name}`, "utf8"));
    if (Array.isArray(data)) out.push(...data);
    else out.push(data);
  }
  return out;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const index = [];
const catalog = [];
let rules = 0;
let components = 0;
let templates = 0;

// ── 规则 ──────────────────────────────────────────────
for (const rule of RULE_TABLE) {
  const tag = rule.signature.tag;
  const name = label("rule", tag);
  const desc = describe("rule", tag);
  const skill = rule.signature.skill;

  const body = [
    `# ${name}`,
    "",
    `\`${tag}\`${desc ? " — " + desc : ""}`,
    "",
    "## 参数",
    json(rule.signature.params),
    "",
    "## 返回",
    json(rule.signature.result),
    "",
  ];

  if (skill !== undefined) {
    body.push(
      "## 作为技能",
      "",
      `- 名字：${skill.name}`,
      `- 成本键：\`${skill.cost}\`（查 world.json 的 clock.costs）`,
      `- 目标：${skill.target.kind}，射程 ${skill.target.range}`,
      "",
    );
  }

  body.push(`产出效果：${rule.signature.returnsEffects ? "是（Effect[]）" : "否"}`);
  body.push("");

  writeFileSync(`${OUT}/rule-${tag}.md`, body.join("\n"), "utf8");
  index.push(`| 规则 | [${name}](rule-${tag}.md) | \`${tag}\` | ${desc} |`);
  catalog.push({ kind: "rule", id: tag, name, desc, file: `rule-${tag}.md`, params: rule.signature.params, returnsEffects: rule.signature.returnsEffects });
  rules += 1;
}

// ── 组件 ──────────────────────────────────────────────
for (const component of readJson("game/worlds/official.base")) {
  void component;
}

const componentsJson = JSON.parse(readFileSync("game/worlds/official.base/components.json", "utf8"));
for (const component of componentsJson) {
  const name = label("component", component.id);
  const desc = describe("component", component.id);

  const body = [`# ${name}`, "", `\`${component.id}\`${desc ? " — " + desc : ""}`, "", "## Schema", json(component.schema), ""];
  writeFileSync(`${OUT}/component-${component.id}.md`, body.join("\n"), "utf8");
  index.push(`| 组件 | [${name}](component-${component.id}.md) | \`${component.id}\` | ${desc} |`);
  catalog.push({ kind: "component", id: component.id, name, desc, file: `component-${component.id}.md`, schema: component.schema });
  components += 1;
}

// ── 预制件 ────────────────────────────────────────────
for (const dir of ["game/worlds/official.normal/groups"]) {
  let files = [];
  try {
    files = readdirSync(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const list = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    for (const group of Array.isArray(list) ? list : [list]) {
      const body = [
        "# 预制件 " + group.id,
        "",
        "一组实体 + 相对偏移，用 `stamp` 盖到地图上。",
        "",
        "## 组成",
        ...group.entities.map((part) => `- \`${part.template}\` 偏移 (${part.dx}, ${part.dy})`),
        "",
      ];
      writeFileSync(`${OUT}/group-${group.id}.md`, body.join("\n"), "utf8");
      index.push(`| 预制件 | ${group.id} | \`${group.id}\` | ${group.entities.length} 个实体 |`);
      catalog.push({ kind: "group", id: group.id, name: group.id, desc: "", file: `group-${group.id}.md`, entities: group.entities });
    }
  }
}

// ── 模板（base + normal）──────────────────────────────
const templatesDirs = ["game/worlds/official.base/templates", "game/worlds/official.normal/templates"];
for (const dir of templatesDirs) {
  let files = [];
  try {
    files = readdirSync(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const list = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    for (const template of Array.isArray(list) ? list : [list]) {
      const name = label("template", template.id);
      const desc = describe("template", template.id);
      const components = Object.keys(template.components ?? {});

      const body = [
        `# ${name}`,
        "",
        `\`${template.id}\`${desc ? " — " + desc : ""}`,
        "",
        template.extends ? `继承：\`${template.extends}\`` : "继承：无",
        "",
        "## 组件",
        ...components.map((component) => `- \`${component}\` — ${label("component", component)}`),
        "",
      ];

      writeFileSync(`${OUT}/template-${template.id}.md`, body.join("\n"), "utf8");
      index.push(`| 模板 | [${name}](template-${template.id}.md) | \`${template.id}\` | ${desc} |`);
      catalog.push({ kind: "template", id: template.id, name, desc, file: `template-${template.id}.md`, extends: template.extends ?? null, components });
      templates += 1;
    }
  }
}

// ── 目录 ──────────────────────────────────────────────
const readme = [
  "# 模块目录（自动生成）",
  "",
  "> 由 `node tools/gen-docs.mjs` 生成。**不要手改**——改语言包或代码。",
  "",
  `规则 ${rules} 条 · 组件 ${components} 个 · 模板 ${templates} 个`,
  "",
  "| 类型 | 名字 | id | 说明 |",
  "|---|---|---|---|",
  ...index,
  "",
];

writeFileSync(`${OUT}/README.md`, readme.join("\n"), "utf8");
writeFileSync(`${OUT}/index.json`, JSON.stringify({ generated: true, entries: catalog }, null, 2) + "\n", "utf8");
console.log(`生成 ${rules + components + templates} 篇文档 → ${OUT}/`);
