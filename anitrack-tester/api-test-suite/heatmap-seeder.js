/**
 * 向本地 API 播种约 20 条 COMPLETED 记录，completedDates 集中在若干天，
 * 便于热力图强度 0–4 与颜色阶梯联调。
 *
 * 说明：本脚本**不会**清空数据库，仅通过 POST 追加数据；若 malId 冲突会自动换一批随机 id 重试。
 *
 * 前置：anitrack 已 `npm run dev`，Mongo 可用；BASE_URL 与 api-test-suite 一致。
 *
 *   node heatmap-seeder.js
 */
const { BASE_URL } = require("./test-config");

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

async function postAnime(body) {
  const f = await getFetch();
  const url = `${BASE_URL}/anime`;
  const res = await f(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json, text };
}

/** 每条 { titleSuffix, date } 会 POST 一条 COMPLETED，completedDates 仅含该日 */
const PLAN = [
  ...Array.from({ length: 1 }, (_, i) => ({ day: "2026-04-15", tag: `d15-${i}` })),
  ...Array.from({ length: 5 }, (_, i) => ({ day: "2026-04-16", tag: `d16-${i}` })),
  ...Array.from({ length: 2 }, (_, i) => ({ day: "2026-04-17", tag: `d17-${i}` })),
  ...Array.from({ length: 3 }, (_, i) => ({ day: "2026-04-18", tag: `d18-${i}` })),
  ...Array.from({ length: 4 }, (_, i) => ({ day: "2026-04-19", tag: `d19-${i}` })),
  ...Array.from({ length: 2 }, (_, i) => ({ day: "2026-04-14", tag: `d14-${i}` })),
  ...Array.from({ length: 1 }, (_, i) => ({ day: "2026-04-13", tag: `d13-${i}` })),
  ...Array.from({ length: 1 }, (_, i) => ({ day: "2026-04-12", tag: `d12-${i}` })),
  ...Array.from({ length: 1 }, (_, i) => ({ day: "2026-04-11", tag: `d11-${i}` })),
];

async function main() {
  console.log(`[heatmap-seeder] BASE_URL=${BASE_URL}`);
  let baseMal = Math.floor(Math.random() * 800_000_000) + 100_000_000;
  const createdIds = [];

  for (let i = 0; i < PLAN.length; i++) {
    const { day, tag } = PLAN[i];
    let malId = baseMal + i;
    const body = {
      malId,
      title: `Heatmap seed ${day} ${tag}`,
      status: "COMPLETED",
      completedAt: day,
      completedDates: [day],
    };

    let { res, json, text } = await postAnime(body);
    if (res.status === 409) {
      baseMal = Math.floor(Math.random() * 800_000_000) + 100_000_000;
      malId = baseMal + i;
      body.malId = malId;
      ({ res, json, text } = await postAnime(body));
    }

    if (res.status !== 201) {
      console.error(`[FAIL] POST malId=${malId} → HTTP ${res.status}\n${text.slice(0, 500)}`);
      process.exitCode = 1;
      return;
    }
    if (!json?.id) {
      console.error(`[FAIL] 响应缺少 id: ${text.slice(0, 300)}`);
      process.exitCode = 1;
      return;
    }
    createdIds.push(json.id);
    console.log(`[ok] ${i + 1}/${PLAN.length} id=${json.id} malId=${malId} date=${day}`);
  }

  console.log("\n────────────────────────────────────────");
  console.log("播种成功：已追加", createdIds.length, "条 COMPLETED（未清空数据库）。");
  console.log("────────────────────────────────────────");
  console.log(
    "浏览器联调：http://localhost:3000/api/stats/heatmap?from=2026-04-11&to=2026-04-20&tz=Europe/Berlin",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
