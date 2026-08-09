#!/usr/bin/env python3
"""Ornek gundem ozetleri uretir (deneme / demo icin).

    python3 tools/make_sample_news.py [--out inbox] [--clean]

Gercek akisla ayni yolu kullanir: publish_news.publish(). Kategori basina bir
dosya yazar; her dosya "stories" dizisiyle sirali basliklari icerir.

Icerik uydurmadir — yalnizca arayuzu denemek icindir.
"""

import argparse
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from publish_news import publish  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DIGESTS = [
    dict(
        category='economy', label='Economy', days_ago=0,
        stories=[
            dict(title='Merkez Bankası politika faizini 250 baz puan indirdi',
                 summary='Politika faizi yüzde 39 seviyesine çekildi; karar piyasa '
                         'beklentisinin üzerinde geldi.',
                 detail='Para Politikası Kurulu politika faizini 250 baz puan indirerek yüzde 39 '
                        'seviyesine çekti. Anket katılımcılarının medyan beklentisi 200 baz puanlık '
                        'bir indirim yönündeydi, dolayısıyla karar piyasayı bir miktar şaşırttı.'
                        '\n\n'
                        'Kurul metninde aylık enflasyonun ana eğiliminde belirgin bir bozulma '
                        'görülmediği vurgulandı ve sıkı duruşun kalıcı iyileşme sağlanana dek '
                        'süreceği yinelendi. Kararın ardından tahvil faizlerinde sınırlı gerileme '
                        'izlendi, kur tarafında sert bir hareket olmadı.',
                 points=['Politika faizi: %41,5 → %39',
                         'Beklenti 200 baz puan indirim yönündeydi',
                         'Bankacılık endeksi günü %1,4 artıda kapattı'],
                 source='AA', time='14:00'),
            dict(title='Yüksek hızlı tren hattında test sürüşleri başladı',
                 summary='213 kilometrelik hatta sinyalizasyon ve elektrifikasyon tamamlandı.',
                 detail='Sinyalizasyon ve elektrifikasyon çalışmalarının tamamlanmasının ardından '
                        'hatta ilk test sürüşleri gerçekleştirildi. Testler kademeli olarak hız '
                        'artırılarak sürdürülecek; ticari işletmeye açılış için hedef takvim yıl '
                        'sonu olarak açıklandı. Hat devreye girdiğinde iki şehir arasındaki seyahat '
                        'süresinin yaklaşık 5 saatten 1 saat 50 dakikaya düşmesi bekleniyor.',
                 points=['Hat uzunluğu: 213 km', 'Hedef: yıl sonu', 'Seyahat süresi: 5 sa → 1 sa 50 dk'],
                 source='NTV', time='11:20'),
            dict(title='Bankacılık endeksi günü yüzde 1,4 yükselişle kapattı',
                 summary='Faiz kararının ardından tahvil faizlerinde sınırlı gerileme izlendi; '
                         'kur tarafında sert bir hareket görülmedi.',
                 source='Bloomberg HT', time='18:10'),
        ],
    ),
    dict(
        category='world', label='Dünya Gündemi', days_ago=0,
        stories=[
            dict(title='İklim zirvesinde metan için bağlayıcı takvim kabul edildi',
                 summary='Ülkeler enerji kaynaklı metan salımını 2030\'a dek yüzde 45 azaltma '
                         'taahhüdüne uydu tabanlı bağımsız denetim mekanizması ekledi.',
                 source='AFP', time='09:45'),
            dict(title='Uyum finansmanında rakam üzerinde anlaşılamadı',
                 summary='Gelişmekte olan ülkelerin talep ettiği kalemde uzlaşma sağlanamadı; '
                         'konu gelecek yılki zirveye bırakıldı.',
                 source='Reuters', time='22:30'),
        ],
    ),
    dict(
        category='tech', label='Teknoloji Gündemi', days_ago=0,
        stories=[
            dict(title='Yapay zeka çip talebi veri merkezi yatırımlarını rekora taşıdı',
                 summary='Üç büyük bulut sağlayıcısının sermaye harcaması yıllık yüzde 60 arttı.',
                 detail='Hiperölçekli bulut sağlayıcılarının çeyreklik bilançoları, veri merkezi '
                        'yatırımlarının yıllık bazda yüzde 60 civarında arttığını gösterdi; bu '
                        'yılki toplam sermaye harcaması beklentisi 400 milyar doları aştı. Şirket '
                        'yöneticileri talebin arzın önünde gitmeye devam ettiğini söylüyor.'
                        '\n\n'
                        'Analistler asıl kısıtın çip üretiminden çok elektrik şebekesi kapasitesine '
                        'kaydığını belirtiyor. Birkaç projede devreye alma takvimi, şebeke bağlantısı '
                        'beklendiği için 2027 sonrasına ertelendi.',
                 points=['Yıllık artış: %60', 'Toplam beklenti: 400 milyar dolar üzeri'],
                 source='Bloomberg', time='16:05'),
            dict(title='Darboğaz çip üretiminden elektrik şebekesine kaydı',
                 summary='Birkaç veri merkezi projesinde devreye alma takvimi şebeke bağlantısı '
                         'nedeniyle 2027 sonrasına ertelendi.',
                 source='Ars Technica', time='13:40'),
        ],
    ),
    dict(
        category='usmarkets', label='US Markets', days_ago=0,
        stories=[
            dict(title='Petrol üst üste dördüncü haftayı düşüşle kapattı',
                 summary='Brent, arz artışı ve stok verilerindeki beklenmedik yükselişle varil '
                         'başına 62 doların altını test etti.',
                 source='Financial Times', time='21:00'),
            dict(title='Rafineri marjları güçlü seyrini koruyor',
                 summary='Orta distilat marjları yüksek kalmayı sürdürüyor; ham petroldeki '
                         'zayıflık ürün tarafına tam yansımadı.',
                 source='Reuters', time='20:15'),
        ],
    ),
    dict(
        category='world', label='Dünya Gündemi', days_ago=1,
        stories=[
            dict(title='Düzenli yürüyüş kalp riskini belirgin biçimde azaltıyor',
                 summary='180 bin kişilik on yıllık kohort, günde 7 bin adımı aşanlarda '
                         'kardiyovasküler riskin yüzde 28 düşük olduğunu buldu.',
                 source='The Guardian', time='12:00'),
        ],
    ),
]


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'inbox'))
    ap.add_argument('--clean', action='store_true', help='once klasordeki ornekleri sil')
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    if args.clean:
        for n in os.listdir(args.out):
            if n.endswith(('.pdf', '.json')):
                os.remove(os.path.join(args.out, n))

    for d in DIGESTS:
        day = date.today() - timedelta(days=d['days_ago'])
        spec = {
            'title': '%s — %s' % (d['label'], day.strftime('%d.%m.%Y')),
            'category': d['category'],
            'date': day.isoformat(),
            'source': 'Örnek Veri',
            'stories': d['stories'],
        }
        print('  ' + os.path.basename(publish(spec, args.out)))

    print('\n%d ornek gundem yazildi -> %s\n' % (len(DIGESTS), args.out))
