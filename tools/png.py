"""Dependency-free RGBA canvas + PNG writer (the build must not need Pillow)."""
import random
import struct
import zlib


def hex_rgba(value, alpha=255):
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def shade(color, factor):
    r, g, b, a = color
    return (max(0, min(255, int(r * factor))), max(0, min(255, int(g * factor))), max(0, min(255, int(b * factor))), a)


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))


class Canvas:
    def __init__(self, width, height, fill=(0, 0, 0, 0)):
        self.w = width
        self.h = height
        self.px = [[fill for _ in range(width)] for _ in range(height)]

    def set(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = color

    def get(self, x, y):
        return self.px[y][x]

    def rect(self, x, y, w, h, color):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, color)

    def noise_rect(self, x, y, w, h, color, amount, rng):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, shade(color, 1 + rng.uniform(-amount, amount)))

    def ascii(self, rows, palette, ox=0, oy=0):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in palette and palette[ch] is not None:
                    self.set(ox + x, oy + y, palette[ch])

    def scaled(self, factor):
        out = Canvas(self.w * factor, self.h * factor)
        for y in range(out.h):
            for x in range(out.w):
                out.px[y][x] = self.px[y // factor][x // factor]
        return out

    def paste(self, other, ox, oy):
        for y in range(other.h):
            for x in range(other.w):
                c = other.px[y][x]
                if c[3] > 0:
                    self.set(ox + x, oy + y, c)

    def save(self, path):
        raw = b"".join(b"\x00" + bytes(v for p in row for v in p) for row in self.px)

        def chunk(tag, data):
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        header = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def rng_for(name):
    return random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(name)))
