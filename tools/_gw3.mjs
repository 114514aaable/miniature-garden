const base = "http://127.0.0.1:8788";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, b) => { await wait(150); return fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json()); };

const s = await post("/api/start", { id: "official.normal", seed: 3 });
const me = s.snapshot.entities.find((e) => e.handle === s.playerHandle);
const npc = s.snapshot.entities.find((e) => e.template === "npc_salt");
console.log("me", me.x, me.y, "npc", npc.x, npc.y);

// 走到 NPC 左边相邻
while (true) {
  const st = await post("/api/state");
  const p = st.snapshot.entities.find((e) => e.handle === st.playerHandle);
  if (Math.abs(p.x - npc.x) + Math.abs(p.y - npc.y) === 1) break;
  const dir = p.y !== npc.y ? (p.y < npc.y ? "s" : "w") : (p.x < npc.x ? "d" : "a");
  const r = await post("/api/act", { dir });
  if (!r.hud) { console.log("move blocked:", r.message); break; }
}

const atk = await post("/api/skill", { tag: "base.attack", x: npc.x, y: npc.y });
console.log("attack:", atk.message);
const st2 = await post("/api/state");
const npc2 = st2.snapshot.entities.find((e) => e.handle === npc.handle);
console.log("npc hp:", npc2 ? npc2.components["core.health"].hp : "(gone)");

// 对话推进（场景效果路径）
const talk = await post("/api/skill", { tag: "base.talk", x: npc.x, y: npc.y });
console.log("talk:", talk.message);
const pick = await post("/api/scene", { command: "1" });
console.log("scene cmd:", pick.message);
