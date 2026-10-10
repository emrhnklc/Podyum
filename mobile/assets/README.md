# Assets

Uygulamaya gömülecek ortak görseller ve fontlar burada tutulur. Hanken Grotesk fontları şu an `@expo-google-fonts/hanken-grotesk` paketinden yerel asset olarak yüklenir.

Kişisel fotoğraflar `demo/` içinde Git dışında kalır. Native demo görseli kullanmak için açık bir `require()` kaynağı tanımlamak gerekir; `/demo/...` web yolları telefonda dosya adresi değildir. Mevcut örneklerde eksik görseller pastel yer tutucuyla gösterilir. Eski `public/demo/` dosyaları korunmuştur, native ekranda otomatik yüklenmez.
