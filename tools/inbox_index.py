#!/usr/bin/env python3
"""inbox/ klasorunun icerigini tek bir JSON indeksine cikarir.

    python3 tools/inbox_index.py            # inbox/index.json'u yeniden yazar

publish_news.publish() her yayindan sonra bunu otomatik cagirir. Statik
barindirmada (Cloudflare Pages vb.) uygulama artik /api/inbox'a degil,
dogrudan bu dosyaya (inbox/index.json) bakar — sunucu tarafi kod gerekmez.

Iki tur haber var:
  - PDF + (istege bagli) JSON sidecar: klasik, "files"/"sidecars" altinda.
  - Yalniz JSON (esleseni PDF yok): dogrudan uygulama icinde sayfa olarak
    acilan "native" haber, "articles" altinda — tum icerik JSON'da.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX = os.path.join(ROOT, "inbox")
INDEX_PATH = os.path.join(INBOX, "index.json")


def build_index(inbox_dir):
    pdf_files, pdf_bases, json_by_base = [], set(), {}

    for dirpath, dirnames, filenames in os.walk(inbox_dir):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        depth = os.path.relpath(dirpath, inbox_dir).count(os.sep)
        if depth >= 2:
            dirnames[:] = []
        for name in filenames:
            if name.startswith(".") or name == "index.json":
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, inbox_dir).replace(os.sep, "/")
            if name.lower().endswith(".pdf"):
                st = os.stat(full)
                pdf_files.append({"path": rel, "size": st.st_size,
                                   "mtime": int(st.st_mtime * 1000)})
                pdf_bases.add(rel[:-4])
            elif name.lower().endswith(".json"):
                json_by_base[rel[:-5]] = full

    sidecars, articles = {}, []
    for base, full in json_by_base.items():
        try:
            with open(full, encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as e:
            sys.stderr.write("  json okunamadi: %s (%s)\n" % (base, e))
            continue
        if base in pdf_bases:
            sidecars[base] = data
        else:
            st = os.stat(full)
            entry = dict(data)
            entry["path"] = base + ".json"
            entry["size"] = st.st_size
            entry["mtime"] = int(st.st_mtime * 1000)
            articles.append(entry)

    pdf_files.sort(key=lambda f: f["path"])
    articles.sort(key=lambda f: f["path"])
    return {"ok": True, "root": "inbox", "files": pdf_files,
            "sidecars": sidecars, "articles": articles}


def write_index(inbox_dir=INBOX, index_path=INDEX_PATH):
    index = build_index(inbox_dir)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    return index


if __name__ == "__main__":
    idx = write_index()
    print("  inbox/index.json yazildi — %d PDF, %d native haber" %
          (len(idx["files"]), len(idx["articles"])))
