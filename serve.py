#!/usr/bin/env python3
"""Daily Now icin kucuk gelistirme sunucusu.

Kullanim:  python3 serve.py [port]
Varsayilan port 8123 -> http://localhost:8123

Duz bir statik dosya sunucusu — inbox/index.json dahil her sey publish_news.py
tarafindan onceden yazilmis dosyalar oldugu icin sunucu tarafi mantik
gerekmiyor. Ayni dizin yapisi Cloudflare Pages gibi statik bir barindirmada
da calisir; bu script yalnizca yerel gelistirme icin. Sunucu yalnizca
127.0.0.1'i dinler.
"""

import http.server
import mimetypes
import os
import socketserver
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

# Python 3.9'un mimetypes tablosu .mjs / .webmanifest bilmiyor; ES module
# import'lari dogru MIME olmadan calismaz.
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/svg+xml", ".svg")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Gelistirme sirasinda tarayici eski dosyayi tutmasin.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (args[0] if args else ""):
            sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    url = "http://localhost:%d/" % PORT
    print("\n  Daily Now  ->  %s" % url)
    print("  Klasor: %s" % ROOT)
    print("  Durdurmak icin Ctrl+C\n")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Kapatildi.\n")
