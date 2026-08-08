# Daily Now

Türkçe haber gündemi uygulaması. Canlı: **[daily-now.com](https://daily-now.com)**

Haberleri Claude (Cowork) topluyor, özetliyor ve yayınlıyor — kullanıcı arşivlemiyor.
Uygulama bu boru hattının okuyucu ucu.

## Mimari — özet

Sıfır-build statik site: düz ES modülleri, bundler yok, `package.json` yok.

```
Cowork/bulut rutini
  → tools/publish_news.py <dosya.json>   (haberi yazar)
  → inbox/index.json'ı otomatik yeniden üretir
  → git commit + push
  → Cloudflare Pages otomatik yeniden yayınlar
  → daily-now.com güncellenir
```

- **`inbox/`** — her kayıt bir JSON (bazılarında eşleşen PDF). `index.json` bu klasörün
  statik indeksi, `publish_news.py` her yayından sonra kendisi yazıyor. Uygulama
  sunucu tarafı kod olmadan bunu doğrudan okuyor.
- **`serve.py`** — yalnızca **yerel geliştirme** için düz statik dosya sunucusu
  (`python3 serve.py` → `localhost:8123`). Canlı sitenin çalışması için gerekmiyor.
- **Kategoriler** (`src/categories.js`): `world` (Dünya), `turkey` (Türkiye — genel iç
  gündem), `trmarkets` (Türkiye Borsa — TCMB/BİST/Türkiye ekonomisi), `tech` (Teknoloji),
  `markets` (ABD Borsa — yalnızca Wall Street/Fed), `health` (Sağlık).
- **Story birimi**: bir inbox kaydı birden çok "story" (haber satırı) üretebilir —
  `stories: [...]` alanı önerilen biçim. Okundu/yıldız durumu belge değil, story
  anahtarına (URL) bağlı.

## Otomasyon

Bulut rutini her gün **07:00 (İstanbul) / 04:00 UTC**'de çalışıyor:
6 kategori için haber araştırıp Türkçe özetliyor, `publish_news.py` ile yayınlıyor,
depoya push ediyor. Kurulum/düzenleme: [claude.ai/code/routines](https://claude.ai/code/routines).
Model: `claude-sonnet-5`. Manuel/interaktif yayın için aynı akışı `.claude/skills/haber-yayinla/`
skill'i (proje kökünün dışında, `Proje/.claude/skills/`) tanımlıyor.

## Barındırma

- **GitHub**: [github.com/KarabiberMert/daily-now](https://github.com/KarabiberMert/daily-now) (public)
- **Cloudflare Pages**: `main` dalına her push otomatik deploy tetikler. Build yok
  (Framework preset: None, output dir: `/`).
- **Domain**: `daily-now.com`, aynı Cloudflare hesabında kayıtlı.

## Yerelde çalıştırma

```bash
python3 serve.py        # localhost:8123
```

Push etmeden önce değişiklikleri burada test et. `git push` sonrası Cloudflare
Pages birkaç saniye içinde yeni sürümü yayınlar.

## Kaldırılanlar (bilerek)

Bunlar önceki sürümlerde vardı, kasıtlı olarak kaldırıldı — geri eklemeden önce
neden gittiğini hatırla:

- **Canlı (RSS) sekmesi** — uygulama artık yalnızca Cowork'ün yayınladığı gündemi
  gösteriyor, üçüncü taraf RSS akışı yok.
- **Ayarlar sekmesi** — statik sitede "inbox'ı tara" gibi sunucu-durumu ayarlarının
  anlamı kalmadı; tema değişimi topbar'daki ikonla hâlâ çalışıyor.
- **Arama sekmesi** — üstteki genel arama barı zaten yazınca sonuç gösteriyor, ayrı
  bir sekmeye gerek yoktu.
- **`/api/inbox` dinamik uç noktası** — yerini statik `inbox/index.json` aldı.

## Maliyet notu

Otomasyon Claude Pro kotasından çalışıyor (ayrı bir API faturası yok). Kotayı düşük
tutmak için: günde 1 kez, `sonnet` modeli, kategori başına "mümkünse en az 8 ama
zorlama yok" talimatı ve WebFetch'in gereksiz yere kullanılmaması hedefleniyor.
