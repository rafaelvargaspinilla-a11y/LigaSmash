#!/usr/bin/env python3
"""Download the original Ultimate portrait assets; keep TLS verification enabled."""
import concurrent.futures
import hashlib
import json
import re
import struct
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OFFICIAL = 'https://www.smashbros.com'
CATALOGUE = OFFICIAL + '/assets_v2/data/fighter.json'

def read(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()

rows = json.loads(read(CATALOGUE))['fighters']
by_id = {row['url']: row for row in rows}
ids = re.findall(r'\["([^\"]+)",', (ROOT / 'src/characters.ts').read_text())
assert len(ids) == 86 and len(set(ids)) == 86
sources = {}
for ident in ids:
    if ident in ['51', '52', '53']:
        continue
    slug = by_id[ident]['file']
    assert re.fullmatch('[a-z0-9_]+', slug)
    sources[ident] = OFFICIAL + '/assets_v2/img/fighter/thumb_a/' + slug + '.png'
# Individual in-game Ultimate Mii portraits are supplied by the community asset mirror.
for ident, slug in [('51','mii_brawler'),('52','mii_swordfighter'),('53','mii_gunner')]:
    sources[ident] = 'https://raw.githubusercontent.com/marcrd/smash-ultimate-assets/master/portraits/small/' + slug + '.png'

def download(item):
    ident, url = item
    data = read(url)
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        extension='png'
        width,height=struct.unpack('>II',data[16:24])
    else:
        assert data[:2]==b'\xff\xd8',f'{ident}: unsupported image format'
        extension='jpg'
        # The mirror names these .png, but their original bytes are JPEG.
        pos=2
        while pos<len(data):
            while data[pos]==255:pos+=1
            marker=data[pos];pos+=1
            length=struct.unpack('>H',data[pos:pos+2])[0]
            if marker in [192,193,194,195,197,198,199,201,202,203,205,206,207]:
                height,width=struct.unpack('>HH',data[pos+3:pos+7]);break
            pos+=length
        else:raise ValueError(f'{ident}: invalid JPEG')
    assert 32 <= width <= 4096 and 32 <= height <= 4096
    assert len(data) < 2 * 1024 * 1024
    (ROOT / 'public/characters' / f'{ident}.{extension}').write_bytes(data)
    return ident, {'url':url,'file':f'{ident}.{extension}', 'width':width, 'height':height, 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}

result = {}
errors = []
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    futures = {pool.submit(download,item):item[0] for item in sources.items()}
    for future in concurrent.futures.as_completed(futures):
        try:
            ident, info = future.result()
            result[ident] = info
        except Exception as error:
            errors.append(f'{futures[future]}: {error}')
if errors:
    raise SystemExit('\n'.join(errors))
assert len(result) == 86
(ROOT / 'public/characters/sources.json').write_text(json.dumps(dict(sorted(result.items())),ensure_ascii=False,indent=2)+'\n')
print(f'Downloaded {len(result)} verified portrait files: {sum(x["bytes"] for x in result.values()) / 1024 / 1024:.2f} MiB')
