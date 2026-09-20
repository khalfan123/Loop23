import crypto from "crypto";

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required for token encryption at rest");
  }
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

/**
 * Encrypt small secrets for DB storage using AES-256-GCM.
 * Format: base64url(iv).base64url(ciphertext).base64url(tag)
 */
export function sealString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function unsealString(sealed: string): string {
  const key = getKey();
  const [ivB64, ctB64, tagB64] = sealed.split(".");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("Invalid sealed string format");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

