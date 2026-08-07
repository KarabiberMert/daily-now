/* İstatistik görünümü — saf SVG/CSS grafikler, dış bağımlılık yok. */

import { state, tags, isStoryRead, isStoryStarred } from '../store.js';
import { collectStories } from '../stories.js';
import { storySources } from './feed.js';
import { CATEGORY_LABEL } from '../categories.js';
import { dayKey, dayKeyOffset, formatDay, esc } from '../util.js';

export function renderStats(root) {
  // Akış gibi burası da belgeleri değil tek tek başlıkları sayıyor.
  const all = collectStories(state.articles.filter(a => !a.missing));

  if (!all.length) {
    root.innerHTML = `<div class="empty">
      <div class="em-ico">📈</div>
      <h3>Gösterilecek veri yok</h3>
      <p>Birkaç gündem özeti geldiğinde günlük dağılım, kaynak payları ve okuma
         durumun burada özetlenir.</p>
    </div>`;
    return;
  }

  const today = dayKey();
  const byDay = new Map();
  for (const a of all) byDay.set(a.date, (byDay.get(a.date) || 0) + 1);

  const last30 = series(30, byDay);
  const last7 = series(7, byDay);
  const weekTotal = last7.reduce((s, d) => s + d.n, 0);
  const monthTotal = last30.reduce((s, d) => s + d.n, 0);
  const unread = all.filter(s => !isStoryRead(s.key)).length;
  const starred = all.filter(s => isStoryStarred(s.key)).length;
  const linked = all.filter(s => s.url).length;
  const avg = (monthTotal / 30).toFixed(1).replace('.', ',');
  const streak = currentStreak(byDay, today);
  const busiest = last30.reduce((m, d) => (d.n > m.n ? d : m), last30[0]);

  root.innerHTML = `
    <div class="stat-grid">
      ${stat('Toplam başlık', all.length, `${linked} tanesi kaynağa bağlı`)}
      ${stat('Bu hafta', weekTotal, 'son 7 gün')}
      ${stat('Okunmamış', unread, `${starred} yıldızlı`, unread ? 'accent' : '')}
      ${stat('Günlük ortalama', avg, 'son 30 gün')}
      ${stat('Kesintisiz seri', streak, streak ? 'gün üst üste gündem' : 'bugün gündem yok')}
    </div>

    <div class="panel">
      <h2>Günlük akış</h2>
      <p class="sub">Son 30 günde gündeme giren başlık sayısı${busiest && busiest.n ? ` · en yoğun gün ${esc(formatDay(busiest.day))} (${busiest.n})` : ''}</p>
      <div class="bars">
        ${(() => {
          const max = Math.max(1, ...last30.map(d => d.n));
          return last30.map(d => `
            <div class="b ${d.n ? '' : 'zero'}" data-tip="${esc(formatDay(d.day))} — ${d.n} başlık">
              <i style="height:${d.n ? Math.max(4, (d.n / max) * 100) : 2}%"></i>
            </div>`).join('');
        })()}
      </div>
      <div class="bars-axis">
        <span>${esc(shortDay(last30[0].day))}</span>
        <span>${esc(shortDay(last30[14].day))}</span>
        <span>bugün</span>
      </div>
    </div>

    <div class="panel-grid">
      <div class="panel">
        <h2>Kaynaklar</h2>
        <p class="sub">Başlıklar hangi haber kaynaklarından geliyor</p>
        ${hbars(storySources().slice(0, 8), all.length)}
      </div>
      <div class="panel">
        <h2>Etiketler</h2>
        <p class="sub">En sık kullanılan konu etiketleri</p>
        ${tags().length
          ? hbars(tags().slice(0, 8), Math.max(...tags().map(t => t.count)))
          : `<p class="sub" style="margin:0">Henüz etiket yok. Sidecar JSON dosyasına <code>tags</code> alanı ekleyebilirsin.</p>`}
      </div>
    </div>

    <div class="panel">
      <h2>Son 90 gün</h2>
      <p class="sub">Her kare bir gün — koyu kareler gündem gelen günler</p>
      <div class="heat">
        ${(() => {
          const days = series(90, byDay);
          const max = Math.max(1, ...days.map(d => d.n));
          return days.map(d => {
            const a = d.n ? 0.22 + 0.78 * (d.n / max) : 0;
            return `<i title="${esc(formatDay(d.day))} — ${d.n} başlık"${
              d.n ? ` style="background:color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, var(--elev-2))"` : ''
            }></i>`;
          }).join('');
        })()}
      </div>
    </div>

    <div class="panel">
      <h2>Okuma durumu</h2>
      <p class="sub">Gündemin ne kadarını okudun</p>
      ${hbars([
        { name: 'Okundu', count: all.length - unread },
        { name: 'Okunmadı', count: unread },
        { name: 'Yıldızlı', count: starred },
      ], all.length)}
    </div>
  `;
}

function stat(k, v, d, cls = '') {
  return `<div class="stat ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="d">${esc(d)}</div></div>`;
}

function hbars(items, max) {
  if (!items.length) return '<p class="sub" style="margin:0">Veri yok</p>';
  const top = Math.max(1, max, ...items.map(i => i.count));
  return `<div class="hbars">${items.map(i => `
    <div class="hbar">
      <div class="hb-top"><span>${esc(i.name)}</span><span>${i.count}</span></div>
      <div class="track"><i style="width:${Math.round((i.count / top) * 100)}%"></i></div>
    </div>`).join('')}</div>`;
}

function series(n, byDay) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = dayKeyOffset(i);
    out.push({ day, n: byDay.get(day) || 0 });
  }
  return out;
}

function currentStreak(byDay, today) {
  let n = 0;
  // Bugun henuz haber gelmediyse seri dunden geriye sayilir.
  let i = byDay.get(today) ? 0 : 1;
  while (byDay.get(dayKeyOffset(i))) { n++; i++; }
  return n;
}

function shortDay(key) {
  const [, m, d] = key.split('-');
  return `${+d}.${+m}`;
}
