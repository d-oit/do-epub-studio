/**
 * Deterministic identity helpers for data portability.
 *
 * Imports must be idempotent: re-importing the same backup must not create
 * duplicates. We derive entity mutation IDs and remapped annotation IDs from
 * stable keys (namespace + source id), so the server's
 * `ON CONFLICT(mutation_id) DO NOTHING` paths replay exactly.
 */

/** DNS namespace UUID (RFC 4122 appendix C), reused as default v5 namespace. */
const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    bytes[i] = Number.isFinite(byte) ? byte : 0;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * UUID v5 (SHA-1, name-based). Deterministic across sessions, which is what
 * idempotent import needs; not a secret, never used as one.
 */
export async function stableUuid(namespace: string, name: string): Promise<string> {
  const nsBytes = hexToBytes(namespace.replace(/-/g, ''));
  const nameBytes = new TextEncoder().encode(name);
  const buffer = new Uint8Array(nsBytes.length + nameBytes.length);
  buffer.set(nsBytes);
  buffer.set(nameBytes, nsBytes.length);

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', buffer));
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytesToHex(digest.subarray(0, 16));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** v5 id for an imported entity, stable per source entity. */
export function importMutationId(envelopeId: string, sourceId: string): Promise<string> {
  return stableUuid(DNS_NAMESPACE, `do-epub-studio:import:${envelopeId}:${sourceId}`);
}

/**
 * Canonical anchor identity for duplicate detection. Two entities are "the
 * same" when they anchor to the same locator and carry the same payload; this
 * key feeds the preview diff so re-imports are clearly reported, never
 * silently duplicated.
 */
export function anchorIdentityKey(params: {
  kind: 'highlight' | 'bookmark' | 'comment';
  cfi: string | null | undefined;
  selectedText: string | null | undefined;
  chapterRef: string | null | undefined;
  body?: string | null;
}): string {
  const text = normalizeAnchorText(params.selectedText ?? '');
  const cfi = (params.cfi ?? '').replace(/\s+/g, '').toLowerCase();
  const chapter = (params.chapterRef ?? '').replace(/\s+/g, '').toLowerCase();
  const body = normalizeAnchorText(params.body ?? '');
  return `${params.kind}|${cfi}|${chapter}|${text}|${body}`;
}

/** Normalize a short text for locator comparison. */
function normalizeAnchorText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
