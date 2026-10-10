# Ana akış API'si

10 Ekim 2026. Yol haritası 10: `GET /v1/feed` çalışır. `feed` modülü yalnız organik paylaşımları listeler. Reklam, kişiselleştirme ve mobil bağlantısı henüz uygulanmadı. Şema/migration değişikliği yoktur.

## İstek ve yanıt

Bearer oturumu zorunludur. Query alanları:

| Alan | Kabul edilen değer |
| --- | --- |
| scope | `everyone` (varsayılan), `friends`; küçük harf |
| category | `OUTFIT`, `SHOES`, `BAG`, `JEWELRY`, `ACCESSORY`, `TATTOO`; tümü için gönderilmez |
| limit | 1–50; varsayılan 20 |
| cursor | Önceki yanıttaki opaque `nextCursor`; ilk sayfada gönderilmez |

Yanıt `{ items, serverNow, nextCursor }` biçimindedir. Boş sonuç hata değildir: `items: []`, `nextCursor: null`. Bilinmeyen alanlar, geçersiz enum/limit ve bozuk/boş cursor 400 alır. Cursor başka kullanıcı, sekme, kategori veya liste kaynağına taşınırsa `INVALID_CURSOR` döner. Limit sonraki sayfada değiştirilebilir.

Her kart mevcut [oylama detay sözleşmesini](polls-development.md) kullanır: yazarın kamusal özeti, soru, kategori, kullanım amacı, yorum izni, görünürlük, sürüm/zamanlar, 2–4 seçenek, işlemden geçmiş fotoğraf yolları ve USER_ENTERED ürün etiketleri. `myOptionId`, `canVote`, `canViewResults`, `remainingSeconds` ve `serverNow` aynı sunum fonksiyonuyla üretilir; istemci ayrı oy uygunluğu hesabı yapmaz.

Ek kart alanları:

- `totalVotes`: oylamanın toplam tercih sayısı. Seçenek sayıları/yüzdeleri ve kazananlar oy öncesinde döndürülmez.
- `commentCount`: görünür yorumlar; askıda/silinmiş ve izleyiciyle iki yönlü engeli olan yazarların yorumları sayılmaz. Yorum ekleme/liste API'si sonraki adımdadır.
- `isSaved`: yalnız izleyicinin mevcut kişisel kayıt durumu. Kaydet/kaldır uçları sonraki adımdadır; bu alan bir kaydetme komutu değildir.

Fotoğraf/avatar yolları Bearer isteyen `/v1/media/.../content` uçlarıdır; depolama anahtarı veya herkese açık dosya linki dönmez. Mobil bu dosyaları oturumla istemelidir. Tüm JSON yanıtları ortak `no-store` politikasını kullanır. Sonuç yetkisi [tercih/sonuç API'sinde](poll-votes-development.md) yeniden kontrol edilir.

## Akış kuralları

- Herkes sekmesi: erişilebilen PUBLIC yayınlar ve kabul edilmiş arkadaşların FRIENDS yayınları.
- Arkadaşlar sekmesi: ayrıca yazarın kabul edilmiş arkadaş olması gerekir; arkadaşın PUBLIC ve FRIENDS yayınları birlikte görünür.
- Kişinin kendi paylaşımları ve daha önce oy verdiği oylamalar akışta gösterilmez. Kendi liste `/me/polls`; tercih sonrası detay ve sonuç uçları kullanılmaya devam eder.
- Yalnız `contentStatus=VISIBLE`, aktif/engelsiz yazarlı, `status=OPEN`, son süresi sunucunun şimdiki zamanından ileride ve yayın zamanı gelmiş oylamalar adaydır. Taslak, iptal, kapalı, gizli, kaldırılmış veya süresi dolmuş içerik akışa girmez. Kapanış işçisinin kalıcı durumu güncellemesi beklenmez.
- Gelişmiş kitle hedeflemesi henüz açık değildir. ANY dışı cinsiyet, yaş hedefi veya stil eşleşmesi isteyen eski/deneme kayıtları oy verilebilir adaymış gibi sunulmaz; yayın/oy API'lerinin mevcut kuralıyla uyumludur.
- Bekleyen/reddedilen arkadaşlık yetki sağlamaz. Arkadaşlıktan çıkarma veya engelleme sonraki sayfa isteğinde yeniden değerlendirilir. Cursor eski yetkiyi korumaz; detay/görsel uçları da güncel erişimi denetler.
- Normal tercih profil puanı veya çoğunluğu tahmin ödülü üretmez.

## Sıralama ve mobil geçişi

İlk sıra `publishedAt DESC, id DESC` biçimindedir. UUID eşit yayın zamanında kararlı ikinci anahtardır. Offset veya cursor kaydının hâlâ görünür olmasına bağımlılık yoktur. Yeni yayınlar yenilemede başa gelir; eldeki cursor'la devam eden sayfalara eklenmez. Her sayfa bir RepeatableRead transaction'ında aynı DB zamanıyla okunur; tüm oturumu donduran snapshot değildir. Süre/oy/ilişki/içerik değişiklikleri sonraki istekte kartları azaltabilir.

Ortak cursor zarfındaki teknik `createdAt` alanı bu kaynakta `publishedAt` sıralama değerini taşır. Mobil cursor'ı çözmez veya üretmez; gelen değeri aynen geri gönderir.

`Geç` kalıcı API komutu değildir. Mobil eldeki karttan sonrakine ilerler; kartlar tükenince `nextCursor` ile yeni sayfa alır. `nextCursor=null` ise boş akış ekranına geçer. Sekme/kategori değişince liste/cursor sıfırlanır. Yenilemede cursor gönderilmez; geçilen kart tekrar görülebilir. Oy sonrası istemci kartı kaldırıp mevcut tercih makbuzuyla detay/sonuç ekranına geçebilir. Beklerken süre dolması veya erişim değişmesi nedeniyle oy 409/404 alırsa kartı kaldırıp akışı yeniler; önce alınmış `canVote` sonraki komutu garanti etmez.

## Doğrulama

`npm run test:feed`: 15 gerçek HTTP/DB testi. Oturum ve DTO, PUBLIC/FRIENDS, arkadaşlık yönleri/bekleyen/red/kaldırma, iki yönlü engel, görünürlük ve hesap durumu, oy sonrası çıkarma, desteklenmeyen hedefler, boş filtre, eşit zamanlı cursor/yeni yayın/sınır kaydı değişikliği, cursor bağlamı, kart/detay eşitliği, özel veri/sonuç ayrımı, yorum sayacı, süre dolması ve Swagger kontrol edilir.

`npm run test:polls` ayrıca gerçek fotoğraf yükleme/işleme/onay → özel yayın → arkadaş kabulü → akış/görsel → tercih → sonuç zincirini doğrular. `npm run test:api` ikisini de kapsar. Testler kendi benzersiz hesap ve kayıtlarını temizler, demo verisini değiştirmez. Çok bağlantılı PostgreSQL yarış/yük testi bu yerel tek bağlantılı PGlite kontrollerinin yerine geçmez; ayrıca yapılacak.

Kod: [FeedService](../src/modules/feed/feed.service.ts), [kart sunumu](../src/modules/polls/poll-read-model.ts). [HTTP örnekleri](../examples/feed.http). Bu teslimde `mobile/` değişmedi; ekran hâlâ demo veri kullanır.
