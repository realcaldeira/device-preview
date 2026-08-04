#!/usr/bin/env python3
"""Gera as molduras fotorrealistas da extensão (frames/*.webp).

Cada arquétipo de aparelho vira um PNG/WebP com fundo transparente e o miolo da
tela vazado, desenhado para entrar como border-image de 9 fatias no mockup:
os cantos ficam intactos e só as faixas do meio esticam. A arte é 100%
procedural (stdlib + Pillow), então pode ser redistribuída com a extensão —
fotos e renders oficiais de fabricantes não poderiam (ver frames/README.md).

Uso:

    python3 tools/make_frames.py            # gera tudo em frames/
    python3 tools/make_frames.py island     # gera só um arquétipo

Geometria: pads/raios/viewports de referência vivem em shared/frames.js
(DP_FRAME_PRESETS, DP_FRAME_IMAGES, DP_FRAME_VIEWPORTS). ARCHETYPES abaixo
precisa espelhar esses valores — mexeu nos pads ou nos raios, atualize os
dois lados e rode o gerador de novo. preview.js fatia o 9-slice em
max(pad, radius) × scale (a fatia de canto precisa conter o arco inteiro).
"""

import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'frames')

# Paletas de metal: (sombra, tom médio, luz). Os varridos cônicos alternam
# luz e sombra como o bisel usinado de verdade faz ao girar na mão.
METALS = {
    # aço inox polido dos iPhones com notch
    'steel':      {'dark': (74, 78, 87),   'mid': (185, 190, 199), 'light': (246, 248, 251)},
    # titânio natural dos iPhones com Dynamic Island: mais morno e menos espelhado
    'titanium':   {'dark': (96, 92, 85),   'mid': (163, 158, 148), 'light': (226, 221, 210)},
    # alumínio preto fosco dos Galaxy
    'phantom':    {'dark': (16, 18, 22),   'mid': (52, 56, 63),    'light': (118, 124, 133)},
    # alumínio prata fosco dos Pixel
    'alu-silver': {'dark': (104, 108, 115),'mid': (189, 193, 200), 'light': (240, 242, 245)},
    # plástico preto brilhante dos aparelhos de entrada (gota d'água)
    'gloss':      {'dark': (7, 8, 10),     'mid': (30, 33, 39),    'light': (96, 102, 112)},
    # alumínio anodizado "slate" do iPhone 5/SE
    'slate':      {'dark': (18, 20, 24),   'mid': (55, 60, 67),    'light': (132, 139, 149)},
    # cinza-espacial dos iPads
    'space-gray': {'dark': (52, 55, 61),   'mid': (116, 122, 131), 'light': (206, 210, 216)},
    # alumínio escuro de notebook comum
    'alu-dark':   {'dark': (22, 24, 28),   'mid': (62, 67, 75),    'light': (140, 147, 157)},
    # alumínio claro de MacBook
    'macbook':    {'dark': (146, 151, 158),'mid': (214, 217, 221), 'light': (252, 253, 254)},
    # metal preto de TV
    'tv':         {'dark': (6, 7, 9),      'mid': (28, 31, 36),    'light': (82, 88, 97)},
}

