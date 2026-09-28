"""Rebuild the deployable site at the repository root from the files in source/.

    python3 source/build.py

Writes index.html, api/pulse.js, api/town.js, vercel.json and package.json next to this folder.
Set SITE_URL (for example https://ethereum-town.vercel.app) so the social preview tags use absolute URLs.
"""
import json, os

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(SRC)
THREE_V = "0.170.0"
SITE = os.environ.get("SITE_URL", "https://ethereum-town.vercel.app").rstrip("/")

head = open(os.path.join(SRC, "head.html")).read()
data = open(os.path.join(SRC, "data.js")).read()
parts = ["a_setup.js", "b_world.js", "c_actors.js", "d_sim.js", "e_ui.js", "f_main.js"]
js = "\n".join(open(os.path.join(SRC, "js", p)).read() for p in parts)
importmap = json.dumps({"imports": {"three": f"https://cdn.jsdelivr.net/npm/three@{THREE_V}/build/three.module.min.js",
                                    "three/addons/": f"https://cdn.jsdelivr.net/npm/three@{THREE_V}/examples/jsm/"}})
scripts = f'<script>{data}</script>\n<script type="importmap">{importmap}</script>\n<script type="module">\n{js}\n</script>\n'

split = head.index('<div id="app">')
head_part, body_part = head[:split], head[split:]
og = ('<meta name="theme-color" content="#0d111d">\n'
      f'<meta property="og:image" content="{SITE}/og.png">\n<meta name="twitter:image" content="{SITE}/og.png">\n'
      '<meta property="og:type" content="website">\n'
      '<meta property="og:title" content="Ethereum Town">\n'
      '<meta property="og:description" content="A live 3D miniature of Ethereum: every train is a real block, every L2 a shop sized by real usage. Click any building to learn what it is and where the data comes from.">\n'
      '<meta name="twitter:card" content="summary_large_image">\n')
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + og + head_part +
        '</head>\n<body>\n' + body_part + "\n" + scripts + "</body>\n</html>\n")
open(os.path.join(OUT, "index.html"), "w").write(page)

# serverless functions: bake in the batch-poster map and the L2 candidate list
senders = json.load(open(os.path.join(SRC, "senders.json")))
senders = {a: ("zksync2" if k == "zksync" else k) for a, k in senders.items()}
cands = json.load(open(os.path.join(SRC, "l2_candidates.json")))["candidates"]
os.makedirs(os.path.join(OUT, "api"), exist_ok=True)
for name in ["pulse", "town"]:
    src = open(os.path.join(SRC, "api_src", name + ".js")).read()
    src = src.replace("__SENDERS__", json.dumps(senders, separators=(",", ":"))).replace("__CANDIDATES__", json.dumps(cands, separators=(",", ":")))
    open(os.path.join(OUT, "api", name + ".js"), "w").write(src)

open(os.path.join(OUT, "vercel.json"), "w").write(json.dumps({
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": None,
    "functions": {"api/town.js": {"maxDuration": 30}, "api/pulse.js": {"maxDuration": 10}},
    "headers": [{"source": "/(.*)", "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
        {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"},
    ]}],
}, indent=2) + "\n")
open(os.path.join(OUT, "package.json"), "w").write(json.dumps({
    "name": "ethereum-town", "private": True, "version": "2.0.0",
    "description": "A live 3D miniature of the Ethereum network. Static page plus two read-only serverless functions; no build step.",
    "engines": {"node": ">=20"},
}, indent=2) + "\n")
print("index.html", os.path.getsize(os.path.join(OUT, "index.html")), "bytes · candidates", len(cands))
