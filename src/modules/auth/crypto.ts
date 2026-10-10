import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt:32768:8:3:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, salt, key] = encoded.split(":");
  if (algorithm !== "scrypt" || n !== "32768" || r !== "8" || p !== "3"
    || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(key ?? "")) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, "hex"));
}

export function newToken() { return randomBytes(32).toString("base64url"); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
