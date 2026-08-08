#!/usr/bin/env python3
"""Ollama ile 6 kategori icin gundem toplar, ozetler ve publish_news.py ile yayinlar.

Mevcut Cowork rutininin (bkz. CLAUDE.md) yerini token/kota harcamadan, tamamen
yerel bir Ollama modeliyle almak icin yazildi. Ayni sema ve yayin akisini kullanir:
kategori basina bir JSON -> tools/publish_news.py -> git add/commit/push.

Kullanim:
    python tools/ollama_gundem.py                        # tum kategoriler, yayinla + push
    python tools/ollama_gundem.py --no-push               # yayinla ama git push yapma
    python tools/ollama_gundem.py --categories markets tech
    python tools/ollama_gundem.py --dry-run               # hicbir sey yazma/yayinlama, sadece uret ve yazdir
"""
import argparse
import html
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
OLLAMA_HOST = "http://127.0.0.1:11434"
MODEL = "qwen2.5:14b"
FETCH_TIMEOUT = 8
ARTICLE_MAX_CHARS = 6000
MAX_CANDIDATES_PER_CATEGORY = 16
# Az ve dogru > cok ve hatali: her uretim bir halusinasyon sansi tasidigi icin
# tam-ozetli haber sayisini dusuk tutuyoruz. Geri kalanlar Ollama'ya hic
# girmeden, RSS basligiyla "sadece baslik" olarak yayinlanir (publish_news.py
# 'detail' yoksa tiklamayi doğrudan kaynak url'e yonlendiriyor).
MAX_STORIES_PER_CATEGORY = 4
MAX_HEADLINE_ONLY_PER_CATEGORY = 4
MAX_RETRIES = 2
RECENCY_DAYS = 1
USER_AGENT = "Mozilla/5.0 (compatible; DailyNowOllama/1.0)"

CATEGORY_LABELS = {
    "world": "Dünya",
    "turkey": "Türkiye",
    "markets": "Borsa",
    "tech": "Teknoloji",
    "sports": "Spor",
    "health": "Sağlık",
}

CATEGORY_QUERIES = {
    "world": ["dünya gündemi", "uluslararası ilişkiler diplomasi"],
    "turkey": ["türkiye gündem", "türkiye son dakika"],
    "markets": ["borsa istanbul BIST TCMB dolar faiz", "wall street fed nasdaq"],
    "tech": ["teknoloji yapay zeka", "teknoloji şirketleri yazılım"],
    "sports": ["spor gündem futbol", "spor haberleri transfer"],
    "health": ["sağlık gündemi", "sağlık bakanlığı hastane"],
}

# world/turkey kasıtlı olarak genel gündem (CLAUDE.md) - orada konu filtresi
# uygulamıyoruz. Diğerlerinde RSS sorgusu bazen alakasız yerel haber (trafik
# kazası, meclis kararı vb.) çekiyor; başlıkta bu anahtar kelimelerden hiçbiri
# yoksa aday Ollama'ya gönderilmeden eleniyor.
ANCHOR_KEYWORDS = {
    "markets": ["borsa", "bist", "tcmb", "dolar", "euro", "faiz", "enflasyon",
                "hisse", "endeks", "wall street", "nasdaq", "fed", "piyasa",
                "yatırım", "tahvil", "dow jones", "s&p", "kripto", "altın"],
    "tech": ["teknoloji", "yapay zeka", "yazılım", "siber", "uygulama", "telefon",
             "bilgisayar", "robot", "uzay", "girişim", "startup", "çip", "google",
             "apple", "microsoft", "meta", "openai", "yapayzeka", "yazilim"],
    "sports": ["spor", "futbol", "basketbol", "voleybol", "maç", "gol", "lig",
               "transfer", "şampiyon", "milli takım", "galatasaray", "fenerbahçe",
               "beşiktaş", "trabzonspor", "oyuncu", "teknik direktör", "olimpiyat"],
    "health": ["sağlık", "hastane", "doktor", "tedavi", "ilaç", "hastalık", "aşı",
               "kanser", "salgın", "pandemi", "klinik", "ameliyat", "tıbbi", "who",
               "dso", "beslenme", "virüs"],
}

TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
             "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

CJK_RE = re.compile(r"[一-鿿぀-ヿ가-힯]")
# qwen2.5, "Fed"i yer yer "Federal Temyiz Mahkemesi" (bir mahkeme) diye yanlis
# cevirebiliyor; bu bilinen halusinasyonu tespit edip reddediyoruz.
KNOWN_HALLUCINATIONS_RE = re.compile(r"federal temyiz mahkemesi", re.I)
NUMBER_TOKEN_RE = re.compile(r"\d[\d.,]*")


def unsupported_numbers(text, source_text):
    """text icindeki sayilardan kaynak metinde (substring olarak) gecmeyenleri dondurur."""
    return [n for n in dict.fromkeys(NUMBER_TOKEN_RE.findall(text)) if n not in source_text]


def tr_date(d):
    return f"{d.day} {TR_MONTHS[d.month - 1]} {d.year}"


def fold(s):
    s = s.replace("İ", "i").replace("I", "i").lower()
    for a, b in (("ı", "i"), ("ğ", "g"), ("ü", "u"), ("ş", "s"), ("ö", "o"), ("ç", "c")):
        s = s.replace(a, b)
    return s


def is_relevant(category, article):
    keywords = ANCHOR_KEYWORDS.get(category)
    if not keywords:
        return True  # world/turkey: kasıtlı olarak filtresiz (genel gündem)
    haystack = fold(f"{article['title']} {article['source']}")
    for kw in keywords:
        pattern = r"(?<![a-z0-9])" + re.escape(fold(kw)) + r"(?![a-z0-9])"
        if re.search(pattern, haystack):
            return True
    return False


def fetch(url, timeout=FETCH_TIMEOUT):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8", errors="replace")


def news_url_for(query):
    q = urllib.parse.quote(f"{query} when:{RECENCY_DAYS}d")
    return f"https://news.google.com/rss/search?q={q}&hl=tr&gl=TR&ceid=TR:tr"


def clean_title(title, source):
    if source and title.endswith(f" - {source}"):
        return title[: -(len(source) + 3)]
    return title


def parse_rss(xml_text):
    items = []
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return items
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_el = item.find("source")
        source = (source_el.text or "").strip() if source_el is not None else "Google Haberler"
        if not title or not link:
            continue
        items.append({
            "title": clean_title(title, source),
            "link": link,
            "pubDate": pub_date,
            "source": source,
        })
    return items


def collect_candidates(category, seen_urls):
    candidates = []
    for query in CATEGORY_QUERIES[category]:
        try:
            xml_text = fetch(news_url_for(query))
        except Exception as exc:
            print(f"  [uyarı] '{query}' sorgusu başarısız: {exc}")
            continue
        candidates.extend(parse_rss(xml_text))

    deduped = []
    local_seen = set()
    dropped_irrelevant = 0
    for c in candidates:
        if c["link"] in local_seen or c["link"] in seen_urls:
            continue
        if not is_relevant(category, c):
            dropped_irrelevant += 1
            continue
        local_seen.add(c["link"])
        deduped.append(c)
    if dropped_irrelevant:
        print(f"  [filtre] {dropped_irrelevant} alakasız aday elendi.")

    def sort_key(item):
        try:
            return parsedate_to_datetime(item["pubDate"])
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)

    deduped.sort(key=sort_key, reverse=True)
    return deduped[:MAX_CANDIDATES_PER_CATEGORY]


