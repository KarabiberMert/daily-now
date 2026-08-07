/* Ayarlar görünümü. Butonlar data-act ile app.js'te ele alınır. */

import { state } from '../store.js';
import { estimateUsage } from '../db.js';
import { esc, formatSize } from '../util.js';

export async function renderSettings(root) {
  const s = state.settings;
  const usage = await estimateUsage();

  root.innerHTML = `
  <div class="panel">
    <h2>Haber kaynağı</h2>
    <p class="sub">Coworker'ın ürettiği PDF'lerin geldiği yer.</p>

    <div class="set-row">
      <div class="sr-main">
        <strong>${state.serverInbox
          ? `DailyNews/inbox — ${state.serverInbox.files.length} PDF`
          : 'DailyNews/inbox — bağlı değil'}</strong>
        <span>${state.serverInbox
          ? `Asıl gelen kutusu. <code>serve.py</code> bu klasörü sunduğu için tarayıcı izni
             gerekmez; her tarayıcıda çalışır ve “Yenile” dediğinde yeni dosyalar arşive girer.`
          : `Uygulama <code>serve.py</code> üzerinden açılmadığı için klasör okunamıyor.
             Terminalden <code>python3 DailyNews/serve.py</code> çalıştırıp
             <code>http://localhost:8123</code> adresini aç.`}</span>
      </div>
      <div class="sr-act">
        <button class="btn ${state.serverInbox ? 'btn-primary' : ''}" data-act="sync"
                ${state.serverInbox ? '' : 'disabled'}>Şimdi tara</button>
      </div>
    </div>


    <div class="set-row">
      <div class="sr-main">
        <strong>Kendiliğinden tazele</strong>
        <span>Açılışta, sekmeye her dönüşte ve uygulama açıkken dakikada bir inbox'a bakar;
              yalnızca gerçekten değiştiyse tarar. Kapatırsan haberler yalnızca
              “inbox'ı tara” dediğinde güncellenir.</span>
      </div>
      <div class="sr-act">
        <button class="btn ${s.autoSync ? 'btn-primary' : ''}" data-act="toggle" data-key="autoSync">
          ${s.autoSync ? 'Açık' : 'Kapalı'}
        </button>
      </div>
    </div>

    <div class="set-row">
      <div class="sr-main">
        <strong>Açınca okundu işaretle</strong>
        <span>Bir haberi okuyucuda açtığında otomatik “okundu” olsun.</span>
      </div>
      <div class="sr-act">
        <button class="btn ${s.markReadOnOpen ? 'btn-primary' : ''}" data-act="toggle" data-key="markReadOnOpen">
          ${s.markReadOnOpen ? 'Açık' : 'Kapalı'}
        </button>
      </div>
    </div>
  </div>

  <div class="panel">
    <h2>Coworker nasıl haber bırakır?</h2>
    <p class="sub">Dosyaları <code>DailyNews/inbox/</code> klasörüne yazar. Dosya adı bu
       düzende olursa tarih, kaynak ve başlık kendiliğinden okunur.</p>
    <pre class="code">inbox/
  <b>2026-08-07__Reuters__Fed faiz kararını açıkladı.pdf</b>
  2026-08-07__Reuters__Fed faiz kararını açıkladı.json   ← isteğe bağlı

<b>Sidecar JSON</b> (aynı isim, .json uzantısı) tüm alanları elle belirler:
{
  "title":    "Fed faiz kararını açıkladı",
  "source":   "Reuters",
  "author":   "Cowork",
  "date":     "2026-08-07",
  <b>"category": "markets",</b>
  "tags":     ["ekonomi", "merkez bankası"],
  "summary":  "Fed politika faizini 25 baz puan indirdi…",
  "url":      "https://…"
}</pre>
    <p class="sub" style="margin:14px 0 0"><strong>category</strong> haberin hangi kategori
       sayfasında toplanacağını belirler: <code>world</code> · <code>turkey</code> ·
       <code>tech</code> · <code>markets</code>. Yazılmazsa uygulama başlık, etiket ve PDF
       metninden tahmin eder; hiçbiri tutmazsa haber “Diğer” kategorisine düşer.</p>
    <p class="sub" style="margin:8px 0 0">Sidecar yoksa uygulama sırayla PDF'in kendi
       üst verisine, dosya adına ve PDF'in ilk satırına bakar. Alt klasörler de taranır.</p>
  </div>

  <div class="panel">
    <h2>Görünüm ve veri</h2>
    <div class="set-row">
      <div class="sr-main">
        <strong>Tema</strong>
        <span>Koyu tema gece okuması için, açık tema gazete hissi için.</span>
      </div>
      <div class="sr-act">
        <div class="seg">
          <button data-act="theme" data-theme="dark" class="${s.theme === 'dark' ? 'is-active' : ''}">Koyu</button>
          <button data-act="theme" data-theme="light" class="${s.theme === 'light' ? 'is-active' : ''}">Açık</button>
        </div>
      </div>
    </div>

    <div class="set-row">
      <div class="sr-main">
        <strong>Arşiv</strong>
        <span>${state.articles.length} haber kayıtlı${
          usage && usage.usage ? ` · ${formatSize(usage.usage)} yer kaplıyor` : ''}.</span>
      </div>
      <div class="sr-act">
        <button class="btn" data-act="export">Dışa aktar</button>
        <button class="btn" data-act="mark-all-read">Tümünü okundu yap</button>
        <button class="btn btn-danger" data-act="wipe">Arşivi sil</button>
      </div>
    </div>
  </div>

  <div class="panel">
    <h2>Kısayollar</h2>
    <pre class="code">/  veya  Cmd/Ctrl+K   arama kutusuna geç
1 – 4                sekmeler arasında geçiş
R                    klasörü yeniden tara
Esc                  okuyucuyu kapat
← →  /  J K          okuyucuda sayfa değiştir
+  -                 okuyucuda yakınlaş / uzaklaş
S                    okuyucuda yıldızla</pre>
  </div>`;
}
