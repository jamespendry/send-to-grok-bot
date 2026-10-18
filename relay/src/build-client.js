export function buildClientScript(codecSrc, pageSrc, qrSrc) {
  const codec = String(codecSrc || "").trim();
  const page = String(pageSrc || "").trim();
  const qr = String(qrSrc || "").trim();
  return `"use strict";\n${qr ? qr + "\n" : ""}${codec}\nvar STGB_RELAY_CODE = relayCodec();\n${page}\nglobalThis.__stgbReady = setupPage();\n`;
}
