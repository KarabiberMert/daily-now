#!/usr/bin/env python3
"""Bir gundem ozetini Daily Now gelen kutusuna birakir.

    python3 tools/publish_news.py gundem.json
    cat gundem.json | python3 tools/publish_news.py -

inbox/ altina tek bir .json dosyasi yazilir (PDF uretilmez). Daily Now bunu
okur ve **stories** dizisindeki her maddeyi Akis'ta ayri bir haber satiri
olarak, yazildigi sirayla gosterir. Kullanici satira tiklayinca haber
UYGULAMA ICINDE, yerinde acilir (detail + points gorunur); kaynak sayfasina
gitmek isterse acilan panelde duran baglantiya basar.

Onerilen bicim — kategori basina bir dosya:

    {
      "title":    "Türkiye Gündemi — 7 Ağustos 2026",
      "category": "turkey",              // world | turkey | markets | tech | sports | health
      "date":     "2026-08-07",
      "source":   "Cowork Günlük Özet",
      "stories": [
        {
          "title":   "Kısa, net Türkçe başlık",
          "summary": "Listede görünen 1-2 cümlelik Türkçe özet.",
          "detail":  "Tıklayınca açılan 4-6 cümlelik Türkçe anlatı. Ne oldu, rakamlar,
                      arka plan, neden önemli. Paragraf istersen \\n\\n ile ayır ya da
                      dizi ver.",
          "points":  ["isteğe bağlı madde", "bir tane daha"],
          "source":  "AA",
          "url":     "https://…",
          "time":    "07:30"
        }
      ]
    }

Story alanlari:
  title    zorunlu sayilir
  summary  listede gorunur — kisa tut
  detail   yerinde acilan asil ozet. YAZILMAZSA satir acilmaz, tiklama
           dogrudan url'e gider; o yuzden her zaman yaz.
  points   istege bagli madde listesi (rakamlar, alt basliklar)
  url      "Kaynak sayfasina git" baglantisi

Onem sirasi = dizideki sira. Kategori basina 5-8 haber idealdir.

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
            out.append('%d. %s' % (i + 1, s.get('title') or s.get('summary') or '(basliksiz)'))
    return out


def publish(spec, out_dir, require_url=True):
    if not spec.get('title'):
        raise SystemExit('Hata: "title" alani zorunlu')

    if require_url:
        bad = missing_urls(spec)
        if bad:
            raise SystemExit(
                'Hata: su haberlerde "url" yok — okuyucu kaynaga gidemez:\n  '
                + '\n  '.join(bad)
                + '\n\nHer story icin haberin dogrudan adresini yaz.'
                  ' Gercekten adres yoksa --allow-missing-url ile gecebilirsin.')

    spec = dict(spec)
    spec.setdefault('date', date.today().isoformat())
    spec.setdefault('author', 'Cowork')

    base = file_base(spec)
    json_path = os.path.join(out_dir, base + '.json')

    # Ayni tabanda eski bir PDF kalmis olabilir (eski format) — kalirsa Daily
    # News bu JSON'u PDF'in sidecar'i sanip icerigi gormezden gelir. Temizle.
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
                    help='hedef klasor (varsayilan: DailyNews/inbox)')
    ap.add_argument('--allow-missing-url', action='store_true',
                    help='url yazilmamis haberlere de izin ver (onerilmez)')
    args = ap.parse_args()

    raw = sys.stdin.read() if args.spec == '-' else open(args.spec, encoding='utf-8').read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise SystemExit('Hata: JSON cozumlenemedi — %s' % e)

    os.makedirs(args.out, exist_ok=True)
    for spec in (data if isinstance(data, list) else [data]):
        path = publish(spec, args.out, require_url=not args.allow_missing_url)
        print('  ' + os.path.relpath(path, ROOT))

    # Statik barindirma icin: uygulama artik /api/inbox yerine bu dosyayi okur.
    idx = write_index(args.out, os.path.join(args.out, 'index.json'))
    print('  %s  (%d PDF, %d native haber)' % (
        os.path.relpath(os.path.join(args.out, 'index.json'), ROOT),
        len(idx['files']), len(idx['articles'])))
