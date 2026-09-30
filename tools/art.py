"""16x16 pixel art for items, the Lucky Block and the pack icons."""
from png import Canvas, hex_rgba, mix, rng_for, shade

K = hex_rgba("#1c0b2b")  # shared outline

ITEMS = {
    "chaos_shard": ({
        "k": K, "w": hex_rgba("#ffffff"), "L": hex_rgba("#ffb8ff"), "M": hex_rgba("#d43cff"), "D": hex_rgba("#7a1fa8"),
    }, [
        "................",
        "..........kk....",
        ".........kwLk...",
        "........kLLMk...",
        "........kLMMk...",
        ".......kLMMDk...",
        "......kLMMDk....",
        ".....kLMMDk.....",
        "....kLMMDk......",
        "....kMMDDk......",
        "...kMMDDk...kk..",
        "...kMDDk...kLMk.",
        "..kMDDk....kMDk.",
        "..kDDk......kk..",
        "...kk...........",
        "................",
    ]),
    "chaos_codex": ({
        "k": K, "P": hex_rgba("#6b2fa3"), "D": hex_rgba("#43186e"), "G": hex_rgba("#ffd23f"), "W": hex_rgba("#efe6d2"),
    }, [
        "................",
        "..kkkkkkkkkk....",
        "..kPPPPPPPPPk...",
        "..kPPPGGGPPPkW..",
        "..kPPGPPPGPPkW..",
        "..kPPPPPPGPPkW..",
        "..kPPPPPGPPPkW..",
        "..kPPPPGPPPPkW..",
        "..kPPPPGPPPPkW..",
        "..kPPPPPPPPPkW..",
        "..kPPPPGPPPPkW..",
        "..kPPPPPPPPPkW..",
        "..kDDDDDDDDDkW..",
        "...kWWWWWWWWWk..",
        "....kkkkkkkkkk..",
        "................",
    ]),
    "titan_core": ({
        "k": K, "O": hex_rgba("#2e1f45"), "M": hex_rgba("#e040ff"), "W": hex_rgba("#ffd9ff"),
    }, [
        "................",
        "......kkkk......",
        "....kkOOOOkk....",
        "...kOOMOOOOOk...",
        "..kOOOMMOOOOOk..",
        "..kOOOOMOOOMOk..",
        ".kOOOOOMMMMOOOk.",
        ".kOOOMMMWMOOOOk.",
        ".kOOOOOMMMOOOOk.",
        ".kOOOOMOOMMOOOk.",
        "..kOOMOOOOMOOk..",
        "..kOOMOOOOOMOk..",
        "...kOOOOOOOOk...",
        "....kkOOOOkk....",
        "......kkkk......",
        "................",
    ]),
    "void_eye": ({
        "k": K, "V": hex_rgba("#3a1560"), "C": hex_rgba("#39f5ff"), "B": hex_rgba("#05030a"), "W": hex_rgba("#ffffff"),
    }, [
        "................",
        "......kkkk......",
        "....kkVVVVkk....",
        "...kVVVVVVVVk...",
        "..kVVCCCCCCVVk..",
        "..kVCCBBBBCCVk..",
        ".kVVCBBBBBBCVVk.",
        ".kVCCBBWBBBCCVk.",
        ".kVCCBBBBBBCCVk.",
        ".kVVCBBBBBBCVVk.",
        "..kVCCBBBBCCVk..",
        "..kVVCCCCCCVVk..",
        "...kVVVVVVVVk...",
        "....kkVVVVkk....",
        "......kkkk......",
        "................",
    ]),
    "loaded_die": ({
        "k": K, "Y": hex_rgba("#ffd23f"), "O": hex_rgba("#c9971a"), "p": hex_rgba("#6b2fa3"),
    }, [
        "................",
        "..kkkkkkkkkkkk..",
        ".kYYYYYYYYYYYYk.",
        ".kYppYYYYYYppYk.",
        ".kYppYYYYYYppYk.",
        ".kYYYYYYYYYYYYk.",
        ".kYYYYYppYYYYYk.",
        ".kYYYYYppYYYYYk.",
        ".kYYYYYYYYYYYYk.",
        ".kYppYYYYYYppYk.",
        ".kYppYYYYYYppYk.",
        ".kYYYYYYYYYYYYk.",
        ".kOOOOOOOOOOOOk.",
        "..kkkkkkkkkkkk..",
        "................",
        "................",
    ]),
    "dice_of_destiny": ({
        "k": K, "R": hex_rgba("#c8163a"), "D": hex_rgba("#7d0c22"), "w": hex_rgba("#fff3e0"), "G": hex_rgba("#ffd23f"),
    }, [
        "................",
        "..kkkkkkkkkkkk..",
        ".kGRRRRRRRRRRGk.",
        ".kRwwwRRRRRRRRk.",
        ".kRwwwRRRRRRRRk.",
        ".kRwwwRRRRRRRRk.",
        ".kRRRRRwwwRRRRk.",
        ".kRRRRRwwwRRRRk.",
        ".kRRRRRwwwRRRRk.",
        ".kRRRRRRRRwwwRk.",
        ".kRRRRRRRRwwwRk.",
        ".kGRRRRRRRwwwGk.",
        ".kDDDDDDDDDDDDk.",
        "..kkkkkkkkkkkk..",
        "................",
        "................",
    ]),
    "goblin_bait": ({
        "k": K, "S": hex_rgba("#8b5a2b"), "R": hex_rgba("#d9b26f"), "G": hex_rgba("#ffd23f"), "Y": hex_rgba("#fff3a0"),
    }, [
        "................",
        "......kkkk......",
        ".....kSSSSk.....",
        "......kRRk......",
        ".....kSSSSk.....",
        "....kSSSSSSk....",
        "...kSSSSSSSSk...",
        "..kSSSSSSSSSSk..",
        "..kSSSSkkkSSSk..",
        "..kSSSkGGGkSSk..",
        "..kSSkGGYGGkSk..",
        "..kSSkGYGGGkSk..",
        "..kSSSkGGGkSSk..",
        "...kSSSkkkSSk...",
        "....kkkkkkkk....",
        "................",
    ]),
    "titan_heart": ({
        "k": K, "M": hex_rgba("#b52cff"), "L": hex_rgba("#f0b3ff"), "D": hex_rgba("#5e1591"),
    }, [
        "................",
        "................",
        "...kkk....kkk...",
        "..kMMMk..kMMMk..",
        ".kMLLMMkkMMMMDk.",
        ".kMLMMMMMMMMMDk.",
        ".kMMMMMMMMMMMDk.",
        ".kMMMMMMMMMMDDk.",
        "..kMMMMMMMMDDk..",
        "...kMMMMMMDDk...",
        "....kMMMMDDk....",
        ".....kMMDDk.....",
        "......kDDk......",
        ".......kk.......",
        "................",
        "................",
    ]),
    "void_essence": ({
        "k": K, "W": hex_rgba("#c9a26b"), "G": hex_rgba("#cfe8ff", 210), "V": hex_rgba("#3a1560"), "C": hex_rgba("#39f5ff"),
    }, [
        "................",
        "......kkkk......",
        "......kWWk......",
        ".......kk.......",
        "......kGGk......",
        ".....kGGGGk.....",
        "....kGVVVVGk....",
        "...kGVVCVVVGk...",
        "...kGVCVVVCGk...",
        "...kGVVVCVVGk...",
        "...kGVCVVVVGk...",
        "...kGVVVVCVGk...",
        "....kGVVVVGk....",
        ".....kkkkkk.....",
        "................",
        "................",
    ]),
    "chaos_blade": ({
        "k": K, "W": hex_rgba("#ffc4ff"), "M": hex_rgba("#d43cff"), "G": hex_rgba("#ffd23f"), "H": hex_rgba("#5b3a1e"),
    }, [
        "................",
        ".............kk.",
        "............kWMk",
        "...........kWMk.",
        "..........kWMk..",
        ".........kWMk...",
        "........kWMk....",
        ".......kWMk.....",
        "..kk..kWMk......",
        "..kGkkWMk.......",
        "...kGGMk........",
        "....kGGk........",
        "...kHkGGk.......",
        "..kHk..kGk......",
        ".kHk....kk......",
        ".kk.............",
    ]),
    "chaos_apple": ({
        "k": K, "M": hex_rgba("#e040ff"), "P": hex_rgba("#8a2be2"), "W": hex_rgba("#ffe6ff"), "L": hex_rgba("#3fbf3f"),
        "S": hex_rgba("#5b3a1e"),
    }, [
        "................",
        ".......kk.......",
        "........kS.kk...",
        "........kSkLLk..",
        "....kkk.kkLLk...",
        "...kMMMkMMkk....",
        "..kMWMMMMMMPk...",
        "..kMWMMMMMMPk...",
        "..kMMMMMMMMPk...",
        "..kMMMMMMMPPk...",
        "..kMMMMMMMPPk...",
        "...kMMMMMPPk....",
        "...kMMMMPPPk....",
        "....kkPkkPk.....",
        "......k..k......",
        "................",
    ]),
}

