import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = Buffer.from(env.WITHDRAWAL_ENCRYPTION_KEY, "hex");

  if (key.length !== 32) {
    throw new Error("WITHDRAWAL_ENCRYPTION_KEY must be exactly 64 hexadecimal characters");
  }

  return key;
}

export function encryptSensitiveValue(value: string): string {
  const normalizedValue = value.trim();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  const encrypted = Buffer.concat([cipher.update(normalizedValue, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSensitiveValue(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Encrypted value has an invalid format");
  }

  const [ivPart, authTagPart, encryptedPart] = parts;
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Encrypted value has an invalid format");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function getLastFourCharacters(value: string): string {
  const normalized = value.replace(/\s+/g, "").trim();
  return normalized.slice(-4).padStart(4, "*");
}

export function maskSensitiveReference(lastFour: string): string {
  return `•••• ${lastFour}`;
}
