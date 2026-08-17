"""
Shared design system and page-building helpers for the J-TACS user manuals.

The three manuals are one document family: same grid, same components, one
accent colour swapped per role so a Partner and an Employee holding printouts
side by side can tell instantly which is which.

Rendered by headless Chromium, which supports CSS paged-media margin boxes, so
the running footer and page numbers are real rather than drawn by hand.
"""

from html import escape

# ── Role accents ──────────────────────────────────────────────────────────────

ROLE_THEMES = {
    "partner": {
        "name": "Partner",
        "accent": "#4338CA",
        "accent_soft": "#EEF2FF",
        "accent_line": "#C7D2FE",
        "grad": "linear-gradient(135deg,#312E81 0%,#4338CA 45%,#7C3AED 100%)",
        "tagline": "You run the firm. This is everything it can do.",
    },
    "manager": {
        "name": "Manager",
        "accent": "#0F766E",
        "accent_soft": "#ECFDF5",
        "accent_line": "#99F6E4",
        "grad": "linear-gradient(135deg,#134E4A 0%,#0F766E 45%,#0891B2 100%)",
        "tagline": "You run the work and the team. This is how.",
    },
    "employee": {
        "name": "Employee",
        "accent": "#B45309",
        "accent_soft": "#FFFBEB",
        "accent_line": "#FDE68A",
        "grad": "linear-gradient(135deg,#7C2D12 0%,#B45309 45%,#EA580C 100%)",
        "tagline": "Your work, your hours, your clients. Start here.",
    },
}


