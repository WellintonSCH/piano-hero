#!/usr/bin/env python3
"""
make_icons.py -- gera os ícones do app (assets/icons/) usados pelo manifest.webmanifest
(instalar o jogo na tela inicial do celular) e pelo apple-touch-icon do iPhone.

Desenho: fundo escuro do jogo, um pedaço de teclado embaixo e uma nota azul caindo
em direção a ele. Desenhado em 4x e reduzido (antialias). Requer Pillow:
  python tools/make_icons.py
"""

import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
BG_TOP, BG_BOTTOM = (27, 33, 64), (8, 10, 20)
ACCENT, ACCENT_LIGHT = (91, 132, 245), (157, 186, 255)
WHITE_KEY, BLACK_KEY = (240, 243, 252), (14, 16, 28)


def draw_icon(size, maskable=False):
    s = size * 4
    img = Image.new('RGB', (s, s))
    d = ImageDraw.Draw(img)

    for y in range(s):   # degradê vertical do fundo
        t = y / s
        d.line([(0, y), (s, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))

    # Ícone "maskable" (Android recorta em círculo/squircle): conteúdo dentro da zona segura (80%).
    pad = s * (0.18 if maskable else 0.10)
    x0, x1 = pad, s - pad
    keys_top = s * 0.58
    keys_bottom = s - pad
    n = 5
    w = (x1 - x0) / n
    gap = s * 0.012
    for i in range(n):
        d.rounded_rectangle([x0 + i * w + gap, keys_top, x0 + (i + 1) * w - gap, keys_bottom],
                            radius=s * 0.02, fill=WHITE_KEY)
    for i in (1, 2, 4):   # teclas pretas (padrão Dó Ré Mi | Fá Sol)
        cx = x0 + i * w
        d.rounded_rectangle([cx - w * 0.3, keys_top, cx + w * 0.3, keys_top + (keys_bottom - keys_top) * 0.58],
                            radius=s * 0.015, fill=BLACK_KEY)

    # Nota caindo sobre a 3ª tecla branca (Mi), com brilho.
    nx0, nx1 = x0 + 2 * w + w * 0.18, x0 + 3 * w - w * 0.18
    ny0, ny1 = s * 0.16 + (pad - s * 0.10), keys_top - s * 0.08
    glow = s * 0.03
    d.rounded_rectangle([nx0 - glow, ny0 - glow, nx1 + glow, ny1 + glow], radius=(nx1 - nx0) / 2 + glow,
                        fill=(40, 58, 120))
    d.rounded_rectangle([nx0, ny0, nx1, ny1], radius=(nx1 - nx0) / 2, fill=ACCENT)
    d.rounded_rectangle([nx0 + s * 0.012, ny0 + s * 0.012, (nx0 + nx1) / 2, ny1 - s * 0.05],
                        radius=(nx1 - nx0) / 4, fill=ACCENT_LIGHT)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    draw_icon(192).save(os.path.join(OUT, 'icon-192.png'))
    draw_icon(512).save(os.path.join(OUT, 'icon-512.png'))
    draw_icon(512, maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
    draw_icon(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
    print('ícones gerados em', os.path.abspath(OUT))
