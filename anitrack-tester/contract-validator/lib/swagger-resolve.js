/**
 * 仅解析文档内 #/components/... 形式的 $ref（足够覆盖本仓库 swagger.json）
 * @param {object} root
 * @param {string} ref
 */
function resolveRef(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    throw new Error(`Unsupported $ref: ${ref}`);
  }
  const parts = ref.slice(2).split("/");
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") throw new Error(`Bad $ref path: ${ref}`);
    cur = cur[p];
  }
  return cur;
}

/**
 * @param {object} schema
 * @param {object} root
 * @param {Set<string>} [seen]
 */
function derefSchema(schema, root, seen = new Set()) {
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) {
      throw new Error(`Circular $ref: ${schema.$ref}`);
    }
    seen.add(schema.$ref);
    const target = resolveRef(root, schema.$ref);
    return derefSchema(target, root, seen);
  }
  return schema;
}

/**
 * OpenAPI Schema Object 上「对象」可出现的属性名（仅一层 properties）
 * @param {object} schema
 * @param {object} specRoot
 */
function objectPropertyKeys(schema, specRoot) {
  const s = derefSchema(schema, specRoot);
  if (!s.properties || typeof s.properties !== "object") return new Set();
  return new Set(Object.keys(s.properties));
}

/**
 * @param {object} schema
 * @param {object} specRoot
 */
function objectRequiredKeys(schema, specRoot) {
  const s = derefSchema(schema, specRoot);
  if (!Array.isArray(s.required)) return new Set();
  return new Set(s.required);
}

module.exports = {
  resolveRef,
  derefSchema,
  objectPropertyKeys,
  objectRequiredKeys,
};
