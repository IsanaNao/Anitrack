const { getOrigin, getSwaggerUrl } = require("./lib/config");
const { request } = require("./lib/http");
const { bold, red, green, yellow } = require("./lib/colors");

const { run: runSchema } = require("./swagger-schema-check");
const { run: runSmoke } = require("./contract-smoke-test");

function hr() {
  console.log("\n" + "─".repeat(56) + "\n");
}

async function main() {
  const started = new Date().toISOString();
  console.log(bold("╔══════════════════════════════════════════════════════╗"));
  console.log(bold("║       Anitrack — 契约校验报告（Contract Test）       ║"));
  console.log(bold("╚══════════════════════════════════════════════════════╝"));
  console.log(`时间: ${started}`);
  console.log(`ORIGIN: ${getOrigin()}`);
  console.log(`Swagger: ${getSwaggerUrl()}\n`);

  const sw = await request("GET", getSwaggerUrl());
  if (!sw.res.ok || !sw.isJson || !sw.json) {
    console.log(
      red(
        `[FAIL] 无法加载 swagger.json（请先启动 anitrack：npm run dev，并检查 CONTRACT_ORIGIN / CONTRACT_SWAGGER_URL）\nHTTP ${sw.res.status} json=${Boolean(sw.json)}`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const spec = sw.json;

  console.log(bold("\n[1/2] OpenAPI 文档结构"));
  const schemaResult = await runSchema({ spec, swaggerUrl: getSwaggerUrl() });
  console.log(schemaResult.ok ? green("  → 结构校验通过") : red("  → 结构校验失败"));
  hr();

  console.log(bold("\n[2/2] 运行时契约（HTTP）"));
  const smokeResult = await runSmoke({ spec, swaggerUrl: getSwaggerUrl() });
  console.log(smokeResult.ok ? green("  → 冒烟通过") : red("  → 冒烟失败"));
  hr();

  if (!schemaResult.ok && schemaResult.errors?.length) {
    console.log(red("\n--- swagger-schema-check 失败详情 ---"));
    for (const e of schemaResult.errors) console.log(red(`  • ${e}`));
  }
  if (!smokeResult.ok && smokeResult.errors?.length) {
    console.log(red("\n--- contract-smoke-test 失败详情 ---"));
    for (const e of smokeResult.errors) console.log(red(`  • ${e}`));
  }

  console.log(bold("\n【汇总】"));
  console.log(`  Swagger 结构（AJV + SwaggerParser）: ${schemaResult.ok ? green("PASS") : red("FAIL")}`);
  console.log(`  契约冒烟（路径 / 字段 / 409 / pageSize）: ${smokeResult.ok ? green("PASS") : red("FAIL")}`);

  if (schemaResult.warnings?.length) {
    for (const w of schemaResult.warnings) console.log(yellow(`  [WARN][schema] ${w}`));
  }
  if (smokeResult.warnings?.length) {
    for (const w of smokeResult.warnings) console.log(yellow(`  [WARN][smoke] ${w}`));
  }

  const allOk = schemaResult.ok && smokeResult.ok;
  if (allOk) {
    console.log(green(`\n✓ 契约校验全部通过（${new Date().toISOString()}）\n`));
    process.exitCode = 0;
  } else {
    console.log(red(`\n✗ 契约校验存在失败项，请对照 swagger.json 与 API 路由同步修改\n`));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(red(e?.stack || String(e)));
    process.exitCode = 1;
  });
}

module.exports = { main };
