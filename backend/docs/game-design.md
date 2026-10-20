# Günlük podyum ve QR lobileri — güncel oyun tasarımı

> **20 Ekim güncellemesi:** Günlük 30+30 ve özel `votingSeconds` artık kodda uygulanır. 10 sn yalnız sunum turudur; kartlar toplam süre boyunca döner. Günlük erken kapanmaz, lobi tüm oylar tamamlanınca kapanabilir. ADMIN tema/takvim API'si, mobil oyun ve temel lig vardır. Aşağıdaki 10 Ekim önerileri tarihsel tasarım kaydıdır; güncel çalışan davranış için [oyun rehberi](games-development.md) esastır. Kesin günlük saat, asgari oy ve sezon politikası hâlâ seçilmedi.

10 Ekim 2026, kullanıcının son kapsam değişikliği. **Oyun artık Faz 2'yi beklemiyor; aktif backend planına alındı.** Önceki 10 dakika hazırlık, 3–8 kişi, ortak 20 saniyelik turlar ve zorunlu hızlı eşleşme ilk oyunun temeli değildir. Bu belge tasarım kaynağıdır.

**Uygulama durumu:** Günlük etkinlik ve özel QR lobisi API'si çalışır; uçlar, sınırlar ve kalanlar [oyun rehberinde](games-development.md). Aşağıdaki "öneri" ve "planlanan" ifadeleri tasarım anındaki halidir; uygulanan davranış için rehber esastır. [Yetkili Socket.IO aboneliği](game-realtime-development.md) çalışır; dağıtık fan-out, ödül/lig ve mobil ekran henüz yoktur.

**Uygulamadan önce verilen kullanıcı kararları (10 Ekim):**

- Değerlendirme yalnız 1–5 yıldızdır; "temaya uygun mu?" alanı kullanılmaz.
- Etkinliğe katılan ama fotoğraf göndermeyen üyeler de oy verebilir; etkinlik dışından kimse oy veremez.
- Özel lobiye geçerli QR daveti ve giriş yeterlidir; lobi sahibiyle arkadaşlık aranmaz.
- Günlük başlangıç saati ayarlanabilir bırakıldı; saat belirlenene kadar sunucu kendiliğinden etkinlik başlatmaz.

## Kullanıcının belirlediği iki mod

| Konu | Genel günlük etkinlik | Özel / arkadaş lobisi |
| --- | --- | --- |
| Oluşturma | Sunucu, belirlenen günlük takvime göre | Lobi sahibi |
| Başlangıç | Günün belirli saati; saat henüz seçilmedi | Sahibi lobiyi başlatır |
| Fotoğraf penceresi | 30 dakika | Lobi kurulurken seçilen süre |
| Oylamaya geçiş | Fotoğraf penceresi bitince otomatik | Fotoğraf süresi dolunca veya sahibi erken bitirince |
| Oylama penceresi | 30 dakika | Ayrı ayarlanabilir süre; öneri: zorunlu son süre |
| Katılım | Genel etkinlik katılım kuralları | QR ile paylaşılan davet üzerinden |

**Ek kullanıcı kararı:** Genel etkinlikte yalnız o etkinliğe katılanlar oy verebilir; dışarıdan uygulamayı gezen kullanıcılar değerlendirme yapamaz. Etkinlik üyeliği backend'de doğrulanır, istemcinin katıldım beyanı yetki sayılmaz.

Örnek yalnız zaman ilişkisini anlatır: seçilen başlangıç T ise fotoğraf [T, T+30dk), oylama [T+30dk, T+60dk). Saat uydurulmaz. Takvim saat dilimiyle tanımlanır; ilk aday Europe/Istanbul, kalıcı zamanlar UTC'dir. Tema ve takvim sürümü etkinlik oluşturulurken dondurulur. Günlük aynı etkinlik ikinci kez oluşturulmaz.

## Uygulama önerileri — değiştirilebilir, henüz onaylı değil

