const { getOrigin, getSwaggerUrl, getPendingPaths } = require("./lib/config");
const { request } = require("./lib/http");
const { red, green, yellow, bold } = require("./lib/colors");
const { resolveRef } = require("./lib/swagger-resolve");
const { validateObjectKeysAgainstSchema } = require("./lib/shape-validate");

const SAMPLE_OBJECT_ID = "507f1f77bcf86cd799439011";

/**
 * @param {object} spec
 * @param {string} pathTemplate
 */
function expandPath(pathTemplate) {
  return pathTemplate.replace(/\{id\}/g, SAMPLE_OBJECT_ID);
}

/**
 * @param {object} spec
 * @param {string} path
 * @param {string} method
 * @param {string} paramName
 */
function queryParamMaximum(spec, path, method, paramName) {
  const op = spec.paths?.[path]?.[method];
  if (!op?.parameters) return null;
  const p = op.parameters.find((x) => x.name === paramName && x.in === "query");
  if (!p?.schema) return null;
  let sch = p.schema;
  if (sch.$ref) {
    try {
      sch = resolveRef(spec, sch.$ref);
    } catch {
      return null;
    }
  }
  return typeof sch.maximum === "number" ? sch.maximum : null;
}

/**
 * @param {object} json
 * @param {object} spec
 * @param {string} label
 */
function validateApiErrorBody(json, spec, label) {
  const errors = [];
  const top = validateObjectKeysAgainstSchema(json, "ApiErrorBody", spec, label);
  errors.push(...top.errors);

  const err = json?.error;
  if (!err || typeof err !== "object") {
    errors.push(`${label}: error 对象缺失`);
    return errors;
  }

  for (const k of ["code", "message", "details"]) {
    if (!Object.prototype.hasOwnProperty.call(err, k)) {
      errors.push(`${label}: error.${k} 缺失`);
    }
  }

  const codeEnum =
    spec.components?.schemas?.ApiErrorBody?.properties?.error?.properties?.code?.enum;
  if (Array.isArray(codeEnum) && typeof err.code === "string" && !codeEnum.includes(err.code)) {
    errors.push(`${label}: error.code=${JSON.stringify(err.code)} 不在 Swagger 枚举 ${JSON.stringify(codeEnum)}`);
  }

  if (!Array.isArray(err.details)) {
    errors.push(`${label}: error.details 应为数组`);
  } else {
    for (let i = 0; i < err.details.length; i++) {
      const d = err.details[i];
      if (!d || typeof d !== "object") {
        errors.push(`${label}: error.details[${i}] 非对象`);
        continue;
      }
      for (const k of ["path", "reason"]) {
        if (typeof d[k] !== "string") {
          errors.push(`${label}: error.details[${i}].${k} 应为 string`);
        }
      }
    }
  }

  if (typeof err.message !== "string") {
    errors.push(`${label}: error.message 应为 string`);
  }

  return errors;
}

/**
 * @param {object} spec
 * @param {string} origin
 */
async function checkPathsExist(spec, origin) {
  const errors = [];
  const warnings = [];
  const pending = new Set(getPendingPaths());

  const pathKeys = Object.keys(spec.paths || {});
  for (const p of pathKeys) {
    const expanded = expandPath(p);
    const url = `${origin}${expanded}`;
    const { res, isJson, contentType } = await request("GET", url);

    const isPending = pending.has(p);

    if (res.ok) {
      if (!isJson) {
        errors.push(`路径 ${p}: HTTP 200 但响应非 JSON（Content-Type=${contentType || "(空)"}）`);
      }
      continue;
    }

    if (res.status === 405) {
      /** Next 对个别方法可能 405；换 HEAD 再试一次 */
      const head = await request("HEAD", url);
      if (!head.res.ok && head.res.status !== 404) {
        errors.push(`路径 ${p}: HEAD ${head.res.status}（GET 已 405）`);
      }
      continue;
    }

    if (!isJson && res.status >= 400) {
      const looksLikeNextHtml = (contentType || "").includes("text/html");
      if (isPending && res.status === 404 && looksLikeNextHtml) {
        warnings.push(
          `路径 ${p}: 尚未实现或返回 Next.js HTML 404（列入 CONTRACT_PENDING_PATHS，仅警告）`,
        );
        continue;
      }
      errors.push(
        `路径 ${p}: GET ${url} 期望 JSON 错误体或成功体，得到 HTTP ${res.status}, Content-Type=${contentType || "(空)"}`,
      );
      continue;
    }

    if (res.status >= 500) {
      errors.push(`路径 ${p}: 服务端错误 HTTP ${res.status}（请确认 MongoDB 与 .env.local）`);
      continue;
    }
  }

  return { errors, warnings };
}

