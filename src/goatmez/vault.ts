import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { goatmezId } from "./id.js";
import { GoatmezVaultStore } from "./storage.js";
import type { GoatmezSecretRecord } from "./types.js";

function deriveKey(raw: string): Buffer {
  return createHash("sha256").update(raw).digest();
}

function mask(value: string): string {
  if (!value) return "***";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

export class GoatmezVault {
  constructor(private readonly store: GoatmezVaultStore, private readonly vaultKey: string) {}

  get configured(): boolean {
    return Boolean(this.vaultKey.trim());
  }

  list(): Array<Omit<GoatmezSecretRecord, "encryptedValue" | "iv" | "tag"> & { maskedPreview: string }> {
    return this.store.read().secrets.map((secret) => ({
      ...secret,
      maskedPreview: mask(this.resolve(secret.name, secret.scope))
    }));
  }

  set(input: { name: string; value: string; scope?: string; provider?: string }): GoatmezSecretRecord {
    if (!this.configured) throw new Error("GOATMEZ_VAULT_KEY is required for vault writes.");
    const name = input.name.trim();
    if (!name) throw new Error("Secret name is required.");
    const scope = (input.scope || "workspace").trim();
    const now = new Date().toISOString();
    const { encryptedValue, iv, tag } = this.encrypt(input.value);
    const state = this.store.read();
    const existing = state.secrets.find((secret) => secret.name === name && secret.scope === scope);
    const next: GoatmezSecretRecord = existing
      ? { ...existing, provider: input.provider, encryptedValue, iv, tag, updatedAt: now }
      : {
          id: goatmezId("secret"),
          name,
          scope,
          provider: input.provider,
          encryptedValue,
          iv,
          tag,
          createdAt: now,
          updatedAt: now
        };
    state.secrets = [next, ...state.secrets.filter((secret) => secret.id !== next.id)];
    this.store.write(state);
    return next;
  }

  resolve(name: string, scope = "workspace"): string {
    if (!this.configured) return "";
    const state = this.store.read();
    const direct = state.secrets.find((secret) => secret.name === name && secret.scope === scope);
    const fallback = state.secrets.find((secret) => secret.name === name && secret.scope === "workspace");
    const record = direct ?? fallback;
    if (!record) return "";
    return this.decrypt(record.encryptedValue, record.iv, record.tag);
  }

  private encrypt(plaintext: string): { encryptedValue: string; iv: string; tag: string } {
    const key = deriveKey(this.vaultKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      encryptedValue: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64")
    };
  }

  private decrypt(ciphertextBase64: string, ivBase64: string, tagBase64: string): string {
    const key = deriveKey(this.vaultKey);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, "base64")),
      decipher.final()
    ]);
    return decoded.toString("utf8");
  }
}
