"""
Generate all Android mipmap launcher icons from logo/srklogo.png.
Also copies a 1024x1024 version to assets/images/icon.png for Metro.

Requirements:
    pip install Pillow

Run from project root:
    python scripts/generate_icons.py
"""

import os
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "logo" / "srklogo.png"
RES  = ROOT / "android" / "app" / "src" / "main" / "res"

SIZES = [
    ("mipmap-mdpi",    48),
    ("mipmap-hdpi",    72),
    ("mipmap-xhdpi",   96),
    ("mipmap-xxhdpi",  144),
    ("mipmap-xxxhdpi", 192),
]

def resize_and_save(src: Image.Image, dest: Path, size: int):
    img = src.copy()
    img = img.resize((size, size), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="PNG", optimize=True)

def main():
    if not SRC.exists():
        print(f"ERROR: source logo not found at {SRC}")
        return

    with Image.open(SRC).convert("RGBA") as src_img:
        # Metro require() source
        metro_dest = ROOT / "assets" / "images" / "icon.png"
        metro_dest.parent.mkdir(parents=True, exist_ok=True)
        resize_and_save(src_img, metro_dest, 1024)
        print(f"✓  assets/images/icon.png  1024x1024")

        for folder, size in SIZES:
            resize_and_save(src_img, RES / folder / "ic_launcher.png",       size)
            resize_and_save(src_img, RES / folder / "ic_launcher_round.png", size)
            print(f"✓  {folder}  {size}x{size}")

    print("\nDone — rebuild with:  npm run apk:release")

if __name__ == "__main__":
    main()
