import fs from "fs";
import { verifyEvidencePack } from "./evidencePack.js";

function loadJson(path: string): any {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function loadKeys(path: string): Record<string, Uint8Array> {
  const raw = loadJson(path);
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = new Uint8Array(Buffer.from(v as string, "hex"));
  }
  return out;
}

function main() {
  const packPath = process.argv[2];
  const keysPath = process.argv[3];
  if (!packPath || !keysPath) {
    console.error("Usage: node dist/index.js <evidence_pack.json> <keys.json>");
    process.exit(2);
  }

  const pack = loadJson(packPath);
  const keys = loadKeys(keysPath);

  const res = verifyEvidencePack(pack, keys);
  if (res.ok) {
    console.log("OK");
    process.exit(0);
  } else {
    console.log("FAIL");
    for (const e of res.errors) console.log("-", e);
    process.exit(1);
  }
}

main();
