# Oyun canlı bağlantısı — yol haritası 20

10 Ekim 2026. Günlük etkinlik ve QR lobisinin yetkili Socket.IO aboneliği çalışır. [REST oyun API'si](games-development.md) tek komut hattıdır; socket üzerinden fotoğraf, yıldız veya host komutu kabul edilmez. Mobil henüz bağlanmadı. Bu teslim yeni migration gerektirmez; `npm ci` ile yeni bağımlılıklar kurulur.

## Bağlantı ve oturum

- API ile aynı host/port; namespace **`/games`**, transport yolu **`/socket.io`**, yalnız `websocket` transport. `/v1` prefix'i socket adresine eklenmez.
- Socket.IO 4 istemcisi kullanılır. Düz WebSocket istemcisi aynı protokol değildir.
- Giriş kanıtı `auth: { accessToken }`. Mevcut 43 karakterlik opaque access token doğrulanır; refresh token, QR tokenı veya URL query parametresi giriş sayılmaz.
- Native istemci origin olmadan bağlanabilir. Browser origin'i `CORS_ORIGINS` izin listesinde olmalıdır; websocket upgrade için de denetlenir.
- Her mesaj ve her değişiklik tesliminde mevcut oturum/hesap yeniden doğrulanır. Ayrıca 15 saniyede bir boşta bağlantılar kontrol edilir. Çıkış, token yenilenmesi/süresinin dolması veya askıya alma `game.error` ardından bağlantıyı kapatır. Refresh HTTP'de yapılır; yeni access token ile yeniden bağlanıp tekrar abone olunur.
- İlk doğrulama başarısızsa `connect_error.data` `{ code, message }` içerir. Token ve hata ayrıntıları loga yazılmaz.

```js
import { io } from "socket.io-client";

const socket = io(`${apiOrigin}/games`, {
  transports: ["websocket"],
  auth: { accessToken },
});
```

## İstemci mesajları

Her iki mesaj yalnız `{ sessionId: "uuid" }` gövdesi alır; ek alan/bozuk UUID reddedilir. Ack biçimi başarıda `{ ok: true, data }`, hatada `{ ok: false, error: { code, message } }`.

| Mesaj | Başarılı ack |
| --- | --- |
| `game.subscribe` | `{ data: { state: <kişisel REST game state> }, ok: true }` |
| `game.unsubscribe` | `{ data: { sessionId }, ok: true }` |

Üyelik REST ile oluşturulur: özel lobiye QR tokenıyla `POST /v1/games/join`, günlük etkinliğe `POST /v1/games/:id/join`. Oda kimliği veya QR tokenı socket üzerinden üyelik oluşturmaz. Abonelik aktif üye/aktif hesap/güncel host-engel koşullarına bağlıdır; dışarıdan veya ayrılmış kullanıcı `RESOURCE_NOT_FOUND` alır. Abone olma kalıcı üyeliği değiştirmez, unsubscribe lobiden ayrılmak değildir.

Snapshot başka bir üyenin teslimini, oyunu veya davet sırrını içermez; kişinin kendi teslimi ve kendi oy sayısı mevcut REST sözleşmesiyle aynıdır. Abonelik kaydından sonra snapshot tekrar okunur; ilk kontrol ile kayıt arasında oluşan değişiklik kaçırılmaz.

## Sunucu mesajları

| Mesaj | Gövde / davranış |
| --- | --- |
| `game.changed` | `{ eventId, sessionId, version, serverNow }`; yetkili REST durumunu tekrar oku |
| `game.access-revoked` | `{ sessionId }`; abonelik kaldırıldı, ilgili ekran/cache'i kapat |
| `game.error` | `{ code, message }`; oturum hatasında yeni tokenla yeniden bağlan |

Lobi ayarı, davet yenileme/iptal, üye katılımı/ayrılması, fotoğraf teslimi, aşama geçişi, yıldız, sonuç ve iptal kaynak olayları `game.changed` üretir. Mesajda kaynak olayın ham payload'u veya türü, katılımcı/oy veren kimliği, fotoğraf yolu, yıldız değeri, tema metni, QR tokenı/hash'i bulunmaz. Sunucu ortak odaya kör broadcast yapmaz; her alıcının oturumu ve güncel oyun erişimi ayrı denetlenir. Sosyal ve user.status.changed olayları da abonelikleri tekrar denetler; üyelik/engel yüzünden erişimi kaybedenin aboneliği kaldırılır.

## Yeniden bağlanma ve tutarlılık

1. Listener'ları ekle; her `connect` sonrasında `game.subscribe` gönder.
2. Ack içindeki kişisel snapshot'ı uygula. Daha önce daha yüksek sürüm sinyali geldiyse yeniden REST oku.
3. `game.changed.version` mevcut state'ten yüksekse REST oku; aynı/eski sürümü atla. Eşzamanlı okumaların yanıtını sürüm kontrolüyle uygula.
4. Reconnect, uygulamanın öne gelmesi, faz sonu ve canlı ekranda periyodik kontrol sırasında REST oku. Telefon saati yerine `serverNow` / `phaseEndsAt` kullan.

Mesaj kalıcı teslim makbuzu değildir. Outbox hatasında tekrar gelebilir; eski kaynak olayı işlendiğinde mesaj **veritabanındaki güncel version** değerine işaret eder. Sunucu mesaj geçmişini replay etmez; reconnect aboneliği otomatik geri getirmez. Socket.IO'nun varsayılan teslimi kopuşta mesajı kaybedebilir; bu yüzden REST toparlanması zorunludur. [Socket.IO teslim garantileri](https://socket.io/docs/v4/delivery-guarantees/).

## İşçi ve sınırlar

`GameRealtimeGateway`, mevcut `OutboxRegistry`'ye dış teslim tüketicisi olarak kaydolur. Oyun işlemi ve kaynak olay DB'de commit edildikten sonra mevcut outbox işçisi sinyal üretir; rollback olmuş işlem yayınlanmaz. Başka tüketici hata verirse aynı sinyal tekrar gelebilir. `OUTBOX_WORKER_ENABLED=false` canlı değişiklik sinyallerini de durdurur; abonelik snapshot'ı ve REST çalışmaya devam eder. Varsayılan işçi aralığı 3 saniyedir.

Geliştirme sınırları: kullanıcı başına 5 bağlantı, bağlantı başına 5 abonelik, 10 saniyede 30 subscribe/unsubscribe isteği, aynı bağlantıda tek işleyen komut, 16 KiB transport mesajı. Aşım `CONNECTION_LIMIT`, `SUBSCRIPTION_LIMIT` veya `RATE_LIMITED` verir. Bir abonelikte aynı sessionId tekrarı kapasiteyi tekrar tüketmez.

**Bu teslim tek API süreci içindir.** Abonelikler bellektedir; ayrı API/işçi süreçlerine Redis veya eşdeğer fan-out bağlanmadı. Birden çok API süreci aynı outbox'ı paylaşırsa yalnız olayı alan süreçteki socket'lere sinyal gider; diğer istemciler REST ile toparlanır. Dağıtık canlı teslim ve gerçek çok bağlantılı PostgreSQL yarış testleri 17. adımda açıktır. Socket bağlantısı olmadan da oyun süreleri, teslim, değerlendirme ve sonuç çalışır.

## Çalıştırma ve test

```sh
npm ci
npm run test:realtime
```

12 gerçek Socket.IO/HTTP/DB testi: handshake/token/hesap, browser origin, strict gövde ve üye yetkisi, outbox sinyali ve unsubscribe, kişisel fotoğraf ayrımı/yıldız/sonuç, ayrılma, engelleme, çıkış/süre, tekrar/sıra/reconnect, rollback/retry, mesaj/abonelik sınırları ve bağlantı sınırı. `test:api` bunları mevcut HTTP testleriyle sıralı çalıştırır. PGlite tek bağlantılıdır; bu testler dağıtık PostgreSQL kabul testi yerine geçmez.

Komut satırı istemcisi: [examples/game-realtime.mjs](../examples/game-realtime.mjs). `PODYUM_API_ORIGIN`, `PODYUM_ACCESS_TOKEN`, `PODYUM_GAME_ID` ortam değişkenleriyle çalışır; tokenı loglamaz. Mobil uygulamaya socket.io-client eklemek/ekranı bağlamak bu backend tesliminin dışındadır.

Yönetici iptali ve hesap askıya alma canlı erişime bağlandı; 17 yönetim senaryosu bu iki davranışı da gerçek socket ile kontrol eder. [Yönetim rehberi](moderation-development.md).
