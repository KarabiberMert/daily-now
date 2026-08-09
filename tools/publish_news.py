#!/usr/bin/env python3
"""Bir gundem ozetini Daily Now gelen kutusuna birakir.

    python3 tools/publish_news.py agenda.json
    cat agenda.json | python3 tools/publish_news.py -

inbox/ altina tek bir .json dosyasi yazilir (PDF uretilmez). Daily Now bunu
okur ve **stories** dizisindeki her maddeyi Akis'ta ayri bir haber satiri
olarak, yazildigi sirayla gosterir. Kullanici satira tiklayinca haber
UYGULAMA ICINDE, yerinde acilir (detail + points gorunur); kaynak sayfasina
gitmek isterse acilan panelde duran baglantiya basar.

DIL — uygulama varsayilan olarak INGILIZCE acilir, sag ustteki secici
Turkce'ye gecirir. Bu yuzden her metin alani IKI DILLI yazilir:

    "title": { "en": "English headline", "tr": "Türkçe başlık" }

Ceviri yazilmazsa (duz metin verilirse) o alan her iki dilde de ayni gorunur.
Ceviri gerektirmeyen alanlar (url, time, source) duz metin kalir.

Kategoriler (yalnizca bunlar gecerli):

    world      Dunya gundemi
    economy    Ekonomi (makro: enflasyon, merkez bankalari, ticaret, buyume)
    usmarkets  ABD borsasi (Wall Street, Nasdaq, S&P 500, Fed, bilancolar)
    tech       Teknoloji
    health     Saglik
    sports     Spor

Onerilen bicim — kategori basina bir dosya:

    {
      "title":    { "en": "World — 9 August 2026", "tr": "Dünya — 9 Ağustos 2026" },
      "category": "world",
      "date":     "2026-08-09",
      "source":   "Daily Now",
      "stories": [
        {
          "title":   { "en": "Short, clear headline",
                       "tr": "Kısa, net Türkçe başlık" },
          "summary": { "en": "The 1-2 sentence summary shown in the list.",
                       "tr": "Listede görünen 1-2 cümlelik özet." },
          "detail":  { "en": "The 4-6 sentence story shown when the row is opened.",
                       "tr": "Tıklayınca açılan 4-6 cümlelik anlatı." },
          "points":  { "en": ["optional bullet", "another one"],
                       "tr": ["isteğe bağlı madde", "bir tane daha"] },
          "source":  "Reuters",
          "url":     "https://…",
          "time":    "07:30"
        }
      ]
    }

Story alanlari:
  title    zorunlu sayilir            (iki dilli)
  summary  listede gorunur — kisa tut (iki dilli)
  detail   yerinde acilan asil ozet. YAZILMAZSA satir acilmaz, tiklama
           dogrudan url'e gider; o yuzden her zaman yaz.   (iki dilli)
  points   istege bagli madde listesi (iki dilli)
  url      "kaynak sayfasina git" baglantisi — ZORUNLU, benzersiz olmali
  source   haber kaynagi (Reuters, AP…)  — cevrilmez
  time     biliniyorsa yayin saati       — cevrilmez

Onem sirasi = dizideki sira. Kategori basina 0-4 haber yeterlidir.

Tek bir uzun habere ait sayfa da yayinlanabilir (lead/body/quote alanlariyla);
o kayit Akis'ta tek satir olur, acilinca giris ve govde paragraflari yerinde
gosterilir.
"""

import argparse
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from newspdf import file_base  # noqa: E402  (sadece dosya adi uretimi icin)
from inbox_index import write_index  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LANGS = ('en', 'tr')
PRIMARY = 'en'

CATEGORIES = ('world', 'economy', 'usmarkets', 'tech', 'health', 'sports')

# Iki dilli yazilmasi beklenen story alanlari.
TRANSLATED = ('title', 'summary', 'detail', 'points')


def is_lang_map(v):
    return isinstance(v, dict) and v and all(k in LANGS for k in v)


def in_lang(v, lang):
    """Bir alanin belirli dildeki karsiligi (duz metinse kendisi)."""
    if is_lang_map(v):
        return v.get(lang) or v.get(PRIMARY) or ''
    return v


def as_plain(v, lang=PRIMARY):
    """Dosya adi gibi tek dil gereken yerler icin duz metin."""
    v = in_lang(v, lang)
    if isinstance(v, (list, tuple)):
        return ' '.join(str(x) for x in v)
    return '' if v is None else str(v)


def missing_urls(spec):
    """url'si olmayan story'lerin basliklarini dondurur.

    Uygulamada her haberin altinda "kaynak sayfasina git" baglantisi cikar;
    url yazilmazsa o satirda baglanti hic olusmuyor. Sessizce gecmek yerine
    yayini durduruyoruz.
    """
    out = []
    for i, s in enumerate(spec.get('stories') or []):
        if not isinstance(s, dict):
            continue
        if not str(s.get('url') or '').startswith(('http://', 'https://')):
            label = as_plain(s.get('title')) or as_plain(s.get('summary')) or '(basliksiz)'
            out.append('%d. %s' % (i + 1, label))
    return out


def duplicate_urls(spec):
    """Ayni url'yi paylasan story'ler.

    Uygulama okundu/yildiz durumunu url'ye bagliyor: ayni url iki haberde
    kullanilirsa ikincisi arayuzde sessizce kaybolur. Yayini burada durdurmak
    o sessiz kaybi onluyor.
    """
    seen, dupes = {}, []
    for i, s in enumerate(spec.get('stories') or []):
        if not isinstance(s, dict):
            continue
        url = str(s.get('url') or '').strip()
        if not url:
            continue
        if url in seen:
            dupes.append('%d. %s  (ayni url: %d. haber)' % (
                i + 1, as_plain(s.get('title')) or url, seen[url] + 1))
        else:
            seen[url] = i
    return dupes


def bad_category(spec):
    cat = str(spec.get('category') or '').strip().lower()
    if not cat:
        return 'kategori yazilmamis'
    if cat not in CATEGORIES:
        return '"%s" gecerli bir kategori degil' % cat
    return None


def untranslated(spec):
    """Turkce karsiligi eksik olan alanlar — uyari olarak listelenir."""
    out = []
    for i, s in enumerate(spec.get('stories') or []):
        if not isinstance(s, dict):
            continue
        gaps = []
        for name in TRANSLATED:
            v = s.get(name)
            if v is None or v == '' or v == []:
                continue
            if not is_lang_map(v):
                gaps.append(name)
            elif not v.get('tr'):
                gaps.append(name)
        if gaps:
            out.append('%d. %s — %s' % (i + 1, as_plain(s.get('title')) or '(basliksiz)',
                                        ', '.join(gaps)))
    return out


def missing_primary(spec):
    """Ingilizce karsiligi olmayan story basliklari — bunlar yayini durdurur."""
    out = []
    for i, s in enumerate(spec.get('stories') or []):
        if not isinstance(s, dict):
            continue
        if not as_plain(s.get('title'), PRIMARY) and not as_plain(s.get('summary'), PRIMARY):
            out.append('%d. haber' % (i + 1))
    return out


def publish(spec, out_dir, require_url=True, require_category=True):
    if not spec.get('title'):
        raise SystemExit('Hata: "title" alani zorunlu')

    if require_category:
        problem = bad_category(spec)
        if problem:
            raise SystemExit(
                'Hata: %s. Gecerli kategoriler: %s'
                % (problem, ', '.join(CATEGORIES))
                + '\n\n(--allow-any-category ile gecebilirsin, onerilmez.)')

    blank = missing_primary(spec)
    if blank:
        raise SystemExit(
            'Hata: su haberlerde Ingilizce metin yok — uygulama Ingilizce aciliyor:\n  '
            + '\n  '.join(blank))

    if require_url:
        bad = missing_urls(spec)
        if bad:
            raise SystemExit(
                'Hata: su haberlerde "url" yok — okuyucu kaynaga gidemez:\n  '
                + '\n  '.join(bad)
                + '\n\nHer story icin haberin dogrudan adresini yaz.'
                  ' Gercekten adres yoksa --allow-missing-url ile gecebilirsin.')

        dupes = duplicate_urls(spec)
        if dupes:
            raise SystemExit(
                'Hata: ayni url birden fazla haberde kullanilmis — ikincisi'
                ' arayuzde gorunmez:\n  ' + '\n  '.join(dupes)
                + '\n\nAyni kaynaktan cikan birden fazla gelismeyi tek haberde'
                  ' "points" listesiyle birlestir.')

    gaps = untranslated(spec)
    if gaps:
        sys.stderr.write(
            'Uyari: su haberlerde Turkce karsilik eksik — Turkce secildiginde'
            ' Ingilizcesi gorunecek:\n  ' + '\n  '.join(gaps) + '\n')

    spec = dict(spec)
    spec.setdefault('date', date.today().isoformat())
    spec.setdefault('author', 'Daily Now')

    # Dosya adi tek dilden uretilir (Ingilizce), yoksa iki dilli baslik
    # "[object Object]" gibi bir ada donusurdu.
    naming = dict(spec)
    naming['title'] = as_plain(spec.get('title'))
    naming['source'] = as_plain(spec.get('source'))
    base = file_base(naming)
    json_path = os.path.join(out_dir, base + '.json')

    # Ayni tabanda eski bir PDF kalmis olabilir (eski format) — kalirsa Daily
    # Now bu JSON'u PDF'in sidecar'i sanip icerigi gormezden gelir. Temizle.
    old_pdf = os.path.join(out_dir, base + '.pdf')
    if os.path.exists(old_pdf):
        os.remove(old_pdf)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)

    return json_path


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec', help='JSON dosyasi, ya da stdin icin -')
    ap.add_argument('--out', default=os.path.join(ROOT, 'inbox'),
                    help='hedef klasor (varsayilan: inbox/)')
    ap.add_argument('--allow-missing-url', action='store_true',
                    help='url yazilmamis haberlere de izin ver (onerilmez)')
    ap.add_argument('--allow-any-category', action='store_true',
                    help='listede olmayan kategori adina izin ver (onerilmez)')
    args = ap.parse_args()

    raw = sys.stdin.read() if args.spec == '-' else open(args.spec, encoding='utf-8').read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise SystemExit('Hata: JSON cozumlenemedi — %s' % e)

    os.makedirs(args.out, exist_ok=True)
    for spec in (data if isinstance(data, list) else [data]):
        path = publish(spec, args.out,
                       require_url=not args.allow_missing_url,
                       require_category=not args.allow_any_category)
        print('  ' + os.path.relpath(path, ROOT))

    # Statik barindirma icin: uygulama artik /api/inbox yerine bu dosyayi okur.
    idx = write_index(args.out, os.path.join(args.out, 'index.json'))
    print('  %s  (%d PDF, %d native haber)' % (
        os.path.relpath(os.path.join(args.out, 'index.json'), ROOT),
        len(idx['files']), len(idx['articles'])))
