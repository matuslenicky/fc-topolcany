# Fotky z webu klubu (fcto.sk) -> src/img/foto/<meno>-<šírka>.webp + data/foto-out.json (pre build.js)
#   python -I scripts/photos.py          (FORCE=1 prepíše aj existujúce súbory)
# Vstup: media/fcto/ (stiahnuté z fcto.sk, mimo repozitára) a výber v data/foto.json:
#   { "zdroj": "...", "fotky": [ { "meno": "hero", "subor": "big/....webp", "pomer": 1.6, "fx": 0.5, "fy": 0.4, "sirky": [640, 1024, 1600], "alt": "..." } ] }
# pomer = šírka/výška výrezu (bez neho sa fotka neoreže), fx/fy = stred výrezu (0–1).
import json, os
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'data' / 'foto.json').read_text(encoding='utf8'))
SRC = ROOT / 'media' / 'fcto'
OUT = ROOT / 'src' / 'img' / 'foto'; OUT.mkdir(parents=True, exist_ok=True)
FORCE = bool(os.environ.get('FORCE'))

def crop(im, ratio, fx=0.5, fy=0.5):
    W, H = im.size
    if W / H > ratio: w, h = round(H * ratio), H
    else: w, h = W, round(W / ratio)
    x = min(max(round(fx * W - w / 2), 0), W - w); y = min(max(round(fy * H - h / 2), 0), H - h)
    return im.crop((x, y, x + w, y + h))

out = {'zdroj': cfg['zdroj'], 'url': cfg.get('url', ''), 'fotky': {}}
for f in cfg['fotky']:
    im = ImageOps.exif_transpose(Image.open(SRC / f['subor'])).convert('RGB')
    if f.get('pomer'): im = crop(im, f['pomer'], f.get('fx', 0.5), f.get('fy', 0.5))
    ws = []
    for w in f.get('sirky', [480, 960]):
        if w > im.width and ws: break
        c = im.copy(); c.thumbnail((w, 100000), Image.LANCZOS)
        dst = OUT / f"{f['meno']}-{c.width}.webp"
        if FORCE or not dst.exists(): c.save(dst, 'WEBP', quality=f.get('q', 78), method=6)
        ws.append(c.width)
    out['fotky'][f['meno']] = {'widths': ws, 'w': ws[-1], 'h': round(ws[-1] * im.height / im.width), 'alt': f.get('alt', ''), 'skupina': f.get('skupina', '')}
(ROOT / 'data' / 'foto-out.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf8')
print(f"fotky: {len(out['fotky'])} -> src/img/foto, data/foto-out.json")
