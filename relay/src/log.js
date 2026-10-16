// Only these fields are written. Callers cannot sneak a token in by adding a property.
const FIELDS = ["method", "path", "status", "destination", "error"];

export function safeLog(fields) {
  const out = {};
  const src = fields || {};
  for (const key of FIELDS) {
    if (src[key] == null || src[key] === "") continue;
    out[key] = String(src[key]).replace(/[\r\n]/g, " ").slice(0, 200);
  }
  console.log(JSON.stringify(out));
}
