"""Gera os ícones PNG da extensão usando apenas a biblioteca padrão.

Uso:
    python3 tools/make_icons.py
    # depois, redimensione com sips (macOS):
    # for s in 16 32 48; do sips -z $s $s icons/icon128.png --out icons/icon$s.png; done
"""
import os
import struct
import zlib

def chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

def write_png(path, size, rows):
    raw = b''.join(b'\x00' + bytes(row) for row in rows)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)

def in_rrect(x, y, x0, y0, x1, y1, r):
    """Ponto dentro de um retângulo de cantos arredondados."""
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    dx = (x0 + r) - x if x < x0 + r else (x - (x1 - r) if x > x1 - r else 0)
    dy = (y0 + r) - y if y < y0 + r else (y - (y1 - r) if y > y1 - r else 0)
    if dx > 0 and dy > 0:
        return dx * dx + dy * dy <= r * r
    return True

S = 128
BG = (79, 70, 229, 255)
BODY = (255, 255, 255, 255)
SCREEN = (23, 20, 70, 255)

rows = []
for y in range(S):
    row = []
    for x in range(S):
        px = (0, 0, 0, 0)
        if in_rrect(x, y, 4, 4, 123, 123, 28):
            px = BG
        if in_rrect(x, y, 41, 22, 87, 106, 12):
            px = BODY
        if in_rrect(x, y, 47, 30, 81, 92, 5):
            px = SCREEN
        if in_rrect(x, y, 56, 28, 72, 33, 2):
            px = BODY
        if (x - 64) ** 2 + (y - 99) ** 2 <= 12:
            px = SCREEN
        row.extend(px)
    rows.append(row)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(out, exist_ok=True)
write_png(os.path.join(out, 'icon128.png'), S, rows)
print('icons/icon128.png gerado')
