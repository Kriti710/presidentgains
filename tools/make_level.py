W, H = 216, 15
GR, DR = 12, 13          # grass row, first dirt row
g = [[' ']*W for _ in range(H)]

def put(x, y, ch):
    if 0 <= x < W and 0 <= y < H: g[y][x] = ch
def ground(a, b):
    for x in range(a, b+1):
        put(x, GR, '='); put(x, DR, '-'); put(x, DR+1, '-')
def row(a, b, y, pat):
    for i, x in enumerate(range(a, b+1)): put(x, y, pat[i % len(pat)])
def pipe(x, h):                       # h = tiles tall (>=2)
    top = GR - h
    put(x, top, 'P'); put(x+1, top, 'p')
    for y in range(top+1, GR):
        put(x, y, 'q'); put(x+1, y, 'q')
def stairs(x, n, up=True):
    for i in range(n):
        hgt = i+1 if up else n-i
        for k in range(hgt): put(x+i, GR-1-k, '!')

# --- terrain -------------------------------------------------------
ground(0, 68); ground(72, 104); ground(107, 148); ground(152, W-1)

# --- opening -------------------------------------------------------
put(4, GR-1, '^'); put(30, GR-1, '^'); put(96, GR-1, '^'); put(160, GR-1, '^')
put(9, GR-1, 'M'); put(76, GR-1, 'M'); put(170, GR-1, 'M')
for cx in (14, 44, 88, 126, 178, 200): put(cx, 2, '~')
for cx in (26, 60, 112, 158): put(cx, 4, '~')

put(18, 8, '?')
row(23, 27, 8, 'b?b?b'); put(25, 4, '?')
put(22, GR-1, 'g')
row(24, 26, 3, 'ccc')

pipe(31, 2); pipe(37, 3)
put(41, GR-1, 'g'); put(44, GR-1, 'g')
row(47, 48, 8, 'bb'); put(50, 8, '?'); put(50, GR-1, 'g')
row(55, 59, 4, 'b?b?b'); row(55, 59, 9, 'cccc c')
pipe(63, 4)
put(66, GR-1, 'g'); put(67, GR-1, 'g')
row(69, 71, 8, 'ccc')

# --- middle --------------------------------------------------------
put(75, 7, '?'); row(79, 81, 8, 'b?b'); put(80, GR-1, 'g')
stairs(85, 4, True); stairs(90, 4, False)
row(87, 88, 6, 'cc')
row(95, 96, 8, '??'); put(99, GR-1, 'g'); put(101, GR-1, 'g')
row(104, 106, 7, 'ccc')

pipe(111, 2)
row(115, 119, 8, 'b?bb?'); put(117, GR-1, 'g'); put(121, GR-1, 'g')
row(124, 129, 5, 'b?bb?b'); row(124, 129, 3, 'cccccc')
put(132, GR-1, 'g'); put(134, GR-1, 'g')
pipe(137, 3)
row(141, 146, 8, 'bb?bbb')
row(148, 151, 7, 'cccc')

# --- final run ------------------------------------------------------
stairs(157, 4, True); stairs(162, 4, False)
put(165, 8, '?'); put(168, GR-1, 'g'); put(170, GR-1, 'g'); put(172, GR-1, 'g')
row(176, 181, 6, 'b?bb?b'); row(176, 181, 4, 'cccccc')
put(184, GR-1, 'g')
stairs(188, 8, True)
for i in range(8): put(196+i, GR-1, '!') if False else None
put(199, 3, 'F')                 # flagpole (anchored top)
put(208, GR-1, 'C')              # castle
row(192, 195, 8, 'cccc')

lines = [''.join(r).rstrip() for r in g]
wmax = max(len(l) for l in lines)
lines = [l.ljust(wmax) for l in lines]
js = "// Level map — edit freely, every row must be the same length.\n"
js += "// = grass  - dirt  ! solid  b brick  ? prize block  c coin\n"
js += "// P/p pipe top (2 wide)  q pipe body  g goomba\n"
js += "// ^ bush  M mountain  ~ cloud  F flagpole  C castle\n\n"
js += "export const TILE = 48;\n\nexport const LEVEL = [\n"
js += "".join(f'  "{l}",\n' for l in lines)
js += "];\n"
open('src/level.js','w').write(js)
print('rows', len(lines), 'cols', wmax)
