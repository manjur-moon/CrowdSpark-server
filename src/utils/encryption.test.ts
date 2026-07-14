import { describe, expect, it } from "vitest";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  getLastFourCharacters,
  maskSensitiveReference
} from "./encryption.js";

describe("withdrawal reference encryption", () => {
  it("round-trips a sensitive reference without exposing plaintext", () => {
    const plaintext = "01700123456";
    const encrypted = encryptSensitiveValue(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.split(".")).toHaveLength(3);
    expect(decryptSensitiveValue(encrypted)).toBe(plaintext);
  });

  it("uses a random IV for repeated values", () => {
    expect(encryptSensitiveValue("account-1234")).not.toBe(encryptSensitiveValue("account-1234"));
  });

  it("returns only the final four characters for display", () => {
    expect(getLastFourCharacters("01700 123456")).toBe("3456");
    expect(maskSensitiveReference("3456")).toBe("•••• 3456");
  });

  it("rejects malformed ciphertext", () => {
    expect(() => decryptSensitiveValue("invalid")).toThrow("invalid format");
  });
});
