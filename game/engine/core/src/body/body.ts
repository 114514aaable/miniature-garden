// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 部位：目录（可复用定义）+ 蓝图（一棵树）+ 运行时实例。
 *
 *   parts.json   每个部件的数值：hp / coverage / armor / grants / slots
 *   plans.json   把部件组成一棵树：parent、repeat、extends、delete
 *
 * 这里只做「解析 + 展开 + 校验」，不碰渲染和伤害；
 * 伤害路由、血条投影在 systems 层用这份数据。
 */

export interface BodyPartDef {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  /** 被选中的权重（相对值，不用凑 100）。 */
  readonly coverage: number;
  readonly armor: number;
  readonly vital: boolean;
  readonly tags: readonly string[];
  /** 能力点数：sight / hearing / manipulator / mover / core。 */
  readonly grants: Readonly<Record<string, number>>;
  /** 装备槽。 */
  readonly slots: readonly string[];
}

export interface BodyPlanPart {
  readonly id: string;
  readonly part: string;
  readonly parent?: string;
  readonly hp?: number;
  readonly coverage?: number;
  readonly armor?: number;
  readonly vital?: boolean;
  readonly tags?: readonly string[];
  readonly grants?: Readonly<Record<string, number>>;
  readonly slots?: readonly string[];
  /** 一次展开成 n 个：id 变成 id_1 … id_n。 */
  readonly repeat?: number;
  /** extends 时删掉继承来的同名部件。 */
  readonly delete?: boolean;
}

export interface BodyPlanDef {
  readonly id: string;
  readonly extends?: string;
  /** "marked"（默认，至少一个 vital）或 "all"（整棵树都是命）。 */
  readonly vital: "marked" | "all";
  readonly parts: readonly BodyPlanPart[];
}

/** 展开后的蓝图：parent / 数值都已落定。 */
export interface ResolvedBodyPlan {
  readonly id: string;
  readonly vital: "marked" | "all";
  readonly parts: ReadonlyArray<{
    readonly id: string;
    readonly part: string;
    readonly name: string;
    readonly parent: string | null;
    readonly hp: number;
    readonly coverage: number;
    readonly armor: number;
    readonly vital: boolean;
    readonly tags: readonly string[];
    readonly grants: Readonly<Record<string, number>>;
    readonly slots: readonly string[];
  }>;
}

const KEY = /^[a-z][a-z0-9_.-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asInt(value: unknown, fallback: number, where: string, min: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new Error(`${where} 需要 >= ${min} 的整数`);
  }
  return value;
}

function asStringArray(value: unknown, where: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${where} 应该是字符串数组`);
  }
  return [...value];
}

function asGrantMap(value: unknown, where: string): Record<string, number> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${where} 应该是对象`);
  const out: Record<string, number> = {};
  for (const [key, points] of Object.entries(value)) {
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0) {
      throw new Error(`${where}.${key} 应该是非负数`);
    }
    out[key] = points;
  }
  return out;
}

/** 校验并解析一个部件定义。 */
export function parseBodyPart(raw: unknown, idKey: string): BodyPartDef {
  if (!KEY.test(idKey)) throw new Error(`部件 id 非法：${idKey}`);
  if (!isRecord(raw)) throw new Error(`部件 ${idKey}：应该是对象`);

  const name = typeof raw.name === "string" && raw.name.length > 0 ? raw.name : idKey;
  return {
    id: idKey,
    name,
    hp: asInt(raw.hp, 10, `部件 ${idKey}.hp`, 1),
    coverage: asInt(raw.coverage, 1, `部件 ${idKey}.coverage`, 1),
    armor: asInt(raw.armor, 0, `部件 ${idKey}.armor`, 0),
    vital: raw.vital === true,
    tags: asStringArray(raw.tags, `部件 ${idKey}.tags`),
    grants: asGrantMap(raw.grants, `部件 ${idKey}.grants`),
    slots: asStringArray(raw.slots, `部件 ${idKey}.slots`),
  };
}

