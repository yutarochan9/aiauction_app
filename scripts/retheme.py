import os, re

SRC = r'C:\Claude\起業\aiauction_app\src'

# ダーク→ライト＋オーカー の置換マップ（順番に注意）
REPLACEMENTS = [
    # Violet → Amber/Ochre（先に長いパターンを処理）
    ('bg-violet-900/30',        'bg-amber-50'),
    ('bg-violet-900/20',        'bg-amber-50'),
    ('bg-violet-900',           'bg-amber-50'),
    ('bg-violet-800',           'bg-amber-100'),
    ('bg-violet-700',           'bg-amber-200'),
    ('hover:bg-violet-500',     'hover:bg-amber-600'),
    ('bg-violet-600',           'bg-amber-700'),
    ('bg-violet-500',           'bg-amber-600'),
    ('border-violet-800',       'border-amber-300'),
    ('border-violet-700',       'border-amber-400'),
    ('hover:border-violet-500', 'hover:border-amber-500'),
    ('focus:border-violet-500', 'focus:border-amber-500'),
    ('border-violet-500',       'border-amber-500'),
    ('text-violet-400',         'text-amber-700'),
    ('text-violet-300',         'text-amber-600'),
    ('accent-violet-500',       'accent-amber-600'),

    # Backgrounds
    ('bg-gray-950',  'bg-stone-50'),
    ('bg-gray-900',  'bg-white'),
    ('bg-gray-800',  'bg-stone-100'),
    ('bg-gray-700',  'bg-stone-200'),

    # Borders
    ('border-gray-800', 'border-stone-200'),
    ('border-gray-700', 'border-stone-300'),
    ('border-gray-600', 'border-stone-400'),

    # Text（長い数字から先に）
    ('text-gray-100',  'text-gray-800'),
    ('text-gray-300',  'text-gray-600'),
    ('text-gray-400',  'text-gray-500'),
    ('text-gray-500',  'text-gray-400'),
    ('text-gray-600',  'text-gray-300'),
    ('text-white',     'text-gray-900'),

    # amber-400 → 600（ライト背景で見やすく）
    ('text-amber-400', 'text-amber-600'),
]

EXCLUDE = ['Navbar.tsx']  # Navbarは別途手動で対応

count = 0
for root, dirs, files in os.walk(SRC):
    for fname in files:
        if not fname.endswith(('.tsx', '.ts', '.css')):
            continue
        if fname in EXCLUDE:
            continue
        path = os.path.join(root, fname)
        with open(path, encoding='utf-8') as f:
            text = f.read()
        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'Updated: {fname}')
            count += 1

print(f'\n{count} files updated.')