LUCKY = [
    "OOOOOOOOOOOOOOOO",
    "OYYYYYYYYYYYYYYO",
    "OYYYYYYYYYYYYYYO",
    "OYYYYkkkkkYYYYYO",
    "OYYYkWWWWWkYYYYO",
    "OYYYkWkkkWWkYYYO",
    "OYYYYkYYYkWkYYYO",
    "OYYYYYYYkWWkYYYO",
    "OYYYYYYkWWkYYYYO",
    "OYYYYYYkWkYYYYYO",
    "OYYYYYYYkYYYYYYO",
    "OYYYYYYkWkYYYYYO",
    "OYYYYYYkWkYYYYYO",
    "OYYYYYYYkYYYYYYO",
    "OYYYYYYYYYYYYYYO",
    "OOOOOOOOOOOOOOOO",
]


def item_textures():
    out = {}
    for name, (palette, rows) in ITEMS.items():
        cv = Canvas(16, 16)
        cv.ascii(rows, palette)
        out[name] = cv
    return out


def lucky_block():
    rng = rng_for("lucky")
    cv = Canvas(16, 16)
    gold = hex_rgba("#ffc933")
    for y, row in enumerate(LUCKY):
        for x, ch in enumerate(row):
            if ch == "Y":
                cv.set(x, y, shade(gold, 1 + rng.uniform(-0.07, 0.07)))
            elif ch == "O":
                cv.set(x, y, shade(hex_rgba("#b8860b"), 1 + rng.uniform(-0.1, 0.1)))
            elif ch == "W":
                cv.set(x, y, hex_rgba("#ffffff"))
            elif ch == "k":
                cv.set(x, y, hex_rgba("#5a3a00"))
    return cv


def pack_icon(kind):
    """128x128 icon: purple gradient, big lucky block, a chaos shard badge."""
    size = 128
    cv = Canvas(size, size)
    top, bottom = hex_rgba("#3b0f63"), hex_rgba("#12051f")
    for y in range(size):
        for x in range(size):
            cv.set(x, y, mix(top, bottom, y / size))
    rng = rng_for("stars" + kind)
    for _ in range(70):
        cv.set(rng.randrange(size), rng.randrange(size), hex_rgba("#e9c6ff", rng.randrange(90, 255)))
    cv.paste(lucky_block().scaled(5), 24, 20)
    shard = item_textures()["chaos_shard" if kind == "behavior" else "loaded_die"].scaled(3)
    cv.paste(shard, 76, 72)
    return cv
