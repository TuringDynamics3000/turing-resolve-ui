import { canonicalJsonBytes } from "./canonicalJson.js";
import { sha256 } from "./hash.js";
import { verifyEd25519 } from "./sig.js";
import { verifyInclusion } from "./merkle.js";

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

export type KeyLookup = Record<string, Uint8Array>;

export function verifyEvidencePack(pack: any, keys: KeyLookup): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1) Evidence pack hash
  const expected = hexToBytes(pack.evidence_pack_hash);
  const copy = { ...pack };
  delete copy.evidence_pack_hash;
  const actual = sha256(canonicalJsonBytes(copy));
  if (!Buffer.from(actual).equals(Buffer.from(expected))) {
    errors.push("EVIDENCE_PACK_HASH_MISMATCH");
  }

  // 2) Policy signature (v0 signs bytecode_hash)
  const pol = pack.policy;
  const pk = keys[pol.key_id];
  if (!verifyEd25519(pk, hexToBytes(pol.bytecode_hash), hexToBytes(pol.signature))) {
    errors.push("POLICY_SIGNATURE_INVALID");
  }

  // 3) Model signature (optional)
  if (pack.model) {
    const m = pack.model;
    const mk = keys[m.key_id];
    if (!verifyEd25519(mk, hexToBytes(m.artifact_hash), hexToBytes(m.signature))) {
      errors.push("MODEL_SIGNATURE_INVALID");
    }
  }

  // 4) Merkle proofs
  for (const ev of (pack.events || [])) {
    const mp = ev.merkle_proof;
    const leafHash = hexToBytes(ev.leaf_hash);
    const siblings = mp.siblings.map((h: string) => hexToBytes(h));
    const rootHash = hexToBytes(mp.root_hash);

    if (!verifyInclusion(leafHash, mp.leaf_index, siblings, rootHash)) {
      errors.push(`MERKLE_INCLUSION_FAIL:${ev.event_id}`);
    }

    const rpk = keys[mp.signing_key_id];
    if (!verifyEd25519(rpk, rootHash, hexToBytes(mp.root_signature))) {
      errors.push(`MERKLE_ROOT_SIG_INVALID:${mp.batch_id}`);
    }

    if (!mp.anchor_ref) errors.push(`MERKLE_ROOT_NOT_ANCHORED:${mp.batch_id}`);
  }

  return { ok: errors.length === 0, errors };
}
