import crypto from "crypto";

// Server-only module. Never import this from a client component.
// Encrypts/decrypts marketplace secrets using AES-256-GCM.
// Storage format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Set a 32-byte key in your environment before storing credentials."
    );
  }
  // Derive a stable 32-byte key from whatever string is provided, so any
  // reasonably long secret works without the operator worrying about exact
  // byte length or encoding.
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptSecret(stored: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted credential payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Returns a display-safe mask like "************ABCD". Never logs/returns the real value. */
export function maskSecret(last4: string | null | undefined): string | null {
  if (!last4) return null;
  return "*".repeat(12) + last4;
}

export function last4(plaintext: string): string {
  return plaintext.slice(-4);
}
