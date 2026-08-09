/* İstatistik görünümü — saf SVG/CSS grafikler, dış bağımlılık yok. */

import { state, tags, isStoryRead, isStoryStarred } from '../store.js';
import { collectStories } from '../stories.js';
import { storySources } from './feed.js';
import { dayKey, dayKeyOffset, formatDay, esc } from '../util.js';
import { t, lang } from '../i18n.js';

export function renderStats(root) {
  // Akış gibi burası da belgeleri değil tek tek başlıkları sayıyor.
  const all = collectStories(state.articles.filter(a => !a.missing));

  if (!all.length) {
    root.innerHTML = `<div class="empty">
      <div class="em-ico">📈</div>
      <h3>${t('stats.emptyTitle')}</h3>
      <p>${t('stats.emptyText')}</p>
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
  const avg = lang() === 'tr'
    ? (monthTotal / 30).toFixed(1).replace('.', ',')
    : (monthTotal / 30).toFixed(1);
  const streak = currentStreak(byDay, today);
  const busiest = last30.reduce((m, d) => (d.n > m.n ? d : m), last30[0]);

  root.innerHTML = `
    <div class="stat-grid">
      ${stat(t('stats.total'), all.length, t('stats.linked', { n: linked }))}
      ${stat(t('stats.thisWeek'), weekTotal, t('stats.last7'))}
      ${stat(t('stats.unread'), unread, t('stats.starredN', { n: starred }), unread ? 'accent' : '')}
      ${stat(t('stats.dailyAvg'), avg, t('stats.last30'))}
      ${stat(t('stats.streak'), streak, streak ? t('stats.streakOn') : t('stats.streakOff'))}
    </div>

    <div class="panel">
      <h2>${t('stats.flowTitle')}</h2>
      <p class="sub">${t('stats.flowSub')}${busiest && busiest.n
        ? esc(t('stats.busiest', { day: formatDay(busiest.day), n: busiest.n })) : ''}</p>
      <div class="bars">
        ${(() => {
          const max = Math.max(1, ...last30.map(d => d.n));
          return last30.map(d => `
            <div class="b ${d.n ? '' : 'zero'}" data-tip="${esc(formatDay(d.day))} — ${esc(t('stats.headlineN', { n: d.n }))}">
              <i style="height:${d.n ? Math.max(4, (d.n / max) * 100) : 2}%"></i>
            </div>`).join('');
        })()}
      </div>
      <div class="bars-axis">
        <span>${esc(shortDay(last30[0].day))}</span>
        <span>${esc(shortDay(last30[14].day))}</span>
        <span>${t('stats.today')}</span>
      </div>
    </div>

    <div class="panel-grid">
      <div class="panel">
        <h2>${t('stats.sources')}</h2>
        <p class="sub">${t('stats.sourcesSub')}</p>
        ${hbars(storySources().slice(0, 8), all.length)}
      </div>
      <div class="panel">
        <h2>${t('stats.tags')}</h2>
        <p class="sub">${t('stats.tagsSub')}</p>
        ${tags().length
          ? hbars(tags().slice(0, 8), Math.max(...tags().map(x => x.count)))
          : `<p class="sub" style="margin:0">${t('stats.noTags')}</p>`}
      </div>
    </div>

    <div class="panel">
      <h2>${t('stats.heatTitle')}</h2>
      <p class="sub">${t('stats.heatSub')}</p>
      <div class="heat">
        ${(() => {
          const days = series(90, byDay);
          const max = Math.max(1, ...days.map(d => d.n));
          return days.map(d => {
            const a = d.n ? 0.22 + 0.78 * (d.n / max) : 0;
            return `<i title="${esc(formatDay(d.day))} — ${esc(t('stats.headlineN', { n: d.n }))}"${
              d.n ? ` style="background:color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, var(--elev-2))"` : ''
            }></i>`;
          }).join('');
        })()}
      </div>
    </div>

    <div class="panel">
      <h2>${t('stats.readTitle')}</h2>
      <p class="sub">${t('stats.readSub')}</p>
      ${hbars([
        { name: t('stats.read'), count: all.length - unread },
        { name: t('stats.notRead'), count: unread },
        { name: t('stats.starred'), count: starred },
      ], all.length)}
    </div>
  `;
}

function stat(k, v, d, cls = '') {
  return `<div class="stat ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="d">${esc(d)}</div></div>`;
}

function hbars(items, max) {
  if (!items.length) return `<p class="sub" style="margin:0">${t('stats.noData')}</p>`;
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
  return lang() === 'tr' ? `${+d}.${+m}` : `${+m}/${+d}`;
}
