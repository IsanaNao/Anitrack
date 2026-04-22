const { BASE_URL } = require("./test-config");

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  // Node <18 fallback: allow node-fetch if installed
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
  if (!cond) {
    const err = new Error(message);
    err.name = "AssertionError";
    throw err;
  }
}

function pickId(obj) {
  if (!obj || typeof obj !== "object") return null;
  return obj.id || obj._id || null;
}

async function runSmokeTest() {
  console.log(`[config] BASE_URL=${BASE_URL}`);

  let id = null;
  try {
    // Step 1: POST create PLANNED
    console.log("\n[Step 1] POST /anime (create PLANNED)");
    const malId = Date.now();
    const createBody = {
      malId,
      title: `Smoke Test Anime ${malId}`,
      status: "PLANNED",
    };
    const created = await requestJson("POST", "/anime", createBody);
    assert(created.res.status === 201, `Expected 201, got ${created.res.status}. Body: ${created.raw}`);
    id = pickId(created.json);
    assert(id, `Missing id in create response. Body: ${created.raw}`);
    console.log(`[ok] created id=${id}`);

    // Step 2: PATCH positive: -> WATCHING
    console.log("\n[Step 2] PATCH /anime/:id (positive: PLANNED -> WATCHING)");
    const toWatching = await requestJson("PATCH", `/anime/${id}`, { status: "WATCHING" });
    assert(
      toWatching.res.status === 200,
      `Expected 200 for WATCHING, got ${toWatching.res.status}. Body: ${toWatching.raw}`,
    );
    assert(toWatching.json && toWatching.json.status === "WATCHING", `Expected status=WATCHING. Body: ${toWatching.raw}`);
    console.log("[ok] moved to WATCHING");

    // Step 3: PATCH negative (expect 409 + INVALID_STATUS_TRANSITION)
    console.log("\n[Step 3] PATCH /anime/:id (negative: WATCHING -> PLANNED)");
    const step3 = await requestJson("PATCH", `/anime/${id}`, { status: "PLANNED" });
    assert(
      step3.res.status === 409,
      `Expected 409 Conflict, got ${step3.res.status}. Body: ${step3.raw}`,
    );
    assert(step3.json && step3.json.error, `Expected error object, got: ${step3.raw}`);
    assert(
      step3.json.error.code === "INVALID_STATUS_TRANSITION",
      `Expected error.code=INVALID_STATUS_TRANSITION, got: ${JSON.stringify(step3.json)}`,
    );
    console.log(`[ok] blocked with error.code=${step3.json.error.code}`);

    // Step 4: PATCH positive: -> COMPLETED
    console.log("\n[Step 4] PATCH /anime/:id (positive: WATCHING -> COMPLETED)");
    const toCompleted = await requestJson("PATCH", `/anime/${id}`, { status: "COMPLETED" });
    assert(
      toCompleted.res.status === 200,
      `Expected 200 for COMPLETED, got ${toCompleted.res.status}. Body: ${toCompleted.raw}`,
    );
    assert(toCompleted.json && toCompleted.json.status === "COMPLETED", `Expected status=COMPLETED. Body: ${toCompleted.raw}`);
    console.log("[ok] moved to COMPLETED");

    // Step 5: GET verify completedDates contains today and length 1
    console.log("\n[Step 5] GET /anime/:id (verify completedDates auto-filled)");
    const fetched = await requestJson("GET", `/anime/${id}`);
    assert(fetched.res.status === 200, `Expected 200, got ${fetched.res.status}. Body: ${fetched.raw}`);
    const today = todayYYYYMMDD();
    const completedDates = fetched.json?.completedDates;
    assert(Array.isArray(completedDates), `Expected completedDates array. Body: ${fetched.raw}`);
    assert(completedDates.includes(today), `Expected completedDates to include ${today}. Got: ${JSON.stringify(completedDates)}`);
    assert(completedDates.length === 1, `Expected completedDates length=1. Got: ${JSON.stringify(completedDates)}`);
    console.log(`[ok] completedDates contains ${today} and length=1`);

    // Step 6: DELETE expect 204
    console.log("\n[Step 6] DELETE /anime/:id (cleanup)");
    const del = await requestJson("DELETE", `/anime/${id}`);
    assert(del.res.status === 204, `Expected 204 No Content, got ${del.res.status}. Body: ${del.raw}`);
    console.log("[ok] deleted");

    return { ok: true };
  } catch (err) {
    // Best-effort cleanup if we already created an entry
    if (id) {
      try {
        await requestJson("DELETE", `/anime/${id}`);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

module.exports = { runSmokeTest };

if (require.main === module) {
  runSmokeTest()
    .then(() => {
      console.log("\n[smoke-test] PASS");
      process.exitCode = 0;
    })
    .catch((e) => {
      console.error("\n[smoke-test] FAIL");
      console.error(e?.stack || e);
      process.exitCode = 1;
    });
}

