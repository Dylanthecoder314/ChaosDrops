"""Boss models: geometry, UV-packed textures and animations generated from one spec.

Each cube is painted directly into its box-UV region, so geometry and texture can never
drift apart. Models face -Z (the box-UV "front" region), matching vanilla mobs.
"""
from png import Canvas, hex_rgba, mix, rng_for, shade

TRANSPARENT = (0, 0, 0, 0)


class Cube:
    def __init__(self, origin, size, paint, **opts):
        self.origin = origin
        self.size = size
        self.paint = paint
        self.opts = opts
        self.uv = None


class Bone:
    def __init__(self, name, pivot, cubes=(), parent=None, rotation=None):
        self.name = name
        self.pivot = pivot
        self.cubes = list(cubes)
        self.parent = parent
        self.rotation = rotation


def box_faces(u, v, w, h, d):
    return {
        "top": (u + d, v, w, d),
        "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h),
        "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h),
        "back": (u + 2 * d + w, v + d, w, h),
    }


def pack(bones, width):
    cubes = [c for b in bones for c in b.cubes]
    order = sorted(cubes, key=lambda c: -(c.size[2] + c.size[1]))
    x = y = row_h = 0
    for c in order:
        w, h, d = c.size
        bw, bh = 2 * (w + d), d + h
        if x + bw > width:
            x, y, row_h = 0, y + row_h, 0
        c.uv = (x, y)
        x += bw
        row_h = max(row_h, bh)
    height = y + row_h
    size = 16
    while size < height:
        size *= 2
    return size


# --------------------------------------------------------------------------- painters
# A painter gets (canvas, face, rect, cube, palette, rng) and fills one face.


def base_fill(cv, face, rect, color, rng, noise=0.08, edge=True):
    x, y, w, h = rect
    lit = {"top": 1.18, "bottom": 0.7, "front": 1.0, "back": 0.9, "left": 0.85, "right": 0.85}[face]
    cv.noise_rect(x, y, w, h, shade(color, lit), noise, rng)
    if edge and w > 2 and h > 2:
        dark = shade(color, lit * 0.62)
        for i in range(w):
            cv.set(x + i, y, dark)
            cv.set(x + i, y + h - 1, dark)
        for j in range(h):
            cv.set(x, y + j, dark)
            cv.set(x + w - 1, y + j, dark)


