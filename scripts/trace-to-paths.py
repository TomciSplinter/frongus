"""Turn traced.json into smooth SVG path data and a preview SVG."""
import json, sys, math

data = json.load(open(sys.argv[1]))
out_svg = sys.argv[2]
out_json = sys.argv[3]


def catmull(pts, closed=False, t=0.5):
    if len(pts) < 3:
        return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    P = pts[:]
    n = len(P)
    d = f"M{P[0][0]:.1f},{P[0][1]:.1f}"
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[0]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else P[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    if closed:
        d += "Z"
    return d


def decimate(pts, min_d=9):
    out = [pts[0]]
    for p in pts[1:-1]:
        if math.dist(p, out[-1]) >= min_d:
            out.append(p)
    out.append(pts[-1])
    return out

fill = decimate(data["fill"], 10)
fill_d = catmull(fill, closed=True, t=0.9)
def smooth(pts, it=2):
    P = [list(p) for p in pts]
    for _ in range(it):
        Q = [P[0]]
        for i in range(1, len(P) - 1):
            Q.append([(P[i-1][0] + 2*P[i][0] + P[i+1][0]) / 4, (P[i-1][1] + 2*P[i][1] + P[i+1][1]) / 4])
        Q.append(P[-1])
        P = Q
    return P

def densify(pts, step=4):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        n = max(1, int(d // step))
        for k in range(1, n + 1):
            out.append([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n])
    return out

line_ds = []
for l in data["lines"]:
    pts = densify(l["pts"], 3)
    pts = smooth(pts, 4)
    pts = decimate(pts, 9)
    line_ds.append(catmull(pts, closed=False, t=1.0))

eyes = data["eyes"]
W, H = data["size"]
parts = {"fill": fill_d, "lines": line_ds, "eyes": eyes}
json.dump(parts, open(out_json, "w"), indent=1)

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
       f'<rect width="{W}" height="{H}" fill="#e4e4e4"/>',
       f'<path d="{fill_d}" fill="#758aa2"/>']
for d in line_ds:
    svg.append(f'<path d="{d}" fill="none" stroke="#000" stroke-width="11.5" stroke-linecap="round" stroke-linejoin="round"/>')
for e in eyes:
    el = e["ellipse"]
    svg.append(f'<ellipse cx="{el["cx"]}" cy="{el["cy"]}" rx="{el["rx"]+4.5}" ry="{el["ry"]+4.5}" transform="rotate({el["rot"]} {el["cx"]} {el["cy"]})" fill="#fff" stroke="#000" stroke-width="10"/>')
    p = e["pupil"]
    svg.append(f'<circle cx="{p["cx"]}" cy="{p["cy"]}" r="{p["r"]-1}" fill="#000"/>')
svg.append('</svg>')
open(out_svg, "w").write("\n".join(svg))
print("ok", len(fill), [len(x) for x in line_ds])
