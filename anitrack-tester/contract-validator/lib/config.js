/**
 * CONTRACT_ORIGIN — 站点根，如 http://localhost:3000（swagger 与 /api/* 同源）
 * BASE_URL — 与 api-test-suite 一致时可为 http://localhost:3000/api，用于反推 origin
 * CONTRACT_SWAGGER_URL — 覆盖 swagger 地址（默认 `${origin}/swagger.json`）
 */
function normalizeOrigin(url) {
  return String(url ?? "")
    .trim()
    .replace(/\/$/, "");
}

function getOrigin() {
  const direct = process.env.CONTRACT_ORIGIN?.trim();
  if (direct) return normalizeOrigin(direct);

  const base = normalizeOrigin(process.env.BASE_URL || "http://localhost:3001/api");
  if (base.endsWith("/api")) return base.slice(0, -4);
  return base || "http://localhost:3001";
}

function getSwaggerUrl() {
  const u = process.env.CONTRACT_SWAGGER_URL?.trim();
  if (u) return u;
  return `${getOrigin()}/swagger.json`;
}

/**
 * 尚未实现、允许 404/HTML 的路径（逗号分隔）。
 * 热力图已实现后默认无待办路径；需要宽松校验时可设置例如 `/api/foo`。
 */
function getPendingPaths() {
  const raw = process.env.CONTRACT_PENDING_PATHS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  getOrigin,
  getSwaggerUrl,
  getPendingPaths,
};
