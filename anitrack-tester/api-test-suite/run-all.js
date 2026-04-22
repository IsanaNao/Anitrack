const { runSmokeTest } = require("./smoke-test");
const { runBatchValidator } = require("./batch-validator");
const { BASE_URL } = require("./test-config");

const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

async function preflight() {
  const f = await getFetch();
  const url = `${BASE_URL}/anime?page=1&pageSize=1`;
  let res;
  try {
    res = await f(url, { method: "GET", headers: { Accept: "application/json" } });
  } catch (e) {
    throw new Error(
      [
        `Network error: cannot reach backend at BASE_URL=${BASE_URL}`,
        `Tried: GET ${url}`,
        `Start the Next.js server (and DB) in the sibling 'anitrack' folder, then re-run.`,
        `Cause: ${e?.message || String(e)}`,
      ].join("\n"),
      { cause: e },
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      [
        `Backend responded but API is not healthy.`,
        `Request: GET ${url}`,
        `HTTP ${res.status} ${res.statusText}`,
        `Body: ${text}`,
      ].join("\n"),
    );
  }
}

async function runOne(name, fn) {
  process.stdout.write(colors.gray(`\n== ${name} ==\n`));
  const started = Date.now();
  try {
    await fn();
    const ms = Date.now() - started;
    console.log(colors.green(`[PASS] ${name} (${ms}ms)`));
  } catch (e) {
    const ms = Date.now() - started;
    console.error(colors.red(`[FAIL] ${name} (${ms}ms)`));
    console.error(e?.stack || e);
    throw e;
  }
}

async function main() {
  console.log(colors.gray(`[preflight] BASE_URL=${BASE_URL}`));
  await preflight();
  await runOne("smoke-test", runSmokeTest);
  await runOne("batch-validator", runBatchValidator);
  console.log(colors.green("\nALL TESTS PASSED"));
}

main().catch((e) => {
  console.error(colors.red("\n[run-all] FAIL"));
  console.error(e?.stack || e);
  process.exitCode = 1;
});

