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

/**
 * @param {string} method
 * @param {string} absoluteUrl
 * @param {object} [opts]
 * @param {object} [opts.jsonBody]
 */
async function request(method, absoluteUrl, opts = {}) {
  const f = await getFetch();
  let res;
  try {
    res = await f(absoluteUrl, {
      method,
      headers: {
        Accept: "application/json",
        ...(opts.jsonBody !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.jsonBody === undefined ? undefined : JSON.stringify(opts.jsonBody),
    });
  } catch (e) {
    const err = new Error(`Network error ${method} ${absoluteUrl}: ${e?.message || e}`);
    err.cause = e;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const raw = await res.text();
  const json = isJson ? toJsonSafe(raw) : null;

  return { res, json, raw, contentType, isJson };
}

module.exports = { request, getFetch };
