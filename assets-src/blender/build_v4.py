# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Modelos v4 do Earthset (GLB), geometria procedural hard-surface escrita neste script.

Autoria: toda a geometria é gerada aqui (perfis de revolução, prismas, tubos, biséis e
normais ponderadas). Nenhum modelo de terceiros, nenhuma imagem ou ativo gerado por IA,
nenhuma marca da NASA. O letreiro "EARTHSET" usa a fonte DejaVu Sans Bold (licença livre)
convertida em malha.

Convenções:
  * metros; no Blender Z é a altura, o exportador glTF converte para +Y em cima;
  * origem de cada modelo no chão, no centro;
  * "frente" do habitat, módulo de pouso e demais estruturas = +Z no glTF (= -Y no Blender);
  * o rover anda para +X; rodas wheel_0..wheel_5 são filhos diretos da raiz, com rotação
    identidade e eixo da roda no Z local do glTF (= Y do Blender);
  * nós animáveis (drill, yoke, dish, panel_pivot, engine_glow, beacon) têm origem no pivô.

Uso:
  blender -b --factory-startup -P assets-src/blender/build_v4.py -- public/models/v4 [nome ...]
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT_DIR = ARGS[0] if ARGS else "public/models/v4"
ONLY = set(ARGS[1:])
PI = math.pi
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rgb(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)

MATS: dict = {}

# nome: (cor, metálico, rugosidade, emissão, força, alfa)
PALETTE = {
    "hull": ("#E9E6DD", 0.0, 0.42, None, 0, 1),
    "hull_panel": ("#D3D0C7", 0.0, 0.5, None, 0, 1),
    "shield": ("#C4C0B4", 0.0, 0.7, None, 0, 1),
    "chassis": ("#E6E3DA", 0.0, 0.4, None, 0, 1),
    "metal": ("#A3A9B1", 0.55, 0.38, None, 0, 1),
    "dark_metal": ("#43474F", 0.4, 0.45, None, 0, 1),
    "graphite": ("#26282D", 0.2, 0.55, None, 0, 1),
    "rubber": ("#1C1D20", 0.0, 0.85, None, 0, 1),
    "amber": ("#F0A23A", 0.0, 0.38, None, 0, 1),
    "teal": ("#3DB5A0", 0.0, 0.38, None, 0, 1),
    "water_blue": ("#4C8FE0", 0.0, 0.35, None, 0, 1),
    "foil_gold": ("#E0AE4A", 0.55, 0.32, None, 0, 1),
    "foil_silver": ("#CDD1D6", 0.55, 0.28, None, 0, 1),
    "radiator": ("#F4F3EE", 0.1, 0.25, None, 0, 1),
    "lens": ("#0E141B", 0.3, 0.06, None, 0, 1),
    "rover_cell": ("#1B2F55", 0.4, 0.15, None, 0, 1),
    "panel_cell": ("#1E3866", 0.45, 0.18, None, 0, 1),
    "pad_surface": ("#5E5C59", 0.0, 0.9, None, 0, 1),
    "pad_paint": ("#E7E2D2", 0.0, 0.6, None, 0, 1),
    "regolith": ("#77746E", 0.0, 0.95, None, 0, 1),
    "ice": ("#CFE6F2", 0.0, 0.2, None, 0, 1),
    "plants": ("#5FA94A", 0.0, 0.6, None, 0, 1),
    "soil": ("#4A3B2E", 0.0, 0.95, None, 0, 1),
    "glass": ("#BFE3F2", 0.0, 0.05, None, 0, 0.22),
    "window_light": ("#FFE9C4", 0.0, 0.3, "#FFE2B0", 3.0, 1),
    "ext_light": ("#FFF6E6", 0.0, 0.3, "#FFF3DE", 4.0, 1),
    "beacon": ("#7FD7FF", 0.0, 0.3, "#7FD7FF", 4.0, 1),
    "engine_glow": ("#FFB45A", 0.0, 0.5, "#FF9A3C", 6.0, 1),
    "pad_light": ("#FFC46B", 0.0, 0.3, "#FFB347", 4.0, 1),
    "screen": ("#5BE0C8", 0.0, 0.2, "#4FD8C0", 3.0, 1),
    "status_light": ("#6CF0B0", 0.0, 0.3, "#5CEBA6", 4.0, 1),
    "lamp": ("#FFF4DC", 0.0, 0.3, "#FFF0D2", 6.0, 1),
    "grow_light": ("#F6C8F4", 0.0, 0.3, "#F2A6EE", 4.0, 1),
    "dust_film": ("#B3A892", 0.0, 0.95, None, 0, 0.35),
    "gauge_water": ("#4C8FE0", 0.0, 0.3, "#4C8FE0", 3.0, 1),
    "gauge_air": ("#9FE3F2", 0.0, 0.3, "#9FE3F2", 3.0, 1),
    "tune_glow": ("#7FE8FF", 0.0, 0.3, "#5CE0FF", 5.0, 1),
    "burn": ("#17130F", 0.0, 0.95, None, 0, 1),
}

def mat(name: str):
    if name in MATS:
        return MATS[name]
    color, metal, rough, emit, strength, alpha = PALETTE[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = rgb(color)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emit:
        p.inputs["Emission Color"].default_value = rgb(emit)
        p.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    MATS[name] = m
    return m

PARTS: list = []  # (objeto, grupo)

def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    PARTS.clear()

def _link(name, data):
    ob = bpy.data.objects.new("p_" + name, data)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def finish_mesh(name, me, m, group="body", bev=0.0, seg=2, angle=35, wn=True):
    me.materials.clear()
    me.materials.append(mat(m))
    ob = _link(name, me)
    for p in me.polygons:
        p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(angle))
    if bev > 0:
        b = ob.modifiers.new("Bevel", "BEVEL")
        b.width = bev
        b.segments = seg
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(angle)
    if wn:
        w = ob.modifiers.new("WN", "WEIGHTED_NORMAL")
        w.keep_sharp = True
        w.mode = "FACE_AREA"
    PARTS.append((ob, group))
    return ob

def finish(name, bm, m, group="body", bev=0.0, seg=2, angle=35, wn=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return finish_mesh(name, me, m, group, bev, seg, angle, wn)

def mtx(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    if isinstance(rot, (Quaternion, Matrix, Euler)):
        r = rot
    else:
        r = Euler(rot)
    return Matrix.LocRotScale(Vector(loc), r, Vector(scale))

AXIS_ROT = {"Z": (0, 0, 0), "X": (0, PI / 2, 0), "Y": (PI / 2, 0, 0)}

def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), m="hull", group="body", bev=0.02, seg=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=mtx(loc, rot, size), verts=bm.verts)
    return finish(name, bm, m, group, bev, seg)

def cyl(name, r, h, loc=(0, 0, 0), axis="Z", rot=None, m="metal", group="body",
        bev=0.0, seg=1, n=24, r2=None):
    n = min(n, max(8, int(10 + 50 * max(r, r2 or 0))))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=r,
                          radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.transform(bm, matrix=mtx(loc, rot if rot is not None else AXIS_ROT[axis]), verts=bm.verts)
    return finish(name, bm, m, group, bev, seg)