def css(theme: dict) -> str:
    return f"""
@page {{
  size: A4;
  margin: 19mm 16mm 16mm;
  @bottom-left {{
    content: "J-TACS  ·  {theme['name']} Manual";
    font-family: "Liberation Sans", sans-serif; font-size: 7.5pt;
    color: #94A3B8; letter-spacing: .04em;
  }}
  @bottom-right {{
    content: counter(page);
    font-family: "Liberation Sans", sans-serif; font-size: 8.5pt;
    color: {theme['accent']}; font-weight: 700;
  }}
}}
@page :first {{
  margin: 0;
  @bottom-left {{ content: ""; }}
  @bottom-right {{ content: ""; }}
}}

* {{ box-sizing: border-box; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{
  margin: 0;
  font-family: "Liberation Sans", "DejaVu Sans", sans-serif;
  font-size: 10pt; line-height: 1.55; color: #1E293B;
}}
h1, h2, h3, h4 {{ font-family: "Bitstream Charter", "DejaVu Serif", Georgia, serif; }}
p {{ margin: 0 0 8pt; }}
strong {{ color: #0F172A; font-weight: 700; }}
a {{ color: {theme['accent']}; text-decoration: none; }}

/* ── Cover ─────────────────────────────────────────────────────────────── */
.cover {{
  background: {theme['grad']};
  color: #fff; height: 297mm; width: 210mm;
  padding: 26mm 20mm 18mm; position: relative; overflow: hidden;
  break-after: page; display: flex; flex-direction: column;
}}
.cover::after {{
  content: ""; position: absolute; right: -70mm; bottom: -90mm;
  width: 190mm; height: 190mm; border-radius: 50%;
  background: rgba(255,255,255,.07);
}}
.cover::before {{
  content: ""; position: absolute; right: -30mm; top: -60mm;
  width: 120mm; height: 120mm; border-radius: 50%;
  background: rgba(255,255,255,.05);
}}
.cv-mark {{
  font-family: "Bitstream Charter", serif; font-size: 26pt; font-weight: 700;
  letter-spacing: .16em; margin-bottom: 2mm;
}}
.cv-mark span {{ opacity: .55; font-weight: 400; }}
.cv-rule {{ width: 26mm; height: 3px; background: rgba(255,255,255,.75); margin-bottom: 16mm; }}
.cv-badge {{
  display: inline-block; align-self: flex-start;
  border: 1.5px solid rgba(255,255,255,.5); border-radius: 999px;
  padding: 3.5mm 8mm; font-size: 11pt; font-weight: 700;
  letter-spacing: .22em; text-transform: uppercase; margin-bottom: 9mm;
  background: rgba(255,255,255,.1);
}}
.cv-title {{
  font-size: 46pt; line-height: 1.03; font-weight: 700;
  margin: 0 0 6mm; letter-spacing: -.02em; position: relative; z-index: 2;
}}
.cv-sub {{
  font-size: 14pt; line-height: 1.5; opacity: .92; max-width: 128mm;
  margin-bottom: 14mm; position: relative; z-index: 2;
}}
.cv-chips {{ display: flex; flex-wrap: wrap; gap: 2.5mm; max-width: 150mm; position: relative; z-index: 2; }}
.cv-chip {{
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.22);
  border-radius: 5px; padding: 2mm 4mm; font-size: 9pt; font-weight: 600;
}}
.cv-foot {{
  margin-top: auto; font-size: 9pt; opacity: .8;
  border-top: 1px solid rgba(255,255,255,.25); padding-top: 5mm;
  position: relative; z-index: 2;
}}

/* ── Contents ──────────────────────────────────────────────────────────── */
.toc {{ break-after: page; }}
.toc-row {{
  display: flex; align-items: baseline; gap: 3mm;
  padding: 2.6mm 0; border-bottom: 1px solid #E2E8F0;
}}
.toc-n {{
  font-family: "Bitstream Charter", serif; font-weight: 700; font-size: 12pt;
  color: {theme['accent']}; width: 9mm; flex: none;
}}
.toc-t {{ font-weight: 600; font-size: 10.5pt; color: #0F172A; }}
.toc-d {{ color: #64748B; font-size: 9pt; margin-left: auto; text-align: right; max-width: 78mm; }}

/* ── Chapters ──────────────────────────────────────────────────────────── */
.chapter {{ break-before: page; }}
.ch-head {{ margin-bottom: 7mm; }}
.ch-kicker {{
  font-size: 8pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase;
  color: {theme['accent']}; margin-bottom: 2mm;
}}
.ch-title {{
  font-size: 25pt; line-height: 1.12; margin: 0 0 3mm; color: #0F172A;
  letter-spacing: -.015em;
}}
.ch-title .num {{ color: {theme['accent_line']}; margin-right: 3mm; }}
.ch-lead {{ font-size: 11pt; color: #475569; line-height: 1.55; max-width: 155mm; }}
.ch-bar {{ height: 3px; width: 100%; background: {theme['grad']}; border-radius: 2px; margin: 5mm 0 7mm; }}

h2.sec {{
  font-size: 14pt; margin: 8mm 0 3mm; color: #0F172A; break-after: avoid;
  padding-bottom: 1.5mm; border-bottom: 2px solid {theme['accent_line']};
}}
h3.sub {{ font-size: 11pt; margin: 6mm 0 2mm; color: {theme['accent']}; break-after: avoid; }}

/* ── Steps ─────────────────────────────────────────────────────────────── */
.steps {{ counter-reset: st; margin: 4mm 0; }}
.step {{
  display: flex; gap: 4mm; padding: 0 0 4.5mm 0; break-inside: avoid;
  position: relative;
}}
.step:not(:last-child)::before {{
  content: ""; position: absolute; left: 3.5mm; top: 8mm; bottom: 0;
  width: 1.5px; background: {theme['accent_line']};
}}
.step-n {{
  counter-increment: st; flex: none; width: 7mm; height: 7mm; border-radius: 50%;
  background: {theme['accent']}; color: #fff; font-size: 8.5pt; font-weight: 700;
  display: flex; align-items: center; justify-content: center; z-index: 1;
}}
.step-n::before {{ content: counter(st); }}
.step-b {{ flex: 1; padding-top: .3mm; }}
.step-t {{ font-weight: 700; color: #0F172A; margin-bottom: 1mm; font-size: 10.5pt; }}
.step-d {{ color: #475569; font-size: 9.5pt; line-height: 1.5; }}
.step-d p {{ margin: 0 0 4pt; }}

/* ── Callouts ──────────────────────────────────────────────────────────── */
.callout {{
  border-left: 3.5px solid; border-radius: 0 6px 6px 0;
  padding: 3.5mm 5mm; margin: 4mm 0; break-inside: avoid; font-size: 9.5pt;
  line-height: 1.5;
}}
.callout .c-t {{ font-weight: 700; margin-bottom: 1.2mm; font-size: 10pt; }}
.callout p:last-child {{ margin-bottom: 0; }}
.c-tip  {{ background: #ECFDF5; border-color: #059669; }}
.c-tip .c-t {{ color: #047857; }}
.c-warn {{ background: #FFF7ED; border-color: #EA580C; }}
.c-warn .c-t {{ color: #C2410C; }}
.c-rule {{ background: #EEF2FF; border-color: #4F46E5; }}
.c-rule .c-t {{ color: #4338CA; }}
.c-note {{ background: #F8FAFC; border-color: #94A3B8; }}
.c-note .c-t {{ color: #475569; }}
.c-stop {{ background: #FEF2F2; border-color: #DC2626; }}
.c-stop .c-t {{ color: #B91C1C; }}

/* ── Tables ────────────────────────────────────────────────────────────── */
/* Long tables must be allowed to split, or a table taller than the remaining
   space jumps to the next page and leaves half a page blank. Rows stay intact
   and the header repeats on each page it continues onto. */
table.tbl {{
  width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt;
  break-inside: auto;
}}
table.tbl thead {{ display: table-header-group; }}
table.tbl tr {{ break-inside: avoid; }}
table.tbl thead th {{
  background: {theme['accent']}; color: #fff; text-align: left;
  padding: 2.6mm 3mm; font-size: 8.5pt; font-weight: 700;
  letter-spacing: .05em; text-transform: uppercase;
}}
table.tbl td {{ padding: 2.4mm 3mm; border-bottom: 1px solid #E2E8F0; vertical-align: top; line-height: 1.45; }}
table.tbl tbody tr:nth-child(even) {{ background: #F8FAFC; }}
table.tbl td:first-child {{ font-weight: 600; color: #0F172A; }}
table.tbl.lg {{ font-size: 9.5pt; }}

/* ── Pipeline flow ─────────────────────────────────────────────────────── */
.flow {{
  display: flex; flex-wrap: wrap; align-items: center; gap: 2mm;
  margin: 4mm 0; break-inside: avoid;
}}
/* Arrow and the chip it points at wrap together, so a long chain never leaves
   a dangling arrow at the end of a line. */
.fl-grp {{ display: inline-flex; align-items: center; gap: 2mm; }}
.fl {{
  background: #fff; border: 1.5px solid {theme['accent_line']};
  border-radius: 6px; padding: 2mm 3.5mm; font-size: 8.5pt; font-weight: 700;
  color: {theme['accent']};
}}
.fl.end-good {{ background: #ECFDF5; border-color: #6EE7B7; color: #047857; }}
.fl.end-bad  {{ background: #FEF2F2; border-color: #FCA5A5; color: #B91C1C; }}
.fl-a {{ color: {theme['accent_line']}; font-weight: 700; font-size: 11pt; }}

/* ── Status chips ──────────────────────────────────────────────────────── */
.chips {{ display: flex; flex-wrap: wrap; gap: 2mm; margin: 3mm 0; }}
.chip {{
  border-radius: 999px; padding: 1.4mm 3.5mm; font-size: 8pt; font-weight: 700;
  border: 1px solid;
}}
.chip.gray  {{ background:#F1F5F9; border-color:#CBD5E1; color:#475569; }}
.chip.blue  {{ background:#EFF6FF; border-color:#93C5FD; color:#1D4ED8; }}
.chip.amber {{ background:#FFFBEB; border-color:#FCD34D; color:#B45309; }}
.chip.violet{{ background:#F5F3FF; border-color:#C4B5FD; color:#6D28D9; }}
.chip.green {{ background:#ECFDF5; border-color:#6EE7B7; color:#047857; }}
.chip.red   {{ background:#FEF2F2; border-color:#FCA5A5; color:#B91C1C; }}

/* ── Cards ─────────────────────────────────────────────────────────────── */
.cards {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3.5mm; margin: 4mm 0; }}
.card {{
  border: 1px solid #E2E8F0; border-top: 3px solid {theme['accent']};
  border-radius: 7px; padding: 4mm; break-inside: avoid; background: #fff;
}}
.card-t {{ font-weight: 700; color: #0F172A; margin-bottom: 1.5mm; font-size: 10pt; }}
.card-d {{ color: #475569; font-size: 9pt; line-height: 1.5; }}
.card-d p:last-child {{ margin-bottom: 0; }}

/* ── Sidebar mock ──────────────────────────────────────────────────────── */
.navmock {{
  border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;
  background: #0F172A; color: #E2E8F0; padding: 4mm; margin: 4mm 0;
  break-inside: avoid; font-size: 8.5pt;
}}
.nm-brand {{
  font-family: "Bitstream Charter", serif; font-weight: 700; font-size: 12pt;
  letter-spacing: .1em; color: #fff; padding-bottom: 3mm;
  border-bottom: 1px solid rgba(255,255,255,.1); margin-bottom: 3mm;
}}
/* Two columns so a full Partner menu — seven groups, twenty-five entries —
   still fits on one page instead of straddling two. */
.nm-cols {{ column-count: 2; column-gap: 7mm; }}
.nm-g {{ margin-bottom: 3mm; break-inside: avoid; }}
.nm-gl {{
  font-size: 6.8pt; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  color: #64748B; margin-bottom: 1.5mm;
}}
.nm-i {{ padding: 1.1mm 2mm; border-radius: 4px; color: #CBD5E1; }}
.nm-i.on {{ background: rgba(99,102,241,.18); color: #A5B4FC; font-weight: 700; }}
.nm-note {{ font-size: 8pt; color: #64748B; font-style: italic; margin-top: 2mm; }}

/* ── Inline bits ───────────────────────────────────────────────────────── */
.ui {{
  background: {theme['accent_soft']}; border: 1px solid {theme['accent_line']};
  border-radius: 4px; padding: .4mm 1.6mm; font-size: 8.5pt; font-weight: 700;
  color: {theme['accent']}; white-space: nowrap;
}}
.path {{
  font-family: "DejaVu Sans Mono", monospace; font-size: 8pt;
  background: #F1F5F9; border-radius: 3px; padding: .4mm 1.4mm; color: #334155;
}}
ul.tight {{ margin: 2mm 0 3mm; padding-left: 5mm; }}
ul.tight li {{ margin-bottom: 1.4mm; line-height: 1.5; }}
ol.tight {{ margin: 2mm 0 3mm; padding-left: 5mm; }}
ol.tight li {{ margin-bottom: 1.4mm; line-height: 1.5; }}

/* ── Quick reference back page ─────────────────────────────────────────── */
.qref {{ break-before: page; }}
/* The whole card must land on one page — it is meant to be torn out and kept
   next to a desk, and a two-page quick reference is not a quick reference. */
.qr-head {{
  background: {theme['grad']}; color: #fff; border-radius: 8px;
  padding: 4.5mm 6mm; margin-bottom: 3.5mm;
}}
.qr-head h2 {{ margin: 0 0 1mm; font-size: 17pt; }}
.qr-head p {{ margin: 0; opacity: .9; font-size: 9pt; }}
.qr-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }}
.qr-box {{
  border: 1px solid #E2E8F0; border-radius: 6px; padding: 3mm; break-inside: avoid;
}}
.qr-box h4 {{
  margin: 0 0 1.5mm; font-size: 9pt; color: {theme['accent']};
  padding-bottom: 1.2mm; border-bottom: 1px solid #E2E8F0;
}}
.qr-box ul {{ margin: 0; padding-left: 4mm; font-size: 8pt; }}
.qr-box li {{ margin-bottom: .8mm; line-height: 1.35; }}
.qr-box ol {{ font-size: 8pt; }}
.qr-box ol li {{ margin-bottom: .8mm; line-height: 1.35; }}
.qr-kv {{ display: flex; justify-content: space-between; gap: 2.5mm; font-size: 8pt; padding: .8mm 0; border-bottom: 1px dotted #E2E8F0; }}
.qr-kv span:last-child {{ color: #64748B; text-align: right; }}
"""