/**
 * @param {object} spec
 * @param {string} origin
 */
async function checkPageSizeClamp(spec, origin) {
  const errors = [];
  const max = queryParamMaximum(spec, "/api/anime", "get", "pageSize");
  if (max == null) {
    errors.push("无法在 swagger 中解析 GET /api/anime pageSize.maximum");
    return errors;
  }

  const url = `${origin}/api/anime?page=1&pageSize=101`;
  const { res, json, isJson } = await request("GET", url);
  if (!res.ok) {
    errors.push(`pageSize=101 测试: 期望 200，得到 ${res.status}`);
    return errors;
  }
  if (!isJson || !json) {
    errors.push("pageSize=101 测试: 响应不是 JSON");
    return errors;
  }

  /** 契约：文档声明 maximum=100 时，实现应将 101 限制为 100（与 route.ts 一致） */
  if (max === 100 && json.pageSize !== 100) {
    errors.push(
      `pageSize 上限契约: Swagger 声明 maximum=100，请求 pageSize=101 时期望响应 pageSize=100，实际 ${json.pageSize}`,
    );
  } else if (max !== 100) {
    errors.push(`Swagger 中 pageSize.maximum=${max}，本测试套件当前只校验与实现一致的上限 100`);
  }

  return errors;
}

/**
 * @param {object} spec
 * @param {string} origin
 */
async function checkListAndItemShape(spec, origin) {
  const errors = [];
  const malId = Math.floor(Math.random() * 900_000_000) + 100_000_000;

  const createUrl = `${origin}/api/anime`;
  const created = await request("POST", createUrl, {
    jsonBody: {
      malId,
      title: `contract-validator ${malId}`,
      status: "PLANNED",
    },
  });

  if (created.res.status !== 201) {
    errors.push(`POST 创建失败: HTTP ${created.res.status} body=${created.raw?.slice(0, 500)}`);
    return { errors, id: null };
  }

  const id = created.json?.id;
  if (!id || typeof id !== "string") {
    errors.push(`POST 响应缺少字符串 id（禁止仅 _id）: ${created.raw?.slice(0, 300)}`);
    return { errors, id: null };
  }

  errors.push(
    ...validateObjectKeysAgainstSchema(created.json, "AnimeEntry", spec, "POST 201 AnimeEntry").errors,
  );

  const listUrl = `${origin}/api/anime?page=1&pageSize=100&sort=updatedAt:desc`;
  const listed = await request("GET", listUrl);
  if (!listed.res.ok || !listed.isJson || !listed.json) {
    errors.push(`GET 列表失败: HTTP ${listed.res.status}`);
    await request("DELETE", `${origin}/api/anime/${id}`);
    return { errors, id };
  }

  errors.push(
    ...validateObjectKeysAgainstSchema(
      listed.json,
      "AnimeListPage",
      spec,
      "GET /api/anime 根对象 AnimeListPage",
    ).errors,
  );

  const items = listed.json.items;
  if (!Array.isArray(items)) {
    errors.push("GET /api/anime: items 不是数组");
  } else {
    const found = items.find((x) => x && x.id === id);
    if (!found) {
      errors.push(
        `GET /api/anime: 未在首屏 pageSize=100 中找到新建条目 id=${id}（请检查排序/分页是否与契约描述一致）`,
      );
    } else {
      errors.push(
        ...validateObjectKeysAgainstSchema(found, "AnimeEntry", spec, "GET /api/anime items[] AnimeEntry")
          .errors,
      );
    }
  }

  return { errors, id };
}

