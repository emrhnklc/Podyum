# Yönetim ve şikâyet inceleme — yerel teslim

16. adımın ilk bölümü çalışır: ortak ADMIN yetkisi, şikâyet kuyruğu/karar, paylaşım gizleme/geri açma, yorum kaldırma, hesap askıya alma/geri açma, oyun iptali ve gerekçeli denetim kaydı. Yönetim paneli mobilde yapılmadı. Hesap silme/kalıcı yerel temizliği sonraki [AccountsModule tesliminde](accounts-development.md) eklendi; genel saklama işleri hâlâ açıktır.

## Kurulum ve yetki

Backend klasöründe `npm ci`, `npm run db:deploy`, `npm run db:generate` çalıştırılır. 15. migration User.role, inceleme metadatası ve ModerationAudit ekler; 16. migration eksik karar gerekçesini DB seviyesinde reddeder. Eski migration'lar değiştirilmez, DB resetlenmez. Varsayılan rol USER; seed veya kayıt hiçbir hesabı otomatik yönetici yapmaz.

İlk yönetici için mevcut aktif hesabın UUID'siyle, yalnız güvenilen yerel terminalden:

```bash
npm run admin:grant -- <user-uuid> "Yerel geliştirme yönetici ataması"
```

Araç yerel proje DB sahipliğini doğrular, production modunda çalışmaz. Rol, ROLE_GRANTED denetimi ve iç outbox olayı aynı transaction'dadır; CLI işleminde actorId null ve after.source LOCAL_CLI olur. Zaten ADMIN hesabı tekrar atamak yeni audit yazmaz. Rol atama/geri alma HTTP API'si yoktur; bu araç üretim yönetici tedarik sistemi değildir.

Tüm `/v1/admin/*` yolları aktif Bearer oturumu ve DB'den güncel ADMIN rolü ister. Profil/kayıt DTO'su role alanını kabul etmez. Yetki guard'da, serviste ve mutasyonun kullanıcı kilitleri alındıktan sonra yeniden denetlenir. Rolü alınan kişi eski başarılı makbuzunu da admin API'sinden okuyamaz. Başka modüller AuthModule'ün export ettiği AdminGuard ve AdminAccessService'i kullanır; ayrı bir yönetici token'ı oluşturmaz.

## Uçlar

Aşağıdaki yollar `/v1` önekiyle kullanılır. GET dışındaki tüm uçlar `Idempotency-Key` ve kırpıldıktan sonra 3–500 karakter `reason` ister. Başarılı yanıtlar 200'dür. Örnekler: [moderation.http](../examples/moderation.http).

| Metot | Yol | Girdi / yanıt |
| --- | --- | --- |
| GET | `/admin/me` | userId, role=ADMIN |
| GET | `/admin/reports` | status (varsayılan OPEN), targetType, limit (1–50), cursor; items/serverNow/nextCursor |
| GET | `/admin/reports/:id` | Özet, note, reviewedAt, reviewedBy, decisionNote, reporter, hedef içerik |
| GET | `/admin/reports/:id/media/:mediaId/content` | variant=display veya thumbnail; yetkili WebP, no-store |
| PUT | `/admin/reports/:id/decision` | expectedVersion, reason, decision; karar ve yaptırım atomik |
| PUT | `/admin/polls/:id/visibility` | expectedVersion, reason, contentStatus=HIDDEN veya VISIBLE |
| POST | `/admin/comments/:id/remove` | reason |
| PUT | `/admin/users/:id/status` | reason, status=SUSPENDED veya ACTIVE |
| POST | `/admin/games/:id/cancel` | expectedVersion, reason |
| GET | `/admin/audit` | resourceType/resourceId, limit/cursor; items/serverNow/nextCursor |

Karar seçenekleri:

| decision | Uygun hedef | Etki |
| --- | --- | --- |
| DISMISS | Tümü | Şikâyeti DISMISSED kapat; içerik değişmez |
| NO_ACTION | Tümü | İncelendi, ek yaptırım yok; RESOLVED kapat |
| HIDE_POLL | POLL | Paylaşımı HIDDEN yap, RESOLVED kapat |
| REMOVE_COMMENT | COMMENT | Yorumu REMOVED yap, RESOLVED kapat |
| SUSPEND_USER | USER | Hesabı SUSPENDED yap, RESOLVED kapat |

