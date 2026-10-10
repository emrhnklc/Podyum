import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";

const command = process.argv[2];
if (command !== "dev" && command !== "deploy") throw new Error("Migration komutu dev veya deploy olmalı.");
await assertProjectDatabase({ allowEmpty: true });
if (command === "dev" && process.env.SHADOW_DATABASE_URL) {
  const primary = new URL(process.env.DATABASE_URL!);
  const shadow = new URL(process.env.SHADOW_DATABASE_URL);
  // localhost/127.0.0.1 aynı sunucuyu işaret edebilir; iki URL aynı DB'ye gitmemeli.
  const target = (url: URL) => `${url.port || "5432"}${url.pathname}:${url.searchParams.get("schema") ?? "public"}`;
  if (target(primary) === target(shadow)) throw new Error("Ana DB ve shadow DB ayrı olmalı.");
  await assertProjectDatabase({
    allowEmpty: true, allowOwnedShadow: true, connectionString: process.env.SHADOW_DATABASE_URL,
  });
}
const cli = fileURLToPath(import.meta.resolve("prisma/build/index.js"));
const result = spawnSync(process.execPath, [cli, "migrate", command, ...process.argv.slice(3)], {
  stdio: "inherit", env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