/**
 * @param {string} origin
 * @param {string} id
 * @param {object} spec
 */
async function checkInvalidPatch409(origin, id, spec) {
  const errors = [];

  const r1 = await request("PATCH", `${origin}/api/anime/${id}`, { jsonBody: { status: "WATCHING" } });
  if (r1.res.status !== 200) {
    errors.push(`PATCH→WATCHING: 期望 200，得到 ${r1.res.status} body=${r1.raw?.slice(0, 400)}`);
    return errors;
  }

  const r2 = await request("PATCH", `${origin}/api/anime/${id}`, { jsonBody: { status: "PLANNED" } });
  if (r2.res.status !== 409) {
    errors.push(
      `非法状态转换: 期望 HTTP 409，实际 ${r2.res.status}（WATCHING→PLANNED 应对齐状态机与 Swagger） body=${r2.raw?.slice(0, 400)}`,
    );
    return errors;
  }

  if (!r2.isJson || !r2.json) {
    errors.push("409 响应应为 application/json");
    return errors;
  }

  errors.push(...validateApiErrorBody(r2.json, spec, "409 ApiErrorBody"));

  if (r2.json?.error?.code !== "INVALID_STATUS_TRANSITION") {
    errors.push(
      `409 错误码: 期望 error.code=INVALID_STATUS_TRANSITION，实际 ${JSON.stringify(r2.json?.error?.code)}`,
    );
  }

  return errors;
}

/**
 * @param {object} [opts]
 * @param {object} [opts.spec]
 */
async function run(opts = {}) {
  const origin = opts.origin ?? getOrigin();
  const swaggerUrl = opts.swaggerUrl ?? getSwaggerUrl();
  const errors = [];
  const warnings = [];

  let spec = opts.spec;
  if (!spec) {
    const sw = await request("GET", swaggerUrl);
    if (!sw.isJson || !sw.json) {
      errors.push(`无法读取 swagger: ${swaggerUrl}`);
      return { ok: false, errors, warnings, origin, swaggerUrl };
    }
    spec = sw.json;
  }

  const pe = await checkPathsExist(spec, origin);
  errors.push(...pe.errors);
  warnings.push(...pe.warnings);

  errors.push(...(await checkPageSizeClamp(spec, origin)));

  const { errors: shapeErr, id } = await checkListAndItemShape(spec, origin);
  errors.push(...shapeErr);

  if (id) {
    errors.push(...(await checkInvalidPatch409(origin, id, spec)));

    const del = await request("DELETE", `${origin}/api/anime/${id}`);
    if (del.res.status !== 204) {
      errors.push(`清理 DELETE: 期望 204，得到 ${del.res.status}`);
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings, origin, swaggerUrl };
}

async function main() {
  console.log(bold("\n━━ 契约冒烟（路径 / 字段 / 409 / pageSize 上限）━━"));
  console.log(`ORIGIN: ${getOrigin()}`);
  console.log(`Swagger: ${getSwaggerUrl()}`);
  console.log(`PENDING_PATHS: ${getPendingPaths().join(", ") || "(无)"}\n`);

  const result = await run();
  for (const w of result.warnings) console.log(yellow(`[WARN] ${w}`));
  for (const e of result.errors) console.log(red(`[FAIL] ${e}`));

  if (result.ok) {
    console.log(green("\n[PASS] 契约冒烟：实现与 swagger 一致（在已声明的校验范围内）"));
    process.exitCode = 0;
  } else {
    console.log(red("\n[FAIL] 契约冒烟未通过"));
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
