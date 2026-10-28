// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 事件：世界发生过的每一件事的记录。
 *
 * 一条事件固定带两个时间：
 *   - lTick + seq：**落地时刻**——它在第几个逻辑步、第几个被应用。永远等于当下，不能伪造。
 *   - （世界时间 wTime 故意不在这里：那是规则层的投影，事件只记录「机器走到哪了」。）
 *
 * 事件是追加式的：一旦写入，不可修改。日志用哈希串成链，
 * 改中间任何一条，后面全部对不上——这是「可验证」的物理基础。
 *
 * 哈希算法现在是 FNV-1a 32 位：够用、纯 TS、浏览器和 Node 都能跑。
 * 它不适合防攻击，只适合防「手滑」和「不同步」。将来要更强，换一个 hash 函数即可，
 * 因为事件结构不依赖具体算法。
 */

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
  readonly lTick: number;
  /** 这个逻辑步里的第几个动作，从 1 开始。 */
  readonly seq: number;
  /** 事件类型，比如 "move" / "attack" / "rewind"。 */
  readonly kind: string;
  /** 谁做的；环境事件可以是 null。 */
  readonly actor: Handle | null;
  /** 作用在谁身上。 */
  readonly targets: readonly Handle[];
  /** 负载。只放真正需要记录的东西：能算出来的不要放（见 README 的「决定 vs 计算」）。 */
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
 *
 * 没有这一步，{a:1,b:2} 和 {b:2,a:1} 会算出两个哈希——
 * 同一个事件，两次序列化，两个身份，链就断了。
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

/** FNV-1a，32 位，输出 8 位十六进制。 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** 事件日志：只追加，不改写。 */
export class EventLog {
  private readonly events: Event[] = [];
  private head = "0";
  private nextId = 1;

  /** 链条头部的哈希。空日志是 "0"。 */
  get headHash(): string {
    return this.head;
  }

  get size(): number {
    return this.events.length;
  }

  /**
   * 只读快照。深拷贝——外面改了也不会影响日志内部。
   * 注意：这不是为了性能，是为了让「只读」变成真的只读，而不是一句注释。
   */
  all(): readonly Event[] {
    return structuredClone(this.events);
  }

  /** 写入一条事件。只该由 store 在提交成功后调用。 */
  append(input: EventInput, lTick: number, seq: number): Event {
    if (!Number.isInteger(lTick) || lTick < 0) {
      throw new Error(`lTick 必须是非负整数，收到 ${lTick}`);
    }
    if (!Number.isInteger(seq) || seq < 1) {
      throw new Error(`seq 必须是正整数，收到 ${seq}`);
    }

    const body = {
      id: this.nextId,
      lTick,
      seq,
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

  /** 从第一条开始重算哈希链，返回第一条对不上的下标；全对返回 -1。 */
  verify(): number {
    return verifyChain(this.events);
  }
}

/**
 * 校验一条哈希链。单独抽成纯函数，是为了能对「外部传来的事件数组」也做校验
 * ——比如读档时、或者别人给你的回放文件。
 */
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
