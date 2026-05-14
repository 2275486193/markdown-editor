const STORAGE_KEY = "md-editor-encryption-key";
const ALGORITHM = "AES-GCM";

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    const raw = Uint8Array.from(JSON.parse(existing) as number[]);
    return crypto.subtle.importKey("raw", raw, ALGORITHM, false, [
      "encrypt",
      "decrypt",
    ]);
  }
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const exported = new Uint8Array(
    await crypto.subtle.exportKey("raw", key),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(exported)));
  return key;
}

export async function encrypt(value: string): Promise<string> {
  if (!value) return "";
  try {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoded,
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    return "";
  }
}

export async function decrypt(encoded: string): Promise<string> {
  if (!encoded) return "";
  try {
    const key = await getOrCreateKey();
    const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}