# Arquétipos. pads = (topo, direita, baixo, esquerda) em px CSS — os mesmos de
# DP_FRAME_PRESETS em shared/frames.js, exceto a TV: a arte leva queixo de 36px
# (DP_FRAME_IMAGES.tv.inset); o preset CSS fica com padBottom 6 + .tv-chin.
ARCHETYPES = {
    'notch': {
        'vp': (390, 844), 'sb': 40, 'pads': (16, 16, 16, 16), 'radius': 63,
        'screen_radius': 47, 'squircle': 4.4, 'metal': 'steel', 'rail': 5.0,
        'antenna': True, 'scale': 2, 'ss': 3,
    },
    'island': {
        'vp': (393, 852), 'sb': 54, 'pads': (14, 14, 14, 14), 'radius': 69,
        'screen_radius': 55, 'squircle': 4.4, 'metal': 'titanium', 'rail': 5.0,
        'antenna': True, 'scale': 2, 'ss': 3,
    },
    'punch': {
        'vp': (384, 854), 'sb': 30, 'pads': (11, 11, 13, 11), 'radius': 47,
        'screen_radius': 36, 'squircle': 2.0, 'metal': 'phantom', 'rail': 4.0,
        'antenna': False, 'scale': 2, 'ss': 3,
    },
    'punch-left': {
        'vp': (412, 915), 'sb': 30, 'pads': (11, 11, 13, 11), 'radius': 51,
        'screen_radius': 40, 'squircle': 2.0, 'metal': 'alu-silver', 'rail': 4.0,
        'antenna': False, 'scale': 2, 'ss': 3,
    },
    'drop': {
        'vp': (360, 800), 'sb': 28, 'pads': (12, 12, 20, 12), 'radius': 38,
        'screen_radius': 26, 'squircle': 2.0, 'metal': 'gloss', 'rail': 4.5,
        'antenna': False, 'scale': 2, 'ss': 3,
    },
    'home': {
        'vp': (320, 568), 'sb': 22, 'pads': (80, 18, 86, 18), 'radius': 56,
        'screen_radius': 4, 'squircle': 2.0, 'metal': 'slate', 'rail': 5.5,
        'antenna': True, 'scale': 2, 'ss': 3,
    },
    'tablet': {
        'vp': (820, 1180), 'sb': 26, 'pads': (32, 32, 32, 32), 'radius': 36,
        'screen_radius': 12, 'squircle': 4.2, 'metal': 'space-gray', 'rail': 7.0,
        'antenna': True, 'scale': 2, 'ss': 3,
    },
    'laptop': {
        'vp': (1920, 1080), 'sb': 0, 'pads': (15, 11, 26, 11), 'radius': 16,
        'screen_radius': 4, 'squircle': 2.0, 'metal': 'alu-dark', 'rail': 5.0,
        'antenna': False, 'scale': 1.5, 'ss': 2, 'rotate': False,
    },
    'laptop-macbook': {
        'vp': (1440, 900), 'sb': 0, 'pads': (15, 11, 26, 11), 'radius': 16,
        'screen_radius': 4, 'squircle': 2.0, 'metal': 'macbook', 'rail': 5.0,
        'antenna': False, 'scale': 1.5, 'ss': 2, 'rotate': False,
    },
    'tv': {
        'vp': (1920, 1080), 'sb': 0, 'pads': (10, 10, 36, 10), 'radius': 12,
        'screen_radius': 3, 'squircle': 2.0, 'metal': 'tv', 'rail': 99.0,
        'antenna': False, 'scale': 1, 'ss': 2, 'chin': True,
    },
}


# ------------------------------------------------------------------ máscaras

def rounded_outline(left, top, right, bottom, radius, n):
    """Contorno de retângulo com cantos de curvatura contínua (squircle).

    As bordas ficam retas — só o quadrado radius×radius de cada canto recebe o
    arco de superelipse. É o formato real dos aparelhos e evita que a borda
    emcurve quando o 9-slice estica as faixas do meio.
    """
    r = min(radius, (right - left) / 2.0, (bottom - top) / 2.0)
    e = 2.0 / n
    arc = max(12, int(r / 3))

    def corner(cx, cy, a0):
        pts = []
        for i in range(arc + 1):
            t = math.radians(a0 + 90.0 * i / arc)
            c, s = math.cos(t), math.sin(t)
            pts.append((cx + r * math.copysign(abs(c) ** e, c),
                        cy + r * math.copysign(abs(s) ** e, s)))
        return pts

    pts = [(left + r, top), (right - r, top)]
    pts += corner(right - r, top + r, -90)      # superior direito
    pts += [(right, bottom - r)]
    pts += corner(right - r, bottom - r, 0)     # inferior direito
    pts += [(left + r, bottom)]
    pts += corner(left + r, bottom - r, 90)     # inferior esquerdo
    pts += [(left, top + r)]
    pts += corner(left + r, top + r, 180)       # superior esquerdo
    return pts


def shape_mask(size, box, radius, n=2.0):
    """Máscara L de um retângulo arredondado (n=2) ou de cantos squircle (n>2)."""
    left, top, right, bottom = box
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    if n <= 2.01:
        d.rounded_rectangle([left, top, right - 1, bottom - 1],
                            radius=max(0.0, radius), fill=255)
    else:
        d.polygon(rounded_outline(left, top, right, bottom, radius, n), fill=255)
    return m


def ring_mask(size, outer_box, outer_radius, inner_box, inner_radius, n=2.0):
    outer = shape_mask(size, outer_box, outer_radius, n)
    inner = shape_mask(size, inner_box, inner_radius, n)
    return ImageChops.subtract(outer, inner)


