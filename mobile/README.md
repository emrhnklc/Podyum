# Podyum — mobile

Next.js 16 (App Router) + TypeScript. Şu an hiçbir backend çağrısı yapmaz; ekranlar `lib/demo.ts` içindeki demo verisinden beslenir.

Önceki `web/` klasörü artık `Podyum/mobile/` altında. Backend `../backend/` dizinindedir. Genel komutlar: [Podyum rehberi](../README.md).

Her ekranın rotası, her tuşun nereye gittiği ve hangi backend çağrısına karşılık geldiği: [docs/ekran-ve-api-haritasi.md](docs/ekran-ve-api-haritasi.md).

## Çalıştırma

```bash
cd mobile
npm ci
npm run dev
```

Adres `http://localhost:3001`. Backend varsayılan olarak 3000'de açılır; iki uygulama aynı anda çalışabilir. Proje kökünden `npm run dev:mobile` ve `npm run dev:backend` komutları da kullanılabilir.

Telefonda denemek için bilgisayarla aynı Wi-Fi'da `http://<bilgisayarın-ağ-adresi>:3001` adresini aç. İzin verilen geliştirme adresleri `next.config.ts` içinde.

## Klasörler

| Yol | İçerik |
| --- | --- |
| `app/` | Rotalar: `/`, `/trendler`, `/u/[username]`, `/paylas`, `/bildirimler` |
| `components/` | Ekranlar (`Kesfet`, `Trendler`, `Profil`) ve ortak alt menü (`Nav`) |
| `lib/demo.ts` | Demo kullanıcıları, oylamalar ve trend ürünleri |
| `public/demo/` | Demo fotoğraf ve videoları; repoya girmez |
| `docs/` | Ekran ve API haritası |

## Demo medyası

`public/demo/` `.gitignore` içindedir: kişilerin fotoğraf ve videoları herkese açık repoya konmaz. Dosya yoksa ekranlar pastel yer tutucu gösterir. Kendi makinende görmek için dosyaları `lib/demo.ts` içindeki yollarla aynı adlarla bu klasöre koy.

## Kontroller

```bash
npm run typecheck
npm run lint
npm run build
```

`AGENTS.md` dosyasını Next.js üretir; bu sürümde API'ler değiştiği için kod yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehberin okunmasını ister.
