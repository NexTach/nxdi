import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey() {
  const encoded = process.env.DATA_ENCRYPTION_KEY_BASE64;
  if (!encoded) throw new Error("DATA_ENCRYPTION_KEY_BASE64 is required for sensitive data");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  return key;
}

export function encryptSensitive(value: string) {
  if (value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitive(value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const [ivText, tagText, encryptedText] = value.slice(PREFIX.length).split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted sensitive value");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function maskAccountNumber(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length <= 4) return "****";
  return `${"*".repeat(Math.min(normalized.length - 4, 12))}${normalized.slice(-4)}`;
}
