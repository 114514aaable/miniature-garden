// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 投影：按契约从世界生成一张「照片」。
 *
 * 照片是值，不是窗口——渲染器拿到之后不许再回查世界。
 * 只拷契约里列的字段和组件，别的一概不碰。
 *
 * 启动握手也在这里：必需的组件缺了直接报错，可选的缺了记警告。
 */

import { type Entity } from "../../engine/core/src/entity/entity.ts";
import { mergeDeep } from "../../engine/core/src/entity/merge.ts";
import { type TemplateRegistry } from "../../engine/core/src/entity/template.ts";
import { type Space } from "../../engine/core/src/space.ts";
import { type JsonValue } from "../../engine/core/src/time.ts";
import { type EntityField, type RenderContract, validateContract } from "./contract.ts";

export interface RenderSource {
  readonly tick: number;
  readonly spaces: readonly Space[];
  readonly templates: TemplateRegistry;
  readonly entities: readonly Entity[];
}

export interface SnapshotEntity {
  readonly handle: number;
  readonly x?: number;
  readonly y?: number;
  readonly template?: string;
  readonly sprite?: JsonValue;
  /** 只包含契约点名的组件。 */
  readonly components: Readonly<Record<string, JsonValue>>;
}

export interface FrameSnapshot {
  readonly tick: number;
  readonly spaces: ReadonlyArray<{
    readonly id: number;
    readonly width: number;
    readonly height: number;
    readonly terrain: Int32Array;
  }>;
  readonly entities: readonly SnapshotEntity[];
}

export interface Projector {
  readonly warnings: readonly string[];
  snapshot(source: RenderSource): FrameSnapshot;
}

/**
 * 启动握手：校验契约、确认世界里有它要的组件，产出投影器。
 *
 * 必需组件缺失 = 直接抛错；可选缺失 = 收一条警告，面板那块不画。
 */
export function createProjector(contract: RenderContract, templates: TemplateRegistry): Projector {
  validateContract(contract);

  const warnings: string[] = [];
  for (const need of contract.needs.components) {
    if (!templates.hasComponent(need.name)) {
      if (need.required) {
        throw new Error(
          `渲染器 ${contract.id} 需要组件 ${need.name}，但这个世界没有定义它`,
        );
      }
      warnings.push(`渲染器 ${contract.id} 要的组件 ${need.name} 不存在，相关显示会跳过`);
    }
  }

  const fields = new Set<EntityField>(contract.needs.entityFields);
  const components = contract.needs.components
    .filter((need) => templates.hasComponent(need.name))
    .map((need) => need.name);

  return {
    warnings,
    snapshot(source: RenderSource): FrameSnapshot {
      const spaces = contract.needs.spaces === "all" ? source.spaces : source.spaces.slice(0, 1);

      return {
        tick: source.tick,
        spaces: spaces.map((space) => ({
          id: space.id,
          width: space.width,
          height: space.height,
          terrain: copyTerrain(space),
        })),
        entities: source.entities.map((entity) => projectEntity(entity, fields, components, templates)),
      };
    },
  };
}

function projectEntity(
  entity: Entity,
  fields: ReadonlySet<EntityField>,
  components: readonly string[],
  templates: TemplateRegistry,
): SnapshotEntity {
  const picked: Record<string, JsonValue> = {};

  if (components.length > 0 && templates.has(entity.template)) {
    const resolved = mergeDeep(
      templates.get(entity.template).components as Record<string, JsonValue>,
      entity.overrides,
    ) as Record<string, JsonValue>;

    for (const name of components) {
      if (resolved[name] !== undefined) {
        picked[name] = structuredClone(resolved[name]);
      }
    }
  }

  return {
    handle: entity.handle,
    ...(fields.has("pos") && entity.pos !== null ? { x: entity.pos.x, y: entity.pos.y } : {}),
    ...(fields.has("template") ? { template: entity.template } : {}),
    ...(fields.has("sprite") && picked["core.sprite"] !== undefined
      ? { sprite: picked["core.sprite"] }
      : {}),
    components: picked,
  };
}

/** 地形表要拷一份：快照不能和活着的空间共享引用。 */
function copyTerrain(space: Space): Int32Array {
  const terrain = new Int32Array(space.width * space.height);
  for (let y = 0; y < space.height; y++) {
    for (let x = 0; x < space.width; x++) {
      terrain[y * space.width + x] = space.terrainAt({ x, y });
    }
  }
  return terrain;
}
