// Secure patient-link token generation (S-01, Phase 3 / FR-051).
//
// The token is a capability secret: possession of `/p/<token>` is the only thing
// that grants access to an approved quote (the patient route is unauthenticated).
// It must therefore be unguessable. Generated from the Web Crypto CSPRNG (exposed
// globally in the Cloudflare Workers runtime) over 16 bytes / 128 bits and encoded
// URL-safe with no padding ambiguity — never a DB sequence or `Math.random`.

const TOKEN_BYTES = 16; // 128-bit entropy (FR-051)

/**
 * Generate a URL-safe, ≥128-bit random token. Uses base64url (RFC 4648 §5)
 * without padding so it drops cleanly into a `/p/<token>` path segment.
 */
export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);

  let base64 = "";
  if (typeof btoa === "function") {
    base64 = btoa(String.fromCharCode(...bytes));
  } else {
    base64 = Buffer.from(bytes).toString("base64");
  }
  // base64 → base64url, strip padding.
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
