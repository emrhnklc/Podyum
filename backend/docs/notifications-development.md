# Bildirim API'si ve olay kuyruğu

10 Ekim 2026. Yol haritası 12 çalışır: uygulama içi bildirim listesi, okunmamış sayısı, okundu işaretleri, cihaz kaydı, olay kuyruğu işçisi ve push teslimi. Yeni migration: `20261010220000_notifications`. Gerçek cihaza push teslimi mobil bağlanmadan doğrulanamaz; varsayılan sağlayıcı yereldir ve hiçbir yere göndermez. `mobile/` değişmedi.

## Seçilen ürün kararları

| Konu | Karar |
| --- | --- |
| Oylama sonucu | Paylaşım sahibine uygulama içi + push. Oy verenlere yalnız uygulama içi |
| Yorum bildirimi | Paylaşım başına tek okunmamış bildirim; yeni yorumlar onu günceller. Push yalnız grubun ilk yorumunda |
| Oyun | Etkin üyelere "oylama başladı" ve "sonuç açıklandı" |
| Push metni | Genel metin; isim, soru veya yorum taşımaz |

Varsayım (değiştirilebilir): ayarlardaki tür anahtarları ve `pushEnabled` yalnız push'u kapatır. Uygulama içi liste tercihten bağımsız yazılır.

## Uçlar

Hepsi Bearer oturumu ister; `Idempotency-Key` istemez.

| Metot | Yol | Davranış |
| --- | --- | --- |
| GET | `/me/notifications` | Bildirimler, son etkinlik önce; `limit` 1–50, `cursor` |
| GET | `/me/notifications/unread-count` | Sekme rozeti için `{ unreadCount }` |
| PUT | `/me/notifications/:id/read` | Tek bildirimi okundu yap; tekrar aynı yanıt |
| POST | `/me/notifications/read-all` | Verilen ana kadarki bildirimleri okundu yap |
| PUT | `/me/devices/:installationId` | Bu kurulumun push anahtarını kaydet/güncelle |
| DELETE | `/me/devices/:installationId` | Bu kurulumun push kaydını kaldır |

Liste yanıtı:

```json
{
  "items": [{
    "id": "uuid", "type": "poll.comment.received", "createdAt": "2026-10-10T18:00:00.000Z",
    "isRead": false, "readAt": null, "count": 3,
    "actor": { "id": "uuid", "username": "ada", "displayName": "Ada", "avatarPath": null },
    "target": { "type": "POLL", "id": "uuid", "title": "Cuma akşamı hangisi?" }
  }],
  "unreadCount": 1, "serverNow": "2026-10-10T18:00:05.000Z", "nextCursor": null
}
```

- Metni mobil `type`, `actor` ve `count` alanlarından üretir; sunucu hazır cümle döndürmez.
- `createdAt` son etkinlik zamanıdır; gruplu bildirim yeni yorumla listenin başına çıkar.
- `target` dokununca açılacak ekrandır: `USER` profil, `POLL` paylaşım, `GAME` oyun. `title` paylaşımın sorusu veya oyunun temasıdır; hedef artık görülemiyorsa `null` gelir. Bildirim erişim hakkı vermez; hedef ekranı kendi yetkisini yeniden denetler.
- Engellenen veya pasif hale gelen kişinin bildirimi silinmez ama listede ve `unreadCount` içinde görünmez; engel kalkarsa geri gelir.
- `PUT .../read` yanıtı `{ id, isRead: true, readAt }`; ilk okunma zamanı korunur. Başkasının bildirimi 404.
- `POST .../read-all` gövdesi boş veya `{ "before": "<liste yanıtındaki serverNow>" }`. `before` gönderilirse ekranda henüz görülmemiş yeni bildirim okunmuş sayılmaz. Yanıt `{ updated, unreadCount }`.

## Bildirim türleri

| Tür | Kime | Ne zaman | Push | Ayar |
| --- | --- | --- | --- | --- |
| `friend.request.received` | İsteği alan | Arkadaşlık isteği geldi | Evet | `friendRequestNotifications` |
| `friend.request.accepted` | İsteği gönderen | İstek kabul edildi | Evet | `friendRequestNotifications` |
| `poll.comment.received` | Paylaşım sahibi | Başkası yorum yazdı | Grubun ilk yorumunda | `commentNotifications` |
| `poll.result.own` | Paylaşım sahibi | Oylama kapandı | Evet | `pollResultNotifications` |
| `poll.result.voted` | Oy verenler | Oy verdikleri oylama kapandı | Hayır | — |
| `game.voting.opened` | Etkin oyun üyeleri | Oyunda oylama aşaması açıldı | Evet (30 dk geçerli) | `gameNotifications` |
| `game.completed` | Etkin oyun üyeleri | Oyun sonucu açıklandı | Evet | `gameNotifications` |

