const DEFAULT_BASE_URL = "http://localhost:3000/api";

function normalizeBaseUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

module.exports = {
  BASE_URL: normalizeBaseUrl(process.env.BASE_URL || DEFAULT_BASE_URL),
};