def strip_html(html_text):
    text = re.sub(r"<script[\s\S]*?</script>", " ", html_text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<nav[\s\S]*?</nav>", " ", text, flags=re.I)
    text = re.sub(r"<header[\s\S]*?</header>", " ", text, flags=re.I)
    text = re.sub(r"<footer[\s\S]*?</footer>", " ", text, flags=re.I)
    paragraphs = re.findall(r"<p[^>]*>([\s\S]*?)</p>", text, flags=re.I)
    source = "\n".join(paragraphs) if paragraphs else text
    source = re.sub(r"<[^>]+>", " ", source)
    source = html.unescape(source)
    return re.sub(r"\s+", " ", source).strip()


def fetch_article_text(link):
    try:
        return strip_html(fetch(link))[:ARTICLE_MAX_CHARS]
    except Exception:
        return ""


def call_ollama(prompt):
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "format": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "summary": {"type": "string"},
                "detail": {"type": "string"},
                "points": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["title", "summary", "detail"],
        },
        "options": {"temperature": 0.2},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        data = json.loads(res.read().decode("utf-8"))
    return json.loads(data["response"])


def build_prompt(article, body_text):
    source_text = body_text if len(body_text) > 200 else article["title"]
    return f"""Aşağıda bir haberin başlığı, kaynağı ve (varsa) makale metni var. SADECE verilen bilgiye dayanarak bir haber kaydı üret.

Kurallar:
- title: kısa, net, Türkçe, tıklama tuzağı olmayan bir başlık (kaynak başlığını birebir kopyalama, kendi cümlenle yaz)
- summary: 1-2 cümlelik Türkçe özet
- detail: 4-6 cümlelik Türkçe anlatı - ne oldu, rakamlar, arka plan, neden önemli. Kısa geçme, boş bırakma.
- points: varsa 2-4 maddelik önemli rakam/veri listesi (yoksa boş liste bırak)
- Kaynak metni birebir kopyalama, kendi cümlelerinle yaz.
- Rakam veya bilgi uydurma; sadece verilen metinde olanı kullan.
- "Fed" kısaltmasını AÇMA, ÇEVİRME, YORUMLAMA — metinde nerede geçiyorsa
  aynen "Fed" olarak bırak. "Federal Temyiz Mahkemesi" gibi bir kurum ADI
  ASLA YAZMA, bu kesinlikle yanlıştır ve kullanılması yasaktır.
- Diğer kurum/kısaltma isimlerini de olduğu gibi koru, yanlış çevirme.
- Kesinlikle yatırım tavsiyesi (al/sat/tut yorumu) verme, sadece haberi anlat.
- Emoji kullanma. Sadece Türkçe/Latin alfabe kullan.

Başlık: {article['title']}
Kaynak: {article['source']}
Metin: {source_text}
"""


