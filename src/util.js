/* Kucuk yardimcilar: tarih, metin, DOM. Tarih bicimleri secili dile uyar. */

import { months, days, locale, lang, isLangMap } from './i18n.js';

/** Yerel saate gore YYYY-MM-DD (Date.toISOString UTC'ye kaydigi icin kullanilmiyor). */
export function dayKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  const p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function dayKeyOffset(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return dayKey(d);
}

/** "2026-08-07" -> "August 7, 2026, Friday" / "7 Ağustos 2026, Cuma" */
export function formatDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const month = months()[m - 1];
  const day = days()[dt.getDay()];
  return lang() === 'tr'
    ? `${d} ${month} ${y}, ${day}`
    : `${month} ${d}, ${y}, ${day}`;
}

/** Kisa tarih: "9 Ağustos" / "August 9" */
export function formatDayShort(key) {
  const [, m, d] = key.split('-').map(Number);
  const month = months()[m - 1];
  return lang() === 'tr' ? `${d} ${month}` : `${month} ${d}`;
}

export function relativeDay(key) {
  const today = dayKey();
  const tr = lang() === 'tr';
  if (key === today) return tr ? 'Bugün' : 'Today';
  if (key === dayKeyOffset(1)) return tr ? 'Dün' : 'Yesterday';
  const diff = Math.round((new Date(today) - new Date(key)) / 86400000);
  if (diff > 1 && diff < 7) return tr ? `${diff} gün önce` : `${diff} days ago`;
  if (diff < 0) return tr ? 'İleri tarihli' : 'Upcoming';
  return '';
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

export function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Bir degerin butun metnini duz yaziya cevirir. Iki dilli alanlarda
 * ({en, tr}) her iki dili de birlestirir — boylece Ingilizce arayuzdeyken
 * Turkce ceviride gecen bir kelimeyle de arama yapilabiliyor.
 */
export function allText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(allText).filter(Boolean).join(' ');
  if (isLangMap(v)) return Object.values(v).map(allText).filter(Boolean).join(' ');
  if (typeof v === 'object') return '';
  return String(v);
}

/** Turkce duyarli kucultme — I/İ sorunlarini onler. */
export function lower(s) {
  return String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR');
}

/** Arama icin aksan/harf normalizasyonu. Iki dilli alanlari da kabul eder. */
export function fold(s) {
  return lower(allText(s))
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function debounce(fn, ms = 220) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/** Ismi kararli bir renge cevirir (kaynak rozetleri icin). */
export function hueOf(str) {
  let x = 0;
  for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 360;
  return x;
}

let toastHost;
export function toast(msg, kind = '') {
  toastHost = toastHost || document.getElementById('toasts');
  if (!toastHost) return;
  const el = h(`<div class="toast ${kind}">${esc(msg)}</div>`);
  toastHost.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, kind === 'err' ? 4200 : 2600);
}
