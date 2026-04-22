const { objectPropertyKeys, objectRequiredKeys } = require("./swagger-resolve");

/**
 * 字段级契约：Swagger 定义的属性集合 vs 实际 JSON（键名严格，禁止 _id）
 * @param {object} obj
 * @param {string} schemaName components.schemas 下的名称
 * @param {object} spec 完整 OpenAPI 文档
 * @param {string} label 日志用
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateObjectKeysAgainstSchema(obj, schemaName, spec, label) {
  const errors = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    errors.push(`${label}: 期望对象，实际 ${obj === null ? "null" : typeof obj}`);
    return { ok: false, errors };
  }

  const schema = spec.components?.schemas?.[schemaName];
  if (!schema) {
    errors.push(`${label}: Swagger 缺少 components.schemas.${schemaName}`);
    return { ok: false, errors };
  }

  if (Object.prototype.hasOwnProperty.call(obj, "_id")) {
    errors.push(
      `${label}: 响应包含禁止字段 _id（契约使用 id；若 Mongoose 未 transform，请同步实现与 Swagger）`,
    );
  }

  const allowed = objectPropertyKeys(schema, spec);
  const required = objectRequiredKeys(schema, spec);

  for (const k of required) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) {
      errors.push(`${label}: 缺少 Swagger 必填字段 "${k}"`);
    }
  }

  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      errors.push(
        `${label}: 存在未在 Swagger schema "${schemaName}" 中声明的字段 "${k}"（请更新 swagger.json 或移除多余字段）`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateObjectKeysAgainstSchema };
