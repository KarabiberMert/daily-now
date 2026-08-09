# Daily Now — proje talimatları

Bu dosya, bu repo üzerinde çalışan her Claude Code / Cowork oturumu (günlük bulut
rutini dahil) tarafından otomatik yüklenir. Amaç: kota/token tüketimini düşük tutmak.

## Haber yayınlama görevi

Uygulama **varsayılan olarak İngilizce** açılır; sağ üstteki **EN / ES / TR / DE / FR**
seçicisi İspanyolca, Türkçe, Almanca ve Fransızca'ya geçirir. Bu yüzden her haber
**beş dilli** yazılır (aşağıya bak).

Kategoriler — yalnızca bu altısı geçerlidir, `publish_news.py` başkasını reddeder:

| id | Ekranda (EN / ES / TR / DE / FR) | Kapsam |
|---|---|---|
| `world` | World / Mundo / Dünya / Welt / Monde | Dünya gündemi, diplomasi, çatışmalar, seçimler, iklim |
| `economy` | Economy / Economía / Ekonomi / Wirtschaft / Économie | Makro ekonomi: enflasyon, merkez bankaları, büyüme, ticaret, istihdam, enerji fiyatları |
| `usmarkets` | US Markets / Bolsa de EE. UU. / ABD Borsası / US-Börse / Bourse américaine | ABD borsası: Wall Street, Nasdaq, S&P 500, Dow, Fed, bilançolar, halka arzlar |
| `tech` | Technology / Tecnología / Teknoloji / Technologie / Technologie | Teknoloji, yapay zeka, yarı iletken, uzay, siber güvenlik |
| `health` | Health / Salud / Sağlık / Gesundheit / Santé | Sağlık, tıp, ilaç, salgın, halk sağlığı |
| `sports` | Sports / Deportes / Spor / Sport / Sport | Spor |

`economy` makro ekonomi içindir, `usmarkets` özel olarak ABD hisse piyasasıdır — Fed
faiz kararının piyasa yansıması `usmarkets`'e, enflasyon/büyüme verisi `economy`'ye gider.
Türkiye'ye özel bir kategori yok; Türkiye haberi gerçekten küresel öneme sahipse
`world` ya da ilgili kategoriye girer.

### Kota/token sınırları — bunlara kesinlikle uy

- **WebSearch: kategori başına en fazla 2.** Ayrı ayrı her haber adayı için arama
  yapma; geniş sorgularla (ör. "world news [tarih]") tara, sonuçlardan seç.
- **WebFetch: sadece gerekirse.** Arama sonucundaki snippet zaten `summary`/`detail`
  yazmaya yetiyorsa sayfayı çekme. Rakam/detay eksikse ya da snippet yetersizse kullan.
- Aynı konuyu doğrulamak için tekrar arama yapma — ilk yeterli sonuçla devam et.
- **Çeviri için ayrı arama/fetch yapma.** Dört çeviriyi de kendin yaz; ek tur atma.
  Diller ek arama değil, yalnızca daha uzun çıktı demektir.
- **Kategoriler arasında uzun anlatım yazma.** Bir kategoriyi yayınladıktan sonra
  tek satır "X: N haber yayınlandı" de ve doğrudan sıradaki kategoriye geç.
- **Önceki kategoriye geri dönüp özetleme/tekrar okuma yapma.** Context'i büyütme.

### Beş dillilik — zorunlu

Metin alanları `{ "en": …, "es": …, "tr": …, "de": …, "fr": … }` biçiminde yazılır:

```json
"title":   { "en": "Fed holds rates steady",
             "es": "La Fed mantiene los tipos sin cambios",
             "tr": "Fed faizi sabit tuttu",
             "de": "Fed lässt die Zinsen unverändert",
             "fr": "La Fed maintient ses taux inchangés" },
"summary": { "en": "…", "es": "…", "tr": "…", "de": "…", "fr": "…" },
"detail":  { "en": "…", "es": "…", "tr": "…", "de": "…", "fr": "…" },
"points":  { "en": ["…"], "es": ["…"], "tr": ["…"], "de": ["…"], "fr": ["…"] }
```

- **İngilizce asıl metindir** — yazılmazsa yayın reddedilir. Diğer diller
  eksikse uyarı verilir ve o dil seçildiğinde İngilizcesi görünür; bunu
  istemiyoruz, hep beşini birden yaz.
- Çeviriler **birebir kelime çevirisi değil**, akıcı olsun; İngilizce metinle aynı
  bilgiyi versin, kısaltma.
- `url`, `source`, `time` çevrilmez — düz metin kalır.
- Çeviri gerektirmeyen bir alanı düz metin olarak da yazabilirsin; o zaman beş dilde
  de aynı görünür.

### Haber seçimi ve yazım

- **Her haberin `url`si benzersiz olmalı.** Uygulama okundu/yıldız durumunu ve
  haber kimliğini `url`ye bağlıyor — aynı `url`yi iki farklı haberde kullanırsan
  `publish_news.py` yayını reddeder. Bir kaynaktan (ör. bir "günün haberleri"
  derlemesi) birden fazla gerçek gelişme çıkarıyorsan bunları ayrı story yapma —
  **tek bir haberde `points` listesiyle birleştir.**
- Kategori başına **0-4 haber yeterlidir** — zorlama yok, o kategoride gerçekten
  önemli/yeni gelişme yoksa az sayıda ya da hiç haber eklemeden geç. Doldurmak
  için önemsiz/tekrar haber ekleme.
- Her haber: `title` (kısa, tıklama tuzağı yok), `summary` (1-2 cümle), `detail`
  (4-6 cümle — burası kullanıcının asıl okuma yeri, **bu alanı kısaltma**, boş
  bırakma), `points` (opsiyonel 2-4 madde), `source`, `url` (**zorunlu**, gerçek
  haber adresi — uydurma, yoksa yayın reddedilir), `time` (biliniyorsa).
- Kaynak metni birebir kopyalama, kendi cümlelerinle yaz. Emoji ve Latin dışı
  alfabelerden kaçın. Önem sırası = dizideki sıra, en önemli haber başa.

### Yayınlama

Kategori başına bir JSON dosyası yaz, sonra:

```bash
python3 tools/publish_news.py <dosya.json>
```

Tüm kategoriler bitince: `git add -A`, `git commit`, `git push` — bunlar olmadan
değişiklik `daily-now.com`'a yansımaz.

Alan biçimi ve örnek JSON için `tools/publish_news.py` başındaki docstring'e veya
proje kökü dışındaki `haber-yayinla` skill'ine bak.

## Uygulama tarafı — dil katmanı

- `src/i18n.js` — arayüz metinleri (`t()`), dil seçimi (`lang()`/`setLang()`) ve
  çok dilli içerik alanlarını çözen `pick()`/`field()`. Yeni bir arayüz metni
  eklerken sözlüğe **beş dili birden** yaz. Yeni dil eklemek için `LANGS`, `MONTHS`,
  `DAYS`, `LOCALES` girdilerini ve sözlüğü tamamlamak, `util.js`'te tarih
  sözdizimini eklemek yeterli.
- `index.html`'deki sabit metinler `data-i18n` / `data-i18n-placeholder` /
  `data-i18n-title` / `data-i18n-aria` öznitelikleriyle işaretlenir; `app.js`
  içindeki `applyStaticI18n()` bunları dolduruyor.
- Dil seçimi `localStorage`'da (`dn-lang`) tutulur, varsayılan `en`.
- Arama beş dili birden tarar (`util.js` içindeki `allText()`), yani İngilizce
  arayüzdeyken Almanca ya da Fransızca çeviride geçen bir kelimeyle de sonuç bulunur.
  `fold()` Türkçe, İspanyolca, Fransızca ve Almanca aksanları sadeleştirir
  (`ß`→`ss`, `œ`→`oe` dahil).
- **İstatistik görünümü kaldırıldı** — uygulamada Akış ve Arama var, başka sekme yok.
- **Tek kolonlu düzen**: kenar çubuğu, mobil alt gezinme ve karartma katmanı yok.
  Marka/arama/dil/tema üst barda; `#brandHome` akışa dönüş düğmesi.