Davranış ayrıntıları:

- **Arkadaşlık:** yalnız işlemi yapmayan taraf bildirim alır. İstek iptal, red, kabul, kaldırma veya engelle sonuçlanınca bekleyen "istek geldi" bildirimi kalkar. Red ve engel karşı tarafa bildirilmez. Reddedilip yeniden gönderilen istek tek satırdır.
- **Yorum:** kişi kendi paylaşımına yazdığı yorumdan bildirim almaz. `count` grubun başladığı andan beri görünür yorum sayısı, `actor` son yorumu yazandır. Yorum kaldırılırsa sayı düşer; grupta yorum kalmazsa okunmamış bildirim de kalkar. Bildirim okununca grup kapanır; sonraki yorum yeni bildirim ve yeni push üretir.
- **Sonuç:** gizlenmiş/kaldırılmış paylaşımın kapanışı bildirilmez. Sahibiyle engeli olan veya FRIENDS paylaşımda artık arkadaş olmayan oy verenler bildirim almaz. İptal edilen oylama bildirim üretmez.
- **Oyun:** fotoğraf göndermemiş etkin üye de oylamaya çağrılır (katılan herkes oy verebilir). Oyundan ayrılan üye almaz. Oyun bitince okunmamış "oylama başladı" bildirimi kalkar, yerine sonuç gelir.

## Cihaz kaydı ve push

