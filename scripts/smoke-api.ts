import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Gerçek bootstrap'ı boş bir portta açar; kullanıcının çalışan API süreçlerine dokunmaz.
const child = spawn(process.execPath, ["dist/main.js"], {
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let startupTimer: ReturnType<typeof setTimeout>;
const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
const address = new Promise<string>((resolve, reject) => {
  startupTimer = setTimeout(() => reject(new Error(`API açılış zaman aşımı.\n${output}`)), 15_000);
  child.once("error", reject);
  child.once("exit", () => reject(new Error(`API beklenmedik şekilde kapandı.\n${output}`)));
  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-12_000);
    const match = output.match(/Kombin backend: (http:\/\/127\.0\.0\.1:\d+)/);
    if (match) resolve(match[1]);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
});

try {
  const base = await address;
  clearTimeout(startupTimer!);
  const live = await fetch(`${base}/v1/health/live`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: "ok" });
  const ready = await fetch(`${base}/v1/health/ready`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ok", database: "connected" });
  const unknown = await fetch(`${base}/v1/unknown`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(unknown.status, 404);
  console.log("API smoke geçti: gerçek bootstrap, liveness=200, DB readiness=200, bilinmeyen yol=404.");
} finally {
  clearTimeout(startupTimer!);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    let shutdownTimer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        exited,
        new Promise<never>((_, reject) => {
          shutdownTimer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error("API düzgün kapanmadı; smoke süreci sonlandırıldı."));
          }, 5_000);
        }),
      ]);
    } finally {
      clearTimeout(shutdownTimer!);
    }
  }
}
