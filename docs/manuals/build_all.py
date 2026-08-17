#!/usr/bin/env python3
"""
Build the three J-TACS user manuals as PDFs.

    python3 docs/manuals/build_all.py

Writes <role>-manual.html next to this file and <role>-manual.pdf beside it.
Rendering is done by headless Chromium because it supports CSS paged-media
margin boxes, which is what gives the manuals real running footers and page
numbers rather than hand-drawn ones.
"""

import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import employee_manual  # noqa: E402
import manager_manual  # noqa: E402
import partner_manual  # noqa: E402

MANUALS = [
    ("partner", partner_manual, "J-TACS Partner Manual"),
    ("manager", manager_manual, "J-TACS Manager Manual"),
    ("employee", employee_manual, "J-TACS Employee Manual"),
]

CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
    shutil.which("google-chrome") or "",
]


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if c and os.path.exists(c):
            return c
    # Last resort: any chrome under the Playwright browser root.
    for root, _dirs, files in os.walk("/opt/pw-browsers"):
        if "chrome" in files:
            return os.path.join(root, "chrome")
    raise SystemExit("No Chromium found — cannot render PDFs.")


def main() -> int:
    chrome = find_chrome()
    failures = []

    for slug, module, title in MANUALS:
        html_path = os.path.join(HERE, f"{slug}-manual.html")
        pdf_path = os.path.join(HERE, f"{slug}-manual.pdf")

        with open(html_path, "w", encoding="utf-8") as fh:
            fh.write(module.build())

        subprocess.run(
            [
                chrome,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--no-pdf-header-footer",
                f"--print-to-pdf={pdf_path}",
                html_path,
            ],
            check=True,
            capture_output=True,
        )

        if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) < 5000:
            failures.append(f"{title}: PDF missing or suspiciously small")
            continue

        size_kb = os.path.getsize(pdf_path) / 1024
        print(f"  {title:32}  {size_kb:6.0f} KB   {os.path.basename(pdf_path)}")

    if failures:
        for f in failures:
            print(f"FAILED  {f}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