def crack_lines(cv, rect, glow, rng, count):
    x, y, w, h = rect
    if w < 3 or h < 3:
        return
    for _ in range(count):
        cx, cy = rng.randrange(1, w - 1), rng.randrange(1, h - 1)
        for _ in range(rng.randrange(3, max(4, (w + h) // 2))):
            cv.set(x + cx, y + cy, glow)
            cx = max(1, min(w - 2, cx + rng.choice((-1, 0, 1))))
            cy = max(1, min(h - 2, cy + rng.choice((-1, 0, 1, 1))))


def p_stone(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal[cube.opts.get("color", "stone")], rng, noise=0.12)


def p_cracked(cv, face, rect, cube, pal, rng):
    p_stone(cv, face, rect, cube, pal, rng)
    crack_lines(cv, rect, pal["glow"], rng, count=max(1, rect[2] * rect[3] // 60))


def p_gem(cv, face, rect, cube, pal, rng):
    x, y, w, h = rect
    cv.rect(x, y, w, h, pal["glow"])
    for i in range(w):
        for j in range(h):
            if i == 0 or j == 0 or i == w - 1 or j == h - 1:
                cv.set(x + i, y + j, shade(pal["glow"], 0.6))
    if w > 3 and h > 3:
        cv.set(x + 1, y + 1, pal["white"])
        cv.set(x + 2, y + 1, pal["white"])
        cv.set(x + 1, y + 2, pal["white"])


def p_titan_head(cv, face, rect, cube, pal, rng):
    p_cracked(cv, face, rect, cube, pal, rng)
    if face != "front":
        return
    x, y, w, h = rect
    brow = shade(pal["stone"], 0.55)
    cv.rect(x + 1, y + 3, w - 2, 1, brow)
    cv.rect(x + 2, y + 4, 2, 2, pal["eye"])
    cv.rect(x + w - 4, y + 4, 2, 2, pal["eye"])
    cv.set(x + 2, y + 4, pal["white"])
    cv.set(x + w - 4, y + 4, pal["white"])
    cv.rect(x + 3, y + 7, w - 6, 1, (10, 5, 15, 255))
    cv.set(x + 4, y + 8, (10, 5, 15, 255))
    cv.set(x + w - 5, y + 8, (10, 5, 15, 255))


def p_robe(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["robe"], rng, noise=0.1)
    x, y, w, h = rect
    if face in ("front", "back", "left", "right"):
        for i in range(w):
            cv.set(x + i, y + h - 1, pal["trim"])
            if (i + rng.randrange(2)) % 3 == 0:
                cv.set(x + i, y + h - 2, pal["trim"])
        if face == "front" and cube.opts.get("clasp"):
            cv.set(x + w // 2, y + 1, pal["glow"])
            cv.set(x + w // 2 - 1, y + 1, pal["glow"])


def p_tattered(cv, face, rect, cube, pal, rng):
    p_robe(cv, face, rect, cube, pal, rng)
    x, y, w, h = rect
    if face in ("front", "back", "left", "right"):
        for i in range(w):
            cut = rng.randrange(0, max(1, h // 2))
            for j in range(cut):
                cv.set(x + i, y + h - 1 - j, TRANSPARENT)
    if face == "bottom":
        cv.rect(x, y, w, h, TRANSPARENT)


def p_hood(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["robe"], rng, noise=0.1)
    x, y, w, h = rect
    if face == "front":
        cv.rect(x + 2, y + 2, w - 4, h - 3, TRANSPARENT)
        for i in range(w):
            cv.set(x + i, y, pal["trim"])
        for j in range(h):
            cv.set(x, y + j, pal["trim"])
            cv.set(x + w - 1, y + j, pal["trim"])
    if face == "bottom":
        cv.rect(x + 1, y + 1, w - 2, h - 2, TRANSPARENT)


def p_wraith_face(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["void"], rng, noise=0.2, edge=False)
    if face != "front":
        return
    x, y, w, h = rect
    cv.rect(x + 1, y + 3, 2, 1, pal["eye"])
    cv.rect(x + w - 3, y + 3, 2, 1, pal["eye"])
    cv.set(x + 2, y + 4, shade(pal["eye"], 0.6))
    cv.set(x + w - 3, y + 4, shade(pal["eye"], 0.6))


def p_bone(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["bone"], rng, noise=0.1)


def p_orb(cv, face, rect, cube, pal, rng):
    x, y, w, h = rect
    cv.rect(x, y, w, h, pal["glow"])
    cv.set(x + w // 2, y + h // 2, pal["white"])


PIPS = {
    1: [(0.5, 0.5)],
    2: [(0.25, 0.25), (0.75, 0.75)],
    3: [(0.25, 0.25), (0.5, 0.5), (0.75, 0.75)],
    4: [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)],
    5: [(0.25, 0.25), (0.75, 0.25), (0.5, 0.5), (0.25, 0.75), (0.75, 0.75)],
    6: [(0.25, 0.22), (0.75, 0.22), (0.25, 0.5), (0.75, 0.5), (0.25, 0.78), (0.75, 0.78)],
}
FACE_NUMBER = {"top": 1, "bottom": 6, "right": 3, "left": 4, "back": 2, "front": 5}


def p_die(cv, face, rect, cube, pal, rng):
    x, y, w, h = rect
    base_fill(cv, face, rect, pal["die"], rng, noise=0.04, edge=False)
    for i in range(w):
        cv.set(x + i, y, pal["edge"])
        cv.set(x + i, y + h - 1, pal["edge"])
    for j in range(h):
        cv.set(x, y + j, pal["edge"])
        cv.set(x + w - 1, y + j, pal["edge"])
    if face == "front" and cube.opts.get("eye"):
        draw_eye(cv, rect, pal)
        return
    r = max(1, min(w, h) // 8)
    for px, py in PIPS[FACE_NUMBER[face]]:
        cx, cy = x + int(px * (w - 1)), y + int(py * (h - 1))
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r + r:
                    cv.set(cx + dx, cy + dy, pal["pip"])


def draw_eye(cv, rect, pal):
    x, y, w, h = rect
    cx, cy = x + w / 2 - 0.5, y + h / 2 - 0.5
    rx, ry = w * 0.4, h * 0.26
    for j in range(h):
        for i in range(w):
            dx, dy = (x + i - cx) / rx, (y + j - cy) / ry
            d = dx * dx + dy * dy
            if d <= 1.0:
                cv.set(x + i, y + j, pal["sclera"])
            elif d <= 1.35:
                cv.set(x + i, y + j, pal["edge"])
    ir = min(w, h) * 0.2
    for j in range(h):
        for i in range(w):
            dd = ((x + i - cx) ** 2 + (y + j - cy) ** 2) ** 0.5
            if dd <= ir * 0.5:
                cv.set(x + i, y + j, (8, 4, 12, 255))
            elif dd <= ir:
                cv.set(x + i, y + j, pal["iris"])
    cv.set(int(cx - ir * 0.4), int(cy - ir * 0.4), pal["white"])


def p_skin(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["skin"], rng, noise=0.1)


def p_goblin_head(cv, face, rect, cube, pal, rng):
    p_skin(cv, face, rect, cube, pal, rng)
    if face != "front":
        return
    x, y, w, h = rect
    cv.rect(x + 1, y + 2, 2, 2, pal["eye"])
    cv.rect(x + w - 3, y + 2, 2, 2, pal["eye"])
    cv.set(x + 2, y + 3, (0, 0, 0, 255))
    cv.set(x + w - 3, y + 3, (0, 0, 0, 255))
    cv.rect(x + 2, y + h - 2, w - 4, 1, (40, 15, 10, 255))
    cv.set(x + 3, y + h - 2, pal["white"])
    cv.set(x + w - 4, y + h - 2, pal["white"])


def p_vest(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["vest"], rng, noise=0.12)
    x, y, w, h = rect
    if face == "front":
        cv.rect(x + w // 2 - 1, y, 2, h, pal["skin"])
        cv.rect(x, y + h - 2, w, 1, pal["gold"])


def p_sack(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["sack"], rng, noise=0.14)
    x, y, w, h = rect
    if face in ("front", "back", "left", "right") and h > 3:
        cv.rect(x, y + 1, w, 1, pal["rope"])
        for _ in range(max(1, w // 3)):
            cv.set(x + rng.randrange(w), y + rng.randrange(2, h), shade(pal["sack"], 0.7))
    if face == "top":
        for _ in range(w * h // 3):
            cv.set(x + rng.randrange(w), y + rng.randrange(h), pal["gold"])


def p_gold(cv, face, rect, cube, pal, rng):
    base_fill(cv, face, rect, pal["gold"], rng, noise=0.1)


PAINTERS = {
    "stone": p_stone, "cracked": p_cracked, "gem": p_gem, "titan_head": p_titan_head,
    "robe": p_robe, "tattered": p_tattered, "hood": p_hood, "wraith_face": p_wraith_face,
    "bone": p_bone, "orb": p_orb, "die": p_die, "skin": p_skin, "goblin_head": p_goblin_head,
    "vest": p_vest, "sack": p_sack, "gold": p_gold,
}


# --------------------------------------------------------------------------- model specs

def titan():
    c = Cube
    bones = [
        Bone("root", [0, 0, 0]),
        Bone("body", [0, 18, 0], parent="root", cubes=[
            c([-9, 20, -5], [18, 16, 10], "cracked"),
            c([-7, 16, -4], [14, 4, 8], "stone", color="dark"),
            c([-3, 26, -6], [6, 6, 1], "gem"),
        ]),
        Bone("head", [0, 36, -1], parent="body", cubes=[
            c([-5, 36, -6], [10, 10, 10], "titan_head"),
            c([5, 42, -3], [3, 3, 3], "stone", color="horn"),
            c([7, 44, -2], [2, 4, 2], "stone", color="horn"),
            c([-8, 42, -3], [3, 3, 3], "stone", color="horn"),
            c([-9, 44, -2], [2, 4, 2], "stone", color="horn"),
        ]),
        Bone("right_arm", [-11, 33, 0], parent="body", cubes=[
            c([-16, 31, -5], [8, 6, 10], "cracked"),
            c([-15, 12, -3], [6, 19, 6], "stone"),
            c([-16, 4, -4], [8, 8, 8], "cracked", color="dark"),
        ]),
        Bone("left_arm", [11, 33, 0], parent="body", cubes=[
            c([8, 31, -5], [8, 6, 10], "cracked"),
            c([9, 12, -3], [6, 19, 6], "stone"),
            c([8, 4, -4], [8, 8, 8], "cracked", color="dark"),
        ]),
        Bone("right_leg", [-5, 16, 0], parent="root", cubes=[c([-9, 0, -4], [8, 16, 8], "cracked")]),
        Bone("left_leg", [5, 16, 0], parent="root", cubes=[c([1, 0, -4], [8, 16, 8], "cracked")]),
    ]
    base = {"stone": hex_rgba("#3a2a52"), "dark": hex_rgba("#241833"), "horn": hex_rgba("#d8cdf0"),
            "white": hex_rgba("#fff0ff")}
    palettes = {
        "chaos_titan": dict(base, glow=hex_rgba("#e040ff"), eye=hex_rgba("#ff66ff")),
        "chaos_titan_enraged": dict(base, stone=hex_rgba("#3d1f22"), dark=hex_rgba("#26100f"),
                                    glow=hex_rgba("#ff5a1f"), eye=hex_rgba("#ffc21f")),
    }
    walk = "math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed * 57.3"
    anims = {
        "walk": {"loop": True, "bones": {
            "right_leg": {"rotation": [f"{walk} * 0.9", 0, 0]},
            "left_leg": {"rotation": [f"-{walk} * 0.9", 0, 0]},
            "right_arm": {"rotation": [f"-{walk} * 0.5", 0, 0]},
            "left_arm": {"rotation": [f"{walk} * 0.5", 0, 0]},
            "body": {"rotation": [0, 0, f"{walk} * 0.05"]},
        }},
        "idle": {"loop": True, "bones": {
            "body": {"rotation": ["math.sin(query.life_time * 70) * 1.5", 0, 0]},
            "right_arm": {"rotation": [0, 0, "math.sin(query.life_time * 70) * 2 + 3"]},
            "left_arm": {"rotation": [0, 0, "-math.sin(query.life_time * 70) * 2 - 3"]},
        }},
        "look": {"loop": True, "bones": {"head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}}},
        "attack": {"loop": True, "bones": {
            "right_arm": {"rotation": ["-math.sin(variable.attack_time * 180) * 110", 0, 0]},
            "left_arm": {"rotation": ["-math.sin(variable.attack_time * 180) * 110", 0, 0]},
        }},
        "slam": {"loop": False, "animation_length": 1.2, "bones": {
            "right_arm": {"rotation": {"0.0": [0, 0, 0], "0.6": [-165, 0, 10], "0.8": [20, 0, 0], "1.2": [0, 0, 0]}},
            "left_arm": {"rotation": {"0.0": [0, 0, 0], "0.6": [-165, 0, -10], "0.8": [20, 0, 0], "1.2": [0, 0, 0]}},
            "body": {"rotation": {"0.0": [0, 0, 0], "0.6": [-12, 0, 0], "0.8": [18, 0, 0], "1.2": [0, 0, 0]}},
        }},
    }
    animate = ["idle", "look", "walk", "attack"]
    return dict(name="chaos_titan", bones=bones, width=128, palettes=palettes, anims=anims,
                animate=animate, bounds=(5, 5.5, [0, 2.5, 0]))


def void_wraith():
    c = Cube
    bones = [
        Bone("root", [0, 0, 0]),
        Bone("body", [0, 16, 0], parent="root", cubes=[
            c([-6, 22, -4], [12, 12, 8], "robe", clasp=True),
            c([-5, 12, -3], [10, 10, 6], "robe"),
        ]),
        Bone("tail", [0, 12, 0], parent="body", cubes=[c([-4, 2, -2], [8, 10, 4], "tattered")]),
        Bone("head", [0, 34, 0], parent="body", cubes=[
            c([-4, 34, -4], [8, 8, 8], "wraith_face"),
            c([-5, 33, -5], [10, 11, 10], "hood"),
        ]),
        Bone("right_arm", [-7, 32, 0], parent="body", cubes=[
            c([-10, 16, -2], [3, 16, 3], "robe"),
            c([-11, 12, -2], [4, 4, 3], "bone"),
        ]),
        Bone("left_arm", [7, 32, 0], parent="body", cubes=[
            c([7, 16, -2], [3, 16, 3], "robe"),
            c([7, 12, -2], [4, 4, 3], "bone"),
        ]),
        Bone("orbit", [0, 24, 0], parent="root", cubes=[
            c([-15, 25, -1], [3, 3, 3], "orb"),
            c([12, 21, -1], [3, 3, 3], "orb"),
            c([-1, 29, 12], [3, 3, 3], "orb"),
            c([-1, 19, -15], [3, 3, 3], "orb"),
        ]),
    ]
    base = {"robe": hex_rgba("#16122e"), "void": hex_rgba("#07050f"), "bone": hex_rgba("#cfc8e8"),
            "white": hex_rgba("#ffffff")}
    palettes = {
        "void_wraith": dict(base, trim=hex_rgba("#7b3fd1"), glow=hex_rgba("#39f5ff"), eye=hex_rgba("#39f5ff")),
        "void_wraith_enraged": dict(base, trim=hex_rgba("#c21d3c"), glow=hex_rgba("#ff3355"), eye=hex_rgba("#ff3355")),
    }
    anims = {
        "float": {"loop": True, "bones": {
            "root": {"position": [0, "math.sin(query.life_time * 90) * 1.5", 0]},
            "tail": {"rotation": ["math.sin(query.life_time * 110) * 8 + query.modified_move_speed * 25", 0, 0]},
        }},
        "arms": {"loop": True, "bones": {
            "right_arm": {"rotation": ["-10 - query.has_target * 55 + math.sin(query.life_time * 80) * 8", 0, 5]},
            "left_arm": {"rotation": ["-10 - query.has_target * 55 - math.sin(query.life_time * 80) * 8", 0, -5]},
        }},
        "orbit": {"loop": True, "bones": {"orbit": {"rotation": [0, "query.life_time * 140", 0]}}},
        "look": {"loop": True, "bones": {"head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}}},
    }
    animate = ["float", "arms", "orbit", "look"]
    return dict(name="void_wraith", bones=bones, width=128, palettes=palettes, anims=anims,
                animate=animate, bounds=(4, 4, [0, 1.5, 0]))


def the_randomizer():
    c = Cube
    bones = [
        Bone("root", [0, 0, 0]),
        Bone("core", [0, 18, 0], parent="root", cubes=[
            c([-10, 8, -10], [20, 20, 20], "die", eye=True),
            c([-8, 28, -2], [4, 4, 4], "gold"),
            c([-2, 28, -2], [4, 6, 4], "gold"),
            c([4, 28, -2], [4, 4, 4], "gold"),
        ]),
        Bone("orbit", [0, 18, 0], parent="root"),
        Bone("die1", [18, 18, 0], parent="orbit", cubes=[c([15, 15, -3], [6, 6, 6], "die")]),
        Bone("die2", [-18, 18, 0], parent="orbit", cubes=[c([-21, 15, -3], [6, 6, 6], "die")]),
        Bone("die3", [0, 18, 18], parent="orbit", cubes=[c([-3, 15, 15], [6, 6, 6], "die")]),
        Bone("die4", [0, 18, -18], parent="orbit", cubes=[c([-3, 15, -21], [6, 6, 6], "die")]),
    ]
    base = {"white": hex_rgba("#ffffff"), "sclera": hex_rgba("#fbf7ff"), "gold": hex_rgba("#e7b52a")}
    palettes = {
        "the_randomizer": dict(base, die=hex_rgba("#efe9dc"), edge=hex_rgba("#c9971a"), pip=hex_rgba("#5b2a86"),
                               iris=hex_rgba("#b44cff")),
        "the_randomizer_enraged": dict(base, die=hex_rgba("#b3122e"), edge=hex_rgba("#ffd23f"), pip=hex_rgba("#fff3e0"),
                                       iris=hex_rgba("#ffae00")),
    }
    tumble = "query.life_time * 200"
    anims = {
        "float": {"loop": True, "bones": {
            "root": {"position": [0, "math.sin(query.life_time * 60) * 2", 0]},
            "core": {"rotation": ["query.target_x_rotation * 0.5", "query.target_y_rotation", "math.sin(query.life_time * 45) * 4"]},
        }},
        "orbit": {"loop": True, "bones": {
            "orbit": {"rotation": [0, "query.life_time * 90", 0]},
            "die1": {"rotation": [tumble, 0, tumble]},
            "die2": {"rotation": [0, tumble, tumble]},
            "die3": {"rotation": [tumble, tumble, 0]},
            "die4": {"rotation": [f"-{tumble}", 0, tumble]},
        }},
        "cast": {"loop": False, "animation_length": 0.8, "bones": {
            "core": {"scale": {"0.0": [1, 1, 1], "0.3": [1.15, 1.15, 1.15], "0.8": [1, 1, 1]}},
            "orbit": {"scale": {"0.0": [1, 1, 1], "0.3": [1.5, 1.2, 1.5], "0.8": [1, 1, 1]}},
        }},
    }
    animate = ["float", "orbit"]
    return dict(name="the_randomizer", bones=bones, width=128, palettes=palettes, anims=anims,
                animate=animate, bounds=(4, 4, [0, 1.2, 0]))


def loot_goblin():
    c = Cube
    bones = [
        Bone("root", [0, 0, 0]),
        Bone("body", [0, 6, 0], parent="root", cubes=[c([-3, 6, -2], [6, 7, 4], "vest")]),
        Bone("sack", [0, 12, 3], parent="body", cubes=[
            c([-4, 6, 2], [8, 9, 6], "sack"),
            c([-1, 15, 4], [2, 2, 2], "sack"),
        ]),
        Bone("head", [0, 13, 0], parent="body", cubes=[
            c([-4, 13, -4], [8, 7, 7], "goblin_head"),
            c([-1, 14, -6], [2, 3, 2], "skin"),
            c([4, 16, -1], [4, 2, 1], "skin"),
            c([-8, 16, -1], [4, 2, 1], "skin"),
        ]),
        Bone("right_arm", [-4, 12, 0], parent="body", cubes=[c([-5, 5, -1], [2, 7, 2], "skin")]),
        Bone("left_arm", [4, 12, 0], parent="body", cubes=[c([3, 5, -1], [2, 7, 2], "skin")]),
        Bone("right_leg", [-1.5, 6, 0], parent="root", cubes=[c([-3, 0, -1], [3, 6, 3], "vest")]),
        Bone("left_leg", [1.5, 6, 0], parent="root", cubes=[c([0, 0, -1], [3, 6, 3], "vest")]),
    ]
    pal = {"skin": hex_rgba("#5fae3a"), "eye": hex_rgba("#ffe23f"), "white": hex_rgba("#ffffff"),
           "vest": hex_rgba("#6b3f1d"), "gold": hex_rgba("#ffd23f"), "sack": hex_rgba("#9a6a36"),
           "rope": hex_rgba("#e0c083")}
    walk = "math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed * 57.3"
    anims = {
        "walk": {"loop": True, "bones": {
            "right_leg": {"rotation": [f"{walk} * 1.4", 0, 0]},
            "left_leg": {"rotation": [f"-{walk} * 1.4", 0, 0]},
            "right_arm": {"rotation": [f"-{walk} * 1.2", 0, 0]},
            "left_arm": {"rotation": [f"{walk} * 1.2", 0, 0]},
            "sack": {"rotation": [f"math.abs({walk}) * 0.25", 0, 0]},
        }},
        "look": {"loop": True, "bones": {"head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}}},
        "idle": {"loop": True, "bones": {"head": {"rotation": [0, 0, "math.sin(query.life_time * 200) * 3"]}}},
    }
    return dict(name="loot_goblin", bones=bones, width=64, palettes={"loot_goblin": pal}, anims=anims,
                animate=["walk", "look", "idle"], bounds=(2, 2, [0, 0.6, 0]))


MODELS = [titan, void_wraith, the_randomizer, loot_goblin]


# --------------------------------------------------------------------------- output

def build_model(spec):
    bones = spec["bones"]
    height = pack(bones, spec["width"])
    textures = {}
    for tex_name, pal in spec["palettes"].items():
        cv = Canvas(spec["width"], height)
        for bone in bones:
            for i, cube in enumerate(bone.cubes):
                rng = rng_for(f"{bone.name}:{i}")
                w, h, d = cube.size
                for face, rect in box_faces(cube.uv[0], cube.uv[1], w, h, d).items():
                    PAINTERS[cube.paint](cv, face, rect, cube, pal, rng)
        textures[tex_name] = cv

    bw, bh, off = spec["bounds"]
    geo_bones = []
    for bone in bones:
        entry = {"name": bone.name, "pivot": bone.pivot}
        if bone.parent:
            entry["parent"] = bone.parent
        if bone.rotation:
            entry["rotation"] = bone.rotation
        if bone.cubes:
            entry["cubes"] = [{"origin": c.origin, "size": c.size, "uv": list(c.uv)} for c in bone.cubes]
        geo_bones.append(entry)
    geometry = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": f"geometry.chaos.{spec['name']}",
                "texture_width": spec["width"],
                "texture_height": height,
                "visible_bounds_width": bw,
                "visible_bounds_height": bh,
                "visible_bounds_offset": off,
            },
            "bones": geo_bones,
        }],
    }
    animations = {"format_version": "1.8.0", "animations": {
        f"animation.chaos.{spec['name']}.{k}": v for k, v in spec["anims"].items()}}
    return geometry, textures, animations


def front_preview(spec, textures, scale=4):
    """Orthographic front view (looking at -Z faces) for eyeballing UVs; not shipped."""
    bones = spec["bones"]
    cubes = [c for b in bones for c in b.cubes]
    minx = min(c.origin[0] for c in cubes)
    maxx = max(c.origin[0] + c.size[0] for c in cubes)
    maxy = max(c.origin[1] + c.size[1] for c in cubes)
    miny = min(c.origin[1] for c in cubes)
    tex = next(iter(textures.values()))
    W, H = int(maxx - minx), int(maxy - miny)
    cv = Canvas(W, H, (40, 44, 52, 255))
    zbuf = [[1e9] * W for _ in range(H)]
    for c in cubes:
        w, h, d = c.size
        fx, fy, _, _ = box_faces(c.uv[0], c.uv[1], w, h, d)["front"]
        z = c.origin[2]
        for j in range(int(h)):
            for i in range(int(w)):
                px = int(c.origin[0] - minx + i)
                py = int(maxy - (c.origin[1] + h) + j)
                if 0 <= px < W and 0 <= py < H and z < zbuf[py][px]:
                    # Texture column 0 sits on the +X edge of a north (-Z) face.
                    col = tex.get(fx + (int(w) - 1 - i), fy + j)
                    if col[3] > 0:
                        cv.set(W - 1 - px, py, col)
                        zbuf[py][px] = z
    return cv.scaled(scale)
