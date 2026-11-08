// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成流水线：把生成算法拆成「一步一个算子」，串起来跑。
 *
 * 为什么不再用 generation.generator 二选一：
 *   地下洞窟 = 地表（噪声+群系） + 洞穴遮罩 + 混合
 *   需要「多层叠加」，而不是「换一个生成器」。
 *
 * 约定：
 *   - 每个算子只改传入的 sandbox（地形数组 + 具名图层），不返回新世界；
 *   - 算子之间只通过 sandbox 的图层名交流（"biome" / "cave" …）；
 *   - 全部纯函数 + 确定性，同一份输入永远同一张图。
 */

import { generateCaves } from "./generators/caves.ts";
import { generateMaze } from "./generators/maze.ts";
import { placeStructures, type SpawnRequest, type StructureDef } from "./structures.ts";
import { placeRooms } from "./generators/rooms.ts";
import { placeTiles } from "./generators/tiles.ts";
import { placeLayout } from "./generators/layout.ts";
import { placeSprawl } from "./generators/sprawl.ts";
import { populate } from "./populate.ts";
import { generateTerrain, type FieldConfig } from "./generators/generate.ts";
import type { Biome } from "./generators/select.ts";

export interface Sandbox {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** 地形号数组（长度 width×height）。 */
  terrain: number[];
  /** 具名图层：来源算子写，混合算子读。 */
  readonly layers: Map<string, readonly number[]>;
  /** 群系号（overworld 算子写）。 */
  biome: number[];
  /** 生成期产出的出生请求（结构里的实体）。 */
  spawns: SpawnRequest[];
  /** 实体图：cell → 实体（模板 + 标签）。 */
  readonly entities: Map<number, EntityPlacement[]>;
  /** 生成期登记的区域（房间，带标签）。 */
  readonly regions: { rooms: SpaceRoom[] };
  /** 出生点（populate 的 avoid: start 用）。 */
  start: { x: number; y: number } | null;
}

export interface EntityPlacement {
  readonly template: string;
  readonly tags: readonly string[];
  readonly source: string;
}

export interface SpaceRoom {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tags: readonly string[];
  readonly structure: string;
}

export interface PipelineDeps {
  readonly biomes: readonly Biome[];
  readonly terrainIdByCode: ReadonlyMap<string, number>;
  /** 结构定义（place 阶段用；不摆结构可以不传）。 */
  readonly structures?: ReadonlyMap<string, StructureDef>;
  /** 出生点（可选；populate 清空周围时用）。 */
  readonly start?: { readonly x: number; readonly y: number };
}

export type Step =
  | { readonly op: "overworld"; readonly fields?: Record<string, FieldConfig>; readonly levels?: { water?: number; hill?: number } }
  | {
      readonly op: "caves";
      /** 墙 / 地板的地形代号（默认 wall / floor）。 */
      readonly wall?: string;
      readonly floor?: string;
      readonly fill?: number;
      readonly iterations?: number;
      readonly spawnClear?: number;
      readonly regions?: number;
      readonly chambers?: number;
      /** 图层名，默认 "cave"。 */
      readonly as?: string;
    }
  | {
      readonly op: "maze";
      /** 墙 / 通道的地形代号（默认 wall / floor）。 */
      readonly wall?: string;
      readonly floor?: string;
      /** 0..1：死胡同打通比例。 */
      readonly braid?: number;
      readonly inset?: number;
    }
  | {
      readonly op: "populate";
      /** 投放规则（按房间 / 走廊 / 死胡同）。 */
      readonly rules: readonly import("./populate.ts").PopulateRule[];
    }
  | {
      readonly op: "sprawl";
      /** 候选房间件（role = room，尺寸随意）。 */
      readonly rooms: readonly string[];
      readonly count?: number;
      readonly tries?: number;
      readonly margin?: number;
      readonly corridor?: string;
      readonly widen?: number;
    }
  | {
      readonly op: "layout";
      /** 走廊格可用的 7×7 件。 */
      readonly tiles: readonly string[];
      /** 大房间数量。 */
      readonly rooms?: number;
      readonly roomMin?: readonly [number, number];
      readonly roomMax?: readonly [number, number];
      readonly loops?: number;
    }
  | {
      readonly op: "tiles";
      /** 候选 7×7 件。 */
      readonly tiles: readonly string[];
    }
  | {
      readonly op: "rooms";
      /** 候选房间结构（role = room）。 */
      readonly structures: readonly string[];
      readonly count?: number;
      readonly minSize?: readonly [number, number];
      readonly maxSize?: readonly [number, number];
      readonly corridor?: string;
      readonly connect?: "anchors" | "centers";
      readonly inset?: number;
      readonly margin?: number;
      /** 额外环路比例（0..1）。 */
      readonly loops?: number;
    }
  | {
      readonly op: "place";
      readonly structures: readonly string[];
      readonly count?: number;
      readonly spacing?: number;
      readonly on?: readonly string[];
      readonly inset?: number;
      readonly tries?: number;
    }
  | {
      readonly op: "blend";
      /** 用哪个洞穴图层。 */
      readonly cave?: string;
      /** 洞穴里「地」用哪个地形代号。 */
      readonly floor?: string;
      /** 洞穴里「墙」怎么处理：keep = 保留地表，solid = 变成墙。 */
      readonly wall?: "keep" | "solid";
      /** 洞穴只在一个矩形范围内生效（可选）。 */
      readonly inset?: number;
    };

