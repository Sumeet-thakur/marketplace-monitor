import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ENCRYPTION_KEY = "test-encryption-key-for-unit-tests";

const { encryptSecret, decryptSecret, maskSecret, last4 } = await import("../lib/crypto");

test("encryptSecret/decryptSecret round-trips correctly", () => {
  const plaintext = "sk-live-abcdef1234567890";
  const encrypted = encryptSecret(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test("encrypting the same value twice produces different ciphertext (random IV)", () => {
  const a = encryptSecret("same-value");
  const b = encryptSecret("same-value");
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), "same-value");
  assert.equal(decryptSecret(b), "same-value");
});

test("decrypting a tampered payload throws instead of returning garbage", () => {
  const encrypted = encryptSecret("sensitive-value");
  const [iv, tag, data] = encrypted.split(":");
  const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(":");
  assert.throws(() => decryptSecret(tampered));
});

test("maskSecret shows only the last 4 characters", () => {
  const masked = maskSecret(last4("super-secret-token-ABCD"));
  assert.equal(masked, "************ABCD");
});

test("maskSecret returns null when there is nothing stored", () => {
  assert.equal(maskSecret(null), null);
  assert.equal(maskSecret(undefined), null);
});
