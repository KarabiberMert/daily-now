#!/usr/bin/env python3
"""Bagimsiz, kutuphanesiz haber PDF yazici.

Sadece standart kutuphane kullanir (zlib). Ciktisi metin katmani iceren
gercek bir PDF'tir; Daily Now bu metni arama icin cikarabilir.

    from newspdf import build_pdf, slugify
    pdf_bytes = build_pdf({...})
"""

import zlib
from datetime import date

# ── Turkce ve tipografik karakterler icin ozel kodlar (128+) ───────────────
SPECIAL = {
    'ç': (128, 'ccedilla'), 'Ç': (129, 'Ccedilla'),
    'ğ': (130, 'gbreve'),   'Ğ': (131, 'Gbreve'),
    'ı': (132, 'dotlessi'), 'İ': (133, 'Idotaccent'),
    'ö': (134, 'odieresis'), 'Ö': (135, 'Odieresis'),
    'ş': (136, 'scedilla'), 'Ş': (137, 'Scedilla'),
    'ü': (138, 'udieresis'), 'Ü': (139, 'Udieresis'),
    '“': (140, 'quotedblleft'), '”': (141, 'quotedblright'),
    '’': (142, 'quoteright'),   '–': (143, 'endash'),
    '·': (144, 'periodcentered'), '…': (145, 'ellipsis'),
    '‘': (146, 'quoteleft'), '—': (147, 'emdash'),
    '€': (148, 'Euro'), '%': (37, 'percent'),
}

_W_NARROW = set("iljtfIr.,:;'|!()[]{}/\\ ")
_W_WIDE = set("mwMW@%")


def text_width(s, size):
    """Helvetica icin kaba genislik tahmini (satir sarmaya yeter)."""
    total = 0
    for ch in s:
        if ch in _W_NARROW:
            total += 280
        elif ch in _W_WIDE:
            total += 830
        elif ch.isupper():
            total += 680
        else:
            total += 540
    return total * size / 1000.0


def enc(s):
    out = bytearray()
    for ch in s:
        if ch in SPECIAL:
            out.append(SPECIAL[ch][0])
        elif ch in '()\\':
            out += b'\\' + ch.encode('latin-1')
        elif ord(ch) < 128:
            out += ch.encode('latin-1')
        else:
            out += b'?'
    return bytes(out)


def wrap(text, size, max_w):
    lines, cur = [], ''
    for word in text.split():
        trial = (cur + ' ' + word).strip()
        if text_width(trial, size) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def slugify(s, limit=80):
    keep = []
    for ch in s:
        if ch.isalnum() or ch in ' -':
            keep.append(ch)
        elif ch in '.,:;':
            continue
    return ' '.join(''.join(keep).split())[:limit].strip()


