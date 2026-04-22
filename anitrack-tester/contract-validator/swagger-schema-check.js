const Ajv = require("ajv-draft-04").default;
const addFormats = require("ajv-formats").default;
const SwaggerParser = require("@apidevtools/swagger-parser").default;
const fs = require("fs");
const path = require("path");

const { getSwaggerUrl } = require("./lib/config");
const { request } = require("./lib/http");
const { red, green, yellow, bold } = require("./lib/colors");

const OPENAPI_META = path.join(
  __dirname,
  "node_modules",
  "@apidevtools",
  "openapi-schemas",
  "schemas",
  "v3.0",
  "schema.json",
);

/**
 * @param {object} [opts]
 * @param {object} [opts.spec] — 已解析的文档（跳过网络）
 * @param {string} [opts.swaggerUrl]
 */
async function run(opts = {}) {
  const swaggerUrl = opts.swaggerUrl ?? getSwaggerUrl();
  const errors = [];
  const warnings = [];

  let spec = opts.spec;
  if (!spec) {
    const { res, json, raw, isJson } = await request("GET", swaggerUrl);
    if (!res.ok) {
      errors.push(`无法下载 Swagger：GET ${swaggerUrl} → HTTP ${res.status}`);
      return { ok: false, errors, warnings, swaggerUrl };
    }
    if (!isJson || !json) {
      errors.push(`Swagger 响应不是 application/json（${swaggerUrl}）`);
      return { ok: false, errors, warnings, swaggerUrl };
    }
    spec = json;
  }

  if (spec.openapi !== "3.0.3") {
    errors.push(`openapi 字段应为 "3.0.3"，实际为 ${JSON.stringify(spec.openapi)}`);
  }

  // --- AJV：OpenAPI 3.0 元模式（Draft-04）---
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(OPENAPI_META, "utf8"));
  } catch (e) {
    errors.push(`读取 OpenAPI 元模式失败: ${OPENAPI_META} — ${e?.message || e}`);
    return { ok: false, errors, warnings, swaggerUrl };
  }

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  addFormats(ajv);

  let validate;
  try {
    validate = ajv.compile(meta);
  } catch (e) {
    errors.push(`AJV compile 元模式失败: ${e?.message || e}`);
    return { ok: false, errors, warnings, swaggerUrl };
  }

  if (!validate(spec)) {
    const msgs = (validate.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`.trim());
    errors.push("OpenAPI 文档未通过 JSON Schema（OpenAPI 3.0 元模式）校验：");
    errors.push(...msgs.slice(0, 40));
    if (msgs.length > 40) errors.push(`… 另有 ${msgs.length - 40} 条`);
  }

  // --- @apidevtools/swagger-parser：语义 / 引用完整性交叉校验 ---
  try {
    await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
  } catch (e) {
    errors.push(`SwaggerParser.validate 失败: ${e?.message || e}`);
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings, swaggerUrl };
}

async function main() {
  console.log(bold("\n━━ OpenAPI / Swagger 结构校验（AJV + SwaggerParser）━━"));
  console.log(`URL: ${getSwaggerUrl()}\n`);

  const result = await run();
  for (const w of result.warnings) console.log(yellow(`[WARN] ${w}`));
  for (const e of result.errors) console.log(red(`[FAIL] ${e}`));

  if (result.ok) {
    console.log(green("[PASS] swagger.json 符合 OpenAPI 3.0.x 元模式且通过 SwaggerParser 校验"));
    process.exitCode = 0;
  } else {
    console.log(red("[FAIL] Swagger 结构校验未通过"));
    process.exitCode = 1;
  }
}

module.exports = { run };

if (require.main === module) {
  main().catch((e) => {
    console.error(red(e?.stack || String(e)));
    process.exitCode = 1;
  });
}