# ── Component helpers ─────────────────────────────────────────────────────────

def cover(theme: dict, title: str, sub: str, chips: list, foot: str) -> str:
    ch = "".join(f'<div class="cv-chip">{escape(c)}</div>' for c in chips)
    return f"""<div class="cover">
  <div class="cv-mark">J<span>-</span>TACS</div>
  <div class="cv-rule"></div>
  <div class="cv-badge">{escape(theme['name'])}</div>
  <h1 class="cv-title">{title}</h1>
  <div class="cv-sub">{sub}</div>
  <div class="cv-chips">{ch}</div>
  <div class="cv-foot">{foot}</div>
</div>"""


def toc(rows: list) -> str:
    body = "".join(
        f'<div class="toc-row"><div class="toc-n">{n}</div>'
        f'<div class="toc-t">{escape(t)}</div><div class="toc-d">{escape(d)}</div></div>'
        for n, t, d in rows
    )
    return f"""<div class="toc">
  <div class="ch-kicker">Contents</div>
  <h1 class="ch-title">What's in here</h1>
  <div class="ch-bar"></div>
  {body}
</div>"""


def chapter(num, title: str, kicker: str, lead: str, body: str) -> str:
    return f"""<div class="chapter">
  <div class="ch-head">
    <div class="ch-kicker">{escape(kicker)}</div>
    <h1 class="ch-title"><span class="num">{num}</span>{title}</h1>
    <div class="ch-lead">{lead}</div>
  </div>
  <div class="ch-bar"></div>
  {body}
</div>"""


