// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 部位：目录 / 蓝图展开（repeat、extends、delete）/ 校验。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  capabilityOf,
  parseBodyPart,
  parseBodyPlan,
  resolveBodyPlans,
  type BodyPartDef,
  type BodyPlanDef,
  type ResolvedBodyPlan,
} from "./body.ts";

const PARTS = [
  parseBodyPart({ id: "torso", hp: 20, coverage: 10, vital: true }, "torso"),
  parseBodyPart({ id: "head", hp: 10, coverage: 4, vital: true }, "head"),
  parseBodyPart({ id: "eye", hp: 2, coverage: 1, grants: { sight: 1 } }, "eye"),
  parseBodyPart({ id: "limb", hp: 8, coverage: 5, grants: { manipulator: 1 } }, "limb"),
];

function resolve(plans: BodyPlanDef[], parts: BodyPartDef[] = PARTS): Map<string, ResolvedBodyPlan> {
  return resolveBodyPlans(
    new Map(plans.map((plan) => [plan.id, plan])),
    new Map(parts.map((part) => [part.id, part])),
  );
}

test("蓝图：repeat 展开成 id_1 / id_2", () => {
  const plan = parseBodyPlan(
    {
      id: "humanoid",
      parts: [
        { id: "torso", part: "torso" },
        { id: "eye", part: "eye", parent: "torso", repeat: 2 },
      ],
    },
    "humanoid",
  );

  const resolved = resolve([plan]).get("humanoid");
  assert.ok(resolved);
  assert.deepEqual(
    resolved.parts.map((part) => part.id).sort(),
    ["eye_1", "eye_2", "torso"],
  );
});

test("蓝图：extends + delete 删掉继承部件", () => {
  const base = parseBodyPlan(
    {
      id: "humanoid",
      parts: [
        { id: "torso", part: "torso" },
        { id: "arm_l", part: "limb", parent: "torso" },
        { id: "arm_r", part: "limb", parent: "torso" },
      ],
    },
    "humanoid",
  );

  const beast = parseBodyPlan(
    {
      id: "beast",
      extends: "humanoid",
      parts: [
        { id: "arm_l", delete: true },
        { id: "arm_r", delete: true },
        { id: "tentacle", part: "limb", parent: "torso", repeat: 3 },
      ],
    },
    "beast",
  );

  const resolved = resolve([base, beast]).get("beast");
  assert.ok(resolved);
  const ids = resolved.parts.map((part) => part.id);
  assert.ok(!ids.includes("arm_l"));
  assert.ok(ids.includes("tentacle_1"));
  assert.ok(ids.includes("tentacle_3"));
});

test("校验：parent 不存在要报错", () => {
  const plan = parseBodyPlan(
    { id: "broken", parts: [{ id: "head", part: "head", parent: "ghost" }] },
    "broken",
  );
  assert.throws(() => resolve([plan]), /parent .* 不存在/);
});

test("校验：没有 vital 要报错；vital: all 可以", () => {
  const noVital = parseBodyPlan(
    { id: "skinny", parts: [{ id: "limb", part: "limb" }] },
    "skinny",
  );
  assert.throws(() => resolve([noVital]), /没有任何 vital/);

  const slime = parseBodyPlan(
    { id: "slime", vital: "all", parts: [{ id: "core", part: "limb" }] },
    "slime",
  );
  const resolved = resolve([slime]).get("slime");
  assert.ok(resolved);
  assert.equal(resolved.parts[0].vital, true);
});

test("校验：蓝图继承成环要报错", () => {
  const a = parseBodyPlan({ id: "a", extends: "b", parts: [] }, "a");
  const b = parseBodyPlan({ id: "b", extends: "a", parts: [] }, "b");
  assert.throws(() => resolve([a, b]), /成环/);
});

test("能力合计：数 grants", () => {
  const plan = parseBodyPlan(
    {
      id: "seer",
      vital: "all",
      parts: [
        { id: "torso", part: "torso" },
        { id: "eye", part: "eye", parent: "torso", repeat: 2 },
      ],
    },
    "seer",
  );
  const resolved = resolve([plan]).get("seer");
  assert.ok(resolved);
  assert.equal(capabilityOf(resolved, "sight"), 2);
});
