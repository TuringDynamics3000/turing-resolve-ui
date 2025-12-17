# td_verify_ts

Minimal offline verifier for Turing evidence packs.

## Install
```bash
cd td_verify_ts
npm install
npm run build
```

## Run
```bash
node dist/index.js path/to/evidence_pack.json path/to/keys.json
```

keys.json format:
```json
{
  "k-policy-2026-01": "<hex_public_key_bytes>",
  "k-merkle-2026-01": "<hex_public_key_bytes>",
  "k-model-2026-01": "<hex_public_key_bytes>"
}
```

Notes:
- JSON numbers are allowed only as integers (e.g., leaf_index). Decimals should be strings.
