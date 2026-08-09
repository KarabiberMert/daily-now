# Daily Now

Üç dilli (İngilizce/İspanyolca/Türkçe) haber gündemi uygulaması. Canlı: **[daily-now.com](https://daily-now.com)**

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
- **Kategoriler** (`src/categories.js`): `world` (World/Dünya), `economy`
  (Economy/Ekonomi — makro), `usmarkets` (US Markets/ABD Borsası), `tech`
  (Technology/Teknoloji), `health` (Health/Sağlık), `sports` (Sports/Spor).
- **Dil** (`src/i18n.js`): uygulama varsayılan olarak **İngilizce** açılır, sağ
  üstteki EN/ES/TR seçicisi İspanyolca ve Türkçe'ye geçirir (seçim `localStorage`'da).
  Arayüz metinleri `t()` sözlüğünden, haber içeriği ise JSON'daki
  `{ "en": …, "es": …, "tr": … }` alanlarından geliyor — çeviri çalışma anında değil,
  yayın anında yazılıyor. Çevirisi eksik bir alan İngilizcesine düşer. Arama üç dili
  birden tarar.
- **Görünümler**: Akış (kategori kartları) ve Arama. İstatistik görünümü kaldırıldı.
- **Düzen**: kenar çubuğu yok — tek kolon. Üst barda solda marka (tıklayınca akışa
  döner, okunmamış sayısı rozette), ortada arama, sağda EN/ES/TR seçicisi ve tema
  düğmesi. Dar ekranda arama alt satıra iner. Konu etiketleri akışın süzgeç
  satırında.
- **Story birimi**: bir inbox kaydı birden çok "story" (haber satırı) üretebilir —
  `stories: [...]` alanı önerilen biçim. Okundu/yıldız durumu belge değil, story
  anahtarına (URL) bağlı — **aynı URL iki story'de kullanılırsa ikincisi
  sessizce kaybolur**, bu yüzden her story'nin url'si benzersiz olmalı.

## Otomasyon

Bulut rutini her gün **07:00 (İstanbul) / 04:00 UTC**'de çalışıyor:
6 kategori için haber araştırıp İngilizce + İspanyolca + Türkçe özetliyor, `publish_news.py` ile yayınlıyor,
depoya push ediyor. Kurulum/düzenleme: [claude.ai/code/routines](https://claude.ai/code/routines).
Model: `claude-sonnet-5`.

Üç yerde aynı akış tanımlı, biri değişince diğerleri de güncellenmeli:

- **[`CLAUDE.md`](CLAUDE.md)** (repo kökü) — bu repoda çalışan her Claude Code/Cowork oturumu
  (rutin dahil) tarafından otomatik yüklenir. Kota/token sınırları ve editoryal
  kurallar için **tek doğru kaynak** burası.
- **`.claude/skills/haber-yayinla/`** (proje kökünün dışında, `Proje/.claude/skills/`) —
  manuel/interaktif yayın için aynı akışı tanımlıyor.
- **Rutinin kendi prompt'u** (claude.ai/code/routines üzerinde) — otomatik CLAUDE.md
  okumuyorsa (rutinin çalışma ortamı bu repoyu klonlamıyorsa) aynı kuralları kendi
  metninde de tekrarlaman gerekir; oradan manuel güncellenir, buradan görülemez.

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

Otomasyon Claude Pro kotasından çalışıyor (ayrı bir API faturası yok). Kota/token
sınırlarının somut değerleri (arama sayısı, haber sayısı, model seçimi) [`CLAUDE.md`](CLAUDE.md)'de
tutuluyor — burada tekrarlamıyoruz ki iki yer birbirinden kopup eskimesin.
