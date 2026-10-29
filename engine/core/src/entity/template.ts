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

const COMPONENT_PATTERN = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;
const TEMPLATE_PATTERN = /^[a-z][a-z0-9_-]{2,47}$/;

export interface Template {
  readonly id: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}

export interface TemplateLink {
  /** 模板 + 组件定义的整体哈希，参与世界身份。 */
  readonly hash: string;
}

export class TemplateRegistry {
  private readonly schemas = new Map<string, Schema>();
  private readonly templates = new Map<string, Template>();

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
   *   - 组件数据必须符合 schema；
   *   - 不允许出现模板里没登记的组件（防止打错字）。
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
      validate(value, schema, `$${template.id}.${name}`);
    }
    this.templates.set(template.id, structuredClone(template));
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  /** 取模板；返回副本，外面改不到内部。 */
  get(id: string): Template {
    const template = this.templates.get(id);
    if (template === undefined) {
      throw new Error(`模板不存在：${id}`);
    }
    return structuredClone(template);
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
      .map((id) => ({ id, components: this.templates.get(id)?.components ?? {} }));

    return {
      hash: hashText(canonicalize({ components, templates } as unknown as JsonValue)),
    };
  }
}