export function createSandbox(seed: number, width: number, height: number, fill: number): Sandbox {
  return {
    seed,
    width,
    height,
    terrain: new Array<number>(width * height).fill(fill),
    layers: new Map(),
    biome: new Array<number>(width * height).fill(0),
    spawns: [],
    entities: new Map(),
    regions: { rooms: [] },
    start: null,
  };
}

/** 洞穴图层：1 = 洞，0 = 岩。 */
export const CAVE_LAYER = "cave";

export function runPipeline(
  sandbox: Sandbox,
  steps: readonly Step[],
  deps: PipelineDeps,
): Sandbox {
  sandbox.start = deps.start ?? null;

  for (const [stepIndex, step] of steps.entries()) {
    switch (step.op) {
      case "overworld": {
        const result = generateTerrain({
          seed: sandbox.seed,
          width: sandbox.width,
          height: sandbox.height,
          fields: step.fields ?? {},
          biomes: deps.biomes,
          terrainIdByCode: deps.terrainIdByCode,
          levels: step.levels ?? {},
        });
        sandbox.terrain = [...result.terrain];
        break;
      }

      case "caves": {
        const caves = generateCaves({
          seed: sandbox.seed,
          width: sandbox.width,
          height: sandbox.height,
          fill: step.fill,
          iterations: step.iterations,
          spawnClear: step.spawnClear,
          regions: step.regions,
          chambers: step.chambers,
        });
        // 1 = 洞，0 = 石
        const caveLayer = caves.walls.map((wall) => (wall ? 0 : 1));

        if (step.as !== undefined) {
          // 写图层：留给后面的 blend 用（地表先不动）
          sandbox.layers.set(step.as, caveLayer);
          break;
        }

        // 默认直接写地形：纯洞穴世界不需要 blend
        const caveWall = deps.terrainIdByCode.get(step.wall ?? "wall");
        const caveFloor = deps.terrainIdByCode.get(step.floor ?? "floor");
        if (caveWall === undefined) throw new Error("洞穴缺少地形：wall");
        if (caveFloor === undefined) throw new Error("洞穴缺少地形：floor");
        sandbox.terrain = caves.walls.map((wall) => (wall ? caveWall : caveFloor));
        sandbox.layers.set(step.as ?? CAVE_LAYER, caveLayer);
        break;
      }

      case "maze": {
        const wallId = deps.terrainIdByCode.get(step.wall ?? "wall");
        const floorId = deps.terrainIdByCode.get(step.floor ?? "floor");
        if (wallId === undefined) throw new Error("迷宫缺少地形：wall");
        if (floorId === undefined) throw new Error("迷宫缺少地形：floor");

        sandbox.terrain = generateMaze({
          seed: sandbox.seed + stepIndex * 7919,
          width: sandbox.width,
          height: sandbox.height,
          wall: wallId,
          floor: floorId,
          braid: step.braid,
          inset: step.inset,
        });
        break;
      }

      case "populate": {
        const floorId = deps.terrainIdByCode.get("floor");
        if (floorId === undefined) throw new Error("populate 需要地形：floor");

        const result = populate(
          sandbox,
          { rules: step.rules },
          sandbox.seed + stepIndex * 7919,
          floorId,
        );
        for (const warning of result.warnings) console.warn("[populate] " + warning);
        break;
      }

      case "sprawl": {
        const sprawlDefs = deps.structures;
        if (sprawlDefs === undefined) throw new Error("sprawl 需要 structures（结构定义）");

        const sprawl = placeSprawl(
          sandbox.terrain,
          sandbox.width,
          sandbox.height,
          sprawlDefs,
          {
            rooms: step.rooms,
            count: step.count,
            tries: step.tries,
            margin: step.margin,
            corridor: step.corridor,
            widen: step.widen,
          },
          sandbox.seed + stepIndex * 7919,
          deps.terrainIdByCode,
        );
        sandbox.spawns.push(...sprawl.spawns);
        for (const room of sprawl.rooms) {
          sandbox.regions.rooms.push({ x: room.x, y: room.y, w: room.w, h: room.h, tags: room.tags, structure: room.structure });
        }
        for (const warning of sprawl.warnings) console.warn("[sprawl] " + warning);
        break;
      }

      case "layout": {
        const layoutDefs = deps.structures;
        if (layoutDefs === undefined) throw new Error("layout 需要 structures（结构定义）");

        const layout = placeLayout(
          sandbox.terrain,
          sandbox.width,
          sandbox.height,
          layoutDefs,
          {
            tiles: step.tiles,
            rooms: step.rooms,
            roomMin: step.roomMin,
            roomMax: step.roomMax,
            loops: step.loops,
          },
          sandbox.seed + stepIndex * 7919,
          deps.terrainIdByCode,
        );
        sandbox.spawns.push(...layout.spawns);
        for (const room of layout.rooms) {
          sandbox.regions.rooms.push({ x: room.x * 7, y: room.y * 7, w: room.w * 7, h: room.h * 7, tags: [], structure: "(layout)" });
        }
        for (const warning of layout.warnings) console.warn("[layout] " + warning);
        break;
      }

      case "tiles": {
        const tileDefs = deps.structures;
        if (tileDefs === undefined) throw new Error("tiles 需要 structures（结构定义）");

        const tiled = placeTiles(
          sandbox.terrain,
          sandbox.width,
          sandbox.height,
          tileDefs,
          step.tiles,
          sandbox.seed + stepIndex * 7919,
          deps.terrainIdByCode,
        );
        sandbox.spawns.push(...tiled.spawns);
        for (const warning of tiled.warnings) console.warn("[tiles] " + warning);
        break;
      }

      case "rooms": {
        const structures = deps.structures;
        if (structures === undefined) throw new Error("rooms 需要 structures（结构定义）");

        const codeOf = (terrainId: number): string | undefined => {
          for (const [code, id] of deps.terrainIdByCode) if (id === terrainId) return code;
          return undefined;
        };

        // 房间要铺在实心底上：先整张填墙
        const wallId = deps.terrainIdByCode.get("wall");
        if (wallId === undefined) throw new Error("rooms 需要地形：wall");
        sandbox.terrain.fill(wallId);

        const roomResult = placeRooms(
          sandbox.terrain,
          sandbox.width,
          sandbox.height,
          structures,
          {
            structures: step.structures,
            count: step.count,
            minSize: step.minSize,
            maxSize: step.maxSize,
            corridor: step.corridor,
            connect: step.connect,
            inset: step.inset,
            margin: step.margin,
            loops: step.loops,
          },
          sandbox.seed + stepIndex * 7919,
          deps.terrainIdByCode,
          codeOf,
        );

        sandbox.spawns.push(...roomResult.spawns);
        for (const room of roomResult.placements) {
          sandbox.regions.rooms.push({ x: room.x, y: room.y, w: room.w, h: room.h, tags: room.tags, structure: room.structure });
        }
        void roomResult.placements; // 以后 fill / 传送会用到
        break;
      }

      case "place": {
        const structures = deps.structures;
        if (structures === undefined) throw new Error("place 需要 structures（结构定义）");

        const codeOf = (terrainId: number): string | undefined => {
          for (const [code, id] of deps.terrainIdByCode) if (id === terrainId) return code;
          return undefined;
        };

        const placed = placeStructures(
          sandbox.terrain,
          sandbox.width,
          sandbox.height,
          structures,
          {
            structures: step.structures,
            count: step.count,
            spacing: step.spacing,
            on: step.on,
            inset: step.inset,
            tries: step.tries,
          },
          sandbox.seed + stepIndex * 7919,
          deps.terrainIdByCode,
          codeOf,
        );
        sandbox.spawns.push(...placed.spawns);
        break;
      }

      case "blend": {
        const cave = sandbox.layers.get(step.cave ?? CAVE_LAYER);
        if (cave === undefined) {
          throw new Error(`blend 找不到图层 "${step.cave ?? CAVE_LAYER}"`);
        }

        const floor = step.floor === undefined ? undefined : deps.terrainIdByCode.get(step.floor);
        if (step.floor !== undefined && floor === undefined) {
          throw new Error(`地形代号 "${step.floor}" 不在包里`);
        }

        const wallId = deps.terrainIdByCode.get("wall");
        if (step.wall === "solid" && wallId === undefined) {
          throw new Error("blend 需要地形代号 wall");
        }

        const inset = step.inset ?? 0;
        for (let y = inset; y < sandbox.height - inset; y += 1) {
          for (let x = inset; x < sandbox.width - inset; x += 1) {
            const index = y * sandbox.width + x;
            if (cave[index] !== 1) {
              // 洞穴的「岩」：保留地表，或整片变成墙
              if (step.wall === "solid" && wallId !== undefined) sandbox.terrain[index] = wallId;
              continue;
            }
            if (floor !== undefined) sandbox.terrain[index] = floor;
          }
        }
        break;
      }
    }
  }

  // 实体图摊平成宿主认识的 spawns（按坐标排序，保证确定性）
  const spawns: SpawnRequest[] = [...sandbox.spawns];
  const keys = [...sandbox.entities.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    for (const entity of sandbox.entities.get(key) ?? []) {
      spawns.push({
        template: entity.template,
        x: key % sandbox.width,
        y: Math.floor(key / sandbox.width),
        source: entity.source,
      });
    }
  }
  sandbox.spawns = spawns;

  return sandbox;
}