- Genel oylama yalnız etkinlik katılımcılarına açıktır (onaylı). Oy hakkı için ayrıca geçerli fotoğraf teslimi gerekip gerekmediği netleştirilecek; üyelik olmadan oy her durumda reddedilir. Kendi fotoğrafına oy verilmez. Özel lobide başlangıç kadrosu oy verir; yeni katılım fotoğraf aşamasının bitişinde kapanır.
- Kullanıcı başına tek fotoğraf teslimi; fotoğraf penceresinde kendi teslimi değiştirilebilir. Son kabul edilen READY ve önizlemesi onaylı kendi görseli geçerlidir. Yalnız yükleme izni veya bitmemiş dosya teslim sayılmaz. Ayrı GAME medya amacı ve oyun erişim kuralları eklenmeden POLL görselleri rastgele oyunda kullanılmaz.
- Süre bittiğinde yeni/yenilenen teslim kapalıdır. Lobi sahibinin erken bitirmesi de aynı atomik geçiştir; süreyi veya teslimleri sonradan değiştiremez. İlk öneri yalnız hazır/onaylı teslimleri dondurmak; işleme için gizli ek 30 saniye yaratmamak.
- Önceki 1–5 yıldız + temaya uygunluk değerlendirmesi aday olarak korunur; yeni akışta otomatik kesin karar sayılmaz. Kişi/teslim başına bir değerlendirme; tekrar aynıysa aynı kabul, değiştirme ilk öneride kapalıdır. Genel değerlendirme ile normal A/B tercih oyu ayrı tablolardır.
- Oylama sırasında anonim teslim kartları sayfalı gösterilir; bütün kullanıcılar tek bir ortak 20 saniyelik turu beklemez. Sunucu dengeli gösterim/oy dağıtımını ve aynı kartın tekrarlarını yönetir. Fotoğraf tanınabilir; tam anonimlik iddiası yoktur.
- Özel davet QR'ı uygulama/deep-link açar; QR üretimi frontend, güvenilir davet üretme/çözümleme backend işidir. Kriptografik rastgele davet token'ı DB'de hash'lenir, son süre/iptal/yenileme ve kapasite denetlenir. QR kişiyi otomatik giriş yapmış veya kabul edilmiş üye yapmaz; giriş ve join komutu gerekir. Ham token log/outbox'a yazılmaz.
- “Arkadaş lobisi” özel davetli oda anlamındadır. QR ile gelenlerin önceden host ile arkadaş olmasının zorunlu olup olmadığı açık karardır; eski zorunlu arkadaşlık kuralı yeni davet tasarımına sessizce taşınmaz. Öneri: geçerli davet + giriş + kapasite/engel denetimi; gerekirse host onayı ayrı seçilebilir.
- Katılımcılar, tema, teslim ve oylama süreleri başlarken sabitlenir. Süresiz oda açmamak için süreler zorunlu/alt-üst sınırlı olur; izin verilen aralıklar henüz seçilmedi. Host yalnız fotoğraf aşamasını erken bitirebilir; oylamayı keyfî erken kapatma hakkı bu istekle verilmedi.
- Oylama kesin son süreyle kapanır. Host bağlantısı kopsa bile sunucu ilerler; başladıktan sonra host ayrılması süreyi durdurmaz. Başlangıçtan önce host ayrılması ve aktif engel/moderasyon davranışı ayrıca belirlenir.
- Genel etkinlik için eski 8 kişi sınırı kullanılmaz. Genel ve özel kapasite ayrı seçilir. En az iki geçerli teslim önerilir; altında gerekçeli iptal. Genel etkinlik ile özel lobide eşzamanlı katılım/tek aktif üyelik kararı ayrıca seçilecek.
- Sonuçta alınan oy sayısı, yıldız toplamı/ortalaması ve varsa temaya uygunluk gösterilir. Hiç oy ve eşitlik açıkça ele alınır. Yetersiz örneklemle kazanan ilan edilmez; genel etkinlikte dengeli gösterim ve minimum oy eşiği belirlenmeden resmî ödül açılmaz. Eksik oy sıfır yıldız sayılmaz.
- İlk oyun sonucu profil puanı üretmez. Ödül formülü, genel/özel ödül uygunluğu, lig ve sponsor envanteri ayrı kararlar olarak kalır; oyunun çalışmasını bunları bekleterek ertelemeyiz.

## Durum ve zamanlama

```text
SCHEDULED / WAITING → SUBMISSION_OPEN → VOTING_OPEN → FINALIZING → COMPLETED
                                aktif aşamalar → CANCELLED
```

Genel etkinlik önceden SCHEDULED; özel lobi WAITING başlar. submissionEndsAt ve votingEndsAt ayrı kalıcı alanlardır. Özel lobide erken geçişin kabul edildiği DB saati oylamanın başlangıcı olur; seçilen votingDurationSeconds kadar sürer. İki kez geçiş süreyi yeniden başlatmaz. Genel takvim sabittir; işçi geç başlarsa kullanıcıya fazladan teslim/oy süresi tanınmaz. Oylama penceresi tamamen kaçmışsa geçmişe oy toplanmaz; sonuç/iptal toparlanma politikası uygulanır.

