# Daily Now — proje talimatları

Bu dosya, bu repo üzerinde çalışan her Claude Code / Cowork oturumu (günlük bulut
rutini dahil) tarafından otomatik yüklenir. Amaç: kota/token tüketimini düşük tutmak.

## Haber yayınlama görevi

Kategoriler: `world` (Dünya), `turkey` (Türkiye — genel iç gündem), `trmarkets`
(Türkiye Borsa — TCMB/BİST/Türkiye ekonomisi), `tech` (Teknoloji), `markets`
(ABD Borsa — yalnızca Wall Street/Fed/Nasdaq), `health` (Sağlık).

`turkey` genel iç gündem içindir; Borsa İstanbul/TCMB/Türkiye ekonomisi haberleri
`trmarkets`'e gider. `markets` yalnızca ABD piyasalarınadır, Türkiye ekonomi
haberini oraya koyma.

### Kota/token sınırları — bunlara kesinlikle uy

- **WebSearch: kategori başına en fazla 2.** Ayrı ayrı her haber adayı için arama
  yapma; geniş sorgularla (ör. "türkiye gündem [tarih]") tara, sonuçlardan seç.
- **WebFetch: sadece gerekirse.** Arama sonucundaki snippet zaten `summary`/`detail`
  yazmaya yetiyorsa sayfayı çekme. Rakam/detay eksikse ya da snippet yetersizse kullan.
- Aynı konuyu doğrulamak için tekrar arama yapma — ilk yeterli sonuçla devam et.
- **Kategoriler arasında uzun anlatım yazma.** Bir kategoriyi yayınladıktan sonra
  tek satır "X: N haber yayınlandı" de ve doğrudan sıradaki kategoriye geç.
- **Önceki kategoriye geri dönüp özetleme/tekrar okuma yapma.** Context'i büyütme.

### Haber seçimi ve yazım

- Kategori başına **mümkünse en az 4-5 haber** (zorlama yok — önemli olan azsa
  azıyla yetin, doldurmak için önemsiz/tekrar haber ekleme).
- Her haber: `title` (kısa, Türkçe, tıklama tuzağı yok), `summary` (1-2 cümle),
  `detail` (4-6 cümle — burası kullanıcının asıl okuma yeri, **bu alanı kısaltma**,
  boş bırakma), `points` (opsiyonel 2-4 madde), `source`, `url` (**zorunlu**, gerçek
  haber adresi — uydurma, yoksa `publish_news.py` yayını reddeder), `time` (biliniyorsa).
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
