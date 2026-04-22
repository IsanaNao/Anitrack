const { BASE_URL } = require("./test-config");

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

function toJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestJson(method, path, body) {
  const f = await getFetch();
  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  let res;
  try {
    res = await f(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    const msg = [
      `Network error calling ${method} ${url}`,
      `Make sure the backend is running and BASE_URL is correct.`,
      `Tip (PowerShell): $env:BASE_URL='http://localhost:3000/api'`,
    ].join("\n");
    const err = new Error(msg);
    err.cause = e;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const raw = await res.text();
  const json = isJson ? toJsonSafe(raw) : null;
  return { res, json, raw, url };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function pickId(obj) {
  if (!obj || typeof obj !== "object") return null;
  return obj.id || obj._id || null;
}

function assertAnimeListShape(payload) {
  assert(payload && typeof payload === "object", `Expected JSON object, got: ${JSON.stringify(payload)}`);
  assert(Array.isArray(payload.items), "Expected payload.items to be an array");
  assert(Number.isFinite(payload.page), "Expected payload.page to be a number");
  assert(Number.isFinite(payload.pageSize), "Expected payload.pageSize to be a number");
  assert(Number.isFinite(payload.total), "Expected payload.total to be a number");
}

async function runBatchValidator() {
  console.log(`[config] BASE_URL=${BASE_URL}`);
  console.log("\n[batch] Creating 5 entries...");

  const createdIds = [];
  const base = Date.now();

  try {
    for (let i = 0; i < 5; i++) {
      const malId = base + i;
      const body = { malId, title: `Batch Test Anime ${malId}`, status: "PLANNED" };
      const r = await requestJson("POST", "/anime", body);
      assert(r.res.status === 201, `Create failed (i=${i}): expected 201, got ${r.res.status}. Body: ${r.raw}`);
      const id = pickId(r.json);
      assert(id, `Create response missing id (i=${i}). Body: ${r.raw}`);
      createdIds.push(id);
    }

    console.log("[batch] Validating pagination GET /anime?pageSize=2 ...");
    const page1 = await requestJson("GET", "/anime?page=1&pageSize=2");
    assert(page1.res.status === 200, `Expected 200, got ${page1.res.status}. Body: ${page1.raw}`);
    assertAnimeListShape(page1.json);
    assert(page1.json.pageSize === 2, `Expected pageSize=2, got ${page1.json.pageSize}`);
    assert(page1.json.items.length <= 2, `Expected <=2 items, got ${page1.json.items.length}`);

    const page2 = await requestJson("GET", "/anime?page=2&pageSize=2");
    assert(page2.res.status === 200, `Expected 200, got ${page2.res.status}. Body: ${page2.raw}`);
    assertAnimeListShape(page2.json);
    assert(page2.json.pageSize === 2, `Expected pageSize=2, got ${page2.json.pageSize}`);
    assert(page2.json.items.length <= 2, `Expected <=2 items, got ${page2.json.items.length}`);

    console.log("[batch] PASS");
    return { ok: true };
  } catch (err) {
    throw err;
  } finally {
    if (createdIds.length) {
      console.log("\n[batch] Cleanup: deleting created entries...");
      for (const id of createdIds) {
        try {
          await requestJson("DELETE", `/anime/${id}`);
        } catch {
          // ignore cleanup failures
        }
      }
    }
  }
}

module.exports = { runBatchValidator };

if (require.main === module) {
  runBatchValidator()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((e) => {
      console.error("\n[batch-validator] FAIL");
      console.error(e?.stack || e);
      process.exitCode = 1;
    });
}

