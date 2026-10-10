// backend/ içinden: node examples/game-realtime.mjs
// Önce HTTP ile giriş yapıp oyuna katıl; değerleri ortam değişkenleriyle ver.
import { io } from "socket.io-client";

const origin = process.env.PODYUM_API_ORIGIN ?? "http://127.0.0.1:3000";
const accessToken = process.env.PODYUM_ACCESS_TOKEN;
const sessionId = process.env.PODYUM_GAME_ID;
if (!accessToken || !sessionId) throw new Error("PODYUM_ACCESS_TOKEN ve PODYUM_GAME_ID gerekli.");

let version = -1;
let requestedVersion = -1;
let reading;
let active = true;
let timer;
function apply(state) {
  if (!active || state.version < version) return;
  version = state.version;
  // Kendi fotoğrafı dahil kişisel snapshot'ın tamamını ve tokenı loglama.
  console.log({ sessionId: state.id, phase: state.phase, version, serverNow: state.serverNow, phaseEndsAt: state.phaseEndsAt });
}
async function readState() {
  const response = await fetch(`${origin}/v1/games/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`State HTTP ${response.status}`);
  apply(await response.json());
}
function refresh() {
  if (!active) return Promise.resolve();
  if (reading) return reading;
  reading = (async () => {
    do { await readState(); } while (active && version < requestedVersion);
  })().catch((error) => console.error(error.message)).finally(() => { reading = undefined; });
  return reading;
}

const socket = io(`${origin}/games`, { transports: ["websocket"], auth: { accessToken }, autoConnect: false });
socket.on("game.changed", (change) => {
  if (change.sessionId !== sessionId) return;
  requestedVersion = Math.max(requestedVersion, change.version);
  if (requestedVersion > version) void refresh();
});
socket.on("connect", async () => {
  try {
    const result = await socket.timeout(10000).emitWithAck("game.subscribe", { sessionId });
    if (!result.ok) { console.error(result.error.code); return; }
    apply(result.data.state);
    if (requestedVersion > version) void refresh();
  } catch { console.error("Abonelik yanıtı alınamadı; yeniden bağlantıda tekrar denenecek."); }
});
socket.on("game.access-revoked", (change) => {
  if (change.sessionId !== sessionId) return;
  active = false; clearInterval(timer); console.error("Oyun erişimi kapandı."); socket.disconnect();
});
function stopForAuth(code) {
  if (!["AUTH_REQUIRED", "INVALID_SESSION", "ACCOUNT_SUSPENDED"].includes(code)) return;
  active = false; clearInterval(timer); socket.disconnect();
  console.error("HTTP ile tokenı yenileyip istemciyi tekrar başlat.");
}
socket.on("game.error", (error) => { console.error(error.code); stopForAuth(error.code); });
socket.on("connect_error", (error) => { console.error(error.data?.code ?? "CONNECTION_ERROR"); stopForAuth(error.data?.code); });
timer = setInterval(() => void refresh(), 15000);
socket.connect();
process.once("SIGINT", () => { active = false; clearInterval(timer); socket.disconnect(); });
