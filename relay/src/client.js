import { CODEC_SOURCE, PAGE_SOURCE } from "./browser-sources.js";
import { buildClientScript } from "./build-client.js";

export function clientScript() {
  return buildClientScript(CODEC_SOURCE, PAGE_SOURCE);
}
