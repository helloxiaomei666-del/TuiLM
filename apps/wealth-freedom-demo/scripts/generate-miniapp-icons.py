from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "wechat-miniapp" / "assets"
SIZE = 81
SCALE = 4
CANVAS = SIZE * SCALE
STROKE = 5 * SCALE
GRAY = "#6a7772"
GREEN = "#0f766e"


def make_canvas():
    return Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))


def save_icon(name, draw_fn, color):
    image = make_canvas()
    draw = ImageDraw.Draw(image)
    draw_fn(draw, color)
    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image.save(ASSET_DIR / name)


def xy(*values):
    return tuple(int(value * SCALE) for value in values)


def overview(draw, color):
    draw.ellipse(xy(18, 18, 63, 63), outline=color, width=STROKE)
    draw.arc(xy(25, 25, 56, 56), start=205, end=330, fill=color, width=STROKE)
    draw.line([xy(40, 41), xy(52, 32)], fill=color, width=STROKE)


def assets(draw, color):
    for left, top, right, bottom in [(18, 39, 29, 61), (36, 27, 47, 61), (54, 17, 65, 61)]:
        draw.rounded_rectangle(xy(left, top, right, bottom), radius=4 * SCALE, outline=color, width=STROKE)


def security(draw, color):
    points = [xy(40, 12), xy(61, 22), xy(57, 51), xy(40, 66), xy(23, 51), xy(19, 22)]
    draw.line(points + [points[0]], fill=color, width=STROKE, joint="curve")
    draw.line([xy(31, 40), xy(38, 47), xy(52, 32)], fill=color, width=STROKE)


def route(draw, color):
    points = [xy(17, 58), xy(31, 39), xy(45, 48), xy(64, 22)]
    draw.line(points, fill=color, width=STROKE, joint="curve")
    for point in points:
        x, y = point
        radius = 5 * SCALE
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=color, width=STROKE)


def drags(draw, color):
    draw.rounded_rectangle(xy(18, 17, 63, 63), radius=8 * SCALE, outline=color, width=STROKE)
    draw.line([xy(40, 27), xy(40, 44)], fill=color, width=STROKE)
    draw.ellipse(xy(37, 51, 43, 57), fill=color)


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    icons = {
        "overview": overview,
        "assets": assets,
        "security": security,
        "route": route,
        "drags": drags,
    }
    for key, draw_fn in icons.items():
        save_icon(f"tab-{key}.png", draw_fn, GRAY)
        save_icon(f"tab-{key}-active.png", draw_fn, GREEN)


if __name__ == "__main__":
    main()