# ----------------------------------------------------------------- gradientes

def lerp(c0, c1, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c0, c1))


def ramp_color(stops, t):
    """stops: [(pos 0..1, cor)] ordenados; interpola linearmente."""
    if t <= stops[0][0]:
        return stops[0][1]
    if t >= stops[-1][0]:
        return stops[-1][1]
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        if p0 <= t <= p1:
            return lerp(c0, c1, (t - p0) / (p1 - p0))
    return stops[-1][1]


def linear_gradient(size, angle_deg, stops):
    """Gradiente linear cobrindo size; angle_deg=0 desce de cima para baixo."""
    w, h = size
    diag = int(math.hypot(w, h)) + 4
    ramp = Image.new('RGB', (1, 256))
    ramp.putdata([ramp_color(stops, y / 255.0) for y in range(256)])
    grad = ramp.resize((diag, diag), Image.BILINEAR)
    grad = grad.rotate(-angle_deg, resample=Image.BICUBIC, center=(diag / 2, diag / 2))
    left = (diag - w) // 2
    top = (diag - h) // 2
    return grad.crop((left, top, left + w, top + h))


def conic_gradient(size, stops, cx=None, cy=None, start_deg=0.0, slices=720):
    """Varredura cônica em torno de (cx, cy) — o reflexo giratório do metal."""
    w, h = size
    cx = w / 2.0 if cx is None else cx
    cy = h / 2.0 if cy is None else cy
    radius = math.hypot(max(cx, w - cx), max(cy, h - cy)) + 2
    img = Image.new('RGB', size)
    d = ImageDraw.Draw(img)
    box = [cx - radius, cy - radius, cx + radius, cy + radius]
    for i in range(slices):
        a0 = 360.0 * i / slices
        a1 = 360.0 * (i + 1) / slices
        t = ((a0 + start_deg) % 360.0) / 360.0
        d.pieslice(box, start=a0, end=a1 + 0.5, fill=ramp_color(stops, t))
    return img


