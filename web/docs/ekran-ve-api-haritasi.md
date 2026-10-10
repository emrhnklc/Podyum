# Podyum frontend: ekran ve API haritası

10 Ekim 2026. Bu belge backend tarafına (ve backend'de çalışan yapay zekâ asistanına) frontend'in hangi ekranlardan oluştuğunu, her tuşun nereye gittiğini ve hangi backend çağrısına karşılık geldiğini anlatır. Backend tarafındaki karşılıklar `docs/api-contract.md` taslağına göre yazıldı; yollar `/v1` önekiyle okunmalı.

## 1. Durum

- Frontend `web/` klasöründe, Next.js 16 (App Router) + TypeScript. Tasarım dili: beyaz zemin, kırmızı `#D00A26`, pastel medya alanları, Hanken Grotesk.
- **Henüz hiçbir backend çağrısı yapılmıyor.** Bütün ekranlar `web/lib/demo.ts` içindeki demo verisinden besleniyor. Demo verisinin alan adları ve enum değerleri (`OUTFIT`, `SHOES`, `WOMEN`, `priceMinor` …) Prisma şemasına yakın tutuldu.
- Giriş/kayıt ekranı yok; demo, `elifyz` kullanıcısı giriş yapmış gibi davranır.
- Çalıştırma: `cd web && npm install && npm run dev`. Next varsayılan olarak 3000 portunu kullanır; backend de 3000'de açılıyor. İkisi aynı makinede çalışacaksa backend `PORT=3100 npm start` ile açılmalı.

## 2. Ekranlar ve rotalar

| Rota | Ekran | Frontend durumu |
| --- | --- | --- |
| `/` | Keşfet: tek tek oylama kartları | Çalışıyor (demo verisi) |
| `/trendler` | Trendler: en çok seçilen ürünler, filtreli | Çalışıyor (demo verisi) |
| `/u/[username]` | Kullanıcı profili; kendi profilin `/u/elifyz` | Çalışıyor (demo verisi) |
| `/paylas` | Yeni oylama oluşturma | Yer tutucu; tasarımı hazır |
| `/bildirimler` | Bildirim listesi | Yer tutucu |
| `/oylama/[id]` | Oy sonucu detayı: yüzdeler, ürünler, yorumlar | Henüz yok; tasarımı hazır |
| (yok) | Giriş, kayıt, profil kurulumu | Henüz yok; tasarımı da yok |
| (yok) | Modlar, Canlı Podyum (hazırlık, tur, sonuç) | Tasarımı hazır; Faz 2'ye ertelendiği için uygulamaya alınmadı |

Alt menü her sekme ekranında sabit: **Keşfet · Trendler · Paylaş (+) · Bildirim · Profil**. Modlar sekmesi Faz 2 kararı nedeniyle menüden çıkarıldı, yerini Trendler aldı.

## 3. Tuş haritası

"Backend" sütunundaki durumlar: **çalışıyor** = repoda uygulanmış, **taslak** = `api-contract.md` içinde var ama uygulanmamış, **yok** = sözleşmede hiç yok (bkz. §5).

### 3.1 Alt menü

| Tuş | Gittiği yer | Backend |
| --- | --- | --- |
| Keşfet | `/` | `GET /feed` (taslak) |
| Trendler | `/trendler` | Trend API'si (yok) |
| Paylaş (+) | `/paylas` | (ekran açılışında çağrı yok) |
| Bildirim | `/bildirimler` | `GET /me/notifications` (taslak) |
| Bildirim üstündeki sayı | (rozet) | Okunmamış bildirim sayısı (yok) |
| Profil | `/u/{kendi kullanıcı adın}` | `GET /me` (çalışıyor) |

### 3.2 Keşfet (`/`)

| Tuş / eylem | Gittiği yer | Backend | Bugün ne yapıyor |
| --- | --- | --- | --- |
| Ekran açılışı | (aynı ekran) | `GET /feed?scope=everyone` (taslak) | Demo listesinden kullanıcının kendi paylaşımları çıkarılıp gösterilir |
| "Herkes" / "Arkadaşlar" | (aynı ekran, liste değişir) | `GET /feed?scope=everyone\|friends` (taslak) | Henüz işlevsiz |
| "Tüm kategoriler" | Kategori seçimi açılır | `GET /feed?category=OUTFIT…` (taslak) | Henüz işlevsiz |
| Kombin fotoğrafına/videosuna dokunma (A ya da B) | Aynı kartta sonuç açılır | `PUT /polls/:id/vote` gövde `{ optionId }`, ardından `GET /polls/:id/results` (taslak) | Demo yüzdeleri gösterilir |
| "Sıradaki oylama" | Sonraki kart | (çağrı yok; liste bitince `nextCursor` ile sonraki sayfa) | Demo listesinde sıradakine geçer |
| "Geç" | Sonraki kart | (çağrı yok; sözleşmeye göre oturum içi davranış) | Sıradakine geçer |
| "Kaydet" | (aynı kart) | `PUT /polls/:id/save`, tekrar basınca `DELETE` (taslak) | Henüz işlevsiz |
| Yorum sayısı | `/oylama/[id]` yorum bölümü | `GET /polls/:id/comments` (taslak) | Henüz işlevsiz |
| "Detaylar" | `/oylama/[id]` | `GET /polls/:id`, `GET /polls/:id/results` (taslak) | Henüz işlevsiz |
| Yazarın adı / avatarı | `/u/[username]` | `GET /users/:id` (çalışıyor) | Demo profiline gider |
| "Senin oylaman · 12 oy" şeridi | `/oylama/[id]` (kendi açık oylaman) | Kendi açık oylamanın özeti (yok) | Henüz işlevsiz |
| Üstteki yıldız sayısı | (yalnızca gösterim) | `GET /me` → `counts.stars` (çalışıyor) | Demo sayısı |

### 3.3 Trendler (`/trendler`)

| Tuş / eylem | Gittiği yer | Backend | Bugün ne yapıyor |
| --- | --- | --- | --- |
| Ekran açılışı | (aynı ekran) | Trend listesi (yok, öneri §5.1) | Demo ürün listesi |
| "Bu hafta" / "Bu ay" | (liste değişir) | `period=WEEK\|MONTH` | Demo verisinde çalışıyor |
| Kategori çipleri | (liste değişir) | `category=SHOES…` | Demo verisinde çalışıyor |
| "Tercih yapanlar": Herkes / Kadınlar / Erkekler | (liste değişir) | `voterGender=WOMEN\|MEN` | Demo verisinde çalışıyor |
| Fiyat çipleri | (liste değişir) | `priceMinMinor`, `priceMaxMinor` | Demo verisinde çalışıyor |
| Ürün satırı | Henüz bir yere gitmiyor; hedef ürün detayı | `GET /products/:id` (katalog, planlanan) | Tıklanamaz |

Yaş grubu filtresi (`voterAgeBand`) mentör notunda var ama arayüze henüz eklenmedi; eklenecek.

### 3.4 Profil (`/u/[username]`)

| Tuş / eylem | Gittiği yer | Backend | Bugün ne yapıyor |
| --- | --- | --- | --- |
| Ekran açılışı | (aynı ekran) | `GET /users/:id` (çalışıyor), `GET /users/:id/polls` (taslak) | Demo kullanıcı ve paylaşımları |
| "Arkadaş ekle" | (aynı ekran, tuş "İstek gönderildi" olur) | `POST /friend-requests` gövde `{ targetUserId }` (taslak) | Henüz işlevsiz |
| "…" (üç nokta) | Engelle / şikâyet menüsü | `PUT /blocks/:userId` (taslak); şikâyet (yok) | Henüz işlevsiz |
| "Profili düzenle" (yalnız kendi profilin) | Profil düzenleme ekranı (henüz yok) | `PATCH /me`, `GET /style-tags`, `GET /users/username-availability` (çalışıyor) | Henüz işlevsiz |
| "Arkadaş davet et" (yalnız kendi profilin) | Paylaşım menüsü (uygulama dışı link) | (çağrı yok) | Henüz işlevsiz |
| "Paylaşımlar" sekmesi | (aynı ekran) | `GET /users/:id/polls` (taslak) | Demo paylaşımları |
| "Kaydedilenler" sekmesi (yalnız kendi profilin) | (aynı ekran) | `GET /me/saved-polls` (taslak) | Henüz işlevsiz |
| Paylaşım karesi | `/oylama/[id]` | `GET /polls/:id` (taslak) | Tıklanamaz |
| Geri oku | `/` | (çağrı yok) | Çalışıyor |

### 3.5 Yeni oylama (`/paylas`, henüz yer tutucu)

Tasarımdaki alanlar ve karşılıkları:

| Alan / tuş | Backend |
| --- | --- |
| A ve B medya seçimi | `POST /media/uploads` → yükleme → `POST /media/:id/complete` → `POST /media/:id/accept-preview` (taslak) |
| "Yüzüm bulanık" | `/media/uploads` isteğinde blur tercihi (`blurRequested`) |
| "+ Ürün etiketle" | `POST /products/resolve` (katalog, planlanan) → seçenek `products[]` |
| Soru, kategori, "Nereye giyeceksin?", süre, "Yorumlar açık" | `POST /polls` gövdesinde `question`, `category`, `occasion`, `durationSeconds`, `commentsEnabled` |
| "Arkadaşlarım" | `visibility: "FRIENDS"` |
| "Oylamayı başlat" | `POST /polls` (DRAFT) → `POST /polls/:id/publish`, sonra `/` |
| "Vazgeç" | `/` (taslak oluşturulduysa `POST /polls/:id/cancel`) |

### 3.6 Oy sonucu detayı (`/oylama/[id]`, henüz yok)

| Alan / tuş | Backend |
| --- | --- |
| Yüzdeler, toplam oy, "Senin seçimin" | `GET /polls/:id/results` (taslak) |
| Kazanan seçenekteki ürünler, "Ürüne git" | `GET /polls/:id` → seçenek `products[]`; link `externalUrl` yeni sekmede açılır |
| Yorum listesi, yorum gönderme | `GET` / `POST /polls/:id/comments` (taslak) |
| "Sıradaki oylama" | `/` (akışta sıradaki kart) |

## 4. Frontend'in ekranlarda kullandığı alanlar

Kesin tipler backend OpenAPI'sinden üretilecek; aşağısı ekranların bugün gerçekten gösterdiği alanlardır.

- **Akış kartı:** yazar (`id`, `username`, görünen ad, avatar), `question`, `category`, `occasion`, kapanışa kalan süre (`closesAt` + `serverNow`), seçenekler (`id`, `position`, medya adresi, ürün sayısı), yorum sayısı.
- **Sonuç:** `totalVotes`, `myOptionId`, `winningOptionIds`, seçenek başına `percentage`, `isFinal`.
- **Profil:** `username`, `displayName`, `bio`, `styles[]`, `counts.polls`, `counts.friends`, `counts.stars`, avatar, izleyiciyle arkadaşlık durumu.
- **Profil karesi:** oylamanın önde giden seçeneğinin medyası ve yüzdesi, `question`.
- **Trend satırı:** ürün `id`, `title`, `brand`, `priceMinor`, `currency`, görsel, seçilme sayısı, önceki döneme göre sıra farkı.

## 5. Backend'den istenenler (sözleşmede olmayanlar)

### 5.1 Trend listesi

Frontend'in beklediği şekil (öneri; yol ve adlar backend'in kararı):

