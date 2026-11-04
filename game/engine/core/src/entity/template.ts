// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 模板：世界包里「一类东西长什么样」。
 *
 * 借用新版 Minecraft 的思路（数据组件 + 默认值），但砍掉自由 NBT 树：
 * 每个组件都有 schema，打错字段当场报错。
 *
 *   Template { id: "npc_guard", components: { "core.health": { max: 20 } } }
 *
 * 运行时实例只存「和模板不一样」的部分（见 merge.ts）：
 *   Entity { template: "npc_guard", overrides: { "core.health": { hp: 7 } } }
 *
 * 于是 max 不写进存档，只写 hp——这就是「默认值不存」。
 *
 * 组件名用点号命名空间（core.health），和 Event 的标签保持同一种风格，
 * 免得项目里出现两套命名习惯。
 */

import { type Schema, validate } from "../event/schema.ts";
import { type JsonValue, canonicalize, hashText } from "../time.ts";
import { mergeDeep } from "./merge.ts";

const COMPONENT_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;
const TEMPLATE_PATTERN = /^[a-z][a-z0-9_-]{1,47}$/;

export interface Template {
  readonly id: string;
  /** 继承哪个模板。组件会深合并到父模板上。 */
  readonly extends?: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}

export interface TemplateLink {
  /** 模板 + 组件定义的整体哈希，参与世界身份。 */
  readonly hash: string;
}

export class TemplateRegistry {
  private readonly schemas = new Map<string, Schema>();
  private readonly templates = new Map<string, Template>();
  /** 解析并校验过的模板缓存。get 在实体查询里是热路径。 */
  private readonly resolved = new Map<string, Template>();

  /** 登记一种组件。组件的名字就是它的身份，登记两次直接报错。 */
  defineComponent(name: string, schema: Schema): void {
    if (!COMPONENT_PATTERN.test(name)) {
      throw new Error(`组件名非法："${name}"，应形如 "core.health"`);
    }
    if (this.schemas.has(name)) {
      throw new Error(`组件重复登记："${name}"`);
    }
    this.schemas.set(name, schema);
  }

  /**
   * 登记一个模板。会逐项校验：
   *   - 组件必须已登记；
   *   - 没有继承的模板，组件数据当场按 schema 校验；
   *   - 有继承的模板只校验字段名，数值合并之后再校验（它可能只写了差异）。
   */
  defineTemplate(template: Template): void {
    if (!TEMPLATE_PATTERN.test(template.id)) {
      throw new Error(`模板 id 非法："${template.id}"`);
    }
    if (this.templates.has(template.id)) {
      throw new Error(`模板重复登记："${template.id}"`);
    }
    for (const [name, value] of Object.entries(template.components)) {
      const schema = this.schemas.get(name);
      if (schema === undefined) {
        throw new Error(`模板 "${template.id}" 用了未登记的组件："${name}"`);
      }
      if (template.extends === undefined) {
        validate(value, schema, `$${template.id}.${name}`);
      }
    }
    this.templates.set(template.id, structuredClone(template));
    this.resolved.clear();
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  /** 取模板（已合并继承链）；返回副本，外面改不到内部。 */
  /** 所有模板 id（按注册顺序）。数据体检、调试用。 */
  ids(): readonly string[] {
    return [...this.templates.keys()];
  }

  get(id: string): Template {
    return structuredClone(this.resolve(id, []));
  }

  /**
   * 沿继承链解析组件。
   *
   * 用「路径」而不是「深度」来报错：环的时候能说清是哪一条链断了。
   * 结果会缓存——`get` 在实体查询里是热路径，不能每次都重算 + 重校验。
   */
  private resolve(id: string, path: readonly string[]): Template {
    const cached = this.resolved.get(id);
    if (cached !== undefined) {
      return cached;
    }

    if (path.includes(id)) {
      throw new Error(`模板继承成环：${[...path, id].join(" → ")}`);
    }
    if (path.length > 8) {
      throw new Error(`模板继承超过 8 层：${[...path, id].join(" → ")}`);
    }

    const raw = this.templates.get(id);
    if (raw === undefined) {
      const where = path.length > 0 ? `（被 ${path.join(" → ")} 引用）` : "";
      throw new Error(`模板不存在：${id}${where}`);
    }

    const own = raw.components;
    if (raw.extends === undefined) {
      const template: Template = { id, components: structuredClone(own) };
      this.checkResolved(template);
      this.resolved.set(id, template);
      return template;
    }

    const parent = this.resolve(raw.extends, [...path, id]);
    const merged = mergeDeep(
      parent.components as Record<string, JsonValue>,
      own,
    ) as Record<string, JsonValue>;

    const template: Template = { id, extends: raw.extends, components: merged };
    this.checkResolved(template);
    this.resolved.set(id, template);
    return template;
  }

  /** 合并之后的组件必须整体合法（这才是实体真正会用到的数据）。 */
  private checkResolved(template: Template): void {
    for (const [name, value] of Object.entries(template.components)) {
      const schema = this.schemas.get(name);
      if (schema === undefined) {
        throw new Error(`模板 "${template.id}" 用了未登记的组件："${name}"`);
      }
      validate(value, schema, `$${template.id}.${name}`);
    }
  }

  /** 模板声明了哪些组件。用来校验 patch 不会凭空造组件。 */
  componentNames(templateId: string): readonly string[] {
    return Object.keys(this.get(templateId).components);
  }

  /** 这个世界有没有定义某个组件。渲染器启动握手要用。 */
  hasComponent(name: string): boolean {
    return this.schemas.has(name);
  }

  /** 组件名 → schema，供合并/校验时查。 */
  schemaOf(name: string): Schema {
    const schema = this.schemas.get(name);
    if (schema === undefined) {
      throw new Error(`组件未登记：${name}`);
    }
    return schema;
  }

  /**
   * 链接：按名字排序后算哈希。
   * 登记顺序不影响结果——同一组内容，任何机器算出同一个哈希。
   */
  link(): TemplateLink {
    const components = [...this.schemas.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([name, schema]) => ({ name, schema }));

    const templates = [...this.templates.keys()]
      .sort()
      .map((id) => {
        const resolved = this.resolve(id, []);
        return { id, extends: resolved.extends ?? null, components: resolved.components };
      });

    return {
      hash: hashText(canonicalize({ components, templates } as unknown as JsonValue)),
    };
  }
}
