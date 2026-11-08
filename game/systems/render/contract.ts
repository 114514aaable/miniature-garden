// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 渲染契约：渲染器在启动时声明「我需要什么」。
 *
 * 为什么要提前声明：
 *   缺数据要在启动时报错，而不是画到一半血条突然空掉。
 *   而且快照只拷「要画的字段」，不是整份世界。
 *
 * 这个文件属于 system 包（宿主侧代码），不进数据包，也不进核心。
 */

const ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,3}$/;
const VERSION = /^\d+\.\d+\.\d+$/;

/** 快照里实体的哪些字段。pos 是必选的——没有位置就画不出来。 */
export type EntityField = "pos" | "template" | "sprite";

export interface ComponentNeed {
  readonly name: string;
  /** 缺了是报错（true）还是跳过（false）。默认必需。 */
  readonly required: boolean;
}

export interface RenderNeeds {
  readonly spaces: "all" | "current";
  readonly camera: boolean;
  readonly entityFields: readonly EntityField[];
  readonly components: readonly ComponentNeed[];
  /** 面板需要的数据：inventory / skills / messages / body ... */
  readonly ui: readonly string[];
}

export interface RenderContract {
  readonly id: string;
  readonly version: string;
  readonly needs: RenderNeeds;
}

/** 契约校验的硬上限：防止有人写「我要全部」。 */
export const MAX_COMPONENTS = 16;
export const MAX_UI = 8;

export function validateContract(contract: RenderContract): void {
  if (!ID.test(contract.id)) {
    throw new Error(`渲染器 id 非法："${contract.id}"`);
  }
  if (!VERSION.test(contract.version)) {
    throw new Error(`渲染器版本必须是 x.y.z，收到 "${contract.version}"`);
  }

  const needs = contract.needs;
  if (needs.spaces !== "all" && needs.spaces !== "current") {
    throw new Error(`needs.spaces 只能是 "all" 或 "current"`);
  }
  if (!needs.entityFields.includes("pos")) {
    throw new Error(`渲染器必须声明 entityFields 里的 "pos"，否则没法画`);
  }
  if (needs.entityFields.length > 4) {
    throw new Error(`entityFields 最多 4 个，收到 ${needs.entityFields.length}`);
  }
  if (needs.components.length > MAX_COMPONENTS) {
    throw new Error(`components 最多 ${MAX_COMPONENTS} 个，收到 ${needs.components.length}`);
  }
  if (needs.ui.length > MAX_UI) {
    throw new Error(`ui 最多 ${MAX_UI} 项，收到 ${needs.ui.length}`);
  }

  const seen = new Set<string>();
  for (const component of needs.components) {
    if (!/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/.test(component.name)) {
      throw new Error(`组件名非法："${component.name}"`);
    }
    if (seen.has(component.name)) {
      throw new Error(`组件重复声明："${component.name}"`);
    }
    seen.add(component.name);
  }
}