class Pdf:
    """Cok kucuk bir PDF yazici — Helvetica ve Helvetica-Bold."""

    W, H = 595, 842
    MARGIN = 64

    LINK_RGB = (0.13, 0.32, 0.62)

    def __init__(self):
        self.ops = bytearray()
        self.pages = []
        self.links = []
        self.page_links = []
        self.y = self.H - self.MARGIN

    def _text(self, s, x, y, size, bold=False, gray=0.0, rgb=None):
        font = b'/F2' if bold else b'/F1'
        self.ops += b'BT %s %g Tf ' % (font, size)
        if rgb:
            self.ops += b'%g %g %g rg ' % rgb
        else:
            self.ops += b'%g g ' % gray
        self.ops += b'%g %g Td (' % (x, y)
        self.ops += enc(s)
        self.ops += b') Tj ET\n'

    def _text_link(self, s, x, y, size, uri, gray=0.4):
        """Metni tikanabilir link rengiyle cizer, altini cizer ve tiklama alanini kaydeder."""
        self._text(s, x, y, size, rgb=self.LINK_RGB)
        w = text_width(s, size)
        self.ops += b'%g %g %g rg %g %g %g 0.6 re f\n' % (self.LINK_RGB + (x, y - 2, w))
        self.links.append((x, y - 2, x + w, y + size * 0.78, uri))

    def _rule(self, y, gray=0.82, w=None):
        self.ops += b'%g g %g %g %g 1 re f\n' % (gray, self.MARGIN, y, w or (self.W - 2 * self.MARGIN))

    def _need(self, h):
        if self.y - h < self.MARGIN + 30:
            self.new_page()

    def new_page(self):
        self.pages.append(bytes(self.ops))
        self.page_links.append(self.links)
        self.ops = bytearray()
        self.links = []
        self.y = self.H - self.MARGIN

    def kicker(self, s):
        self._need(30)
        self._text(s.upper(), self.MARGIN, self.y, 8.5, bold=True, gray=0.35)
        self.y -= 8
        self._rule(self.y, 0.75, 44)
        self.y -= 22

    def headline(self, s):
        size = 23 if len(s) < 60 else 19
        for line in wrap(s, size, self.W - 2 * self.MARGIN):
            self._need(size + 10)
            self._text(line, self.MARGIN, self.y, size, bold=True)
            self.y -= size + 6
        self.y -= 8

    def byline(self, s):
        self._need(26)
        self._text(s, self.MARGIN, self.y, 9, gray=0.42)
        self.y -= 12
        self._rule(self.y, 0.85)
        self.y -= 24

    def lead(self, s):
        self.para(s, size=12.5, gray=0.18, lead=18)

    def para(self, s, size=10.5, gray=0.12, lead=15.5):
        for line in wrap(s, size, self.W - 2 * self.MARGIN):
            self._need(lead)
            self._text(line, self.MARGIN, self.y, size, gray=gray)
            self.y -= lead
        self.y -= 7

    def subhead(self, s):
        self._need(30)
        self.y -= 6
        self._text(s, self.MARGIN, self.y, 12.5, bold=True)
        self.y -= 20

    def bullet(self, s):
        for i, line in enumerate(wrap(s, 10.5, self.W - 2 * self.MARGIN - 18)):
            self._need(15.5)
            if i == 0:
                self.ops += b'0.4 g %g %g 4 4 re f\n' % (self.MARGIN + 3, self.y + 3)
            self._text(line, self.MARGIN + 18, self.y, 10.5, gray=0.12)
            self.y -= 15.5
        self.y -= 3

    def source_line(self, s, uri=None):
        """Bir bullet'in altina kucuk kaynak satiri; uri verilirse tiklanabilir olur."""
        for line in wrap(s, 8.5, self.W - 2 * self.MARGIN - 18):
            self._need(12)
            if uri:
                self._text_link(line, self.MARGIN + 18, self.y, 8.5, uri)
            else:
                self._text(line, self.MARGIN + 18, self.y, 8.5, gray=0.55)
            self.y -= 12
        self.y -= 6

    def quote(self, s):
        for line in wrap(s, 12, self.W - 2 * self.MARGIN - 22):
            self._need(19)
            self.ops += b'0.75 g %g %g 3 -14 re f\n' % (self.MARGIN, self.y + 9)
            self._text(line, self.MARGIN + 18, self.y, 12, gray=0.3)
            self.y -= 19
        self.y -= 9

    def footnote(self, s):
        self.para(s, size=8.5, gray=0.55, lead=12)

    def footnote_link(self, label, uri):
        """footnote() ile ayni gorunumde ama tiklanabilir bir satir."""
        for line in wrap(label, 8.5, self.W - 2 * self.MARGIN):
            self._need(12)
            self._text_link(line, self.MARGIN, self.y, 8.5, uri)
            self.y -= 12
        self.y -= 7

    def build(self):
        self.pages.append(bytes(self.ops))
        self.page_links.append(self.links)
        objs = []

        def add(b):
            objs.append(b)
            return len(objs)

        diffs = ' '.join('%d /%s' % (c, n) for c, n in sorted(SPECIAL.values()))
        enc_obj = add(b'<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [ '
                      + diffs.encode() + b' ] >>')
        f1 = add(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding %d 0 R >>' % enc_obj)
        f2 = add(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding %d 0 R >>' % enc_obj)

        content_ids = []
        for content in self.pages:
            data = zlib.compress(content, 9)
            content_ids.append(add(
                b'<< /Length %d /Filter /FlateDecode >>\nstream\n' % len(data) + data + b'\nendstream'))

        pages_id = add(b'')  # asagida dolduruluyor
        page_ids = []
        for cid, links in zip(content_ids, self.page_links):
            annot_ids = [
                add(b'<< /Type /Annot /Subtype /Link /Rect [ %g %g %g %g ] /Border [0 0 0] '
                    b'/A << /S /URI /URI (%s) >> >>' % (x0, y0, x1, y1, enc(uri)))
                for (x0, y0, x1, y1, uri) in links
            ]
            annots = (b' /Annots [ ' + b' '.join(b'%d 0 R' % a for a in annot_ids) + b' ]') if annot_ids else b''
            page_ids.append(add(
                b'<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %d %d] '
                b'/Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> /Contents %d 0 R%s >>'
                % (pages_id, self.W, self.H, f1, f2, cid, annots)))
        objs[pages_id - 1] = (b'<< /Type /Pages /Count %d /Kids [ ' % len(page_ids)
                              + b' '.join(b'%d 0 R' % p for p in page_ids) + b' ] >>')
        root = add(b'<< /Type /Catalog /Pages %d 0 R >>' % pages_id)

        out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
        offsets = []
        for i, b in enumerate(objs, 1):
            offsets.append(len(out))
            out += b'%d 0 obj\n' % i + b + b'\nendobj\n'
        xref = len(out)
        out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
        for off in offsets:
            out += b'%010d 00000 n \n' % off
        out += (b'trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n'
                % (len(objs) + 1, root, xref))
        return bytes(out)


def build_pdf(spec):
    """Haber sozlugunden PDF bytes uretir.

    Beklenen alanlar: title (zorunlu), source, date, kicker, lead,
    body [{heading, text} | {bullets: [...]}], quote, footer.

    bullets listesindeki her ogun duz metin (str) ya da
    {"text": "...", "source": "Reuters", "url": "https://..."} seklinde bir
    sozluk olabilir; sozluk verilirse madde altina kucuk gri bir kaynak/link
    satiri eklenir.
    """
    d = spec.get('date') or date.today().isoformat()
    pdf = Pdf()
    if spec.get('kicker'):
        pdf.kicker(spec['kicker'])
    pdf.headline(spec['title'])

    parts = [spec.get('source'), '.'.join(reversed(d.split('-')))]
    if spec.get('author'):
        parts.append(spec['author'])
    pdf.byline('  ·  '.join(p for p in parts if p))

    if spec.get('lead'):
        pdf.lead(spec['lead'])

    for block in spec.get('body', []):
        if isinstance(block, str):
            pdf.para(block)
            continue
        if block.get('heading'):
            pdf.subhead(block['heading'])
        if block.get('text'):
            pdf.para(block['text'])
        for b in block.get('bullets', []):
            if isinstance(b, dict):
                pdf.bullet(b.get('text', ''))
                uri = b.get('url')
                src = b.get('source', '')
                if uri:
                    # Gorunen metin kisa tutulur (URL'nin kendisi degil) — cok uzun
                    # URL'ler tek "kelime" oldugu icin satir sarma bunlari boleemez
                    # ve sayfa disina tasabilir. Tiklandiginda yine tam url'e gider.
                    pdf.source_line('Kaynak: %s' % (src or 'bağlantı'), uri=uri)
                elif src:
                    pdf.source_line('Kaynak: %s' % src)
            else:
                pdf.bullet(b)

    if spec.get('quote'):
        pdf.quote('“%s”' % spec['quote'].strip('“”"'))
    if spec.get('url'):
        pdf.footnote_link('Kaynak: %s' % (spec.get('source') or 'bağlantı'), spec['url'])
    if spec.get('footer'):
        pdf.footnote(spec['footer'])
    return pdf.build()


def file_base(spec):
    """Daily Now'in bekledigi dosya adi govdesi."""
    d = spec.get('date') or date.today().isoformat()
    return '%s__%s__%s' % (d, slugify(spec.get('source') or 'Cowork', 40), slugify(spec['title']))
