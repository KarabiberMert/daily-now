/* Akışın birimi: "story" — tek bir önemli başlık + Türkçe özeti + kaynağı.
 *
 * Akış artık PDF/belge listelemiyor; Cowork'ün seçtiği başlıkları sırasıyla
 * gösteriyor. Bir gelen kutusu kaydı birden çok story üretebilir:
 *
 *   1. `stories: [...]`  → önerilen biçim. Her madde bir haber.
 *   2. body[].bullets    → eski günlük özetler; her madde başlıksız story olur.
 *   3. digeri            → belgenin kendisi tek story olur, uygulama içinde açılır.
 */

import { fold } from './util.js';

/** Sıralamada ve okundu/yıldız kaydında kullanılan kararlı kimlik. */
export function storyKey(s) {
  if (s.url) return 'u:' + s.url;
  return 'p:' + s.articlePath + '#' + fold(s.title || s.summary || '').slice(0, 60);
}

function asParagraphs(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  const t = String(v || '').trim();
  return t ? t.split(/\n{2,}/).map(x => x.trim()).filter(Boolean) : [];
}

function normalize(raw, article, order) {
  const title = (raw.title || '').trim();
  const summary = (raw.summary || raw.text || '').trim();
  const detail = asParagraphs(raw.detail);
  const points = (Array.isArray(raw.points) ? raw.points : [])
    .map(p => String(p).trim()).filter(Boolean);

  const s = {
    order,
    title,
    summary: title && summary === title ? '' : summary,
    detail,
    points,
    source: (raw.source || article.source || '').trim(),
    url: /^https?:\/\//i.test(raw.url || '') ? raw.url : '',
    time: (raw.time || '').trim(),
    fetchedAt: (raw.fetched_at || '').trim(),
    publishedAt: raw.publishedAt || article.publishedAt || '',
    date: raw.date || article.date,
    articleId: article.id,
    articlePath: article.path || article.id,
    articleTitle: article.title,
    isDocument: !!raw.isDocument,
  };
  // Yerinde açılacak bir şey var mı? Yoksa tıklama doğrudan kaynağa gider.
  s.expandable = detail.length > 0 || points.length > 0;
  s.key = storyKey(s);
  return s;
}

/** Bir kayıttan çıkan story listesi (yazıldıkları sırayla). */
export function storiesOf(article) {
  if (Array.isArray(article.stories) && article.stories.length) {
    return article.stories
      .filter(s => s && (s.title || s.summary || s.text))
      .map((s, i) => normalize(s, article, i));
  }

  // Eski günlük özetler: body bloklarındaki maddeler
  const bullets = [];
  for (const block of article.body || []) {
    if (typeof block === 'string') continue;
    for (const b of block.bullets || []) {
      bullets.push(typeof b === 'string' ? { text: b } : b);
    }
  }
  if (bullets.length) return bullets.map((b, i) => normalize(b, article, i));

  // Tek başına bir haber/belge — detayı belgenin kendi metninden çıkarıyoruz,
  // böylece bu satır da yerinde açılabiliyor.
  return [normalize({
    title: article.title,
    summary: article.summary,
    detail: documentDetail(article),
    source: article.source,
    url: article.url,
    isDocument: true,
  }, article, 0)];
}

/** Belgenin giriş ve gövde paragraflarından okunabilir bir detay üretir. */
function documentDetail(article) {
  const out = [];
  if (article.lead) out.push(article.lead);
  for (const block of article.body || []) {
    if (typeof block === 'string') { out.push(block); continue; }
    if (block.text) out.push(block.text);
  }
  if (!out.length && article.text) {
    // PDF'ler: ilk paragrafları al, başlık satırlarını atla.
    out.push(...article.text.split(/\n{2,}/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(p => p.length > 80)
      .slice(0, 3));
  }
  return out.slice(0, 4);
}

/** Birden çok kaydın story'lerini tek listede toplar (kayıt sırası korunur). */
export function collectStories(articles) {
  const out = [];
  const seen = new Set();
  for (const a of articles) {
    for (const s of storiesOf(a)) {
      if (seen.has(s.key)) continue;   // aynı haber iki özette geçebilir
      seen.add(s.key);
      out.push(s);
    }
  }
  return out;
}

/** Kart üstünde gösterilecek saat. */
export function storyTime(s) {
  if (s.time) return s.time;
  if (!s.publishedAt) return '';
  const d = new Date(s.publishedAt);
  return isNaN(d) ? '' : d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
