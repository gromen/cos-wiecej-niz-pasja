"""
Shirt photo pipeline (runs locally, nothing leaves the machine).

  photos/raw/<igPost>/1.(webp|jpg)  – front, as posted on Instagram
  photos/raw/<igPost>/2.(webp|jpg)  – back

→ src/assets/shirts/<igPost>/front.png, back.png   (transparent cut-out, hanger removed,
                                                     normalised to a 5:6 canvas)
→ src/assets/shirts/<igPost>/original-1.webp, original-2.webp  (untouched originals)

Usage:  .venv-photos/bin/python scripts/cutout.py [post ...]
Model:  rembg "birefnet-general-lite" (downloaded once to ~/.u2net).
"""

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "photos" / "raw"
OUT = ROOT / "src" / "assets" / "shirts"

CANVAS = (1000, 1200)  # 5:6, matches the SVG placeholder box
FILL_W = 0.9  # shirt width as a share of canvas width
FILL_H = 0.92  # …but never taller than this share of canvas height
HOOK_RATIO = 0.2  # top rows narrower than this share of the widest row are the hanger hook
ALPHA_CUT = 24  # alpha below this counts as background when measuring


def remove_hanger(img: Image.Image) -> Image.Image:
    """Drop the hanger hook sticking out above the collar (thin rows at the top)."""
    alpha = np.asarray(img.getchannel("A"))
    widths = (alpha > ALPHA_CUT).sum(axis=1)
    if widths.max() == 0:
        return img
    threshold = widths.max() * HOOK_RATIO
    first_body_row = int(np.argmax(widths > threshold))
    if first_body_row == 0:
        return img
    arr = np.asarray(img).copy()
    arr[:first_body_row, :, 3] = 0
    return Image.fromarray(arr)


def normalise(img: Image.Image) -> Image.Image:
    """Trim to the shirt, scale to a common size and centre it on a 5:6 transparent canvas."""
    bbox = img.getchannel("A").point(lambda a: 255 if a > ALPHA_CUT else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    scale = min(CANVAS[0] * FILL_W / img.width, CANVAS[1] * FILL_H / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.paste(img, ((CANVAS[0] - img.width) // 2, (CANVAS[1] - img.height) // 2), img)
    return canvas


def source(folder: Path, index: int) -> Path | None:
    return next((p for p in sorted(folder.glob(f"{index}.*"))), None)


def main() -> None:
    posts = sys.argv[1:] or sorted(p.name for p in RAW.iterdir() if p.is_dir())
    session = new_session("birefnet-general-lite")
    for post in posts:
        folder = RAW / post
        target = OUT / post
        target.mkdir(parents=True, exist_ok=True)
        for index, side in ((1, "front"), (2, "back")):
            src = source(folder, index)
            if not src:
                print(f"#{post}: brak {index}.*")
                continue
            shutil.copyfile(src, target / f"original-{index}{src.suffix}")
            cut = remove(Image.open(src).convert("RGB"), session=session, post_process_mask=True)
            normalise(remove_hanger(cut.convert("RGBA"))).save(target / f"{side}.png", optimize=True)
            print(f"#{post}: {side} ✓")


if __name__ == "__main__":
    main()
