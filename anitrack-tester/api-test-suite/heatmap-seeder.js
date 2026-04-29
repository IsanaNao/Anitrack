/**
 * 向本地 API 播种若干条 COMPLETED 记录（跨多个月），用于“人生纸格（月）”联调：
 * - completedCount：按 completedAt 的月份计数
 * - episodeCount：按 completedAt 的月份累加 episodesWatched
 *
 * 注意：addedCount 由条目的 createdAt 决定（服务器时间戳），HTTP 播种无法回填历史 createdAt；
 * 因此本脚本主要用于联调 completed/episodes 与月格子的色阶/tooltip。
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

/** 每条会 POST 一条 COMPLETED，按 completedAt 跨月分布 */
const PLAN = [
  ...Array.from({ length: 2 }, (_, i) => ({ day: "2025-12-18", tag: `m12-${i}`, eps: 12 + i })),
  ...Array.from({ length: 3 }, (_, i) => ({ day: "2026-01-12", tag: `m01-${i}`, eps: 24 + i })),
  ...Array.from({ length: 1 }, (_, i) => ({ day: "2026-02-03", tag: `m02-${i}`, eps: 10 + i })),
  ...Array.from({ length: 4 }, (_, i) => ({ day: "2026-03-20", tag: `m03-${i}`, eps: 48 + i })),
  ...Array.from({ length: 5 }, (_, i) => ({ day: "2026-04-16", tag: `m04-${i}`, eps: 12 + i })),
];

async function main() {
  console.log(`[heatmap-seeder] BASE_URL=${BASE_URL}`);
  let baseMal = Math.floor(Math.random() * 800_000_000) + 100_000_000;
  const createdIds = [];

  for (let i = 0; i < PLAN.length; i++) {
    const { day, tag, eps } = PLAN[i];
    let malId = baseMal + i;
    const body = {
      malId,
      status: "COMPLETED",
      completedAt: day,
      completedDates: [day],
      episodesWatched: eps ?? 0,
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
    "浏览器联调：http://localhost:3000/profile （或直接请求后端：/api/stats/heatmap?start=2025-12&end=2026-04）",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