Şikâyet kararı için `expectedVersion` Report sürümüdür. OPEN kayıt satır kilidiyle tek kez kapanır ve version artar. Uygunsuz hedef/karar `400 REPORT_ACTION_MISMATCH`; eski sürüm `409 VERSION_CONFLICT`; aynı güncel kapalı kayda yeni karar `409 REPORT_ALREADY_REVIEWED` verir. Kullanıcının POST /reports işlemi yalnız kayıt açar; otomatik yaptırım uygulamaz.

Komut makbuzu `{auditId, resourceType, resourceId, appliedAt}`; şikâyet kararında ayrıca `{status, version}`. Aynı anahtar/gövde ilk makbuzu döndürür; farklı gövde `409 IDEMPOTENCY_KEY_REUSED`. Makbuz güncel GET yerine geçmez. Yeni anahtarlı aynı durum komutu gerekçeli yeni audit yazabilir; gereksiz domain sürümü/olayı üretmez. Yorumun önceki kaldıran/tarih bilgisi korunur.

## İnceleme ve gizlilik

Şikâyet kuyruğunda not ve şikâyetçi yoktur; detayda yalnız yöneticiye açılır. Yönetici, şikâyetin FRIENDS/HIDDEN hedefini arkadaşlık gerekmeksizin inceleyebilir. Kullanıcı özetleri yalnız id/username/displayName/status içerir; e-posta, UserPrivate demografisi, token ve medya depolama anahtarı verilmez. Hedef türüne göre target poll/comment/user nesnesidir; yanıt şemaları OpenAPI'de tanımlıdır.

Görsel incelemesi yalnız şikâyet hedefinin mevcut görseline bağlıdır: paylaşım seçenekleri, yorumun paylaşım seçenekleri veya kullanıcı şikâyetindeki mevcut avatar. READY ve kullanıcı tarafından onaylanmış işlenmiş display/thumbnail açılır. Original, bağlantısız medya ve onaysız çıktı açılmaz. Bu genel yönetici medya tarama API'si değildir. Daha önce indirilen dosyalar uzaktan geri alınamaz.

Cursor createdAt/id ile en yeniden eskiye ilerler; yönetici ve filtre bağlamına bağlıdır. Başka filtreye/kullanıcıya cursor taşımak `400 INVALID_CURSOR` verir. Liste için sunucunun serverNow alanı kullanılır; hassas detaylar istemci/log cache'ine yazılmamalıdır.

## Yaptırımların davranışı

Paylaşım HIDDEN olduğunda ortak sosyal erişim sorguları akış, başkasının profil paylaşımı, detay/sonuç, kaydedilenler ve diğer kullanıcılara medya erişiminden çıkarır. Sahibinin yönetim/kendi medya erişimi ayrı kurallara tabidir. VISIBLE geri açma PUBLIC/FRIENDS görünürlüğünü, yayın süresini veya eski oyları değiştirmez. REMOVED içerik bu uçtan geri getirilemez; `409 CONTENT_REMOVED`. Doğrudan görünürlük komutunda Poll.version gerekir.

Yorum kaldırma mevcut içerik filtresine bağlanır; yorum metni audit/outbox'a kopyalanmaz. `poll.comment.removed` mevcut bildirim tüketicisinin gruplu yorum sayacını güncellemesini sağlar. Yorum geri açma/düzenleme API'si yoktur.

Hesap askıya alma tüm mevcut oturumları iptal eder ve cihaz kayıtlarını siler. Aktif kullanıcı koşulunu kullanan profil/içerik/medya erişimleri kapanır. Socket kullanıcı durum olayında, ayrıca periyodik yetki kontrolünde oturumu yeniden denetler. Oyun bildirimleri güncel üyelik/host durumu/engel görünürlüğünü kullanır; kaynağa erişim yoksa tema başlığı null olur. Daha önce sağlayıcıya gönderilmiş push geri alınamaz. SUSPENDED hesabı ACTIVE yapmak eski oturum veya cihazı canlandırmaz; yeniden giriş gerekir. Bu işlem kişisel veri silme değildir; geçmiş oylar silinmez. Kendine veya başka ADMIN hesaba yaptırım `409 PROTECTED_ADMIN`; DELETED hesabı geri açma `409 ACCOUNT_DELETED`.

