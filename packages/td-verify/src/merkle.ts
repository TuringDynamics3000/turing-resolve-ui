import { sha256 } from "./hash.js";

const NODE_PREFIX = new Uint8Array([0x01]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function parentHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return sha256(concat(NODE_PREFIX, left, right));
}

export function verifyInclusion(leafHash: Uint8Array, leafIndex: number, siblings: Uint8Array[], rootHash: Uint8Array): boolean {
  let h = leafHash;
  let idx = leafIndex;
  for (const sib of siblings) {
    h = (idx % 2 === 0) ? parentHash(h, sib) : parentHash(sib, h);
    idx = Math.floor(idx / 2);
  }
  return Buffer.from(h).equals(Buffer.from(rootHash));
}