Mobil, kurulumda bir kez ürettiği UUID'yi (`installationId`) saklar ve push izni alınca kaydeder:

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "ios" }
```

`platform`: `ios` veya `android`. Yanıt `{ installationId, platform, updatedAt }`; anahtar geri dönmez.

- Kayıt, onu yapan oturuma bağlıdır. `POST /auth/logout` o oturumun kaydını, `logout-all` hepsini siler. İptal edilmiş veya süresi dolmuş oturumun cihazına push gönderilmez. Mobil çıkıştan önce ayrıca `DELETE` çağırabilir.
- Aynı telefonda başka hesap giriş yapıp kaydederse kurulum yeni hesaba geçer; eski hesap o cihaza push almaz.
- Yeniden kurulumda aynı anahtar yeni `installationId` ile gelirse eski satır silinir.
- Kişi başına en fazla 10 kurulum tutulur; fazlası en eskiden düşer.

Push gövdesi başlık `Podyum` ve türün genel metnidir. `data` alanı uygulamanın açacağı hedefi taşır: `{ notificationId, type, targetType, targetId }`. Okunmuş, silinmiş veya süresi geçmiş bildirim için push gönderilmez.

| `PUSH_PROVIDER` | Davranış |
| --- | --- |
| `local` (varsayılan) | Hiçbir yere gönderilmez; mesaj `LOCAL_PUSH_DIR` (`.local/push`) altına JSON dosyası olarak yazılır |
| `expo` | Expo Push servisine gerçek istek atılır (`EXPO_PUSH_URL`, isteğe bağlı `EXPO_ACCESS_TOKEN`) |

Expo sağlayıcısında `DeviceNotRegistered` yanıtı veya Expo biçiminde olmayan anahtar cihaz kaydını siler. Servise ulaşılamazsa (ağ hatası, 4xx/5xx) teslim olay kuyruğunda yeniden denenir. Push en az bir kez teslim edilir; teslimden hemen sonra süreç çökerse aynı push ikinci kez gidebilir. Uygulama içi bildirim her durumda tektir.

**Açık kalan entegrasyon:** Expo'nun teslim makbuzu sorgusu (bilet kabul edildikten sonra cihaza ulaşmama bilgisi) bağlı değildir; gerçek Expo hesabı ve cihazla test edilmedi. Sağlayıcı testleri yerel bir sahte HTTP sunucusuna karşı çalışır.

## Olay kuyruğu (outbox)

Modüller bildirim servisini çağırmaz; kendi transaction'larında `OutboxEvent` yazar. `OutboxDispatcher` bu olayları oluşturulma sırasıyla tüketir:

- Uygun olaylar `FOR UPDATE SKIP LOCKED` ile 60 saniyeliğine kiralanır; birden çok işçi aynı olayı almaz.
- Veritabanı işi (bildirim üretme) olayın yayınlandı işaretiyle aynı transaction'dadır; aynı olay ikinci kez uygulanmaz. Ayrıca `(userId, eventId, type)` tekildir.
- Dış teslim (push) transaction dışında yapılır; başarıdan sonra olay yayınlandı sayılır.
- Hata olursa olay 10 sn'den başlayıp 1 saate kadar artan aralıkla yeniden denenir. 12 denemeden sonra otomatik denenmez; `publishedAt` boş kalır ve elle incelenir. Günlüğe yalnız olay türü ve kimliği yazılır.
- Tüketicisi olmayan olay türleri de yayınlandı işaretlenir. 20. adımdaki canlı bağlantı aynı kuyruğa yeni tüketici olarak eklenecek.
- 72 saatten eski olay bildirime dönüşmez; işçi uzun süre kapalı kaldıysa eski haber yağmaz.

Olay yalnız tetikleyicidir. Kime ne yazılacağı her seferinde güncel veritabanı durumundan okunur; geç veya sıra dışı işlenen olay (ör. çoktan geri çekilmiş istek) geçersiz bildirim üretmez.

Yeni bildirim için `notification.created` olayı (aggregate `notification`, payload `notificationId`, `userId`, `type`) yazılır ve push bu olaydan teslim edilir. Yalnız uygulama içi tür (`poll.result.voted`) bu olayı yazmaz.

İşçi API açılışında ve varsayılan 3 saniyede bir çalışır: `OUTBOX_WORKER_ENABLED`, `OUTBOX_INTERVAL_MS` (500–300000). Test ortamında otomatik tarama kapalıdır; testler kuyruğu elle boşaltır. İşçi kapalıyken bildirim oluşmaz, olaylar birikir.

## Veri modeli

- `Notification`: `actorId` (işlemi yapan), `count`, `activityAt` (sıralama) eklendi. `count >= 1` ve aktör alıcının kendisi olamaz (CHECK).
- `DeviceToken`: `installationId` (tekil), `sessionId` (kaydı yapan oturum), `createdAt` eklendi; `platform` yalnız `ios`/`android` (CHECK). Migration, daha önce hiçbir uçtan yazılmamış bu tablonun eski satırlarını siler.
- `UserSettings.gameNotifications` (varsayılan açık) eklendi; `GET/PATCH /me/settings` yanıtında yer alır.

Başka makinede: `npm run db:deploy` ve `npm run db:generate`. Yeni ortam değişkenleri `.env.example` içindedir; hepsi isteğe bağlıdır.

## Doğrulama

`npm run test:notifications`: 13 gerçek HTTP/DB testi. Oturum/DTO; arkadaşlık isteği ve kabul bildirimi, genel push metni ve aynı olayın ikinci kez uygulanmaması; iptal/red/engel ve geç işlenen olay; yorum gruplama, sayı, kaldırma ve okuma sonrası yeni grup; oylama kapanışında sahip/oy veren ayrımı; gerçek lobi akışıyla oyun bildirimleri; tercihler ve çıkış/iptal edilmiş oturum; liste sayfalama, başlık görünürlüğü ve engel; okundu işaretleri; cihaz kaydı kuralları ve DB kısıtları; Expo sağlayıcısı (sahte sunucu): geçersiz cihaz temizliği ve yeniden deneme; kuyruk kuralları; OpenAPI. `npm run test:api` bu dosyayı da çalıştırır.

Yerel PGlite tek bağlantılıdır; iki işçinin aynı kuyruğu paylaşması ve büyük oy veren listesine dağıtım çok bağlantılı PostgreSQL'de ayrıca denenmelidir.

Kod: [OutboxDispatcher](../src/common/outbox/outbox-dispatcher.ts), [bildirim üretimi](../src/modules/notifications/notification-projector.ts), [tür listesi](../src/modules/notifications/notification-catalog.ts), [NotificationsService](../src/modules/notifications/notifications.service.ts), [push teslimi](../src/modules/notifications/push/push-delivery.handler.ts). [HTTP örnekleri](../examples/notifications.http).

## Mobil ekranlarla eşleşme

| Ekran / davranış | Uç |
| --- | --- |
| Bildirim sekmesi listesi | `GET /me/notifications` |
| Sekme rozeti | `GET /me/notifications/unread-count`; uygulama öne gelince ve push alınınca yenile |
| Bildirime dokunma | `PUT /me/notifications/:id/read`, sonra `target` ekranına git |
| "Tümünü okundu yap" | `POST /me/notifications/read-all` |
| Push izni verildi / anahtar değişti | `PUT /me/devices/:installationId` |
| Çıkış | `POST /auth/logout` cihaz kaydını da kaldırır |
| Push'a dokunma | `data.targetType` + `data.targetId` ile hedef ekran |
| Ayarlar: bildirim anahtarları | `PATCH /me/settings` (`pushEnabled`, tür anahtarları, `gameNotifications`) |