Hesap durumu komutunda expectedVersion yoktur: kullanıcı kilidiyle sıraya giren son başarılı istek hedef durumu belirler. Her karar auditte görünür. Yayın/oyun/şikâyet komutlarında kaynak sürümü ayrıca zorunludur. Bu politika çok yöneticili panelde beklenen-durum kontrolüyle genişletilebilir.

Oyun iptali GameLifecycleService'i kullanır; önce DB saatine göre geçişleri uygular, sonra sürümü denetler. COMPLETED/CANCELLED oyuna yeni iptal `409 GAME_FINISHED`; süre nedeniyle sürüm değiştiyse önce VERSION_CONFLICT döner ve yeniden GET gerekir. İptal nedeni MODERATION, davet hash'i/süresi null olur; game.cancelled mevcut canlı bağlantı ve bildirim hattına gider. Host askıya alma bütün oyunlarını otomatik iptal etmez; iptal ayrı yönetici kararıdır. Zamanlayıcı ve uygunluk filtreleri sürer. Oyuncuyu tek oyundan atma ve ödül düzeltmesi bu teslimde yoktur.

## Denetim ve olaylar

ModerationAudit: actorId/action/resourceType/resourceId/reportId/reason/before/after/createdAt. before/after yalnız durum/sürüm/karar gibi işlem bilgisidir; içerik veya özel profil kopyası değildir. Yönetim API'sinde audit güncelleme/silme yoktur; DB sahibine karşı değişmez kayıt garantisi sunulmaz. Gerekçeye kişisel bilgi veya token yazılmaz.

Şikâyet kararı, yaptırım, audit, başarılı makbuz ve outbox aynı transaction'dadır; herhangi biri başarısızsa tamamı geri alınır. Kaynak satırı önce, sonra kullanıcı UUID sıralı kilitleri alınır. Yetki ve kilit yarışlarının çok bağlantılı PostgreSQL doğrulaması 17. adımda kalır; yerel PGlite tek bağlantı testi bunun yerine geçmez.

İç `moderation.action.applied` olayı yalnız schemaVersion/auditId/action/resourceType/resourceId taşır; gerekçe, not veya ham içerik taşımaz. Yeni `user.status.changed` aggregate=user-status, aggregateVersion=socialRevision; payload `{schemaVersion:1,userId,status,revision}`. Mevcut canlı oyun tüketicisi erişimi denetler. İleride trend tüketicisi kullanıcı durumu katkılarını yeniden değerlendirmelidir; trend modülü yazılmış sayılmaz. Paylaşım/yorum/oyun yaptırımları kendi mevcut domain olaylarını da üretir. Audit olayı otomatik kullanıcı push'u üretmez.

## Doğrulama ve sonraki teslim

`npm run test:moderation` 17 gerçek HTTP/DB/Socket senaryosu çalıştırır: rol yükseltme engeli, yerel atama, DTO/anahtar, cursor, özel şikâyet/görsel, karar tekrarı, içerik erişimi, eşzamanlı iki karar, oturum/cihaz/socket kesilmesi, oyun iptali/süre/sürüm, korunan hesaplar, audit, outbox hata enjeksiyonu ile rollback ve DB CHECK/OpenAPI. `npm run test:api` mevcut modüllerle regresyonu birlikte denetler. Testler yalnız kendi hesap/kayıt/dosyalarını temizler; demo verileri korunur.

Hesap silme, kimlik/özel veri/analiz snapshot'ı ve yerel medya temizliği [ayrı hesap tesliminde](accounts-development.md) çalışır; geçmiş toplamlar korunur. Sıradaki 16. adım işi genel saklama/süreli temizleme ve yedek/redaksiyon davranışıdır. Kategori/stil, katalog, abonelik ve reklam yönetimi bu modüller yazıldığında ortak admin yetkisine bağlanır. Gerçek yönetici tedariki ve yönetim paneli ayrıca tamamlanır.