def brushed_noise(size, horizontal=True):
    """Estrias do metal escovado: ruído esticado na direção da escovação."""
    w, h = size
    if horizontal:
        n = Image.effect_noise((w, max(1, h // 160)), 26)
    else:
        n = Image.effect_noise((max(1, w // 160), h), 26)
    return n.resize((w, h), Image.BILINEAR)


def apply_grain(img, mask, strength=0.05):
    """Grão fino por cima do metal; strength ~0.05 é quase imperceptível."""
    noise = Image.effect_noise(img.size, 18)
    delta = noise.point(lambda v: int((v - 128) * strength * 2))
    overlay = Image.merge('RGB', (delta, delta, delta))
    blended = ImageChops.add(img, overlay)
    return Image.composite(blended, img, mask)


# ------------------------------------------------------------------ render

def metal_stops(pal, shiny=1.0):
    """Varrido cônico com dois pontos de luz opostos, como um aro usinado."""
    d, m, l = pal['dark'], pal['mid'], pal['light']
    mid = lerp(m, l, 0.35 * shiny)
    dark = lerp(d, (0, 0, 0), 0.25)
    return [
        (0.00, mid), (0.08, dark), (0.20, l), (0.32, dark),
        (0.45, mid), (0.56, dark), (0.68, l), (0.80, dark),
        (0.91, mid), (1.00, mid),
    ]

# Bisel polido: contraste quase total — é o fio de luz que separa o metal do vidro.
CHAMFER_STOPS = [
    (0.00, (210, 214, 220)), (0.08, (38, 40, 45)), (0.20, (255, 255, 255)),
    (0.32, (30, 32, 36)), (0.45, (190, 194, 201)), (0.56, (35, 37, 42)),
    (0.68, (255, 255, 255)), (0.80, (28, 30, 34)), (0.91, (205, 209, 216)),
    (1.00, (210, 214, 220)),
]


def render_box(spec, vw, vh, pads, chin_label=None):
    """Renderiza um quadro: tela vw×vh (já inclui a status bar) + pads ao redor."""
    k = spec['scale'] * spec['ss']
    pt, pr, pb, pl = (p * k for p in pads)
    w = int(round(vw * k + pl + pr))
    h = int(round(vh * k + pt + pb))
    size = (w, h)
    n = spec['squircle']
    pal = METALS[spec['metal']]
    outer_box = (0, 0, w, h)
    outer_r = spec['radius'] * k
    hole_box = (pl, pt, w - pr, h - pb)
    hole_r = spec['screen_radius'] * k
    rail = min(spec['rail'] * k, min(pt, pr, pb, pl) * 0.55)
    rail_box = (rail, rail, w - rail, h - rail)
    # o raio interno acompanha o externo para o aro ter espessura constante
    rail_r = max(outer_r - rail, hole_r + 1.0)

    m_out = shape_mask(size, outer_box, outer_r, n)
    m_hole = shape_mask(size, hole_box, hole_r, n)
    m_rail_in = shape_mask(size, rail_box, rail_r, n)
    m_rail = ImageChops.subtract(m_out, m_rail_in)          # aro de metal
    m_glass = ImageChops.subtract(m_rail_in, m_hole)        # vidro preto da borda

    # --- aro de metal -------------------------------------------------------
    base = linear_gradient(size, 24, [
        (0.00, lerp(pal['light'], pal['mid'], 0.45)),
        (0.35, pal['mid']),
        (0.62, lerp(pal['dark'], pal['mid'], 0.30)),
        (1.00, lerp(pal['mid'], pal['dark'], 0.50)),
    ])
    conic = conic_gradient(size, metal_stops(pal), start_deg=218.0)
    metal = Image.blend(base, conic, 0.62)

    # escovação: horizontal nas barras de cima/baixo, vertical nas laterais
    gh = brushed_noise(size, horizontal=True)
    gv = brushed_noise(size, horizontal=False)
    top_bot = Image.new('L', size, 0)
    d = ImageDraw.Draw(top_bot)
    d.rectangle([0, 0, w, pt + rail], fill=255)
    d.rectangle([0, h - pb - rail, w, h], fill=255)
    grain = Image.composite(gv, gh, top_bot)
    # grão multiplicativo sutil no aro
    mult = grain.point(lambda v: max(0, min(255, 232 + int(0.20 * v))))
    metal = ImageChops.multiply(metal, Image.merge('RGB', (mult, mult, mult)))
    metal = apply_grain(metal, m_rail, strength=0.04)

    # --- vidro preto entre o aro e a tela -----------------------------------
    glass = linear_gradient(size, 90, [
        (0.00, (21, 24, 29)),
        (0.20, (9, 10, 13)),
        (0.55, (3, 4, 6)),
        (1.00, (12, 14, 17)),
    ])
    # reflexo de estúdio na diagonal, largo e suave — vidro, não plástico
    gloss = linear_gradient(size, 32, [
        (0.00, (0, 0, 0)), (0.06, (70, 76, 88)), (0.16, (26, 28, 34)),
        (0.30, (0, 0, 0)), (1.00, (0, 0, 0)),
    ])
    glass = ImageChops.screen(glass, gloss.point(lambda v: int(v * 0.55)).convert('RGB'))

    img = Image.new('RGB', size, (0, 0, 0))
    img.paste(glass, (0, 0), m_glass)
    img.paste(metal, (0, 0), m_rail)

    # --- bisel polido na junção aro/vidro ------------------------------------
    chamfer_w = max(1.0, 1.3 * k)
    inner_edge = shape_mask(size, (rail + chamfer_w, rail + chamfer_w,
                                   w - rail - chamfer_w, h - rail - chamfer_w),
                            max(rail_r - chamfer_w, 1.0), n)
    m_chamfer = ImageChops.subtract(m_rail_in, inner_edge)
    chamfer = conic_gradient(size, CHAMFER_STOPS, start_deg=205.0)
    img.paste(chamfer, (0, 0), m_chamfer)

    # --- linhas de antena cruzando o aro (perto dos cantos, como nos reais) --
    if spec.get('antenna'):
        ant = Image.new('RGBA', size, (0, 0, 0, 0))
        da = ImageDraw.Draw(ant)
        lw = max(1.0, 1.4 * k)
        col = (*lerp(pal['light'], (255, 255, 255), 0.3), 200)
        for frac in (0.16, 0.84):
            y = h * frac
            da.line([0, y, rail, y], fill=col, width=int(lw))
            da.line([w - rail, y, w, y], fill=col, width=int(lw))
        for frac in (0.20, 0.80):
            x = w * frac
            da.line([x, 0, x, rail], fill=col, width=int(lw))
            da.line([x, h - rail, x, h], fill=col, width=int(lw))
        ant.putalpha(ImageChops.multiply(ant.getchannel('A'), m_rail))
        img = Image.alpha_composite(img.convert('RGBA'), ant).convert('RGB')

    # --- sombra de contato no limite da tela ---------------------------------
    groove = ImageChops.subtract(
        shape_mask(size, (pl - k, pt - k, w - pr + k, h - pb + k), hole_r + k, n),
        m_hole)
    img.paste(Image.new('RGB', size, (0, 0, 0)), (0, 0), groove.point(lambda v: int(v * 0.8)))

    # --- queixo de TV: barra escovada, marca e LED de standby ----------------
    if spec.get('chin'):
        dc = ImageDraw.Draw(img)
        chin_top = h - pb
        sheen2 = linear_gradient((w, int(pb)), 90, [
            (0.0, lerp(pal['mid'], pal['light'], 0.25)),
            (0.25, pal['mid']),
            (1.0, pal['dark']),
        ])
        img.paste(sheen2, (0, int(chin_top)), shape_mask((w, int(pb)), (0, 0, w, int(pb)), 0))
        label = chin_label or 'S M A R T  T V'
        try:
            font = ImageFont.load_default(size=int(9 * k))
        except Exception:
            font = ImageFont.load_default()
        bbox = dc.textbbox((0, 0), label, font=font)
        dc.text(((w - (bbox[2] - bbox[0])) / 2, chin_top + (pb - (bbox[3] - bbox[1])) / 2 - bbox[1]),
                label, font=font, fill=lerp(pal['light'], (255, 255, 255), 0.2))
        # LED de standby com brilho
        led_r = 2.6 * k
        lx, ly = w - pl - 16 * k, chin_top + pb / 2
        glow = Image.new('L', size, 0)
        ImageDraw.Draw(glow).ellipse([lx - led_r * 3, ly - led_r * 3, lx + led_r * 3, ly + led_r * 3], fill=120)
        glow = glow.filter(ImageFilter.GaussianBlur(led_r * 1.6))
        img = ImageChops.screen(img, Image.merge('RGB', (glow.point(lambda v: int(v * 0.2)),
                                                         glow, glow.point(lambda v: int(v * 0.55)))))
        dc.ellipse([lx - led_r, ly - led_r, lx + led_r, ly + led_r], fill=(52, 211, 153))

    # --- acabamento da silhueta: luz de contorno em cima, AO embaixo ---------
    edge = ImageChops.subtract(m_out, shape_mask(size, (k, k, w - k, h - k),
                                                 max(outer_r - k, 1.0), n))
    rim = linear_gradient(size, 78, [
        (0.00, (235, 238, 243)), (0.22, (120, 125, 133)), (0.50, (28, 30, 35)),
        (1.00, (8, 9, 11)),
    ])
    img.paste(rim, (0, 0), edge.point(lambda v: int(v * 0.75)))

    alpha = ImageChops.subtract(m_out, m_hole)
    out = img.convert('RGBA')
    out.putalpha(alpha)

    final = (max(1, w // spec['ss']), max(1, h // spec['ss']))
    return out.resize(final, Image.LANCZOS)


def frames_for(name, spec):
    """Gera a moldura na orientação natural e, quando girável, a rotacionada."""
    vw, vh = spec['vp']
    vh_total = vh + spec['sb']
    pt, pr, pb, pl = spec['pads']
    jobs = [(name, vw, vh_total, (pt, pr, pb, pl))]
    if spec.get('rotate', True):
        # girado: o que era topo vai para a esquerda (mesma convenção do CSS)
        jobs.append((name + '.rot', vh_total, vw, (pr, pb, pl, pt)))
    for fname, cw, ch, pads in jobs:
        img = render_box(spec, cw, ch, pads, chin_label='S M A R T  T V')
        path = os.path.join(OUT_DIR, fname + '.webp')
        img.save(path, 'WEBP', quality=88, method=6, exact=False)
        print(f'{fname}.webp  {img.size[0]}×{img.size[1]}  {os.path.getsize(path) // 1024} KB')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    only = sys.argv[1:] or list(ARCHETYPES)
    for name in only:
        if name not in ARCHETYPES:
            sys.exit(f'arquétipo desconhecido: {name}')
        frames_for(name, ARCHETYPES[name])


if __name__ == '__main__':
    main()
