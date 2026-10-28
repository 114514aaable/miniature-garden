// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 时间线：一个单调的时钟 + 它自己的记录。
 *
 * 为什么把「时钟」和「事件日志」合在一起？
 * 因为分开时，`append(input, lTick, seq)` 允许调用方自己填时间——
 * 于是「时钟说到第 5 步、事件说自己来自第 2 步」这种状态可以构造出来。
 * 合并后，事件的 lTick 只能来自 now()，歧义在类型层面就消失了。
 *
 * 四条铁律：
 *   1. 时间只有整数，只能前进。
 *   2. 事件一旦写入不可修改；改了一定能被 verify 发现。
 *   3. 事件的时间戳由时间线自己盖，调用方给不了。
 *   4. 不读真实时间（Date.now / setTimeout 在模拟层是禁词）。
 *
 * 不在这里的东西（故意的）：
 *   - 调度器：什么时候该调用 append，属于规则层。
 *   - 世界时间（第几天、什么季节）：属于世界层，是 tick 的投影，能算就不存。
 */

/** 逻辑刻度：机器走过第几步。 */
export type Tick = number;

/** 句柄：实体 / 空间的整数编号，由解析器分配。 */
export type Handle = number;

/** JSON 能表达的值。哈希要求可规范化，所以只允许这些。 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface Event {
  /** 全局自增编号，从 1 开始。 */
  readonly id: number;
  /** 落地在哪个逻辑步。 */
  readonly lTick: Tick;
  /** 这个逻辑步里的第几个动作，从 1 开始。 */
  readonly seq: number;
  readonly kind: string;
  readonly actor: Handle | null;
  readonly targets: readonly Handle[];
  readonly data: Readonly<Record<string, JsonValue>>;
  /** 上一条的哈希；第一条是 "0"。 */
  readonly prevHash: string;
  /** 本条内容的哈希。 */
  readonly hash: string;
}

export interface EventInput {
  readonly kind: string;
  readonly actor?: Handle | null;
  readonly targets?: readonly Handle[];
  readonly data?: Readonly<Record<string, JsonValue>>;
}

/**
 * 规范化序列化：对象键按字典序排，递归处理。
 * 没有这一步，{a:1,b:2} 和 {b:2,a:1} 会算出两个哈希，链就断了。
 */
export function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => JSON.stringify(key) + ":" + canonicalize(value[key]));
  return "{" + parts.join(",") + "}";
}

/** FNV-1a，32 位，输出 8 位十六进制。防手滑和不同步，不防攻击。 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** 校验一条哈希链，返回第一条对不上的下标；全对返回 -1。 */
export function verifyChain(events: readonly Event[]): number {
  let prev = "0";
  for (let i = 0; i < events.length; i++) {
    const { prevHash, hash, ...body } = events[i];
    if (prevHash !== prev) {
      return i;
    }
    if (hashText(prev + canonicalize(body as unknown as JsonValue)) !== hash) {
      return i;
    }
    prev = hash;
  }
  return -1;
}

export class Timeline {
  private tick: Tick;
  private seq = 0;
  private readonly events: Event[] = [];
  private head = "0";
  private nextId = 1;

  constructor(start: Tick = 0) {
    if (!Number.isInteger(start) || start < 0) {
      throw new Error(`时钟起点必须是非负整数，收到 ${start}`);
    }
    this.tick = start;
  }

  /** 现在第几步。 */
  now(): Tick {
    return this.tick;
  }

  /** 前进一步（或 n 步，用于长动作），并重置 tick 内的序号。 */
  advance(steps: number = 1): Tick {
    if (!Number.isInteger(steps) || steps < 1) {
      throw new Error(`时间只能前进正整数步，收到 ${steps}`);
    }
    this.tick += steps;
    this.seq = 0;
    return this.tick;
  }

  get headHash(): string {
    return this.head;
  }

  get size(): number {
    return this.events.length;
  }

  /** 深拷贝——外面的改动碰不到日志内部。 */
  all(): readonly Event[] {
    return structuredClone(this.events);
  }

  /**
   * 写入一条事件。时间由时间线自己盖：lTick = now()，seq = 本 tick 内的第几条。
   * 调用方给不了时间，也就伪造不了顺序。
   */
  append(input: EventInput): Event {
    this.seq += 1;

    const body = {
      id: this.nextId,
      lTick: this.tick,
      seq: this.seq,
      kind: input.kind,
      actor: input.actor ?? null,
      targets: [...(input.targets ?? [])],
      data: { ...(input.data ?? {}) },
    };

    const hash = hashText(this.head + canonicalize(body as unknown as JsonValue));
    const event: Event = { ...body, prevHash: this.head, hash };

    this.events.push(event);
    this.head = hash;
    this.nextId += 1;
    return event;
  }

  /** 校验自己这条链。 */
  verify(): number {
    return verifyChain(this.events);
  }
}