def sphere(name, r, loc=(0, 0, 0), scale=(1, 1, 1), m="metal", group="body", u=24, v=12, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    bmesh.ops.transform(bm, matrix=mtx(loc, rot, scale), verts=bm.verts)
    return finish(name, bm, m, group, 0, 2, 80)

def z_to(d: Vector) -> Quaternion:
    return Vector((0, 0, 1)).rotation_difference(d.normalized())

def strut(name, p0, p1, r, m="metal", group="body", n=12, bev=0.0):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    return cyl(name, r, d.length, (p0 + p1) / 2, rot=z_to(d), m=m, group=group, n=n, bev=bev)

def beam(name, p0, p1, w, h, m="metal", group="body", bev=0.015):
    """Barra retangular entre dois pontos: w no Y local, h no plano do movimento."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    return box(name, (h, w, d.length), (p0 + p1) / 2, z_to(d), m, group, bev)

def lathe(name, prof, loc=(0, 0, 0), rot=(0, 0, 0), m="hull", group="body", n=32,
          closed=False, bev=0.0, angle=35, cap=True, scale=(1, 1, 1), arc=None):
    """Superfície de revolução em torno do Z local. prof = [(raio, z), ...].

    arc=(a0, a1) gera só um setor (ângulos em radianos), com tampas nas pontas se closed.
    """
    if not arc:
        n = min(n, max(8, int(10 + 30 * max(r for r, _ in prof))))
    bm = bmesh.new()
    rings = []
    if arc:
        angs = [arc[0] + (arc[1] - arc[0]) * i / n for i in range(n + 1)]
    else:
        angs = [2 * PI * i / n for i in range(n)]
    cnt = len(angs)
    for r, z in prof:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for a in angs])
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    if arc and closed:
        bm.faces.new([rg[0] for rg in rings])
        bm.faces.new([rg[-1] for rg in reversed(rings)])
    for a, b in pairs:
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(cnt if not arc else n):
            j = (i + 1) % cnt
            if len(a) == 1:
                bm.faces.new((a[0], b[i], b[j]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap and not closed and not arc:
        if len(rings[0]) > 1:
            bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=mtx(loc, rot, scale), verts=bm.verts)
    return finish(name, bm, m, group, bev, 2, angle)

def ring(name, R, w, t, loc=(0, 0, 0), rot=(0, 0, 0), m="hull_panel", group="body", n=40):
    """Anel de seção retangular chanfrada: raio interno R, largura axial w, espessura radial t."""
    prof = [(R, -w / 2), (R + t, -w / 2), (R + t, w / 2), (R, w / 2)]
    return lathe(name, prof, loc, rot, m, group, n, closed=True, angle=30)

def prism(name, pts_xz, width, loc=(0, 0, 0), rot=(0, 0, 0), m="hull", group="body", bev=0.02, seg=1):
    """Perfil 2D no plano XZ extrudado ao longo de Y (centrado)."""
    bm = bmesh.new()
    a = [bm.verts.new((x, -width / 2, z)) for x, z in pts_xz]
    b = [bm.verts.new((x, width / 2, z)) for x, z in pts_xz]
    n = len(pts_xz)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=mtx(loc, rot), verts=bm.verts)
    return finish(name, bm, m, group, bev, seg)

def _curve_to_mesh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    me.transform(ob.matrix_world)
    bpy.data.objects.remove(ob)
    return me

def tube(name, pts, r, m="metal", group="body", fillet=0.18, res=1):
    pts = [Vector(p) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p = pts[i]
        a = (p - pts[i - 1])
        b = (pts[i + 1] - p)
        f = min(fillet, a.length / 2, b.length / 2)
        s = p - a.normalized() * f
        e = p + b.normalized() * f
        for k in range(6):
            t = k / 5
            out.append((1 - t) ** 2 * s + 2 * (1 - t) * t * p + t * t * e)
    out.append(pts[-1])
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(out) - 1)
    for i, p in enumerate(out):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    ob = _link(name + "_curve", cu)
    return finish_mesh(name, _curve_to_mesh(ob), m, group, 0, 2, 60)

def text(name, s, size, loc, rot, m="graphite", group="body", extrude=0.008):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = s
    cu.size = size
    cu.extrude = extrude
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.space_character = 1.1
    cu.resolution_u = 3
    if os.path.exists(FONT_PATH):
        cu.font = bpy.data.fonts.load(FONT_PATH, check_existing=True)
    ob = _link(name + "_font", cu)
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.view_layer.update()
    return finish_mesh(name, _curve_to_mesh(ob), m, group, 0, 2, 30, wn=False)

def surface_frame(n: Vector, p: Vector) -> Matrix:
    """Matriz com Z local na normal n e origem em p."""
    return Matrix.LocRotScale(p, z_to(n), None)

def round_window(name, p, n, r=0.16, group="body", frame="dark_metal", inset=0.02):
    n = Vector(n).normalized()
    p = Vector(p)
    q = z_to(n)
    ring(name + "_frame", r, 0.07, 0.07, p + n * 0.0, q, frame, group, n=24)
    cyl(name + "_glass", r + 0.01, 0.05, p - n * inset, rot=q, m="window_light", group=group, n=24)

def light_pod(name, p, n, group="body", size=0.12):
    n = Vector(n).normalized()
    q = z_to(n)
    p = Vector(p)
    cyl(name + "_body", size * 0.6, size * 0.6, p + n * size * 0.2, rot=q, m="dark_metal", group=group, n=16, bev=0.008)
    cyl(name + "_lens", size * 0.45, 0.03, p + n * size * 0.52, rot=q, m="ext_light", group=group, n=16)

def finalize(pivots=None):
    """Aplica modificadores, junta peças por grupo e posiciona nós com pivô.

    pivots: lista de (nome, matriz_mundo, pai) na ordem de criação. Se o nome for um grupo,
    a malha é reexpressa no espaço do pivô; senão cria-se um empty.
    """
    pivots = pivots or []
    if os.environ.get("V4_DEBUG"):
        dg = bpy.context.evaluated_depsgraph_get()
        stats = {}
        for ob, _ in PARTS:
            me = ob.evaluated_get(dg).data
            me.calc_loop_triangles()
            key = ob.name.rstrip("0123456789.-")
            stats[key] = stats.get(key, 0) + len(me.loop_triangles)
        for k, v in sorted(stats.items(), key=lambda kv: -kv[1])[:25]:
            print("TRIS", k, v)
    bpy.ops.object.select_all(action="DESELECT")
    for ob, _ in PARTS:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0][0]
    bpy.ops.object.convert(target="MESH")
    groups: dict = {}
    for ob, g in PARTS:
        groups.setdefault(g, []).append(ob)
    nodes = {}
    for g, obs in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = g
        o.data.name = g
        nodes[g] = o
    for name, mw, parent in pivots:
        if name in nodes:
            o = nodes[name]
            o.data.transform(mw.inverted())
        else:
            o = bpy.data.objects.new(name, None)
            bpy.context.scene.collection.objects.link(o)
            nodes[name] = o
        if parent:
            o.parent = nodes[parent]
        o.matrix_world = mw
        bpy.context.view_layer.update()
    return nodes

def export(filename: str, extras: bool = False):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_cameras=False,
        export_lights=False,
        export_extras=extras,
        export_animations=False,
    )
    print("EXPORTED", path, os.path.getsize(path))

HAB_R = 1.7
HAB_ZC = 2.75
HAB_X = 4.15

def hab_module(tag: str, cx: float, flip: float) -> None:
    """Módulo pressurizado horizontal (eixo X), 6 m x Ø3,4 m. flip=+1 à direita, -1 à esquerda."""
    R, zc = HAB_R, HAB_ZC
    prof = [(0.0, -3.0), (0.62, -3.0)]
    for k in range(1, 9):
        t = k / 8 * PI / 2
        prof.append((0.62 + (R - 0.62) * math.sin(t), -2.4 - 0.6 * math.cos(t)))
    prof += [(R, 2.4)]
    for k in range(1, 9):
        t = k / 8 * PI / 2
        prof.append((0.62 + (R - 0.62) * math.cos(t), 2.4 + 0.6 * math.sin(t)))
    prof.append((0.0, 3.0))
    rotx = (0, PI / 2, 0)
    lathe(f"{tag}_shell", prof, (cx, 0, zc), rotx, "hull", n=40, angle=30)
    for z in (-2.4, 0.0, 2.4):
        ring(f"{tag}_seam{z}", R - 0.01, 0.1, 0.045, (cx + z, 0, zc), rotx, "hull_panel", n=36)
    for z0, z1 in ((-1.2, 0.0), (1.2, 2.4)):
        lathe(f"{tag}_shield{z0}", [(R + 0.002, z0 + 0.07), (R + 0.018, z0 + 0.07), (R + 0.018, z1 - 0.07),
                                    (R + 0.002, z1 - 0.07)], (cx, 0, zc), rotx, "shield", n=14, closed=True,
              arc=(PI - 0.95, PI + 0.95), angle=30)
        lathe(f"{tag}_lowshield{z0}", [(R + 0.002, z0 - 1.13), (R + 0.018, z0 - 1.13), (R + 0.018, z0 - 0.07),
                                       (R + 0.002, z0 - 0.07)], (cx, 0, zc), rotx, "shield", n=10, closed=True,
              arc=(-1.42, -0.45), angle=30)
    outer = cx + 1.85 * flip
    for i, (off, col) in enumerate(((0.0, "amber"), (0.24, "graphite"))):
        lathe(f"{tag}_band{i}", [(R + 0.006, -0.09), (R + 0.006, 0.09)], (outer - flip * off, 0, zc), rotx,
              col, n=48, cap=False)
    ring(f"{tag}_endring", 0.5, 0.12, 0.12, (cx + 3.0 * flip, 0, zc), rotx, "metal", n=32)
    cyl(f"{tag}_endhatch", 0.42, 0.06, (cx + 3.02 * flip, 0, zc), "X", m="dark_metal", n=32, bev=0.01)
    for k in range(6):
        a = 2 * PI * k / 6
        cyl(f"{tag}_bolt{k}", 0.03, 0.05, (cx + 3.06 * flip, 0.3 * math.cos(a), zc + 0.3 * math.sin(a)), "X",
            m="metal", n=8)
    inner = cx - 3.0 * flip
    cyl(f"{tag}_collar", 0.72, 0.5, (inner + 0.1 * flip, 0, zc), "X", m="hull_panel", n=32, bev=0.02)
    ring(f"{tag}_collar_ring", 0.72, 0.1, 0.06, (inner + 0.25 * flip, 0, zc), rotx, "metal", n=32)
    for k, dx in enumerate((-1.9, 0.0, 1.9)):
        x = cx + dx
        zb = zc - R - 0.12
        box(f"{tag}_cradle{k}", (0.28, 2.3, 0.2), (x, 0, zb), m="dark_metal", bev=0.03)
        for s in (-1, 1):
            beam(f"{tag}_saddle{k}{s}", (x, s * 1.05, zb + 0.05), (x, s * 1.3, zc - 1.15), 0.24, 0.14, "dark_metal")
            foot = Vector((x, s * 1.75, 0.1))
            strut(f"{tag}_leg{k}{s}", (x, s * 0.95, zb - 0.05), foot + Vector((0, 0, 0.05)), 0.075, "metal", n=14)
            strut(f"{tag}_damper{k}{s}", (x, s * 0.75, zb - 0.05), foot + Vector((0, -s * 0.35, 0.1)), 0.045,
                  "dark_metal", n=10)
            lathe(f"{tag}_pad{k}{s}", [(0.0, 0.0), (0.34, 0.0), (0.36, 0.04), (0.28, 0.1), (0.1, 0.13), (0.0, 0.13)],
                  foot - Vector((0, 0, 0.1)), m="metal", n=14)
    for side in (-1, 1):
        phi = math.radians(52)
        y = side * (R + 0.14) * math.cos(phi)
        z = zc + (R + 0.14) * math.sin(phi)
        tube(f"{tag}_rail{side}", [(cx - 2.2, y, z), (cx + 2.2, y, z)], 0.025, "amber")
        for k in range(5):
            x = cx - 2.0 + k
            p_in = (x, side * (R - 0.05) * math.cos(phi), zc + (R - 0.05) * math.sin(phi))
            strut(f"{tag}_railpost{side}{k}", p_in, (x, y, z), 0.018, "metal", n=8)
    top = zc + R
    box(f"{tag}_avionics", (0.9, 0.55, 0.26), (cx - 1.3 * flip, -0.25, top + 0.06), m="hull_panel", bev=0.03)
    box(f"{tag}_avionics_lid", (0.7, 0.4, 0.04), (cx - 1.3 * flip, -0.25, top + 0.2), m="dark_metal", bev=0.01)
    cyl(f"{tag}_roof_tank", 0.2, 0.9, (cx + 0.9 * flip, 0.45, top + 0.12), "X", m="metal", n=20, bev=0.02)
    for s in (-1, 1):
        ring(f"{tag}_tank_strap{s}", 0.2, 0.05, 0.02, (cx + 0.9 * flip + s * 0.3, 0.45, top + 0.12), (0, PI / 2, 0),
             "dark_metal", n=20)
    box(f"{tag}_conduit", (4.2, 0.16, 0.1), (cx, 0.25, top + 0.02), m="dark_metal", bev=0.02)
    mx = cx + 0.1 * flip
    for dx in (-0.9, 0.9):
        strut(f"{tag}_radpost{dx}", (mx + dx, 0.1, top - 0.05), (mx + dx, 0.1, top + 0.55), 0.04, "metal", n=10)
    box(f"{tag}_rad_frame", (2.8, 0.08, 0.9), (mx, 0.1, top + 1.0), m="metal", bev=0.02)
    box(f"{tag}_rad_panel", (2.65, 0.1, 0.78), (mx, 0.1, top + 1.0), m="radiator", bev=0.01)
    for k in range(9):
        x = mx - 1.2 + k * 0.3
        box(f"{tag}_rad_rib{k}", (0.03, 0.13, 0.76), (x, 0.1, top + 1.0), m="hull_panel", bev=0.0)
    box(f"{tag}_rad_hinge", (2.0, 0.14, 0.1), (mx, 0.1, top + 0.55), m="dark_metal", bev=0.02)
    light_pod(f"{tag}_lamp_a", (outer + 0.7 * flip, -0.9, zc + 1.2), (0.3 * flip, -1, 0.4))
    light_pod(f"{tag}_lamp_b", (cx, -1.25, zc - 1.05), (0, -1, -0.6))

def build_habitat() -> None:
    clear_scene()
    R, zc = HAB_R, HAB_ZC
    for tag, cx, fl in (("modA", HAB_X, 1), ("modB", -HAB_X, -1)):
        hab_module(tag, cx, fl)
    node_r = 1.2
    prof = [(0.0, 1.05), (node_r - 0.1, 1.05), (node_r, 1.15), (node_r, 4.0)]
    for k in range(1, 7):
        t = k / 6 * PI / 2
        prof.append((node_r * math.cos(t) if k < 6 else 0.0, 4.0 + 0.5 * math.sin(t)))
    lathe("node_shell", prof, m="hull", n=40, angle=30)
    for z in (1.45, 3.95):
        ring(f"node_seam{z}", node_r - 0.01, 0.1, 0.05, (0, 0, z), m="hull_panel", n=32)
    lathe("node_band", [(node_r + 0.006, 3.35), (node_r + 0.006, 3.6)], m="teal", n=40, cap=False)
    oct_r = 0.62
    lathe("cupola_base", [(0.0, 4.35), (0.75, 4.35), (0.75, 4.5), (0.0, 4.5)], m="hull_panel", n=8, rot=(0, 0, PI / 8))
    lathe("cupola_body", [(0.0, 4.5), (oct_r, 4.5), (oct_r, 4.85), (0.42, 5.02), (0.0, 5.02)], m="dark_metal", n=8,
          rot=(0, 0, PI / 8), angle=20)
    for k in range(8):
        a = k * PI / 4
        nrm = Vector((math.cos(a), math.sin(a), 0))
        d = oct_r * math.cos(PI / 8)
        box(f"cupola_win{k}", (0.012, 0.32, 0.22), nrm * (d + 0.004) + Vector((0, 0, 4.67)), (0, 0, a), "window_light",
            bev=0.0)
    cyl("cupola_top_win", 0.26, 0.02, (0, 0, 5.025), m="window_light", n=8, rot=(0, 0, PI / 8))
    ring("cupola_cap_ring", 0.26, 0.05, 0.05, (0, 0, 5.03), (0, 0, PI / 8), "metal", n=8)
    for k, a in enumerate((PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4)):
        foot = Vector((1.25 * math.cos(a), 1.25 * math.sin(a), 0.1))
        strut(f"node_leg{k}", (0.8 * math.cos(a), 0.8 * math.sin(a), 1.1), foot + Vector((0, 0, 0.05)), 0.08, "metal")
        lathe(f"node_pad{k}", [(0.0, 0.0), (0.3, 0.0), (0.32, 0.04), (0.24, 0.1), (0.0, 0.12)],
              foot - Vector((0, 0, 0.1)), m="metal", n=14)
    # câmara de descompressão (airlock) para a frente (-Y no Blender = +Z no glTF)
    az = 2.45
    a_prof = [(0.0, 0.3), (0.95, 0.3), (0.95, 2.2), (1.04, 2.25), (1.04, 2.45), (0.98, 2.5), (0.0, 2.5)]
    lathe("airlock_shell", a_prof, (0, 0, az), (PI / 2, 0, 0), "hull", n=40, angle=30)
    for y in (-1.25, -1.85):
        ring(f"airlock_seam{y}", 0.94, 0.08, 0.05, (0, y, az), (PI / 2, 0, 0), "hull_panel", n=32)
    lathe("airlock_band", [(0.956, -0.95), (0.956, -0.65)], (0, 0, az), (PI / 2, 0, 0), "amber", n=40, cap=False)
    yf = -2.5
    fw, fh, ft = 1.06, 1.56, 0.12
    box("door_frame_top", (fw, ft, 0.14), (0, yf - 0.04, az + fh / 2 - 0.07), m="dark_metal", bev=0.03)
    box("door_frame_bot", (fw, ft, 0.14), (0, yf - 0.04, az - fh / 2 + 0.07), m="dark_metal", bev=0.03)
    for s in (-1, 1):
        box(f"door_frame_side{s}", (0.14, ft, fh), (s * (fw / 2 - 0.07), yf - 0.04, az), m="dark_metal", bev=0.03)
        box(f"door_hinge{s}", (0.08, 0.1, 0.22), (-fw / 2 - 0.02, yf - 0.06, az + s * 0.45), m="metal", bev=0.015)
    box("door_panel", (0.8, 0.06, 1.3), (0, yf - 0.02, az), m="hull_panel", bev=0.03)
    box("door_stripe", (0.8, 0.065, 0.08), (0, yf - 0.02, az - 0.4), m="amber", bev=0.0)
    round_window("door_window", (0, yf - 0.05, az + 0.3), (0, -1, 0), r=0.14)
    box("door_handle", (0.06, 0.08, 0.3), (0.28, yf - 0.09, az - 0.05), m="metal", bev=0.015)
    light_pod("door_lamp", (0, yf - 0.02, az + 0.9), (0, -1, 0.3), size=0.14)
    floor_z = az - fh / 2 + 0.02
    box("porch", (1.4, 0.8, 0.1), (0, yf - 0.45, floor_z - 0.05), m="metal", bev=0.02)
    steps = 6
    for k in range(steps):
        z = floor_z - 0.1 - (k + 1) * (floor_z - 0.1) / (steps + 0.3)
        y = yf - 0.95 - k * 0.3
        box(f"step{k}", (1.2, 0.3, 0.05), (0, y, z), m="dark_metal", bev=0.01)
    y_end = yf - 0.95 - (steps - 1) * 0.3 - 0.2
    for s in (-1, 1):
        x = s * 0.65
        beam(f"stair_stringer{s}", (x, yf - 0.85, floor_z - 0.12), (x, y_end, 0.02), 0.06, 0.16, "metal")
        tube(f"stair_rail{s}", [(x, yf - 0.1, floor_z + 0.95), (x, yf - 0.85, floor_z + 0.95),
                                (x, y_end, 0.95), (x, y_end, 0.02)], 0.025, "amber", fillet=0.12)
        strut(f"stair_post{s}", (x, yf - 0.85, floor_z - 0.1), (x, yf - 0.85, floor_z + 0.95), 0.022, "metal", n=8)
        strut(f"porch_leg{s}", (x, yf - 0.6, floor_z - 0.1), (x, yf - 0.6, 0.0), 0.04, "metal", n=10)
    round_window("node_window", (0.0, -node_r - 0.005, 3.75) , (0, -1, 0.0), r=0.13)
    for s in (-1, 1):
        light_pod(f"node_lamp{s}", (s * 0.85, -0.85, 4.0), (s * 0.6, -1, 0.5))
        tube(f"node_rail{s}", [(s * 0.55, -node_r - 0.12, 1.6), (s * 0.55, -node_r - 0.12, 3.3)], 0.022, "amber")
        for z in (1.7, 3.2):
            strut(f"node_rail_post{s}{z}", (s * 0.55, -node_r + 0.05, z), (s * 0.55, -node_r - 0.12, z), 0.015, "metal",
                  n=6)
        for k in range(2):
            c = Vector((s * 1.1, -1.35 - k * 0.3, az - 0.1))
            lathe(f"eva_bottle{s}{k}", capsule_prof(0.12, 0.8, 4), c, m="hull_panel" if k else "teal", n=16)
            ring(f"eva_strap{s}{k}", 0.12, 0.04, 0.015, c + Vector((0, 0, 0.15)), m="dark_metal", n=16)
    for cx in (HAB_X, -HAB_X):
        for dx in (-0.6, 0.6):
            phi = math.radians(20)
            n = Vector((0, math.cos(phi), math.sin(phi)))
            round_window(f"rwin{cx}{dx}", Vector((cx + dx, 0, zc)) + n * (R + 0.01), n, r=0.15)
        light_pod(f"rlamp{cx}", (cx, R * 0.75, zc - R * 0.66), (0, 1, -0.6))
    box("service_panel", (0.7, 0.08, 0.9), (0, node_r + 0.0, 2.3), m="hull_panel", bev=0.02)
    for k in range(3):
        cyl(f"service_port{k}", 0.06, 0.08, (-0.2 + k * 0.2, node_r + 0.05, 2.45), "Y", m="dark_metal", n=12)
    box("service_label", (0.5, 0.085, 0.06), (0, node_r + 0.0, 2.05), m="amber", bev=0.0)
    tube("umbilical", [(0.0, node_r + 0.08, 2.45), (0.0, node_r + 0.5, 2.2), (0.2, node_r + 1.2, 0.05),
                       (0.6, node_r + 2.4, 0.05)], 0.05, "graphite", fillet=0.4)
    for cx in (HAB_X, -HAB_X):
        for dx in (-1.0, 0.0, 1.0):
            phi = math.radians(22)
            n = Vector((0, -math.cos(phi), math.sin(phi)))
            p = Vector((cx + dx, 0, zc)) + n * (R + 0.01)
            round_window(f"win{cx}{dx}", p, n, r=0.15)
    phi = math.radians(-12)
    text("earthset_text", "EARTHSET", 0.4, (HAB_X, -(R * math.cos(phi) + 0.03), zc + R * math.sin(phi)),
         (PI / 2, 0, 0), "graphite")
    for side, x0 in (("l", HAB_X - 1.45), ("r", HAB_X + 1.45)):
        pts = []
        for k in range(8):
            a = math.radians(-45 + k * 10.0)
            pts.append((x0, -(R + 0.004) * math.cos(a), zc + (R + 0.004) * math.sin(a)))
        tube(f"modA_mark_{side}", pts, 0.035, "teal", fillet=0.0, res=1)
    finalize()
    export("habitat_v4.glb")

WHEEL_R = 0.3
WHEEL_W = 0.24
WHEEL_POS = [(0.9, 0.86), (0.0, 0.86), (-0.9, 0.86), (0.9, -0.86), (0.0, -0.86), (-0.9, -0.86)]

def rover_wheel(idx: int, x: float, y: float) -> None:
    g = f"wheel_{idx}"
    c = Vector((x, y, WHEEL_R))
    ry = (PI / 2, 0, 0)  # eixo da roda ao longo de Y do Blender
    w = WHEEL_W
    tire = [(0.2, -w / 2), (0.265, -w / 2), (0.295, -w / 2 + 0.03), (0.3, -w / 2 + 0.06), (0.3, w / 2 - 0.06),
            (0.295, w / 2 - 0.03), (0.265, w / 2), (0.2, w / 2)]
    lathe(f"{g}_tire", tire, c, ry, "rubber", g, n=28, closed=True, angle=40)
    for k in range(14):
        a = 2 * PI * k / 14
        p = c + Vector((math.cos(a) * 0.3, 0, math.sin(a) * 0.3))
        box(f"{g}_grouser{k}", (0.035, w * 0.92, 0.03), p, (0, -a + PI / 2, 0), "rubber", g, bev=0.0)
    rim = [(0.0, -w / 2 + 0.01), (0.09, -w / 2 + 0.01), (0.12, -w / 2 + 0.04), (0.2, -w / 2 + 0.04),
           (0.2, w / 2 - 0.04), (0.12, w / 2 - 0.04), (0.09, w / 2 - 0.01), (0.0, w / 2 - 0.01)]
    lathe(f"{g}_rim", rim, c, ry, "metal", g, n=24, angle=30)
    side = 1 if y > 0 else -1
    cyl(f"{g}_hub", 0.075, 0.08, c + Vector((0, side * (w / 2 + 0.0), 0)), "Y", m="amber", group=g, n=20, bev=0.01)
    for k in range(5):
        a = 2 * PI * k / 5
        p = c + Vector((math.cos(a) * 0.15, side * (w / 2 - 0.035), math.sin(a) * 0.15))
        box(f"{g}_spoke{k}", (0.06, 0.03, 0.15), p, (0, -a + PI / 2, 0), "dark_metal", g, bev=0.0)

def build_rover() -> None:
    clear_scene()
    for i, (x, y) in enumerate(WHEEL_POS):
        rover_wheel(i, x, y)
    for s in (1, -1):
        ya = s * 0.64
        piv = Vector((0.12, ya, 0.8))
        rear = Vector((-0.9, ya, 0.66))
        bog = Vector((0.5, ya, 0.6))
        bf = Vector((0.9, ya, 0.56))
        bm_ = Vector((0.0, ya, 0.56))
        beam(f"rocker_rear{s}", piv, rear, 0.07, 0.1, "dark_metal")
        beam(f"rocker_front{s}", piv, bog, 0.07, 0.1, "dark_metal")
        beam(f"bogie_f{s}", bog, bf, 0.06, 0.08, "dark_metal")
        beam(f"bogie_m{s}", bog, bm_, 0.06, 0.08, "dark_metal")
        cyl(f"rocker_pivot{s}", 0.09, 0.2, piv - Vector((0, s * 0.05, 0)), "Y", m="metal", n=20, bev=0.01)
        cyl(f"bogie_pivot{s}", 0.07, 0.14, bog, "Y", m="metal", n=16, bev=0.01)
        for top, wx, steer in ((rear, -0.9, True), (bf, 0.9, True), (bm_, 0.0, False)):
            hub = Vector((wx, ya, WHEEL_R))
            beam(f"fork{s}{wx}", top + Vector((0, 0, 0.04)), hub, 0.06, 0.09, "metal")
            cyl(f"axle{s}{wx}", 0.05, 0.16, (wx, s * 0.7, WHEEL_R), "Y", m="dark_metal", n=14)
            if steer:
                cyl(f"steer{s}{wx}", 0.075, 0.14, top + Vector((0, 0, 0.06)), m="graphite", n=16, bev=0.01)
                cyl(f"steer_cap{s}{wx}", 0.05, 0.03, top + Vector((0, 0, 0.145)), m="amber", n=16)
    prof = [(-1.05, 0.62), (0.92, 0.62), (1.12, 0.78), (1.12, 0.94), (0.92, 1.1), (-1.05, 1.1)]
    prism("chassis_body", prof, 1.02, m="chassis", bev=0.035, seg=3)
    box("belly", (1.9, 0.86, 0.1), (-0.05, 0, 0.6), m="dark_metal", bev=0.02)
    for s in (1, -1):
        box(f"side_panel{s}", (1.5, 0.02, 0.22), (-0.15, s * 0.515, 0.82), m="hull_panel", bev=0.01)
        box(f"side_stripe{s}", (1.5, 0.025, 0.05), (-0.15, s * 0.52, 0.98), m="amber", bev=0.0)
        for k in range(3):
            box(f"side_vent{s}{k}", (0.24, 0.025, 0.04), (0.5, s * 0.52, 0.76 + k * 0.06), m="graphite", bev=0.0)
        light_pod(f"head_lamp{s}", (1.13, s * 0.34, 0.86), (1, 0, 0), size=0.1)
    box("front_bumper", (0.1, 0.9, 0.08), (1.14, 0, 0.68), m="dark_metal", bev=0.02)
    for s in (1, -1):
        box(f"skirt{s}", (1.95, 0.025, 0.12), (-0.07, s * 0.515, 0.68), m="graphite", bev=0.008)
        for k in range(6):
            cyl(f"skirt_bolt{s}{k}", 0.015, 0.02, (-0.9 + k * 0.33, s * 0.53, 0.68), "Y", m="metal", n=8)
    rc = Vector((-1.2, 0.0, 0.9))
    rq = Euler((0, -0.6, 0))
    cyl("power_pod", 0.13, 0.42, rc, rot=rq, m="dark_metal", n=16, bev=0.015)
    for k in range(6):
        a = k * PI / 3
        d = rq.to_matrix() @ Vector((math.cos(a) * 0.17, math.sin(a) * 0.17, 0))
        box(f"pod_fin{k}", (0.1, 0.012, 0.38), rc + d, rq.to_quaternion() @ Quaternion((0, 0, 1), a), "radiator",
            bev=0.0)
    strut("pod_mount", (-1.05, 0, 0.82), rc, 0.05, "metal", n=10)
    cyl("pod_cap", 0.1, 0.04, rc + rq.to_matrix() @ Vector((0, 0, 0.23)), rot=rq, m="amber", n=14)
    box("deck", (1.95, 0.94, 0.03), (-0.08, 0, 1.11), m="hull_panel", bev=0.01)
    box("solar_frame", (0.95, 0.88, 0.04), (0.08, 0, 1.17), m="metal", bev=0.012)
    for i in range(4):
        for j in range(4):
            box(f"rcell{i}{j}", (0.21, 0.2, 0.012), (0.08 - 0.345 + i * 0.23, -0.315 + j * 0.21, 1.195),
                m="rover_cell", bev=0.0)
    for s in (1, -1):
        strut(f"solar_leg{s}", (0.08, s * 0.3, 1.12), (0.08, s * 0.3, 1.16), 0.03, "metal", n=8)
    bx0, bx1, bz = -1.02, -0.42, 1.12
    box("bin_floor", (0.6, 0.86, 0.04), ((bx0 + bx1) / 2, 0, bz + 0.02), m="dark_metal", bev=0.01)
    for s in (1, -1):
        box(f"bin_side{s}", (0.6, 0.04, 0.3), ((bx0 + bx1) / 2, s * 0.43, bz + 0.15), m="hull_panel", bev=0.012)
    box("bin_back", (0.04, 0.86, 0.3), (bx0, 0, bz + 0.15), m="hull_panel", bev=0.012)
    box("bin_front", (0.04, 0.86, 0.34), (bx1, 0, bz + 0.17), m="hull_panel", bev=0.012)
    for s in (1, -1):
        box(f"bin_rail{s}", (0.6, 0.06, 0.04), ((bx0 + bx1) / 2, s * 0.44, bz + 0.31), m="dark_metal", bev=0.01)
        box(f"bin_tag{s}", (0.2, 0.012, 0.08), ((bx0 + bx1) / 2, s * 0.452, bz + 0.17), m="amber", bev=0.0)
    box("sensor_bar", (0.03, 0.6, 0.07), (1.125, 0, 0.98), (0, 0.9, 0), "lens", bev=0.0)
    for s in (1, -1):
        cyl(f"hazcam{s}", 0.025, 0.04, (1.13, s * 0.18, 0.72), "X", m="lens", n=12)
    box("deck_trim_l", (1.95, 0.04, 0.04), (-0.08, 0.49, 1.11), m="dark_metal", bev=0.01)
    box("deck_trim_r", (1.95, 0.04, 0.04), (-0.08, -0.49, 1.11), m="dark_metal", bev=0.01)
    for k, (dx, dy, r) in enumerate(((-0.75, 0.15, 0.12), (-0.62, -0.2, 0.1), (-0.85, -0.12, 0.09), (-0.6, 0.22, 0.08))):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        bmesh.ops.transform(bm, matrix=mtx((dx, dy, bz + 0.1 + r * 0.4), (k, k * 0.7, 0), (1.2, 1, 0.8)), verts=bm.verts)
        finish(f"ice{k}", bm, "ice", angle=20)
    mx, my = 0.72, 0.3
    box("mast_base", (0.16, 0.16, 0.08), (mx, my, 1.15), m="dark_metal", bev=0.015)
    cyl("mast", 0.035, 0.8, (mx, my, 1.55), m="metal", n=14)
    ring("mast_collar", 0.035, 0.05, 0.02, (mx, my, 1.4), m="amber", n=14)
    cyl("mast_pan", 0.06, 0.08, (mx, my, 1.98), m="graphite", n=16, bev=0.01)
    box("cam_head", (0.16, 0.38, 0.13), (mx + 0.02, my, 2.09), m="hull", bev=0.025, seg=3)
    for s in (1, -1):
        cyl(f"cam_lens{s}", 0.04, 0.05, (mx + 0.11, my + s * 0.11, 2.09), "X", m="dark_metal", n=16, bev=0.006)
        cyl(f"cam_glass{s}", 0.03, 0.02, (mx + 0.135, my + s * 0.11, 2.09), "X", m="lens", n=16)
    cyl("cam_center", 0.025, 0.04, (mx + 0.11, my, 2.09), "X", m="lens", n=12)
    cyl("ant_base", 0.04, 0.06, (-0.95, -0.38, 1.36), m="dark_metal", n=12)
    cyl("ant_rod", 0.012, 0.75, (-0.95, -0.38, 1.75), m="metal", n=8)
    sphere("ant_tip", 0.03, (-0.95, -0.38, 2.13), m="amber", u=12, v=6)
    lathe("ant_dish", [(0.0, 0.0), (0.12, 0.04), (0.13, 0.05), (0.12, 0.055), (0.0, 0.015)],
          (-0.82, 0.32, 1.45), (0, -PI / 3, 0), "hull", n=20)
    strut("ant_dish_post", (-0.82, 0.32, 1.13), (-0.82, 0.32, 1.44), 0.02, "metal", n=8)
    cyl("beacon_post", 0.025, 0.12, (0.62, -0.32, 1.18), m="dark_metal", n=12)
    sphere("beacon", 0.06, (0.62, -0.32, 1.28), m="beacon", group="beacon", u=16, v=8)
    pv = Vector((1.12, 0.0, 0.8))
    cyl("drill_shoulder", 0.08, 0.26, pv, "Y", m="dark_metal", group="drill", n=20, bev=0.01)
    elbow = pv + Vector((0.42, 0, 0.12))
    beam("drill_upper", pv, elbow, 0.1, 0.09, "hull", "drill")
    cyl("drill_elbow", 0.065, 0.16, elbow, "Y", m="dark_metal", group="drill", n=18, bev=0.01)
    cyl("drill_housing", 0.08, 0.34, elbow + Vector((0.06, 0, -0.08)), m="amber", group="drill", n=20, bev=0.015)
    ring("drill_housing_ring", 0.08, 0.04, 0.015, elbow + Vector((0.06, 0, -0.2)), m="dark_metal", group="drill", n=20)
    cyl("drill_bit", 0.03, 0.3, elbow + Vector((0.06, 0, -0.4)), m="metal", group="drill", n=12)
    cyl("drill_tip", 0.03, 0.08, elbow + Vector((0.06, 0, -0.59)), m="metal", group="drill", n=12, r2=0.0)
    for k in range(3):
        ring(f"drill_flute{k}", 0.028, 0.012, 0.012, elbow + Vector((0.06, 0, -0.3 - k * 0.07)), m="metal",
             group="drill", n=10)
    box("drill_scoop", (0.12, 0.16, 0.06), elbow + Vector((-0.08, 0, -0.17)), (0, 0.4, 0), "dark_metal", "drill",
        bev=0.012)
    box("drill_mount_plate", (0.06, 0.32, 0.22), (1.12, 0, 0.8), m="dark_metal", bev=0.015)
    piv = []
    for i, (x, y) in enumerate(WHEEL_POS):
        piv.append((f"wheel_{i}", Matrix.Translation((x, y, WHEEL_R)), None))
    piv.append(("beacon", Matrix.Translation((0.62, -0.32, 1.28)), None))
    mount = Matrix.LocRotScale(pv, Euler((0, 0, -PI / 2)), None)
    piv.append(("drill_mount", mount, None))
    piv.append(("drill", mount.copy(), "drill_mount"))
    finalize(piv)
    export("rover_v4.glb")

def build_lander() -> None:
    clear_scene()
    z0, z1 = 1.55, 2.75
    r_oct = 1.45
    oct_pts = [(r_oct * math.cos(PI / 8 + k * PI / 4), r_oct * math.sin(PI / 8 + k * PI / 4)) for k in range(8)]
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in oct_pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in oct_pts]
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish("descent_core", bm, "foil_gold", bev=0.04, seg=2)
    for k in range(8):
        a = PI / 8 + k * PI / 4 + PI / 8
        nrm = Vector((math.cos(a), math.sin(a), 0))
        d = r_oct * math.cos(PI / 8)
        if k % 2 == 0:
            box(f"silver_panel{k}", (0.03, 0.85, 0.8), nrm * (d + 0.01) + Vector((0, 0, 2.15)), (0, 0, a), "foil_silver",
                bev=0.01)
    lathe("deck_lo", [(0.0, z0 - 0.06), (1.5, z0 - 0.06), (1.5, z0), (0.0, z0)], m="dark_metal", n=8, rot=(0, 0, PI / 8))
    lathe("deck_hi", [(0.0, z1), (1.52, z1), (1.52, z1 + 0.08), (0.0, z1 + 0.08)], m="hull_panel", n=8,
          rot=(0, 0, PI / 8))
    for k in range(4):
        a = k * PI / 2
        c = Vector((1.05 * math.cos(a), 1.05 * math.sin(a), 2.12))
        sphere(f"tank{k}", 0.55, c, m="hull" if k % 2 else "foil_silver", u=20, v=10)
        ring(f"tank_belt{k}", 0.55, 0.06, 0.03, c, m="dark_metal", n=28)
    bell = [(0.22, 1.5), (0.18, 1.35), (0.24, 1.15), (0.38, 0.95), (0.52, 0.78), (0.62, 0.62),
            (0.6, 0.62), (0.5, 0.78), (0.36, 0.95), (0.22, 1.15), (0.15, 1.35), (0.18, 1.5)]
    lathe("engine_bell", bell, m="dark_metal", n=40, closed=True, angle=40)
    lathe("engine_bell_lip", [(0.6, 0.6), (0.64, 0.6), (0.64, 0.66), (0.6, 0.66)], m="metal", n=40, closed=True)
    cyl("engine_mount", 0.32, 0.12, (0, 0, 1.52), m="metal", n=24, bev=0.02)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        strut(f"thrust_strut{k}", (0.85 * math.cos(a), 0.85 * math.sin(a), z0 - 0.05),
              (0.25 * math.cos(a), 0.25 * math.sin(a), 1.45), 0.035, "metal", n=10)
    cyl("engine_glow", 0.52, 0.02, (0, 0, 0.66), m="engine_glow", group="engine_glow", n=32)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        u = Vector((math.cos(a), math.sin(a), 0))
        t = Vector((-math.sin(a), math.cos(a), 0))
        hip = u * 1.35 + Vector((0, 0, 2.55))
        foot = u * 2.75 + Vector((0, 0, 0.22))
        strut(f"leg_upper{k}", hip, hip.lerp(foot, 0.55), 0.09, "foil_silver", n=16)
        strut(f"leg_lower{k}", hip.lerp(foot, 0.5), foot, 0.06, "metal", n=14)
        ring(f"leg_collar{k}", 0.09, 0.08, 0.025, hip.lerp(foot, 0.55), z_to(foot - hip), "amber", n=16)
        for s in (-1, 1):
            strut(f"leg_brace{k}{s}", u * 1.25 + t * s * 0.55 + Vector((0, 0, z0 + 0.05)), hip.lerp(foot, 0.62), 0.035,
                  "metal", n=10)
        lathe(f"footpad{k}", [(0.0, 0.0), (0.42, 0.0), (0.46, 0.05), (0.4, 0.12), (0.08, 0.2), (0.0, 0.2)],
              foot - Vector((0, 0, 0.22)), m="metal", n=24)
        cyl(f"foot_joint{k}", 0.08, 0.1, foot, m="dark_metal", n=14)
    cab = [(0.0, 2.83), (1.05, 2.83), (1.15, 2.95), (1.15, 3.9), (1.05, 4.35), (0.75, 4.75), (0.5, 4.85), (0.0, 4.85)]
    lathe("cabin", cab, m="hull", n=40, angle=30)
    ring("cabin_seam", 1.14, 0.1, 0.04, (0, 0, 3.45), m="hull_panel", n=40)
    lathe("cabin_band", [(1.156, 3.7), (1.156, 3.85)], m="amber", n=40, cap=False)
    for k, a in enumerate((-PI / 2 + 1.0, PI / 2 + 0.6, PI + 0.3)):
        n = Vector((math.cos(a), math.sin(a), 0.25))
        p = Vector((1.13 * math.cos(a), 1.13 * math.sin(a), 4.12))
        round_window(f"cab_win{k}", p, n, r=0.16)
    box("hatch", (0.7, 0.1, 0.9), (0, -1.16, 3.35), m="hull_panel", bev=0.03)
    box("hatch_frame", (0.86, 0.06, 1.04), (0, -1.13, 3.35), m="dark_metal", bev=0.03)
    cyl("docking", 0.42, 0.25, (0, 0, 4.95), m="metal", n=32, bev=0.02)
    ring("docking_ring", 0.42, 0.08, 0.06, (0, 0, 5.08), m="dark_metal", n=32)
    strut("mast", (0.55, 0.35, 4.6), (0.55, 0.35, 5.7), 0.03, "metal", n=10)
    lathe("hga", [(0.0, 0.0), (0.3, 0.09), (0.32, 0.11), (0.3, 0.12), (0.0, 0.04)], (0.55, 0.35, 5.72), (0.5, 0, 0.6),
          "hull", n=24)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        p = Vector((1.18 * math.cos(a), 1.18 * math.sin(a), 3.0))
        box(f"rcs_block{k}", (0.18, 0.18, 0.18), p, (0, 0, a), "dark_metal", bev=0.02)
        for d in (Vector((math.cos(a), math.sin(a), 0)), Vector((0, 0, 1)), Vector((0, 0, -1))):
            cyl(f"rcs_noz{k}{d.z}", 0.03, 0.08, p + d * 0.12, rot=z_to(d), m="metal", n=10, r2=0.045)
    lx = 0.0
    top_z, bot_z = 2.7, 0.35
    y_top, y_bot = -1.5, -2.25
    for s in (-1, 1):
        strut(f"ladder_rail{s}", (lx + s * 0.25, y_top, top_z), (lx + s * 0.25, y_bot, bot_z), 0.025, "metal", n=8)
    for k in range(8):
        t = (k + 0.5) / 8
        y = y_top + (y_bot - y_top) * t
        z = top_z + (bot_z - top_z) * t
        strut(f"ladder_rung{k}", (lx - 0.25, y, z), (lx + 0.25, y, z), 0.018, "amber", n=8)
    box("porch", (0.9, 0.5, 0.06), (0, -1.6, 2.78), m="metal", bev=0.015)
    for s in (-1, 1):
        strut(f"porch_brace{s}", (s * 0.4, -1.8, 2.76), (s * 0.4, -1.3, 2.2), 0.025, "metal", n=8)
        tube(f"porch_rail{s}", [(s * 0.45, -1.3, 2.8), (s * 0.45, -1.3, 3.5), (s * 0.45, -1.8, 3.5), (s * 0.45, -1.8, 2.8)],
             0.02, "amber", fillet=0.08)
    piv = [("engine_glow", Matrix.Translation((0, 0, 0.66)), None)]
    finalize(piv)
    export("lander_v4.glb")

def build_landing_pad() -> None:
    clear_scene()
    R = 6.0
    lathe("pad", [(0.0, 0.0), (R, 0.0), (R, 0.06), (R - 0.15, 0.12), (0.0, 0.12)], m="pad_surface", n=64, angle=30)
    lathe("pad_rim", [(R - 0.45, 0.12), (R - 0.15, 0.12), (R - 0.15, 0.16), (R - 0.45, 0.16)], m="dark_metal", n=64,
          closed=True)
    for r0, r1, m in ((4.3, 4.55, "pad_paint"), (2.0, 2.15, "amber"), (0.0, 0.45, "pad_paint")):
        prof = [(r0, 0.125), (r1, 0.125), (r1, 0.13), (r0, 0.13)] if r0 > 0 else [(0.0, 0.125), (r1, 0.125),
                                                                                    (r1, 0.13), (0.0, 0.13)]
        lathe(f"paint{r0}", prof, m=m, n=64, closed=r0 > 0)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        for j, r in enumerate((3.0, 3.6)):
            pts = [(r, -0.0), (r + 0.35, -0.55), (r + 0.6, -0.55), (r + 0.25, 0.0), (r + 0.6, 0.55), (r + 0.35, 0.55)]
            bm = bmesh.new()
            vs = [bm.verts.new((x, y, 0.126)) for x, y in pts]
            vt = [bm.verts.new((x, y, 0.132)) for x, y in pts]
            bm.faces.new(vt)
            bm.faces.new(list(reversed(vs)))
            for i in range(6):
                jj = (i + 1) % 6
                bm.faces.new((vs[i], vs[jj], vt[jj], vt[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, "Z"), verts=bm.verts)
            finish(f"chev{k}{j}", bm, "amber" if j == 0 else "pad_paint", angle=30, wn=False)
    for k in range(12):
        a = k * PI / 6
        box(f"tick{k}", (0.6, 0.08, 0.006), (5.1 * math.cos(a), 5.1 * math.sin(a), 0.128), (0, 0, a), "pad_paint",
            bev=0.0)
    for k in range(16):
        a = 2 * PI * k / 16 + PI / 16
        p = Vector(((R - 0.3) * math.cos(a), (R - 0.3) * math.sin(a), 0.16))
        cyl(f"light_base{k}", 0.09, 0.05, p + Vector((0, 0, 0.02)), m="dark_metal", n=14, bev=0.01)
        lathe(f"light_dome{k}", [(0.0, 0.0), (0.065, 0.0), (0.06, 0.04), (0.035, 0.07), (0.0, 0.08)],
              p + Vector((0, 0, 0.04)), m="pad_light", n=14)
    finalize()
    export("landing_pad_v4.glb")

def skid(name, L, W, z=0.12, m="dark_metal"):
    for s in (-1, 1):
        box(f"{name}_rail{s}", (L, 0.14, 0.16), (0, s * (W / 2 - 0.07), z), m=m, bev=0.02)
    for k in range(int(L / 0.8) + 1):
        x = -L / 2 + 0.1 + k * (L - 0.2) / int(L / 0.8)
        box(f"{name}_cross{k}", (0.1, W - 0.1, 0.1), (x, 0, z), m=m, bev=0.015)
    for x in (-L / 2 + 0.2, L / 2 - 0.2):
        for s in (-1, 1):
            cyl(f"{name}_foot{x}{s}", 0.12, 0.05, (x, s * (W / 2 - 0.07), 0.025), m="metal", n=14, bev=0.01)
    box(f"{name}_deck", (L - 0.1, W - 0.12, 0.03), (0, 0, z + 0.065), m="metal", bev=0.005)

def build_ice_processor() -> None:
    clear_scene()
    skid("skid", 4.0, 1.6)
    dz = 0.22
    hx = -1.45
    lathe("hopper", [(0.18, dz + 1.05), (0.75, dz + 1.75), (0.78, dz + 1.78), (0.7, dz + 1.78), (0.14, dz + 1.08)],
          (hx, 0, 0), (0, 0, PI / 4), "hull_panel", n=4, closed=True, angle=20)
    lathe("hopper_lip", [(0.78, dz + 1.76), (0.84, dz + 1.76), (0.84, dz + 1.84), (0.78, dz + 1.84)], (hx, 0, 0),
          (0, 0, PI / 4), "amber", n=4, closed=True, angle=20)
    cyl("hopper_neck", 0.2, 0.5, (hx, 0, dz + 0.85), m="metal", n=20, bev=0.01)
    for sx in (-1, 1):
        for sy in (-1, 1):
            strut(f"hopper_leg{sx}{sy}", (hx + sx * 0.5, sy * 0.5, dz), (hx + sx * 0.42, sy * 0.42, dz + 1.5), 0.04,
                  "dark_metal", n=10)
    strut("auger", (hx, 0, dz + 0.6), (-0.6, 0, dz + 0.75), 0.13, "metal", n=18)
    for k in range(4):
        x = hx + 0.2 + k * 0.2
        ring(f"auger_ring{k}", 0.13, 0.04, 0.025, (x, 0, dz + 0.6 + (x - hx) * 0.1), (0, PI / 2, 0), "dark_metal", n=18)
    ox = -0.05
    oven = [(0.0, -0.75), (0.42, -0.75), (0.5, -0.7), (0.52, -0.6), (0.52, 0.6), (0.5, 0.7), (0.42, 0.75), (0.0, 0.75)]
    lathe("oven", oven, (ox, 0, dz + 0.72), (0, PI / 2, 0), "hull", n=32, angle=30)
    for k in range(4):
        ring(f"oven_heat{k}", 0.52, 0.09, 0.03, (ox - 0.45 + k * 0.3, 0, dz + 0.72), (0, PI / 2, 0), "amber", n=32)
    for s in (-1, 1):
        box(f"oven_saddle{s}", (0.18, 0.9, 0.3), (ox + s * 0.5, 0, dz + 0.17), m="dark_metal", bev=0.02)
    light_pod("oven_lamp", (ox, -0.5, dz + 0.95), (0, -1, 0.5), size=0.08)
    cx_ = 0.95
    cyl("condenser_core", 0.2, 1.5, (cx_, 0.25, dz + 0.85), m="metal", n=20)
    for k in range(10):
        cyl(f"cond_fin{k}", 0.36, 0.025, (cx_, 0.25, dz + 0.3 + k * 0.12), m="radiator", n=24, bev=0.0)
    cyl("cond_cap", 0.22, 0.1, (cx_, 0.25, dz + 1.62), m="dark_metal", n=20, bev=0.015)
    tx = 1.45
    tank = [(0.0, -0.45), (0.3, -0.45)]
    for k in range(1, 6):
        t = k / 5 * PI / 2
        tank.append((0.3 + 0.12 * math.sin(t), -0.45 + 0.12 * (1 - math.cos(t))))
    tank += [(0.42, 0.33)]
    for k in range(1, 6):
        t = k / 5 * PI / 2
        tank.append((0.3 + 0.12 * math.cos(t), 0.33 + 0.12 * math.sin(t)))
    tank.append((0.0, 0.45))
    lathe("water_tank", tank, (tx, -0.3, dz + 0.62), (0, 0, 0), "hull", n=32, angle=30)
    lathe("water_band", [(0.426, 0.0), (0.426, 0.16)], (tx, -0.3, dz + 0.6), m="water_blue", n=32, cap=False)
    lathe("water_band2", [(0.426, 0.0), (0.426, 0.04)], (tx, -0.3, dz + 0.82), m="water_blue", n=32, cap=False)
    cyl("water_valve", 0.06, 0.12, (tx, -0.3, dz + 1.13), m="water_blue", n=14, bev=0.01)
    tube("pipe_oven_cond", [(ox + 0.6, 0.15, dz + 0.9), (cx_ - 0.35, 0.15, dz + 0.9), (cx_ - 0.35, 0.25, dz + 1.45),
                            (cx_ - 0.18, 0.25, dz + 1.45)], 0.05, "metal", fillet=0.12)
    tube("pipe_cond_tank", [(cx_, 0.25, dz + 0.18), (cx_ + 0.3, 0.25, dz + 0.18), (tx, -0.05, dz + 0.18),
                            (tx, -0.05, dz + 0.4)], 0.04, "water_blue", fillet=0.12)
    tube("pipe_vent", [(ox - 0.3, 0.0, dz + 1.2), (ox - 0.3, 0.0, dz + 1.55), (ox + 0.2, 0.0, dz + 1.55)], 0.035,
         "dark_metal", fillet=0.1)
    px, py = 0.35, -0.62
    box("ctrl_post", (0.12, 0.12, 0.7), (px, py, dz + 0.35), m="dark_metal", bev=0.015)
    box("ctrl_box", (0.5, 0.14, 0.36), (px, py - 0.02, dz + 0.85), (0.25, 0, 0), "hull", bev=0.025)
    box("ctrl_screen", (0.36, 0.02, 0.22), (px, py - 0.1, dz + 0.865), (0.25, 0, 0), "screen", bev=0.0)
    for k in range(3):
        cyl(f"ctrl_btn{k}", 0.018, 0.02, (px - 0.12 + k * 0.12, py - 0.075, dz + 0.69), "Y", m="amber", n=10)
    finalize()
    export("ice_processor_v4.glb")

def capsule_prof(r, h, k=6):
    """Perfil de cápsula vertical (raio r, altura total h), centrado em 0."""
    half = h / 2 - r * 0.6
    prof = [(0.0, -h / 2)]
    for i in range(1, k + 1):
        t = i / k * PI / 2
        prof.append((r * math.sin(t), -half - r * 0.6 * math.cos(t)))
    for i in range(0, k + 1):
        t = i / k * PI / 2
        prof.append((r * math.cos(t), half + r * 0.6 * math.sin(t)))
    prof[-1] = (0.0, h / 2)
    return prof

def build_tanks() -> None:
    clear_scene()
    skid("skid", 3.4, 1.5)
    specs = [(-1.05, "water_blue", 0.52, 2.0), (0.0, "water_blue", 0.52, 2.0), (1.05, "teal", 0.48, 2.3)]
    gauge_piv = []
    for i, (x, stripe, r, h) in enumerate(specs):
        zc = 0.3 + h / 2
        lathe(f"tank{i}", capsule_prof(r, h), (x, 0, zc), m="hull", n=32, angle=30)
        lathe(f"tank{i}_stripe", [(r + 0.006, -0.1), (r + 0.006, 0.1)], (x, 0, zc + 0.15), m=stripe, n=32, cap=False)
        lathe(f"tank{i}_stripe2", [(r + 0.006, -0.03), (r + 0.006, 0.03)], (x, 0, zc - 0.05), m=stripe, n=32,
              cap=False)
        for dz in (-h / 2 + 0.45, h / 2 - 0.45):
            ring(f"tank{i}_band{dz}", r, 0.06, 0.03, (x, 0, zc + dz), m="dark_metal", n=32)
        lathe(f"tank{i}_skirt", [(r * 0.75, 0.21), (r * 0.8, 0.21), (r * 0.8, 0.45), (r * 0.75, 0.45)], (x, 0, 0),
              m="dark_metal", n=24, closed=True)
        cyl(f"tank{i}_valve", 0.07, 0.14, (x, 0, zc + h / 2 + 0.05), m="metal", n=14, bev=0.01)
        cyl(f"tank{i}_handwheel", 0.1, 0.025, (x, 0, zc + h / 2 + 0.13), m=stripe, n=16, bev=0.0)
        tube(f"tank{i}_riser", [(x, 0, zc + h / 2 + 0.05), (x, 0.35, zc + h / 2 + 0.05), (x, 0.55, 2.0),
                                (x, 0.55, 0.7)], 0.035, "metal", fillet=0.12)
        # medidor de nível: moldura escura (fenda) e barra emissiva com origem na base da fenda
        fy = -r - 0.035
        box(f"gauge_frame_{i}_body", (0.2, 0.08, 1.3), (x, fy + 0.0, zc), m="dark_metal", group=f"gauge_frame_{i}", bev=0.012)
        box(f"gauge_frame_{i}_slit", (0.12, 0.012, 1.2), (x, fy - 0.045, zc), m="lens", group=f"gauge_frame_{i}", bev=0.0)
        box(f"gauge_fill_{i}_bar", (0.07, 0.02, 1.2), (x, fy - 0.062, zc), m="gauge_air" if i == 2 else "gauge_water",
            group=f"gauge_fill_{i}", bev=0.0)
        gauge_piv.append((f"gauge_fill_{i}", Matrix.Translation((x, fy - 0.062, zc - 0.6)), None))
    tube("manifold", [(-1.4, 0.55, 0.7), (1.4, 0.55, 0.7)], 0.05, "metal")
    for x in (-1.4, 1.4):
        cyl(f"manifold_cap{x}", 0.07, 0.1, (x, 0.55, 0.7), "X", m="dark_metal", n=14, bev=0.01)
    for x in (-0.5, 0.5):
        box(f"manifold_valve{x}", (0.14, 0.14, 0.14), (x, 0.55, 0.7), m="amber", bev=0.02)
    for x in (-1.6, 1.6):
        strut(f"frame_post{x}a", (x, -0.68, 0.2), (x, -0.68, 1.7), 0.035, "dark_metal", n=10)
        strut(f"frame_post{x}b", (x, 0.68, 0.2), (x, 0.68, 1.7), 0.035, "dark_metal", n=10)
        strut(f"frame_top{x}", (x, -0.68, 1.7), (x, 0.68, 1.7), 0.03, "dark_metal", n=10)
    strut("frame_long_a", (-1.6, -0.68, 1.7), (1.6, -0.68, 1.7), 0.03, "dark_metal", n=10)
    strut("frame_long_b", (-1.6, 0.68, 1.7), (1.6, 0.68, 1.7), 0.03, "dark_metal", n=10)
    finalize(gauge_piv)
    export("tanks_v4.glb")

def build_power_unit() -> None:
    clear_scene()
    skid("skid", 2.2, 1.3)
    zb = 0.22
    box("body", (1.7, 1.0, 1.15), (0, 0, zb + 0.6), m="hull", bev=0.05, seg=3)
    box("plinth", (1.8, 1.1, 0.08), (0, 0, zb + 0.04), m="dark_metal", bev=0.02)
    box("roof", (1.6, 0.9, 0.08), (0, 0, zb + 1.21), m="hull_panel", bev=0.025)
    for k in range(4):
        box(f"vent{k}", (0.3, 0.6, 0.04), (-0.55 + k * 0.37, 0, zb + 1.27), m="graphite", bev=0.01)
    for s in (-1, 1):
        for k in range(9):
            box(f"fin{s}{k}", (0.22, 0.02, 0.95), (s * 0.95, -0.4 + k * 0.1, zb + 0.6), m="radiator", bev=0.0)
        box(f"fin_bar{s}", (0.26, 0.92, 0.05), (s * 0.95, 0, zb + 1.1), m="metal", bev=0.01)
        box(f"fin_bar_lo{s}", (0.26, 0.92, 0.05), (s * 0.95, 0, zb + 0.12), m="metal", bev=0.01)
    for k in range(3):
        x = -0.52 + k * 0.52
        box(f"bay{k}", (0.46, 0.03, 0.62), (x, -0.505, zb + 0.55), m="hull_panel", bev=0.012)
        box(f"bay_handle{k}", (0.2, 0.04, 0.03), (x, -0.53, zb + 0.78), m="dark_metal", bev=0.008)
        box(f"bay_label{k}", (0.3, 0.032, 0.06), (x, -0.515, zb + 0.35), m="amber", bev=0.0)
    box("status_strip_bezel", (1.4, 0.03, 0.08), (0, -0.505, zb + 1.0), m="graphite", bev=0.01)
    box("status_light", (1.32, 0.03, 0.04), (0, -0.52, zb + 1.0), m="status_light", bev=0.0)
    for k, x in enumerate((-0.4, 0.4)):
        cyl(f"socket{k}", 0.08, 0.1, (x, 0.53, zb + 0.4), "Y", m="dark_metal", n=16, bev=0.01)
        tube(f"cable{k}", [(x, 0.56, zb + 0.4), (x, 0.8, zb + 0.4), (x * 1.3, 0.95, 0.05), (x * 1.6, 1.4, 0.04)],
             0.035, "graphite", fillet=0.2)
    cyl("mast", 0.025, 0.5, (0.65, 0.3, zb + 1.5), m="metal", n=8)
    sphere("mast_tip", 0.04, (0.65, 0.3, zb + 1.77), m="status_light", u=12, v=6)
    finalize()
    export("power_unit_v4.glb")

def build_light_tower() -> None:
    clear_scene()
    cyl("base", 0.3, 0.2, (0, 0, 0.2), m="hull_panel", n=24, bev=0.03)
    for k in range(3):
        a = k * 2 * PI / 3
        u = Vector((math.cos(a), math.sin(a), 0))
        foot = u * 1.0 + Vector((0, 0, 0.06))
        beam(f"outrigger{k}", Vector((0, 0, 0.18)) + u * 0.2, foot + Vector((0, 0, 0.04)), 0.09, 0.08, "dark_metal")
        cyl(f"foot{k}", 0.13, 0.06, foot - Vector((0, 0, 0.03)), m="metal", n=16, bev=0.01)
    cyl("mast_lo", 0.09, 1.9, (0, 0, 1.25), m="hull", n=18, bev=0.01)
    ring("mast_clamp", 0.09, 0.1, 0.03, (0, 0, 2.2), m="amber", n=18)
    cyl("mast_hi", 0.065, 1.7, (0, 0, 3.05), m="metal", n=16)
    ring("mast_band", 0.09, 0.06, 0.012, (0, 0, 1.0), m="amber", n=18)
    box("battery", (0.32, 0.24, 0.4), (0, 0.18, 0.55), m="hull_panel", bev=0.03)
    head_c = Vector((0, -0.15, 3.95))
    tilt = (math.radians(-30), 0, 0)
    box("head_yoke", (0.7, 0.08, 0.14), (0, 0, 3.92), m="dark_metal", bev=0.02)
    box("head", (0.8, 0.22, 0.42), head_c, tilt, "hull", bev=0.035, seg=3)
    R = Euler(tilt).to_matrix()
    for i in range(2):
        for j in range(2):
            off = R @ Vector((-0.19 + i * 0.38, -0.115, -0.09 + j * 0.18))
            box(f"lamp{i}{j}", (0.32, 0.02, 0.14), head_c + off, tilt, "lamp", bev=0.0)
    for k in range(5):
        off = R @ Vector((-0.3 + k * 0.15, 0.13, 0))
        box(f"head_fin{k}", (0.03, 0.06, 0.36), head_c + off, tilt, "dark_metal", bev=0.0)
    tube("cable", [(0.08, 0.06, 0.6), (0.1, 0.06, 1.0), (0.1, 0.06, 3.7)], 0.015, "graphite")
    finalize()
    export("light_tower_v4.glb")

def crate_parts(prefix: str, group: str) -> None:
    s = (1.0, 0.8, 0.75)
    h = s[2]
    box(f"{prefix}_body", (s[0] - 0.04, s[1] - 0.04, h - 0.04), (0, 0, h / 2), m="hull", group=group, bev=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"{prefix}_corner{sx}{sy}", (0.08, 0.08, h), (sx * (s[0] / 2 - 0.04), sy * (s[1] / 2 - 0.04), h / 2),
                m="dark_metal", group=group, bev=0.012)
    for z in (0.03, h - 0.03):
        box(f"{prefix}_rimx{z}", (s[0], 0.06, 0.06), (0, s[1] / 2 - 0.03, z), m="dark_metal", group=group, bev=0.01)
        box(f"{prefix}_rimx2{z}", (s[0], 0.06, 0.06), (0, -s[1] / 2 + 0.03, z), m="dark_metal", group=group, bev=0.01)
        box(f"{prefix}_rimy{z}", (0.06, s[1], 0.06), (s[0] / 2 - 0.03, 0, z), m="dark_metal", group=group, bev=0.01)
        box(f"{prefix}_rimy2{z}", (0.06, s[1], 0.06), (-s[0] / 2 + 0.03, 0, z), m="dark_metal", group=group, bev=0.01)
    for sy in (-1, 1):
        for k in range(4):
            box(f"{prefix}_stencil{sy}{k}", (0.07, 0.006, 0.2), (-0.32 + k * 0.1, sy * (s[1] / 2 - 0.017), h * 0.6),
                (0, 0, 0), "amber", group, bev=0.0)
        box(f"{prefix}_label{sy}", (0.3, 0.006, 0.12), (0.22, sy * (s[1] / 2 - 0.017), h * 0.6), m="graphite",
            group=group, bev=0.0)
    for sx in (-1, 1):
        x = sx * (s[0] / 2 - 0.01)
        tube(f"{prefix}_handle{sx}", [(x, -0.18, h * 0.62), (x + sx * 0.07, -0.15, h * 0.62),
                                      (x + sx * 0.07, 0.15, h * 0.62), (x, 0.18, h * 0.62)], 0.018, "metal",
             group, fillet=0.04)
    for sx in (-1, 1):
        box(f"{prefix}_latch{sx}", (0.08, 0.03, 0.08), (sx * 0.3, -s[1] / 2 + 0.005, h - 0.1), m="metal", group=group,
            bev=0.01)

def build_crates() -> None:
    clear_scene()
    crate_parts("c", "crate")
    finalize()
    export("crate_v4.glb")
    src = bpy.data.objects["crate"]
    src.name = "crate_0"
    layout = [((0.0, 0.0, 0.0), 0.0), ((1.08, 0.12, 0.0), 0.12), ((0.45, 0.05, 0.75), -0.18),
              ((-0.2, 0.95, 0.0), 1.5708 + 0.08)]
    src.location, src.rotation_euler = layout[0][0], (0, 0, layout[0][1])
    for i, (loc, rz) in enumerate(layout[1:], start=1):
        o = bpy.data.objects.new(f"crate_{i}", src.data)
        bpy.context.scene.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (0, 0, rz)
    xs = [lo[0] for lo, _ in layout]
    ys = [lo[1] for lo, _ in layout]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    for o in bpy.context.scene.objects:
        o.location.x -= cx
        o.location.y -= cy
    export("crate_stack_v4.glb")

def build_antenna() -> None:
    clear_scene()
    cyl("base_plate", 0.6, 0.08, (0, 0, 0.04), m="dark_metal", n=8, bev=0.02)
    cyl("pedestal", 0.22, 1.4, (0, 0, 0.8), m="hull", n=24, bev=0.02, r2=0.17)
    ring("pedestal_band", 0.2, 0.08, 0.02, (0, 0, 0.5), m="amber", n=24)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        beam(f"gusset{k}", (0.5 * math.cos(a), 0.5 * math.sin(a), 0.1), (0.18 * math.cos(a), 0.18 * math.sin(a), 0.75),
             0.05, 0.08, "dark_metal")
    box("cabinet", (0.36, 0.26, 0.42), (0, 0.3, 0.45), m="hull_panel", bev=0.025)
    cyl("bearing", 0.26, 0.1, (0, 0, 1.55), m="metal", n=32, bev=0.015)
    # garfo azimutal (yoke): gira em Y (glTF) = Z (Blender)
    zy = 1.6
    cyl("turntable", 0.3, 0.1, (0, 0, zy + 0.05), m="dark_metal", group="yoke", n=32, bev=0.015)
    box("yoke_base", (1.85, 0.3, 0.12), (0, 0, zy + 0.15), m="hull", group="yoke", bev=0.03)
    for s in (-1, 1):
        prism(f"yoke_arm{s}", [(-0.18, zy + 0.1), (0.18, zy + 0.1), (0.12, zy + 1.05), (-0.12, zy + 1.05)], 0.1,
              (s * 0.86, 0, 0), (0, 0, PI / 2), "hull", "yoke", bev=0.02)
        cyl(f"elev_motor{s}", 0.1, 0.12, (s * 0.96, 0, zy + 0.95), "X", m="dark_metal", group="yoke", n=20, bev=0.01)
    box("yoke_counter", (0.4, 0.3, 0.25), (0, 0.3, zy + 0.3), m="dark_metal", group="yoke", bev=0.03)
    # prato (dish): gira em X; aponta para a frente (+Z glTF = -Y Blender)
    ze = zy + 0.95
    R = 0.72
    prof = [(0.0, 0.0)]
    for k in range(1, 9):
        r = R * k / 8
        prof.append((r, r * r / (4 * 0.55)))
    zr = R * R / (4 * 0.55)
    prof += [(R + 0.04, zr + 0.01), (R + 0.04, zr - 0.03)]
    for k in range(8, 0, -1):
        r = R * k / 8
        prof.append((r, r * r / (4 * 0.55) - 0.05))
    prof.append((0.0, -0.05))
    dish_c = Vector((0, -0.1, ze))
    q = Euler((PI / 2, 0, 0))  # Z local -> -Y
    lathe("dish_reflector", prof, dish_c, q, "hull", "dish", n=40, closed=False, angle=40)
    lathe("dish_rim", [(R, zr - 0.04), (R + 0.06, zr - 0.04), (R + 0.06, zr + 0.02), (R, zr + 0.02)], dish_c, q, "metal",
          "dish", n=40, closed=True)
    cyl("dish_hub", 0.18, 0.2, dish_c + Vector((0, 0.12, 0)), "Y", m="dark_metal", group="dish", n=20, bev=0.02)
    cyl("dish_axle", 0.05, 1.78, (0, 0, ze), "X", m="metal", group="dish", n=14)
    box("dish_backframe", (1.0, 0.12, 0.12), dish_c + Vector((0, 0.18, 0)), m="dark_metal", group="dish", bev=0.02)
    feed = dish_c + Vector((0, -0.5, 0))
    for k in range(3):
        a = PI / 2 + k * 2 * PI / 3
        rim_p = dish_c + Vector((0.68 * math.cos(a), -zr + 0.02, 0.68 * math.sin(a)))
        strut(f"feed_strut{k}", rim_p, feed + Vector((0, 0.06, 0)), 0.018, "metal", "dish", n=8)
    cyl("feed_horn", 0.07, 0.18, feed, "Y", m="dark_metal", group="dish", n=16, bev=0.01, r2=0.045)
    cyl("feed_cap", 0.075, 0.02, feed - Vector((0, 0.1, 0)), "Y", m="amber", group="dish", n=16)
    ring("tune_ring", R + 0.06, 0.05, 0.03, dish_c - Vector((0, zr - 0.01, 0)), q, "tune_glow", "tune_ring", n=40)
    a_c = math.radians(245)
    th = math.radians(-70)
    rad = Vector((math.cos(a_c), 0, math.sin(a_c)))
    tan = Vector((-math.sin(a_c), 0, math.cos(a_c)))

    def dish_pt(r_, a_):
        return dish_c + Vector((r_ * math.cos(a_), -(r_ * r_ / (4 * 0.55)), r_ * math.sin(a_)))

    hinge = dish_pt(0.46, a_c)
    rot = Matrix.Rotation(th, 3, tan)
    r_out = [0.70, 0.745, 0.69, 0.73, 0.68]
    nr, nc = 4, 5
    grid = []
    for i in range(nr):
        row = []
        for j in range(nc):
            r_ = 0.46 + (r_out[j] - 0.46) * i / (nr - 1)
            a_ = a_c + (j - 2) * 0.095
            row.append(hinge + rot @ (dish_pt(r_, a_) - hinge))
        grid.append(row)
    nrm = (grid[nr - 1][0] - grid[0][0]).cross(grid[0][nc - 1] - grid[0][0]).normalized()
    bm = bmesh.new()
    top = [[bm.verts.new(p_) for p_ in row] for row in grid]
    bot = [[bm.verts.new(p_ - nrm * 0.02) for p_ in row] for row in grid]
    for i in range(nr - 1):
        for j in range(nc - 1):
            bm.faces.new((top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]))
            bm.faces.new((bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1]))
    for j in range(nc - 1):
        bm.faces.new((top[0][j], bot[0][j], bot[0][j + 1], top[0][j + 1]))
        bm.faces.new((top[nr - 1][j], top[nr - 1][j + 1], bot[nr - 1][j + 1], bot[nr - 1][j]))
    for i in range(nr - 1):
        bm.faces.new((top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0]))
        bm.faces.new((top[i][nc - 1], bot[i][nc - 1], bot[i + 1][nc - 1], top[i + 1][nc - 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish("petal", bm, "hull_panel", "damage_petal", 0.0, 1, 40, wn=False)
    for j in range(nc - 1):
        strut(f"petal_burn{j}", grid[nr - 1][j] - nrm * 0.01, grid[nr - 1][j + 1] - nrm * 0.01, 0.014, "burn",
              "damage_petal", n=6)
    c0 = Vector((0.6, -0.05, zy + 0.09))
    tube("loose_cable", [c0, c0 + Vector((0.02, 0.0, -0.25)), c0 + Vector((-0.06, -0.06, -0.5)),
                         c0 + Vector((-0.1, -0.12, -0.68))], 0.028, "graphite", "damage_cable", fillet=0.12)
    cyl("cable_clamp", 0.05, 0.06, c0 + Vector((0, 0, -0.03)), m="metal", group="damage_cable", n=10)
    strut("cable_tip", c0 + Vector((-0.1, -0.12, -0.68)), c0 + Vector((-0.12, -0.15, -0.77)), 0.02, "foil_gold",
          "damage_cable", n=8)
    def ped_r(z_):
        return 0.22 - 0.05 * (z_ - 0.1) / 1.4

    for k, (z0, z1, a0, a1) in enumerate(((0.80, 1.10, -0.55, 0.55), (0.98, 1.34, -0.3, 0.25), (0.62, 0.86, -0.2, 0.5))):
        lathe(f"scorch{k}", [(ped_r(z0) + 0.003, z0), (ped_r(z0) + 0.012, z0), (ped_r(z1) + 0.012, z1),
                             (ped_r(z1) + 0.003, z1)], (0, 0, 0), (0, 0, 0), "burn", "damage_scorch", n=8,
              closed=True, arc=(-PI / 2 + a0, -PI / 2 + a1), angle=60)
    piv = [("yoke", Matrix.Translation((0, 0, zy)), None),
           ("dish", Matrix.Translation((0, 0, ze)), "yoke"),
           ("damage_petal", Matrix.Translation((0, 0, ze)), "dish"),
           ("tune_ring", Matrix.Translation((0, 0, ze)), "dish"),
           ("damage_cable", Matrix.Translation(c0), "yoke")]
    finalize(piv)
    export("antenna_v4.glb")

def build_solar_array() -> None:
    clear_scene()
    cyl("base", 0.35, 0.1, (0, 0, 0.05), m="dark_metal", n=8, bev=0.02)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        beam(f"anchor{k}", (0.15 * math.cos(a), 0.15 * math.sin(a), 0.1), (0.42 * math.cos(a), 0.42 * math.sin(a), 0.03),
             0.06, 0.05, "metal")
    cyl("post", 0.07, 1.1, (0, 0, 0.65), m="hull", n=16, bev=0.01)
    ring("post_band", 0.07, 0.07, 0.015, (0, 0, 0.35), m="amber", n=16)
    cyl("rotator", 0.11, 0.14, (0, 0, 1.25), m="dark_metal", n=20, bev=0.015)
    zp = 1.45
    for s in (-1, 1):
        prism(f"fork{s}", [(-0.06, 1.3), (0.06, 1.3), (0.05, zp + 0.05), (-0.05, zp + 0.05)], 0.05, (s * 0.22, 0, 0),
              (0, 0, PI / 2), "hull", bev=0.012)
    box("fork_bridge", (0.5, 0.12, 0.06), (0, 0, 1.33), m="hull", bev=0.015)
    g = "panel_pivot"
    cyl("hinge", 0.05, 0.56, (0, 0, zp), "X", m="metal", group=g, n=14)
    box("panel_back", (2.0, 1.2, 0.04), (0, 0, zp + 0.1), m="dark_metal", group=g, bev=0.012)
    box("panel_spine", (1.6, 0.1, 0.08), (0, 0, zp + 0.04), m="metal", group=g, bev=0.015)
    box("panel_rib", (0.1, 1.0, 0.06), (0, 0, zp + 0.05), m="metal", group=g, bev=0.015)
    nx, ny = 10, 6
    cw, ch = 1.9 / nx, 1.1 / ny
    for i in range(nx):
        for j in range(ny):
            box(f"cell{i}{j}", (cw - 0.014, ch - 0.014, 0.012), (-0.95 + cw * (i + 0.5), -0.55 + ch * (j + 0.5), zp + 0.125),
                m="panel_cell", group=g, bev=0.0)
    for s in (-1, 1):
        box(f"frame_x{s}", (2.04, 0.03, 0.05), (0, s * 0.6, zp + 0.11), m="metal", group=g, bev=0.008)
        box(f"frame_y{s}", (0.03, 1.2, 0.05), (s * 1.0, 0, zp + 0.11), m="metal", group=g, bev=0.008)
    box("panel_tag", (0.2, 0.04, 0.03), (0.8, -0.6, zp + 0.11), m="amber", group=g, bev=0.0)
    piv = [(g, Matrix.Translation((0, 0, zp)), None)]
    finalize(piv)
    export("solar_array_v4.glb")

def build_greenhouse() -> None:
    """Módulo de estufa cilíndrico, acoplado ao colar SUL do habitat (eixo ao longo de Z glTF).

    Espaço do modelo: origem no chão na altura da base do habitat; eixo a HAB_ZC; casco de z=-3 a +3
    (z glTF = -Y do Blender). A face de acoplamento é o plano z=-3. Porta de serviço a leste (+X).
    """
    clear_scene()
    R, zc = HAB_R, HAB_ZC
    Ri = R - 0.07
    ZC0, ZC1 = -2.4, 1.3
    rotx = (PI / 2, 0, 0)  # Z local da revolução -> +Z glTF (-Y Blender)
    loc0 = (0, 0, zc)
    A0, A1 = math.radians(12), math.radians(168)
    B1 = A0 + 2 * PI

    def rl(z, r=R):
        return r if z <= ZC1 else math.sqrt(max(r * r - (z - ZC1) ** 2, 0.0))

    def P(a, z, r):
        return Vector((r * math.cos(a), -z, zc + r * math.sin(a)))

    def dome_prof(r, zc1=ZC1):
        pr = [(r, ZC0), (r, zc1)]
        for k in range(1, 9):
            t = k * PI / 18
            pr.append((r * math.cos(t), zc1 + r * math.sin(t)))
        pr.append((0.0, zc1 + r))
        return pr

    cap = [(0.0, -2.9), (0.62, -2.9)]
    for k in range(1, 9):
        t = k / 8 * PI / 2
        cap.append((0.62 + (R - 0.62) * math.sin(t), ZC0 - 0.5 * math.cos(t)))
    lathe("north_cap", cap, loc0, rotx, "hull", n=18, angle=30)
    outer = dome_prof(R)
    inner = [(0.0, ZC1 + Ri)] + [(Ri * math.cos(k * PI / 18), ZC1 + Ri * math.sin(k * PI / 18)) for k in range(8, 0, -1)]
    inner += [(Ri, ZC1), (Ri, ZC0)]
    lathe("hull_low", outer + inner, loc0, rotx, "hull", n=18, closed=True, arc=(A1, B1), angle=30)
    lathe("glass", dome_prof(R - 0.01), loc0, rotx, "glass", "glass", n=14, arc=(A0, A1), angle=80)
    lathe("dust", dome_prof(R + 0.003, ZC1 - 0.004), loc0, rotx, "dust_film", "glass_dust", n=14, arc=(A0, A1),
          angle=80)

    ring("collar_ring", 0.5, 0.04, 0.16, (0, 2.92, zc), rotx, "metal", n=22)
    ring("collar_gasket", 0.5, 0.06, 0.12, (0, 2.97, zc), rotx, "rubber", n=22)
    ring("collar_bellows", 0.43, 0.04, 0.05, (0, 2.94, zc), rotx, "graphite", n=16)
    cyl("collar_hatch", 0.42, 0.09, (0, 2.945, zc), "Y", m="dark_metal", n=22, bev=0.0)
    for k in range(6):
        a = 2 * PI * k / 6
        cyl(f"collar_bolt{k}", 0.03, 0.04, (0.3 * math.cos(a), 2.98, zc + 0.3 * math.sin(a)), "Y", m="metal", n=8)
    cyl("bulk_hatch", 0.42, 0.04, (0, 2.37, zc), "Y", m="dark_metal", n=18, bev=0.0)

    for z in (-2.4, -1.45, -0.5, 0.45, 1.3):
        r = rl(z) - 0.01
        pr = [(r, -0.05), (r + 0.075, -0.05), (r + 0.075, 0.05), (r, 0.05)]
        lathe(f"arch{z}", pr, (0, -z, zc), rotx, "hull", n=8, closed=True, arc=(A0, A1), angle=30)
        if z in (-2.4, 1.3):
            continue
        lathe(f"seam{z}", [(r + 0.01, -0.05), (r + 0.04, -0.05), (r + 0.04, 0.05), (r + 0.01, 0.05)], (0, -z, zc),
              rotx, "hull_panel", n=12, closed=True, arc=(A1, B1), angle=30)
    for a in (A0, A1):
        strut(f"sill{a:.2f}", P(a, ZC0, R + 0.02), P(a, ZC1, R + 0.02), 0.04, "metal", n=8)
    for a in (A0, A1, math.radians(60), math.radians(90), math.radians(120)):
        pts = [P(a, ZC1, R + 0.012)]
        for deg in (15, 30, 45, 60, 72):
            t = math.radians(deg)
            pts.append(P(a, ZC1 + (R + 0.012) * math.sin(t), (R + 0.012) * math.cos(t)))
        for i in range(len(pts) - 1):
            strut(f"mer{a:.2f}_{i}", pts[i], pts[i + 1], 0.03, "hull" if a not in (A0, A1) else "metal", n=6)
        if abs(a - PI / 2) < 1e-6:
            strut(f"ridge{a:.2f}", P(a, ZC0, R + 0.02), P(a, ZC1, R + 0.02), 0.03, "hull", n=8)
    for z in (ZC1 + 1.7 * math.sin(math.radians(35)), ZC1 + 1.7 * math.sin(math.radians(62))):
        r = rl(z) - 0.01
        lathe(f"hoop{z:.2f}", [(r, -0.03), (r + 0.06, -0.03), (r + 0.06, 0.03), (r, 0.03)], (0, -z, zc), rotx, "hull",
              n=10, closed=True, arc=(A0, A1), angle=30)
    cyl("tip_plate", 0.45, 0.08, (0, -2.945, zc), "Y", m="metal", n=24, bev=0.01)
    cyl("tip_hatch", 0.3, 0.02, (0, -2.99, zc), "Y", m="dark_metal", n=24)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        cyl(f"tip_bolt{k}", 0.025, 0.03, (0.37 * math.cos(a), -2.985, zc + 0.37 * math.sin(a)), "Y", m="dark_metal", n=8)

    def band(name, z0, z1, m, a0=A1, a1=B1, lift=0.0):
        r0, r1 = rl(z0), rl(z1)
        lathe(name, [(r0 + 0.002 + lift, z0), (r0 + 0.014 + lift, z0), (r1 + 0.014 + lift, z1), (r1 + 0.002 + lift, z1)],
              loc0, rotx, m, n=max(4, math.ceil((a1 - a0) / math.radians(15))), closed=True, arc=(a0, a1), angle=30)

    band("band_teal", -1.62, -1.38, "teal")
    band("band_amber", -1.28, -1.22, "amber")
    band("band_teal2", 1.38, 1.62, "teal")
    band("band_amber2", 1.22, 1.28, "amber")
    for i, (z0, z1) in enumerate(((-1.25, -0.65), (0.65, 1.25))):
        band(f"panel_e{i}", z0, z1, "shield", math.radians(305), math.radians(355), 0.002)
    for i, (z0, z1) in enumerate(((-2.2, -1.7), (-1.15, 1.2))):
        band(f"panel_w{i}", z0, z1, "shield", math.radians(185), math.radians(235), 0.002)

    for k, z in enumerate((-2.0, -1.0, 1.0, 2.0)):
        rr = rl(z) - 0.02
        lathe(f"saddle{k}", [(rr, -0.14), (rr + 0.1, -0.14), (rr + 0.1, 0.14), (rr, 0.14)], (0, -z, zc), rotx, "dark_metal",
              n=10, closed=True, arc=(math.radians(195), math.radians(345)), angle=30)
        for s in (-1, 1):
            a = math.radians(200) if s < 0 else math.radians(340)
            top = P(a, z, rr + 0.05)
            foot = Vector((s * 1.85, -z, 0.14))
            strut(f"saddle_leg{k}{s}", top, foot, 0.075, "metal", n=8)
            strut(f"saddle_brace{k}{s}", Vector((s * 0.6, -z, zc - R - 0.08)), foot + Vector((-s * 0.25, 0, 0.14)), 0.04,
                  "dark_metal", n=6)
            lathe(f"saddle_pad{k}{s}", [(0.0, 0.0), (0.3, 0.0), (0.32, 0.04), (0.25, 0.1), (0.0, 0.13)],
                  foot - Vector((0, 0, 0.14)), m="graphite", n=8)
        box(f"saddle_tie{k}", (3.3, 0.2, 0.08), (0, -z, 0.3), m="dark_metal", bev=0.0)

    FLOOR = 1.75
    box("floor", (2.5, 3.7, 0.1), (0, 0.55, FLOOR - 0.05), m="dark_metal", bev=0.0)
    cyl("floor_round", 1.25, 0.1, (0, -ZC1, FLOOR - 0.05), m="dark_metal", n=20, bev=0.0)
    for s in (-1, 1):
        box(f"floor_strip{s}", (0.05, 3.3, 0.01), (s * 0.5, 0.35, FLOOR + 0.005), m="amber", bev=0.0)
    ZA, ZB = 2.15, 2.88
    beds = []  # (nome, x, zc_glTF, comprimento útil, altura do solo)

    def bed(x, z0, z1, zs, aisle, w=0.48):
        L = z1 - z0
        zm = (z0 + z1) / 2
        i = len(beds)
        box(f"tray{i}", (w, L, 0.1), (x, -zm, zs - 0.07), m="hull_panel", bev=0.0)
        box(f"soil{i}", (w - 0.06, L - 0.06, 0.04), (x, -zm, zs - 0.02), m="soil", bev=0.0)
        box(f"gutter{i}", (0.06, L - 0.14, 0.05), (x + aisle * (w / 2 + 0.03), -zm, zs - 0.04), m="water_blue", bev=0.0)
        box(f"grow_bar{i}", (0.08, L - 0.2, 0.04), (x, -zm, zs + 0.53), m="grow_light", bev=0.0)
        box(f"grow_hood{i}", (0.16, L - 0.14, 0.04), (x, -zm, zs + 0.56), m="dark_metal", bev=0.0)
        return zm, L

    def rack(x, z0, z1, aisle, w=0.48):
        top = ZB + 0.62
        for tier, zs in enumerate((ZA, ZB)):
            zm, L = bed(x, z0, z1, zs, aisle, w)
            beds.append((x, zm, L - 0.1 if L > 2.0 else L - 0.05, zs, w - 0.08))
        for sz in (z0 + 0.04, z1 - 0.04):
            for sx in (-1, 1):
                strut(f"rack_post{x}{sz:.2f}{sx}", (x + sx * (w / 2 + 0.01), -sz, FLOOR), (x + sx * (w / 2 + 0.01), -sz, top),
                      0.02, "metal", n=6)
            strut(f"rack_top{x}{sz:.2f}", (x - w / 2, -sz, top), (x + w / 2, -sz, top), 0.018, "metal", n=5)
        for sx in (-1, 1):
            strut(f"rack_rail{x}{sx}{z0:.2f}", (x + sx * (w / 2 + 0.01), -z0 - 0.04, top),
                  (x + sx * (w / 2 + 0.01), -z1 + 0.04, top), 0.016, "metal", n=6)

    rack(0.0, -1.35, 1.35, 1, 0.44)
    for side in (1, -1):
        for z0, z1 in ((-2.0, -0.55), (0.55, 2.0)):
            rack(side * 0.95, z0, z1, -side)
    tube("manifold", [(-1.0, 2.2, FLOOR + 0.12), (1.0, 2.2, FLOOR + 0.12)], 0.03, "water_blue", fillet=0.1)
    for sx in (-1, 1):
        xg = sx * (0.95 - 0.27)
        strut(f"riser{sx}", (xg, 2.1, FLOOR + 0.12), (xg, 2.1, ZB - 0.04), 0.02, "water_blue", n=8)
        strut(f"riser_link{sx}", (xg, 2.1, FLOOR + 0.12), (sx * 0.5, 2.2, FLOOR + 0.12), 0.02, "water_blue", n=8)

    # ---- ventiladores de teto (nós fan_i: origem no cubo, o jogo gira em Y local)
    FAN_Z = zc + R - 0.4
    box("ridge_beam", (0.1, 3.9, 0.06), (0, 0.55, zc + R + 0.03), m="hull", bev=0.012)
    pivots = []
    for i, z in enumerate((-1.5, -0.5, 0.5, 1.5)):
        hub = Vector((0, -z, FAN_Z))
        ring(f"fan_cage{i}", 0.32, 0.05, 0.03, hub, (0, 0, 0), "dark_metal", n=10)
        for sx in (-1, 1):
            strut(f"fan_hang{i}{sx}", hub + Vector((sx * 0.34, 0, 0)), Vector((sx * 0.2, -z, zc + R - 0.02)), 0.014,
                  "metal", n=6)
        g = f"fan_{i}"
        cyl(f"{g}_hub", 0.06, 0.1, hub, m="dark_metal", group=g, n=10, bev=0.0)
        cyl(f"{g}_cap", 0.03, 0.04, hub + Vector((0, 0, 0.06)), m="amber", group=g, n=8)
        for k in range(5):
            a = 2 * PI * k / 5 + 0.3 * i
            c = hub + Vector((math.cos(a) * 0.19, math.sin(a) * 0.19, 0.0))
            box(f"{g}_blade{k}", (0.24, 0.07, 0.012), c, (0.35, 0, a), m="foil_silver", group=g, bev=0.0)
        pivots.append((g, Matrix.Translation(hub), None))

    DZ0, DZ1 = 2.30, 3.50
    box("vest", (0.43, 1.1, 1.36), (1.565, 0, 2.90), m="hull_panel", bev=0.02)
    box("vest_cap", (0.47, 1.16, 0.05), (1.565, 0, 3.6), m="hull", bev=0.01)
    box("vest_stripe", (0.44, 1.12, 0.05), (1.565, 0, 2.5), m="amber", bev=0.0)
    box("door_slab", (0.02, 0.86, 1.2), (1.79, 0, 2.90), m="dark_metal", bev=0.0)
    box("frame_top", (0.06, 1.0, 0.1), (1.81, 0, DZ1 + 0.05), m="dark_metal", bev=0.01)
    for s in (-1, 1):
        box(f"frame_side{s}", (0.06, 0.1, 1.3), (1.81, s * 0.48, 2.9), m="dark_metal", bev=0.01)
    box("door_lamp", (0.08, 0.12, 0.1), (1.82, 0.62, 3.4), m="pad_light", bev=0.01)
    strut("beacon_mast", (1.6, 0.4, 3.62), (1.6, 0.4, 4.0), 0.02, "metal", n=8)
    cyl("beacon_base", 0.07, 0.04, (1.6, 0.4, 3.64), m="dark_metal", n=12)
    sphere("beacon", 0.09, (1.6, 0.4, 4.07), m="status_light", u=12, v=6)
    # porta (pivô na dobradiça sul, abre para +X)
    g = "service_door"
    hx, hy, hz = 1.825, -0.42, 2.90
    box("door_panel", (0.05, 0.84, 1.18), (hx, 0.0, hz), m="hull", group=g, bev=0.01)
    box("door_stripe", (0.055, 0.84, 0.07), (hx, 0.0, 2.5), m="amber", group=g, bev=0.0)
    box("door_handle", (0.07, 0.04, 0.26), (hx + 0.03, 0.3, 2.85), m="metal", group=g, bev=0.008)
    cyl("door_hinge", 0.03, 1.1, (hx, hy, hz), m="metal", group=g, n=10)
    round_window("door_window", (hx + 0.026, 0.0, 3.15), (1, 0, 0), r=0.12, group=g)
    pivots.append((g, Matrix.Translation((hx, hy, hz)), None))
    box("landing", (0.42, 1.2, 0.1), (1.97, 0, 2.20), m="metal", bev=0.015)
    box("landing_edge", (0.04, 1.2, 0.12), (2.18, 0, 2.2), m="amber", bev=0.0)
    treads = [(2.285, 2.02), (2.455, 1.79), (2.625, 1.56)]
    for k, (x, z) in enumerate(treads):
        box(f"step{k}", (0.17, 1.1, 0.05), (x, 0, z - 0.025), m="dark_metal", bev=0.01)
        box(f"step_riser{k}", (0.02, 1.1, 0.23), (x - 0.075, 0, z - 0.14), m="graphite", bev=0.0)
    for s in (-1, 1):
        y = s * 0.58
        beam(f"stringer{s}", (2.18, y, 2.14), (2.7, y, 1.5), 0.05, 0.14, "metal")
        tube(f"handrail{s}", [(1.82, y, 3.15), (2.2, y, 3.15), (2.7, y, 2.55), (2.7, y, 2.0)], 0.022, "amber",
             fillet=0.12)
        strut(f"hand_post{s}a", (2.2, y, 2.15), (2.2, y, 3.15), 0.02, "metal", n=8)
        strut(f"hand_post{s}b", (2.55, y, 1.7), (2.55, y, 2.7), 0.02, "metal", n=8)
        strut(f"land_leg{s}", (2.12, s * 0.5, 2.15), (2.12, s * 0.5, 0.0), 0.04, "metal", n=10)
        cyl(f"land_foot{s}", 0.11, 0.05, (2.12, s * 0.5, 0.025), m="graphite", n=12)
        strut(f"ladder_rail{s}", (2.74, s * 0.3, 1.56), (2.74, s * 0.3, 0.05), 0.02, "metal", n=8)
    for k in range(6):
        strut(f"ladder_rung{k}", (2.74, -0.3, 1.4 - k * 0.25), (2.74, 0.3, 1.4 - k * 0.25), 0.015, "metal", n=8)
    box("land_brace", (0.3, 0.1, 0.06), (1.86, 0.0, 2.12), m="dark_metal", bev=0.01)

    tz = 0.0
    lathe("nut_tank", capsule_prof(0.38, 1.5, 4), (-2.15, tz, 0.85), m="hull", n=20, angle=30)
    lathe("nut_tank_band", [(0.386, -0.08), (0.386, 0.08)], (-2.15, tz, 0.95), m="teal", n=28, cap=False)
    for dz in (-0.35, 0.35):
        ring(f"nut_strap{dz}", 0.38, 0.05, 0.02, (-2.15, tz, 0.85 + dz), m="dark_metal", n=14)
    box("nut_skid", (0.84, 0.9, 0.1), (-2.15, tz, 0.05), m="dark_metal", bev=0.02)
    cyl("nut_valve", 0.06, 0.1, (-2.15, tz, 1.67), m="metal", n=12)
    tube("nut_pipe", [(-1.95, tz, 1.15), (-1.6, tz, 1.15), (-1.2, tz, 1.42)], 0.04, "water_blue", fillet=0.12)
    tube("nut_pipe2", [(-2.0, tz + 0.15, 1.5), (-1.55, tz + 0.15, 1.6), (-1.15, tz + 0.15, 1.7)], 0.03, "metal",
         fillet=0.12)
    rz = 2.45
    for dy in (-0.35, 0.35):
        strut(f"rad_leg{dy}", (-2.3, rz + dy - 0.0, 0.0), (-2.3, rz + dy, 0.55), 0.035, "metal", n=10)
    box("rad_frame", (0.1, 0.95, 1.0), (-2.3, rz, 1.0), m="metal", bev=0.02)
    box("rad_panel", (0.12, 0.85, 0.9), (-2.3, rz, 1.0), m="radiator", bev=0.01)
    for k in range(7):
        box(f"rad_rib{k}", (0.15, 0.025, 0.88), (-2.3, rz - 0.36 + k * 0.12, 1.0), m="hull_panel", bev=0.0)
    tube("rad_pipe", [(-2.25, rz, 0.55), (-2.0, rz - 0.5, 0.3), (-1.4, rz - 0.9, 0.3), (-1.0, rz - 0.9, 1.0)], 0.03,
         "metal", fillet=0.18)

    # ---- leitos: empties bed_i na superfície do solo, eixo Z glTF ao longo do comprimento
    for i, (x, zm, L, zs, bw) in enumerate(beds):
        pivots.append((f"bed_{i}", Matrix.Translation((x, -zm, zs)), None))
    nodes = finalize(pivots)
    for i, (x, zm, L, zs, bw) in enumerate(beds):
        ob = nodes[f"bed_{i}"]
        ob["length"] = round(L, 3)
        ob["width"] = round(bw, 3)
        ob.empty_display_size = 0.1
    export("greenhouse_v4.glb", extras=True)

def build_rocks() -> None:
    clear_scene()
    import random

    from mathutils import noise

    rnd = random.Random(7)
    sizes = [0.45, 0.8, 1.25, 1.8, 2.5]
    objs = []
    for i, s in enumerate(sizes):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3 if s < 1 else 4, radius=0.5)
        off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50)))
        for v in bm.verts:
            v.co *= 1 + 0.3 * noise.noise(v.co * 2.0 + off) + 0.08 * noise.noise(v.co * 6.0 + off)
        for k in range(8):
            phi = rnd.uniform(0, 2 * PI)
            el = rnd.uniform(-0.3, 1.2)
            nrm = Vector((math.cos(phi) * math.cos(el), math.sin(phi) * math.cos(el), math.sin(el)))
            d = rnd.uniform(0.34, 0.46)
            res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=nrm * d,
                                         plane_no=nrm, clear_outer=True)
            edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, -0.18),
                                     plane_no=(0, 0, -1), clear_outer=True)
        edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        sx, sy, sz = 1 + rnd.uniform(-0.1, 0.3), 1 + rnd.uniform(-0.2, 0.1), 0.75 + rnd.uniform(0, 0.25)
        bmesh.ops.transform(bm, matrix=mtx((0, 0, 0), (0, 0, rnd.uniform(0, PI)), (s * sx, s * sy, s * sz)),
                            verts=bm.verts)
        zmin = min(v.co.z for v in bm.verts)
        bmesh.ops.translate(bm, vec=(0, 0, -zmin - 0.05 * s), verts=bm.verts)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts[:], edges=bm.edges[:])
        me = bpy.data.meshes.new(f"rock_{i}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mat("regolith"))
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(25))
        ob = bpy.data.objects.new(f"rock_{i}", me)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    x = 0.0
    for ob, s in zip(objs, sizes):
        ob.location = (x + s / 2, 0, 0)
        x += s + 0.6
    for ob in objs:
        ob.location.x -= x / 2
    export("rocks_v4.glb")

BUILDERS = {
    "habitat": build_habitat,
    "rover": build_rover,
    "lander": build_lander,
    "landing_pad": build_landing_pad,
    "ice_processor": build_ice_processor,
    "tanks": build_tanks,
    "power_unit": build_power_unit,
    "light_tower": build_light_tower,
    "crates": build_crates,
    "antenna": build_antenna,
    "solar_array": build_solar_array,
    "greenhouse": build_greenhouse,
    "rocks": build_rocks,
}

if __name__ == "__main__":
    for key, fn in BUILDERS.items():
        if ONLY and key not in ONLY:
            continue
        fn()
