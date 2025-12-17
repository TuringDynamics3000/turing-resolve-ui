export function canonicalize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(canonicalize);

  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj).sort();
    const out: any = {};
    for (const k of keys) out[k] = canonicalize(obj[k]);
    return out;
  }

  if (typeof obj === "number") {
    // Reject non-integers: floats are ambiguous across runtimes.
    if (!Number.isInteger(obj)) throw new Error("Non-integer numbers not allowed in canonical JSON. Encode decimals as strings.");
    return obj;
  }

  return obj;
}

export function canonicalJsonBytes(obj: any): Uint8Array {
  const norm = canonicalize(obj);
  const json = JSON.stringify(norm);
  return new TextEncoder().encode(json);
}
