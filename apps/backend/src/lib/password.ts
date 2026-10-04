/**
 * Password hashing on Cloudflare Workers.
 *
 * WebCrypto has PBKDF2 and scrypt is not available, so PBKDF2-SHA256 with a
 * high iteration count is the choice. It is deliberately slow: the point is to
 * make an offline attack on a stolen D1 dump expensive. Never compare a plain
 * password here.
 *
 * 100000 is a hard ceiling, not a preference. workerd refuses to derive above
 * it — `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
 * supported` — so raising this turns every registration into a 500, because the
 * new-account path is the only one that hashes on the way in. Do not "improve"
 * the count without checking that limit.
 */
const ITERATIONS = 100_000;
const KEY_BYTES = 32;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Salt is stored as hex, but PBKDF2 must receive the raw bytes.
 *
 * Feeding it the hex *string* instead still works cryptographically, but it
 * silently doubles the salt's entropy budget in characters and makes the stored
 * hash impossible to reproduce with any standard tool — so a migration that
 * seeds accounts from another script would compute a different digest for the
 * same password. Decoding keeps the format portable.
 */
function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    return encoder.encode(hex);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function randomSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt.buffer);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomSalt();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromHex(salt) as BufferSource,
      iterations: ITERATIONS,
    },
    key,
    KEY_BYTES * 8,
  );
  return `pbkdf2_sha256$${ITERATIONS}$${salt}$${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterations || !salt || !hash) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromHex(salt) as BufferSource,
      iterations: Number(iterations),
    },
    key,
    KEY_BYTES * 8,
  );

  const computed = toHex(bits);
  if (computed.length !== hash.length) {
    return false;
  }
  // Constant-time compare so a wrong guess leaks no timing signal.
  let diff = 0;
  for (let index = 0; index < computed.length; index += 1) {
    diff |= computed.charCodeAt(index) ^ hash.charCodeAt(index);
  }
  return diff === 0;
}