def steps(items: list) -> str:
    out = "".join(
        f'<div class="step"><div class="step-n"></div>'
        f'<div class="step-b"><div class="step-t">{t}</div>'
        f'<div class="step-d">{d}</div></div></div>'
        for t, d in items
    )
    return f'<div class="steps">{out}</div>'


def callout(kind: str, title: str, body: str) -> str:
    return f'<div class="callout c-{kind}"><div class="c-t">{title}</div>{body}</div>'


def table(headers: list, rows: list, big=False) -> str:
    th = "".join(f"<th>{escape(h)}</th>" for h in headers)
    tb = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="tbl{" lg" if big else ""}"><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table>'


def flow(items: list) -> str:
    """items: list of (label, kind) where kind is "", "end-good" or "end-bad"."""
    parts = []
    for i, (label, kind) in enumerate(items):
        k = f" {kind}" if kind else ""
        chip = f'<div class="fl{k}">{escape(label)}</div>'
        if i:
            parts.append(f'<div class="fl-grp"><div class="fl-a">&rarr;</div>{chip}</div>')
        else:
            parts.append(chip)
    return f'<div class="flow">{"".join(parts)}</div>'


def chips(items: list) -> str:
    return '<div class="chips">' + "".join(
        f'<div class="chip {c}">{escape(t)}</div>' for t, c in items
    ) + "</div>"


