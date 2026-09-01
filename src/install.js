/* Ana ekrana ekle — telefonda ust seritte duran kurulum cagrisi.
 *
 * Iki ayri dunya var:
 *
 *   Android / Chrome  Tarayici `beforeinstallprompt` firlatiyor. Olayi
 *                     yakalayip saklıyoruz; kullanici "Ekle"ye basinca
 *                     prompt() ile yerel kurulum diyalogu aciliyor.
 *   iOS / Safari      Boyle bir olay yok, kurulum yalnizca Paylas menusunden
 *                     elle yapiliyor. Orada dugme, adim adim anlatan bir alt
 *                     sayfa aciyor.
 *
 * Serit yalniz telefon genisliginde ve uygulama kurulu degilken cikar.
 * Kapatilirsa 30 gun geri gelmez.
 */

import { t, onLangChange } from './i18n.js';

const DISMISS_KEY = 'dn-install-dismissed';
const DISMISS_DAYS = 30;
const PHONE = '(max-width: 900px)';

let deferred = null;   // yakalanmis beforeinstallprompt olayi
let mode = null;       // 'prompt' (Android) | 'ios'
let ready = false;     // initInstall() calisti mi
const el = {};

/* ────────────────────────── ortam ────────────────────────── */

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

/** iPadOS 13+ kendini masaustu Safari gibi tanitiyor; dokunma sayisina bakiyoruz.
 *  Android/Windows UA'sini bastan eliyoruz: dokunma emulasyonu acik bir
 *  masaustu tarayicisi da MacIntel + maxTouchPoints>1 gorunuyor. */
function isIOS() {
  const ua = navigator.userAgent || '';
  if (/Android|Windows|CrOS/.test(ua)) return false;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function isPhone() {
  // CSS de ayni esikten gizliyor; ikisi ayni kalsin.
  return !!window.matchMedia?.(PHONE).matches;
}

function dismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && (Date.now() - at) < DISMISS_DAYS * 864e5;
  } catch { return false; }
}

function silence() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
}

/** Seridi gostermenin bir anlami var mi? */
function eligible() {
  return !isStandalone() && !dismissed() && isPhone();
}

/* Ana ekrana eklenmis uygulamada guvenli alan degiskenlerini acan bayrak.
   Modul yuklenirken, ilk boyamadan once yaziliyor; CSS'te :root[data-standalone]
   ust bari durum cubugunun altindan kurtariyor. */
if (isStandalone()) document.documentElement.dataset.standalone = 'true';

/* Olayi modul yuklenirken dinliyoruz: Chrome bunu cok erken firlatabiliyor,
   initInstall()'u beklersek kacirabilirdik. Masaustunde karismiyoruz —
   preventDefault etmeyip tarayicinin kendi kurulum ipucunu birakiyoruz. */
window.addEventListener('beforeinstallprompt', e => {
  if (!eligible()) return;
  e.preventDefault();
  deferred = e;
  if (ready && !mode) { mode = 'prompt'; show(); }
});

/* ────────────────────────── kurulum ────────────────────────── */

export function initInstall() {
  el.bar = document.getElementById('installBar');
  el.sheet = document.getElementById('installSheet');
  if (!el.bar || !el.sheet) return;
  el.cta = document.getElementById('installCta');

  window.addEventListener('appinstalled', () => { deferred = null; silence(); hide(); });
  if (!eligible()) return;

  ready = true;
  document.getElementById('installClose').addEventListener('click', () => { silence(); hide(); });
  el.cta.addEventListener('click', onCta);
  el.sheet.addEventListener('click', e => {
    if (e.target.closest('[data-install-close]')) closeSheet();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.sheet.hidden) { e.preventDefault(); closeSheet(); }
  });
  onLangChange(applyLabel);

  if (deferred) { mode = 'prompt'; show(); }
  else if (isIOS()) { mode = 'ios'; show(); }
  // Diger tarayicilar: beforeinstallprompt gelirse yukaridaki dinleyici acar.
}

function applyLabel() {
  if (el.cta) el.cta.textContent = mode === 'ios' ? t('install.how') : t('install.add');
}

function show() {
  if (!eligible()) return;
  applyLabel();
  el.bar.hidden = false;
}

function hide() {
  if (el.bar) el.bar.hidden = true;
  closeSheet();
}

async function onCta() {
  if (mode === 'ios') return openSheet();
  if (!deferred) return;

  const evt = deferred;
  deferred = null;
  try {
    evt.prompt();
    const { outcome } = await evt.userChoice;
    // Reddettiyse israr etmiyoruz; kabul ettiyse appinstalled zaten kapatacak.
    if (outcome !== 'accepted') silence();
  } catch {}
  hide();
}

function openSheet() {
  el.sheet.hidden = false;
  el.sheet.querySelector('.sheet-body').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  if (!el.sheet || el.sheet.hidden) return;
  el.sheet.hidden = true;
  document.body.style.overflow = '';
}