```http
GET /v1/trends/products?period=WEEK&category=SHOES&voterGender=WOMEN&voterAgeBand=AGE_18_24&priceMinMinor=0&priceMaxMinor=75000&limit=20
```

```json
{
  "period": "WEEK",
  "updatedAt": "2026-10-10T12:00:00.000Z",
  "items": [
    {
      "rank": 1,
      "rankChange": 2,
      "isNew": false,
      "pickCount": 214,
      "product": {
        "id": "uuid",
        "title": "Kahverengi deri loafer",
        "brand": "Kuzey Sokak",
        "category": "SHOES",
        "priceMinor": 189900,
        "currency": "TRY",
        "imageUrl": null
      }
    }
  ],
  "nextCursor": null
}
```

- `pickCount`, ürünün seçilen kombinlerde kaç kez yer aldığıdır; arayüz bunu "seçilen kombinde" diye adlandırır, ürün oyu ya da satış demez.
- Yetersiz örneklemli gruplar listede hiç dönmemeli; frontend boş listede "Bu filtrede yeterli veri yok" gösterir.
- `rankChange` yalnızca filtresiz genel listede gösterilir; filtreli isteklerde dönmesi gerekmez.
- Mentör notundaki günlük dönem (`DAY`) arayüze eklenebilir; şu an hafta ve ay var.