Oda/etkinlik satırı kilidi, expectedVersion ve kalıcı işlem anahtarı geçişleri tekilleştirir. Her teslim/değerlendirme komutu kilit sonrası DB saatini ve gerçek aşamayı doğrular. Socket yalnız değişiklik bildirir; doğru state REST/DB'den okunur. Sunucu yeniden başlayınca tarayıcı kaçan geçişleri DB'den toparlar. Her iki modda da yetkili fotoğraf erişimi ve sonuç öncesi kimlik gizliliği sağlanır.

## Veri ve API işleri — kodlandığında migration gerekir

Günlük ölçek ve özel lobi aynı kavram değildir: DailyGameEvent/Entry/Rating ile GameLobby/Membership/Invite/Entry/Rating alanları ayrı tasarlanacak veya ortak çekirdeğin iki açık türü olarak modellenir. Eski GameRoom/GameRound/ActiveGameMembership tabloları yeni davranışı tek başına karşılamaz. Oyuncu sayısı, tur şeması ve tek aktif oyun kısıtı gözden geçirilmeden şema API'ye zorlanmaz; oyun adımında ayrı migration ile dönüştürülür, bugün eski veri resetlenmez.

Planlanan uçlar: günlük etkinlik/güncel durum, fotoğraf teslimi, sayfalı oy adayları, değerlendirme ve sonuç; özel lobi oluştur/düzenle/başlat, QR daveti üret/yenile/iptal, davetle katıl/ayrıl, fotoğraf aşamasını bitir, state ve geçmiş. Bunlar henüz OpenAPI'de çalışan uç değildir. Eski matchmaking/readiness/per-round uçları zorunlu ilk kapsam değildir.

## Teslim sırası

1. Normal kombin tercih/sonuç ve ana akışını tamamla (9–10).
2. Günlük etkinlik ve özel QR lobisi şemasını/sözleşmesini netleştir (aktif 19. adım).
3. Takvim/oda/QR/katılım → hazır fotoğraf teslimi → faz geçişleri → süreli değerlendirme/sonuç.
4. İşçi toparlanması, yetkili state/medya, canlı bildirim ve yeniden bağlanma (20).
5. Sosyal etkileşim/bildirim ve arkadaşın katalog/trend/gelir koluyla entegrasyon; oyun dahil doğrulama/frontend teslimi (17–18).

Hızlı eşleşme, profil ödülü/lig ve haftalık/sponsorlu yarışma (21–23) sonraki genişleme adaylarıdır; bu güncellemeyle tamamlanmış veya tümü zorunlu ilk oyun kapsamı sayılmaz. Güncel görev paylaşımı: biz backend, arkadaş mobile tema; önceki catalog/trends/billing/ads paylaşımı işe dönüşte yeniden netleştirilecek.

## Açık ürün kararları

**Seçildi:** değerlendirme yöntemi (yalnız yıldız), fotoğrafsız üyenin oy hakkı (var), özel QR'da arkadaşlık (aranmaz). **Geliştirme varsayımıyla uygulandı, değiştirilebilir:** lobi süre sınırları/kapasite, katılım bitişi, host ayrılması, engel davranışı; ayrıntı [rehberde](games-development.md).

**Hâlâ açık:** günlük kesin saat/saat dilimi, nihai minimum oy/beraberlik ve sezon politikası, büyük katılım/yük kabulü. Tema/takvim yönetimi, moderasyonla iptal ve tek aktif üyelik uygulanmıştır.

Tasarım anındaki tam liste: Günlük kesin saat/saat dilimi, katılımcının oy hakkı için geçerli fotoğraf gerekip gerekmediği, tema yönetimi, özel QR'da arkadaşlık/host onayı, lobi süre sınırları/kapasite, başlangıç/katılım bitişi, değerlendirme yöntemi, dengeli gösterim/minimum oy, moderasyon/engel, host ayrılması ve oyunlar arası eşzamanlı üyelik. Genel etkinlikte katılımcı olmayanlara oy kapalıdır; bu karar kesinleşti. Diğer kararlar saat veya hak uydurmadan ilgili uygulama adımında seçilecek.