def cards(items: list) -> str:
    return '<div class="cards">' + "".join(
        f'<div class="card"><div class="card-t">{t}</div><div class="card-d">{d}</div></div>'
        for t, d in items
    ) + "</div>"


def navmock(groups: list, note: str = "") -> str:
    g = ""
    for label, items in groups:
        li = "".join(
            f'<div class="nm-i{" on" if on else ""}">{escape(t)}</div>' for t, on in items
        )
        g += f'<div class="nm-g"><div class="nm-gl">{escape(label)}</div>{li}</div>'
    n = f'<div class="nm-note">{escape(note)}</div>' if note else ""
    return (f'<div class="navmock"><div class="nm-brand">J-TACS</div>'
            f'<div class="nm-cols">{g}</div>{n}</div>')


def qref(theme: dict, title: str, sub: str, boxes: list) -> str:
    b = "".join(f'<div class="qr-box"><h4>{escape(t)}</h4>{c}</div>' for t, c in boxes)
    return f"""<div class="qref">
  <div class="qr-head"><h2>{escape(title)}</h2><p>{escape(sub)}</p></div>
  <div class="qr-grid">{b}</div>
</div>"""


def document(theme: dict, title: str, parts: list) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{escape(title)}</title>
<style>{css(theme)}</style></head><body>
{''.join(parts)}
</body></html>"""