def derive_time(pub_date):
    try:
        dt = parsedate_to_datetime(pub_date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        istanbul = dt.astimezone(timezone.utc) + timedelta(hours=3)
        return istanbul.strftime("%H:%M")
    except Exception:
        return None


def summarize_article(article, body_text):
    source_text = body_text if len(body_text) > 200 else article["title"]
    last_err = None
    for _ in range(MAX_RETRIES):
        try:
            result = call_ollama(build_prompt(article, body_text))
            title = (result.get("title") or "").strip()
            summary = (result.get("summary") or "").strip()
            detail = (result.get("detail") or "").strip()
            points = [p.strip() for p in (result.get("points") or []) if isinstance(p, str) and p.strip()]

            if not title or not summary or len(detail) < 60:
                raise ValueError("eksik/kısa alan")
            combined = f"{title} {summary} {detail}"
            if CJK_RE.search(combined):
                raise ValueError("yabancı alfabe (CJK) tespit edildi")
            if KNOWN_HALLUCINATIONS_RE.search(combined):
                raise ValueError("bilinen halüsinasyon tespit edildi (Fed yanlış çevirisi)")
            bad_nums = unsupported_numbers(f"{summary} {detail}", source_text)
            if bad_nums:
                raise ValueError(f"kaynakta olmayan rakam(lar) uydurulmuş: {bad_nums}")
            # points'teki uydurma rakamli maddeleri sessizce ele; hikayeyi bu yuzden atmaya gerek yok.
            points = [p for p in points if not unsupported_numbers(p, source_text)]

            story = {
                "title": title,
                "summary": summary,
                "detail": detail,
                "source": article["source"],
                "url": article["link"],
            }
            if points:
                story["points"] = points[:4]
            t = derive_time(article["pubDate"])
            if t:
                story["time"] = t
            return story
        except Exception as exc:
            last_err = exc
    print(f"  [atlandı] \"{article['title']}\" özetlenemedi: {last_err}")
    return None


def headline_only_story(article):
    story = {"title": article["title"], "source": article["source"], "url": article["link"]}
    t = derive_time(article["pubDate"])
    if t:
        story["time"] = t
    return story


def build_category(category, seen_urls):
    label = CATEGORY_LABELS[category]
    candidates = collect_candidates(category, seen_urls)
    print(f"[{category}] {len(candidates)} aday haber bulundu.")

    stories = []
    leftover = []
    for article in candidates:
        if article["link"] in seen_urls:
            continue
        if len(stories) >= MAX_STORIES_PER_CATEGORY:
            leftover.append(article)
            continue
        body_text = fetch_article_text(article["link"])
        story = summarize_article(article, body_text)
        if not story:
            continue
        seen_urls.add(story["url"])
        stories.append(story)

    # Kalan adaylar Ollama'dan gecmeden, sadece RSS basligiyla "baslik" olarak
    # eklenir - halusinasyon riski yok, cunku uretilen icerik yok.
    for article in leftover[:MAX_HEADLINE_ONLY_PER_CATEGORY]:
        if article["link"] in seen_urls:
            continue
        seen_urls.add(article["link"])
        stories.append(headline_only_story(article))

    today = datetime.now()
    spec = {
        "title": f"{label} Gündemi — {tr_date(today)}",
        "category": category,
        "date": today.strftime("%Y-%m-%d"),
        "source": "Ollama Günlük Özet",
        "author": "Ollama",
        "stories": stories,
    }
    print(f"[{category}] {len(stories)} haber yayına hazır.")
    return spec


def publish_category(spec, python_exe):
    tmp_path = ROOT / "tools" / f"_tmp_{spec['category']}.json"
    tmp_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        result = subprocess.run(
            [python_exe, str(ROOT / "tools" / "publish_news.py"), str(tmp_path)],
            cwd=str(ROOT), capture_output=True, text=True,
        )
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr)
            return False
        return True
    finally:
        tmp_path.unlink(missing_ok=True)


def git(args):
    return subprocess.run(["git", *args], cwd=str(ROOT), capture_output=True, text=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--categories", nargs="*", default=list(CATEGORY_LABELS.keys()))
    ap.add_argument("--no-push", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    seen_urls = set()
    specs = []
    for category in args.categories:
        if category not in CATEGORY_LABELS:
            print(f"Bilinmeyen kategori: {category}")
            continue
        specs.append(build_category(category, seen_urls))

    if args.dry_run:
        print(json.dumps(specs, ensure_ascii=False, indent=2))
        return

    python_exe = sys.executable
    any_published = False
    for spec in specs:
        if not spec["stories"]:
            print(f"[{spec['category']}] hiç haber yok, atlanıyor.")
            continue
        if publish_category(spec, python_exe):
            any_published = True

    if not any_published:
        print("Yayınlanacak yeni içerik yok.")
        return

    status = git(["status", "--porcelain"])
    if not status.stdout.strip():
        print("Git'te değişiklik yok.")
        return

    git(["add", "-A"])
    commit_msg = f"Ollama gündem güncellemesi - {datetime.now().isoformat(timespec='seconds')}"
    commit = git(["commit", "-m", commit_msg])
    print(commit.stdout or commit.stderr)

    if args.no_push:
        print("--no-push verildi, push atlandı.")
        return

    push = git(["push"])
    if push.returncode != 0:
        print(f"Push başarısız (commit yerelde kaldı): {push.stderr}")
    else:
        print("Push tamamlandı.")


if __name__ == "__main__":
    main()
