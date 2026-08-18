"""
Compute pHash (perceptual hash) for a folder of images and emit docs/image_hashes.json
Requires: pip install pillow imagehash
Usage: python3 scripts/compute_image_hashes.py --src path/to/images --out docs/image_hashes.json

Outputs: JSON array of { "sku": "SKU123", "hash": "010101..." }
The script attempts to extract SKU from filename (prefix before first non-alnum/_- character) — adjust to your naming scheme.
"""
import argparse
import json
from pathlib import Path
from PIL import Image
import imagehash

parser = argparse.ArgumentParser()
parser.add_argument('--src', required=True, help='Source folder with product images')
parser.add_argument('--out', default='docs/image_hashes.json')
args = parser.parse_args()

src = Path(args.src)
assert src.exists() and src.is_dir(), 'src must be an existing directory'

out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)

results = []
for p in sorted(src.glob('*')):
    if p.suffix.lower() not in ['.jpg','.jpeg','.png','.webp']:
        continue
    # derive SKU from filename (customize as needed)
    name = p.stem
    sku = name.split('_')[0]
    try:
        ph = str(imagehash.phash(Image.open(p), hash_size=8))
        # imagehash returns hex string; convert to binary string of length 64
        binstr = bin(int(ph,16))[2:].zfill(64)
        # drop DC bit to match client code (63 bits)
        binstr = binstr[1:]
        results.append({'sku': sku, 'hash': binstr})
        print(f"{p.name} -> {sku} ({len(binstr)} bits)")
    except Exception as e:
        print('ERROR', p, e)

out.write_text(json.dumps(results, indent=2))
print('Wrote', out)
