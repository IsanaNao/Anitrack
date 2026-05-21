import type { Messages } from "./messages/zh";

type Primitive = string | number;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function interpolate(
  template: string,
  params?: Record<string, Primitive>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = params[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

export function createTranslator(messages: Messages) {
  return function t(
    key: string,
    params?: Record<string, Primitive>,
  ): string {
    const raw = getNested(messages as unknown as Record<string, unknown>, key);
    if (typeof raw === "string") return interpolate(raw, params);
    return key;
  };
}