/** 校验并解析一个蓝图（还没展开 extends / repeat）。 */
export function parseBodyPlan(raw: unknown, idKey: string): BodyPlanDef {
  if (!KEY.test(idKey)) throw new Error(`蓝图 id 非法：${idKey}`);
  if (!isRecord(raw)) throw new Error(`蓝图 ${idKey}：应该是对象`);

  const vital = raw.vital === "all" ? "all" : "marked";
  if (!Array.isArray(raw.parts) && raw.extends === undefined) {
    throw new Error(`蓝图 ${idKey}：缺少 parts`);
  }

  const parts: BodyPlanPart[] = [];
  for (const [index, item] of (Array.isArray(raw.parts) ? raw.parts : []).entries()) {
    if (!isRecord(item)) throw new Error(`蓝图 ${idKey}：parts[${index}] 应该是对象`);
    const id = typeof item.id === "string" ? item.id : "";
    if (!KEY.test(id)) throw new Error(`蓝图 ${idKey}：parts[${index}].id 非法`);

    parts.push({
      id,
      part: typeof item.part === "string" ? item.part : "",
      parent: typeof item.parent === "string" ? item.parent : undefined,
      hp: item.hp === undefined ? undefined : asInt(item.hp, 0, `蓝图 ${idKey}.${id}.hp`, 1),
      coverage: item.coverage === undefined ? undefined : asInt(item.coverage, 0, `蓝图 ${idKey}.${id}.coverage`, 1),
      armor: item.armor === undefined ? undefined : asInt(item.armor, 0, `蓝图 ${idKey}.${id}.armor`, 0),
      vital: typeof item.vital === "boolean" ? item.vital : undefined,
      tags: item.tags === undefined ? undefined : asStringArray(item.tags, `蓝图 ${idKey}.${id}.tags`),
      grants: item.grants === undefined ? undefined : asGrantMap(item.grants, `蓝图 ${idKey}.${id}.grants`),
      slots: item.slots === undefined ? undefined : asStringArray(item.slots, `蓝图 ${idKey}.${id}.slots`),
      repeat: item.repeat === undefined ? undefined : asInt(item.repeat, 1, `蓝图 ${idKey}.${id}.repeat`, 1),
      delete: item.delete === true,
    });
  }

  return {
    id: idKey,
    extends: typeof raw.extends === "string" ? raw.extends : undefined,
    vital,
    parts,
  };
}

/**
 * 展开所有蓝图：继承、repeat、delete，再校验引用与环。
 */
export function resolveBodyPlans(
  plans: ReadonlyMap<string, BodyPlanDef>,
  parts: ReadonlyMap<string, BodyPartDef>,
): Map<string, ResolvedBodyPlan> {
  const resolved = new Map<string, ResolvedBodyPlan>();
  const visiting = new Set<string>();

  const resolve = (id: string): ResolvedBodyPlan => {
    const done = resolved.get(id);
    if (done !== undefined) return done;

    const plan = plans.get(id);
    if (plan === undefined) throw new Error(`蓝图不存在："${id}"`);
    if (visiting.has(id)) throw new Error(`蓝图继承成环：${[...visiting].join(" → ")} → ${id}`);
    visiting.add(id);

    const inherited = plan.extends === undefined ? [] : [...resolve(plan.extends).parts];
    const byId = new Map(inherited.map((part) => [part.id, part]));

    for (const item of plan.parts) {
      if (item.delete === true) {
        byId.delete(item.id);
        continue;
      }

      const def = parts.get(item.part);
      if (def === undefined) throw new Error(`蓝图 ${id}：部件定义不存在 "${item.part}"`);

      const count = item.repeat ?? 1;
      for (let index = 1; index <= count; index += 1) {
        const partId = count === 1 ? item.id : `${item.id}_${index}`;
        byId.set(partId, {
          id: partId,
          part: def.id,
          name: def.name,
          parent: item.parent ?? null,
          hp: item.hp ?? def.hp,
          coverage: item.coverage ?? def.coverage,
          armor: item.armor ?? def.armor,
          vital: item.vital ?? def.vital,
          tags: item.tags ?? def.tags,
          grants: item.grants ?? def.grants,
          slots: item.slots ?? def.slots,
        });
      }
    }

    visiting.delete(id);

    let list = [...byId.values()];
    if (list.length === 0) throw new Error(`蓝图 ${id}：没有任何部件`);
    if (plan.vital === "all") {
      list = list.map((part) => ({ ...part, vital: true }));
    }

    // 父部件必须存在；沿 parent 走不能成环
    for (const part of list) {
      if (part.parent !== null && !byId.has(part.parent)) {
        throw new Error(`蓝图 ${id}：部件 ${part.id} 的 parent "${part.parent}" 不存在`);
      }
      const seen = new Set<string>();
      let cursor: string | null = part.id;
      while (cursor !== null) {
        if (seen.has(cursor)) throw new Error(`蓝图 ${id}：parent 成环（${part.id}）`);
        seen.add(cursor);
        cursor = byId.get(cursor)?.parent ?? null;
      }
    }

    if (!list.some((part) => part.vital)) {
      throw new Error(`蓝图 ${id}：没有任何 vital 部件（要么标一个，要么写 vital: "all"）`);
    }

    const result: ResolvedBodyPlan = { id, vital: plan.vital, parts: list };
    resolved.set(id, result);
    return result;
  };

  for (const id of plans.keys()) resolve(id);
  return resolved;
}

/** 能力合计（按部位状态过滤由调用方决定）。 */
export function capabilityOf(plan: ResolvedBodyPlan, ability: string): number {
  let total = 0;
  for (const part of plan.parts) total += part.grants[ability] ?? 0;
  return total;
}
