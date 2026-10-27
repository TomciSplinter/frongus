"""Trace the uploaded Frongus into clean SVG parts: body fill, line strokes, eyes."""
import json, sys
import numpy as np
import cv2
from PIL import Image
from skimage.morphology import skeletonize

SRC = sys.argv[1]
OUT = sys.argv[2]

im = np.array(Image.open(SRC).convert("RGB")).astype(int)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = (r + g + b) / 3
black = lum < 100
bgmask = (np.abs(r - 228) < 22) & (np.abs(g - 228) < 22) & (np.abs(b - 228) < 22)
# eye whites share the background colour: they are the bg-coloured blobs that do not touch the border
_n, _lab = cv2.connectedComponents(bgmask.astype(np.uint8), 8)
_border = set(np.unique(np.concatenate([_lab[0, :], _lab[-1, :], _lab[:, 0], _lab[:, -1], _lab[:, -3]])))
white = np.isin(_lab, [i for i in range(1, _n) if i not in _border])
# ignore the image border column artefacts
black[:, W - 4:] = False
black[:, :3] = False

# ---------- eyes ----------
wl = white.astype(np.uint8)
n, lab, stats, cents = cv2.connectedComponentsWithStats(wl, 8)
eyes = []
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area < 800 or area > 20000:
        continue
    ys, xs = np.where(lab == i)
    # include pupil: fill the hole by using the bbox centre of white+black blob later
    eyes.append({"bbox": [int(x), int(y), int(w), int(h)], "area": int(area)})

eye_info = []
for e in eyes:
    x, y, w, h = e["bbox"]
    pad = 30
    x0, y0, x1, y1 = max(x - pad, 0), max(y - pad, 0), min(x + w + pad, W), min(y + h + pad, H)
    sub_white = white[y0:y1, x0:x1]
    sub_black = black[y0:y1, x0:x1]
    # eye ball (white + pupil inside) = fill holes of white region
    wb = (sub_white).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(wb, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    (cx, cy), rad = cv2.minEnclosingCircle(hull)
    # pupil: black pixels inside the hull
    hullmask = np.zeros_like(wb)
    cv2.fillPoly(hullmask, [hull], 255)
    pupil = (sub_black & (hullmask > 0)).astype(np.uint8) * 255
    pc = cv2.findContours(pupil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
    pcm = max(pc, key=cv2.contourArea)
    (px, py), prad = cv2.minEnclosingCircle(pcm)
    # fit ellipse to white hull for a nicer eye shape
    ell = cv2.fitEllipse(hull)
    eye_info.append({
        "cx": round(cx + x0, 1), "cy": round(cy + y0, 1), "r": round(rad, 1),
        "ellipse": {"cx": round(ell[0][0] + x0, 1), "cy": round(ell[0][1] + y0, 1),
                     "rx": round(ell[1][0] / 2, 1), "ry": round(ell[1][1] / 2, 1), "rot": round(ell[2], 1)},
        "pupil": {"cx": round(px + x0, 1), "cy": round(py + y0, 1), "r": round(prad, 1)},
    })

# mask out eyes (ring + pupil) from the black mask so only body lines remain
lines = black.copy()
for e in eye_info:
    yy, xx = np.ogrid[:H, :W]
    m = (xx - e["cx"]) ** 2 + (yy - e["cy"]) ** 2 <= (e["r"] + 15) ** 2
    lines[m] = False

# ---------- body fill silhouette ----------
fig = (~bgmask).astype(np.uint8)
fig[:, W - 4:] = 0
fig[:, :3] = 0
num, lab2, st2, _ = cv2.connectedComponentsWithStats(fig, 8)
biggest = 1 + np.argmax(st2[1:, cv2.CC_STAT_AREA])
sil = (lab2 == biggest).astype(np.uint8) * 255
# fill holes
cnts, _ = cv2.findContours(sil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
solid = np.zeros_like(sil)
cv2.drawContours(solid, cnts, -1, 255, -1)
# remove thin overshoot strokes (open with ~13px disk), then shrink a bit
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))
opened = cv2.morphologyEx(solid, cv2.MORPH_OPEN, k)
k2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
fillmask = cv2.erode(opened, k2)
fc, _ = cv2.findContours(fillmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
fc = max(fc, key=cv2.contourArea)
fill_poly = cv2.approxPolyDP(fc, 1.6, True)[:, 0, :].tolist()

# silhouette outer contour (for anchors)
oc = max(cnts, key=cv2.contourArea)[:, 0, :]

# ---------- line skeleton -> polylines ----------
# close tiny gaps then skeletonize
lm = lines.astype(np.uint8) * 255
lm = cv2.morphologyEx(lm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
# drop tiny specks
n3, lab3, st3, _ = cv2.connectedComponentsWithStats(lm, 8)
keep = np.zeros_like(lm)
for i in range(1, n3):
    if st3[i, cv2.CC_STAT_AREA] >= 60:
        keep[lab3 == i] = 255
sk = skeletonize(keep > 0)

# local stroke width estimate via distance transform
dist = cv2.distanceTransform(keep, cv2.DIST_L2, 5)

pts = set(zip(*np.where(sk)))
def nbrs(p):
    y, x = p
    out = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            q = (y + dy, x + dx)
            if q in pts:
                out.append(q)
    return out

deg = {p: len(nbrs(p)) for p in pts}
visited_edges = set()
polylines = []
def walk(start, nxt):
    path = [start, nxt]
    visited_edges.add((start, nxt)); visited_edges.add((nxt, start))
    prev, cur = start, nxt
    while deg[cur] == 2:
        cand = [q for q in nbrs(cur) if q != prev and (cur, q) not in visited_edges]
        if not cand:
            break
        q = cand[0]
        visited_edges.add((cur, q)); visited_edges.add((q, cur))
        path.append(q)
        prev, cur = cur, q
    return path

nodes = [p for p in pts if deg[p] != 2]
for p in nodes:
    for q in nbrs(p):
        if (p, q) not in visited_edges:
            polylines.append(walk(p, q))
# pure cycles (no nodes)
for p in pts:
    if deg[p] == 2:
        for q in nbrs(p):
            if (p, q) not in visited_edges:
                polylines.append(walk(p, q))

# merge chains through junctions is skipped; filter very short spurs
res = []
for pl in polylines:
    if len(pl) < 12:
        continue
    arr = np.array([[x, y] for y, x in pl], dtype=np.float32)
    simp = cv2.approxPolyDP(arr.reshape(-1, 1, 2), 1.4, False)[:, 0, :]
    widths = [float(dist[y, x]) * 2 for y, x in pl]
    res.append({"pts": simp.round(1).tolist(), "w": round(float(np.median(widths)), 1), "n": len(pl)})

json.dump({
    "size": [W, H],
    "eyes": eye_info,
    "fill": fill_poly,
    "outer": oc[::4].tolist(),
    "lines": res,
}, open(OUT, "w"))
print("eyes", eye_info)
print("fill pts", len(fill_poly), "lines", len(res))
for l in res:
    print(l["n"], l["w"], l["pts"][0], l["pts"][-1], len(l["pts"]))
