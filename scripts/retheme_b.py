"""
案B カラーテーマ適用スクリプト
- ボタン: charcoal (#2C2C2C)
- アクセント/価格/リンク: gold (#B8902A)
- バッジ: gold-50 background
- 背景: #FAFAF8
"""
import re
import os

SRC = r"C:\Claude\起業\aiauction_app\src"

# 対象ファイル
files = []
for root, dirs, filenames in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.next']]
    for f in filenames:
        if f.endswith(('.tsx', '.ts', '.css')) and f != 'globals.css':
            files.append(os.path.join(root, f))

# 置換ルール（順序重要）
replacements = [
    # ---- ボタン背景 (charcoal) ----
    # メインCTAボタン
    ("bg-amber-700 hover:bg-amber-600 disabled:bg-stone-200 text-white",
     "bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white"),
    ("bg-amber-700 hover:bg-amber-600 text-white",
     "bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white"),
    # 落札ボタン等
    ("bg-amber-700 hover:bg-amber-600 disabled:bg-stone-200 text-white font-bold",
     "bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-bold"),

    # ---- バッジ・タグ (gold-50) ----
    ("bg-amber-100 text-amber-700",     "bg-[#FBF6EC] text-[#B8902A]"),
    ("bg-amber-50 text-amber-700",      "bg-[#FBF6EC] text-[#B8902A]"),
    ("bg-amber-50 border border-amber-400", "bg-[#FBF6EC] border border-[#B8902A]"),

    # ---- テキストアクセント (gold) ----
    ("text-amber-700", "text-[#B8902A]"),
    ("text-amber-600", "text-[#B8902A]"),
    ("hover:text-amber-600", "hover:text-[#C9A040]"),
    ("hover:text-amber-700", "hover:text-[#B8902A]"),

    # ---- ボーダー (gold) ----
    ("border-amber-500",        "border-[#B8902A]"),
    ("border-amber-400",        "border-[#B8902A]"),
    ("border-amber-300",        "border-[#e5d5a8]"),
    ("focus:border-amber-500",  "focus:border-[#B8902A]"),
    ("hover:border-amber-500",  "hover:border-[#B8902A]"),

    # ---- 背景アクセント ----
    ("bg-amber-700",  "bg-[#B8902A]"),  # 残ったbg-amber (リンクボタンなど)
    ("bg-amber-600",  "bg-[#C9A040]"),
    ("bg-amber-50",   "bg-[#FBF6EC]"),
    ("bg-amber-100",  "bg-[#FBF6EC]"),

    # ---- サイト背景 ----
    ("bg-stone-50 text-gray-800", "bg-[#FAFAF8] text-[#2C2C2C]"),
]

changed = 0
for path in files:
    with open(path, encoding='utf-8') as f:
        original = f.read()
    content = original
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {os.path.relpath(path, SRC)}")
        changed += 1

print(f"\nDone: {changed} files updated")
