# Teknik kayıt ve dosya bakımı

20 Ekim 2026. Teknik DB bakımı, süresi dolmuş yerel posta/push dosyaları ve mevcut medya temizliği tek bakım sırasına bağlandı. `MaintenanceState` son raporu ve özel tarama imleçlerini saklar. Varsayılan otomatik çalıştırma **yalnız rapordur**, fiziksel silme ayrıca etkinleştirilir. Gerçek tercih/oyun sonuçları bu bakımla silinmez.

## Kullanım

`backend/` içinde:

```bash
npm run maintenance:run
npm run maintenance:run -- --batch-size=50
npm run maintenance:technical
```

İlk iki komut DB → mail → push → medya sırasını raporlar; sonuncu yalnız teknik DB bölümüdür. Rapor aday/silinen/geçersiz/başarısız sayıları taşır; kimlik, dosya adı, fiziksel yol, token veya olay payload'ı taşımaz. Sınır 1–500; `hasMore` tek çalışmanın bütün depoyu taramadığını belirtir. Oturum FK çocukları seçilen oturumlara bağlı olduğundan çocuk sayısı batch sınırını aşabilir.

Gerçek temizlik için açık komut:

```bash
npm run maintenance:run -- --apply --batch-size=100
```

CLI, yerel proje DB hedefini doğrular ve kendi sürecindeki diğer işçileri kapatır. Bir batch çalışır; hata varsa çıkış kodu 1 olur. Bu teslimde mevcut kullanıcı verisinde `--apply` çalıştırılmadı; dosya silme testleri geçici dizinlerde, teknik DB silme testleri rollback ile yapıldı.

## Otomasyon ve izleme

| Ayar | Varsayılan | Anlamı |
| --- | --- | --- |
| `MAINTENANCE_WORKER_ENABLED` | `true` | API açılışında ve aralıklarla çalıştır |
| `MAINTENANCE_APPLY` | `false` | `false` rapor; `true` uygun kayıt/dosyaları sil |
| `MAINTENANCE_INTERVAL_MS` | `3600000` | 1 dakika–24 saat aralığında çalışma sıklığı |
| `MAINTENANCE_BATCH_SIZE` | `100` | Grup başına 1–500 kayıt |

İşçi test ortamında otomatik başlamaz. Aynı süreçte tekrar tick aynı işi bekler; süreçler arası 15 dakikalık kalıcı lease ve faz başı yenileme çakışmayı sınırlar. Süresi geçmiş işçi yeni sahibin raporunu ezemez. Çöküşten sonra lease bitince yeniden denenir. Bir faz hata verirse kalan fazlar yine denenir; geçersiz yerel dosyalar korunur ve `PARTIAL` üretir. Sonraki periyotta yeniden çalışır.

ADMIN `GET /v1/admin/maintenance`: `status`, başlangıç/bitiş, `lastSuccessAt`, `lastFailureAt`, `consecutiveFailures` ve sayısal `report`. Raporun `mode` alanı başarının rapora mı silmeye mi ait olduğunu belirtir. Tarama imleçleri ve lease anahtarı HTTP'ye çıkmaz. Başarısız fazlar redakte log üretir; harici alarm servisi bu teslimde yoktur. Üretim izleme bu uçtaki artan hata sayısını/gecikmiş başarıyı takip edebilir.

## Uygulanan teknik seçimler

| Kayıt | Seçim |
| --- | --- |
| AuthSession | Kendi bitiş/iptal tarihinden 7 gün sonra |
| DeviceToken / UsedRefreshToken | Silinen oturumun FK çocukları olarak aynı transaction'da |
| AuthActionToken / bağımsız UsedRefreshToken | Anahtarın bitişinden 7 gün sonra |
| IdempotencyRecord | İşlem geçerliliğinin bitişinden ayrıca 7 gün sonra; geçerlilik uzamaz |
| OutboxEvent | En az 30 gün önce başarıyla yayımlanmış, etkin lease altında olmayan olay |
| Yerel mail | Yerel VERIFY_EMAIL / RESET_PASSWORD dosyasının kendi `expiresAt` zamanı geçmişse |
| Yerel push | Yerel mesajın `createdAt + ttlSeconds` zamanı geçmişse |
| Medya | Süresi dolan yükleme, takılmış işlem, 24 saati geçmiş kullanılmayan medya ve eski orphan dizinler; bağlı medya korunur |

DB zamanı esas alınır; DB grubunun silmeleri tek transaction'da ve advisory lock ile yapılır. Bekleyen/başarısız outbox işi veya geçerli replay kaydı sırf eski diye silinmez. Dosya taraması yalnız taşıyıcının ürettiği dosya biçimini okur; büyük/bozuk dosya ve sembolik bağlantıya dokunmaz. Silmeden önce dosya kimliği tekrar denetlenir. Yerel dosya ve medya imleçleri, baştaki canlı/bağlı dosyaların arkadaki süresi dolanları sürekli engellemesini önler.

## Ayrı kalan saklama alanları

- Uygulama içi bildirimler bu bakımda toplu silinmez; okunmuş/okunmamış ömrü ayrıca seçilecek.
- Şikâyet ve yönetim audit'i korunur; genel teknik sürelerle silinmez. Audit redaksiyonu ve nihai süre ayrı işletim politikasıdır.
- Yedek oluşturma/silme burada yapılmaz. Yedek ömrü ve geri yükleme testi yayın adımına aittir.
- Hesap silme kendi anonimleştirme/kalıcı temizlik işini yürütür. Tercihler, oyun sonuçları ve puanlar bu teknik temizliğin hedefi değildir.

Süreler geliştirme varsayımıdır. Bulut dosya adaptörü, harici alarm, çok bağlantılı üretim yükü ve nihai saklama süreleri ayrı doğrulanır.

## Kontroller

```bash
npm run test:retention
npm run test:maintenance
```

6 rollback testi teknik DB seçimlerini; 9 bakım testi dosya koruması/silmesi, imleç ilerlemesi, admin erişimi, lease/tekrar, hata sonrası toparlanma, işçi yaşam döngüsü, ortam doğrulama ve bağlı medya korumasını kapsar. Genel API regresyonuna dahildir.
