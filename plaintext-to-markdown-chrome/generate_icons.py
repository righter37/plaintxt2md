"""Generate 素记 extension icons in multiple sizes."""
from PIL import Image, ImageDraw, ImageFilter
import math

SIZES = [16, 48, 128]
ACCENT_TOP = (217, 119, 54)      # #d97736
ACCENT_BOTTOM = (201, 106, 46)   # #c96a2e
SPARKLE_COLOR = (255, 255, 255)  # white
SHADOW_COLOR = (0, 0, 0, 40)


def rounded_rect(draw, xy, radius, fill):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_sparkle(draw, cx, cy, outer_r, inner_r, arms=4, rotation=0, fill=None):
    """Draw a sparkle/star shape."""
    points = []
    total = arms * 2
    for i in range(total):
        angle = math.radians(rotation + i * 360 / total - 90)
        r = outer_r if i % 2 == 0 else inner_r
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=fill)


def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Padding and corner radius
    pad = max(1, int(size * 0.08))
    radius = int(size * 0.22)

    # Drop shadow
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (pad + 1, pad + 2, size - pad + 1, size - pad + 2),
        radius=radius,
        fill=SHADOW_COLOR
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(1, size // 32)))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # Gradient background (vertical)
    for y in range(pad, size - pad):
        ratio = (y - pad) / max(1, size - 2 * pad)
        r = int(ACCENT_TOP[0] + (ACCENT_BOTTOM[0] - ACCENT_TOP[0]) * ratio)
        g = int(ACCENT_TOP[1] + (ACCENT_BOTTOM[1] - ACCENT_TOP[1]) * ratio)
        b = int(ACCENT_TOP[2] + (ACCENT_BOTTOM[2] - ACCENT_TOP[2]) * ratio)
        draw.line([(pad, y), (size - pad, y)], fill=(r, g, b))

    # Rounded rectangle clip using mask
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=radius, fill=255)

    # Inner highlight line (subtle)
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.rounded_rectangle(
        (pad + 1, pad + 1, size - pad - 1, size - pad - 1),
        radius=radius - 1,
        outline=(255, 255, 255, 50),
        width=max(1, size // 64)
    )
    img = Image.alpha_composite(img, highlight)

    # Apply mask to the gradient area
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg.paste(img, (0, 0), mask)

    # Sparkle in center
    sparkle = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sparkle_draw = ImageDraw.Draw(sparkle)
    cx = cy = size // 2
    outer = int(size * 0.26)
    inner = int(size * 0.10)
    draw_sparkle(sparkle_draw, cx, cy, outer, inner, arms=4, rotation=0, fill=SPARKLE_COLOR)

    # Small secondary sparkle
    if size >= 48:
        sx = int(size * 0.72)
        sy = int(size * 0.28)
        s_outer = int(size * 0.10)
        s_inner = int(size * 0.04)
        draw_sparkle(sparkle_draw, sx, sy, s_outer, s_inner, arms=4, rotation=22, fill=SPARKLE_COLOR)

    bg = Image.alpha_composite(bg, sparkle)
    return bg


def main():
    for size in SIZES:
        icon = create_icon(size)
        icon.save(f'icons/icon{size}.png')
        print(f'Created icons/icon{size}.png')


if __name__ == '__main__':
    main()