### 5.2 Diğer eksikler

1. **Kullanıcı adıyla profil:** Profil adresi `/u/[username]`; sözleşmede yalnızca `GET /users/:id` var. Kullanıcı adından profil okuyan bir yol ya da akış/yorum yanıtlarında her zaman `id` + `username` birlikte gerekli.
2. **Video:** Ürün sahibi oylama seçeneklerinde ve profilde kısa video (dikey, 5–10 sn, sessiz döngü) istiyor. Medya hattı şu an fotoğraf varsayıyor; video türü, süre/boyut sınırı ve kapak görseli gerekir. Yüz bulanıklaştırmanın videoda nasıl olacağı açık.
3. **Avatar:** Profilde ve akış kartında gösteriliyor; `users-development.md` avatarın medya adımında bağlanacağını söylüyor.
4. **Kendi açık oylamanın özeti:** Keşfet'in üstündeki "Senin oylaman · 12 oy · 27 dk kaldı" şeridi için.
5. **Okunmamış bildirim sayısı:** Alt menüdeki rozet için.
6. **Akış kartında ürün ve yorum sayısı:** Kart açılmadan gösteriliyor.

## 6. Tasarım ile backend kuralları arasındaki çakışmalar

Bunlar ürün kararı; frontend tarafı karar gelene kadar demo davranışını koruyor.

