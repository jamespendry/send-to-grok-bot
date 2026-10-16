export function buildClientScript(codecSrc, pageSrc) {
  const codec = String(codecSrc || "").trim();
  const page = String(pageSrc || "").trim();
  return `"use strict";\n${codec}\nvar STGB_RELAY_CODE = relayCodec();\n${page}\nglobalThis.__stgbReady = setupPage();\n`;
}