| Konu | Frontend'de bugün | Backend belgelerinde |
| --- | --- | --- |
| Çoğunluğu bilme ödülü | Oy sonrası "Çoğunluğu bildin +10 ★" ve "Bugünkü tahmin yıldızı 40/100" çubuğu | "Normal oylama kişinin tercihidir. Çoğunluğu seçmeye puan verilmez." (`product-rules.md` §1) |
| Seri, lig, rozet | Keşfet'te "12 gün" seri çipi; tasarımda lig ve rozetler | Puan formülü seçilmedi, otomatik ödül kapalı; lig Faz 2 |
| Demografik sonuç | Oy sonrası "Kadınların %71'i A dedi" satırı; tasarımda "Kim neyi seçti?" bölümü | İlk sonuç sözleşmesinde demografik kırılım yok |
| Kitle filtreleri | Tasarımda cinsiyet / yaş / "benim tarzım" filtreleri, bazıları Plus kilitli | İlk API'de `audienceGender=ANY`; hazır olmadan çalışıyor gibi gösterilmemeli |
| Seçenek sayısı | Tasarımda C ve D seçenekleri Plus | Herkes için 2–4 seçenek; Plus sınırı kararlaştırılmadı |
| Hazır "neden" etiketleri | Tasarımda yorumlarda "Renk uyumu · 42" gibi tek dokunuş etiketler | Sözleşmede yok |
| Modlar / Canlı Podyum | Tasarımı hazır | Faz 2 |

## 7. Açık konular

- Frontend bu repoya `web/` klasörü olarak `feature/frontend` dalından PR ile öneriliyor. Backend dosyalarına, kök `package.json` ve `tsconfig` dahil, dokunulmadı; kök `tsconfig.json` yalnızca `src`, `prisma`, `scripts`, `tests` yollarını derlediği için `web/` backend derlemesini etkilemez.
- Demo medyası (kişilerin fotoğraf ve videoları) repoya girmez; `web/public/demo/` `.gitignore` içindedir.
- API bağlantısı başladığında adres `NEXT_PUBLIC_API_BASE_URL` ortam değişkeninden okunacak (henüz kodda yok).
