# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Converte modelos externos CC0 (KayKit Space Base Bits, Quaternius via poly.pizza) para GLB.

Convenções de saída (public/models/ext/<nome>.glb):
- glTF com Y para cima, metros.
- KayKit: escala 3 m por unidade do kit; origem original preservada (encaixe modular em grade).
- Quaternius: recentrado (origem no chão, no centro da base) e escalado para o tamanho-alvo.
- Rodas como nós próprios, origem no centro da roda, nomes wheel_*.
- Rochas do KayKit (laranja, Marte) remapeadas para cinza no atlas; cúpula da estufa para verde-água.
Uso: blender -b --factory-startup -P assets-src/blender/convert_ext_assets.py -- public/models/ext [nome ...]
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXT = os.path.join(ROOT, "assets-src", "external")
KK = os.path.join(EXT, "kaykit-space-base-bits", "raw", "addons", "kaykit_space_base_bits", "Assets", "gltf")
QS = os.path.join(EXT, "polypizza-quaternius-space", "raw")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = args[0] if args else os.path.join(ROOT, "public", "models", "ext")
ONLY = set(args[1:])
KK_SCALE = 3.0

JOBS = {
    "habitat_a": (f"{KK}/basemodule_A.gltf", "kaykit", {}),
    "habitat_b": (f"{KK}/basemodule_B.gltf", "kaykit", {}),
    "habitat_c": (f"{KK}/basemodule_C.gltf", "kaykit", {}),
    "habitat_d": (f"{KK}/basemodule_D.gltf", "kaykit", {}),
    "habitat_garage": (f"{KK}/basemodule_garage.gltf", "kaykit", {"rename": {"basemodule_garage_door": "door"}}),
    "greenhouse": (f"{KK}/basemodule_E.gltf", "kaykit", {"dome_glass": True}),
    "tunnel_straight": (f"{KK}/tunnel_straight_A.gltf", "kaykit", {}),
    "tunnel_straight_b": (f"{KK}/tunnel_straight_B.gltf", "kaykit", {}),
    "tunnel_diagonal": (f"{KK}/tunnel_diagonal_short_A.gltf", "kaykit", {}),
    "lander": (f"{KK}/lander_A.gltf", "kaykit", {}),
    "lander_dome": (f"{KK}/lander_B.gltf", "kaykit", {}),
    "lander_base": (f"{KK}/lander_base.gltf", "kaykit", {}),
    "landing_pad": (f"{KK}/landingpad_large.gltf", "kaykit", {}),
    "landing_pad_small": (f"{KK}/landingpad_small.gltf", "kaykit", {}),
    "solar_panel": (f"{KK}/solarpanel.gltf", "kaykit", {}),
    "solar_array": (f"{KK}/roofmodule_solarpanels.gltf", "kaykit", {}),
    "drill": (f"{KK}/drill_structure.gltf", "kaykit", {"rename": {"drill_module": "drill_head"}}),
    "light_tower": (f"{KK}/lights.gltf", "kaykit", {}),
    "cargo_a": (f"{KK}/cargo_A.gltf", "kaykit", {}),
    "cargo_b": (f"{KK}/cargo_B.gltf", "kaykit", {}),
    "cargo_stack": (f"{KK}/cargo_A_stacked.gltf", "kaykit", {}),
    "cargo_packed": (f"{KK}/cargo_B_packed.gltf", "kaykit", {}),
    "canisters": (f"{KK}/containers_A.gltf", "kaykit", {}),
    "canisters_b": (f"{KK}/containers_C.gltf", "kaykit", {}),
    "rock_a": (f"{KK}/rock_A.gltf", "kaykit", {"grey": True}),
    "rock_b": (f"{KK}/rock_B.gltf", "kaykit", {"grey": True}),
    "rocks_a": (f"{KK}/rocks_A.gltf", "kaykit", {"grey": True}),
    "rocks_b": (f"{KK}/rocks_B.gltf", "kaykit", {"grey": True}),
    "truck": (f"{KK}/spacetruck.gltf", "kaykit", {"wheels": "spacetruck_wheel_"}),
    "rover": (f"{QS}/WRd1piJOfh.glb", "quaternius", {"length": 3.0, "wheels": "Wheel_"}),
    "antenna_dish": (f"{QS}/V7XQDxF8JC.glb", "quaternius", {"height": 3.0}),
    "dome": (f"{QS}/T7Ge6maWq4.glb", "quaternius", {"height": 4.0}),
}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]

def flatten():
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.parent:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)

def apply_all(loc=False):
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes():
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes()[0]
    bpy.ops.object.transform_apply(location=loc, rotation=True, scale=True)

def world_bbox(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

def transform_all(m):
    for o in meshes():
        o.matrix_world = m @ o.matrix_world

def remap_uv(obj, cond, new_u0, new_v_shift=0.0):
    """Move UVs para outra célula do atlas 8x4 do KayKit (cores lisas por célula)."""
    me = obj.data
    uv = me.uv_layers.active.data
    for p in me.polygons:
        if not cond(obj, p):
            continue
        for li in p.loop_indices:
            u, v = uv[li].uv
            frac = (u * 8) % 1.0
            uv[li].uv = (new_u0 + frac / 8, v + new_v_shift)

def origin_to_center(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

def name_wheels(prefix):
    wheels = [o for o in meshes() if o.name.startswith(prefix)]
    for w in wheels:
        origin_to_center(w)
    # frente = -Y no Blender (+Z no glTF); esquerda do veículo = +X
    ys = sorted({round(w.location.y, 2) for w in wheels})
    rows = ["f", "m", "r"] if len(ys) == 3 else ["f", "r"]
    for w in wheels:
        side = "l" if w.location.x > 0 else "r"
        row = rows[ys.index(round(w.location.y, 2))]
        w.name = f"wheel_{row}{side}"
    return sorted(w.name for w in wheels)

def join_body(keep):
    rest = [o for o in meshes() if o not in keep]
    if len(rest) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for o in rest:
            o.select_set(True)
        bpy.context.view_layer.objects.active = rest[0]
        bpy.ops.object.join()
    body = [o for o in meshes() if o not in keep][0]
    return body

def export(name):
    path = os.path.join(OUT_DIR, f"{name}.glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_animations=False, export_image_format="AUTO")
    return path

def run(name, src, kind, opt):
    reset()
    bpy.ops.import_scene.gltf(filepath=src)
    flatten()
    notes = {}
    if kind == "kaykit":
        transform_all(Matrix.Scale(KK_SCALE, 4))
        apply_all(loc=False)
        if opt.get("grey"):
            # células laranja/marrom (colunas 5-7 da linha de cima) -> cinza frio (coluna 2)
            for o in meshes():
                remap_uv(o, lambda ob, p: True, 2 / 8)
        if opt.get("dome_glass"):
            # cúpula (acima de 1 unidade do kit) -> célula verde-água (coluna 1, linha 3)
            for o in meshes():
                me = o.data
                def is_dome(ob, p, me=me):
                    return (ob.matrix_world @ p.center).z > 1.02 * KK_SCALE
                remap_uv(o, is_dome, 1 / 8, -0.25)
        for old, new in opt.get("rename", {}).items():
            if old in bpy.data.objects:
                bpy.data.objects[old].name = new
        if opt.get("wheels"):
            notes["wheels"] = name_wheels(opt["wheels"])
            join_body([o for o in meshes() if o.name.startswith("wheel_")]).name = "body"
    else:
        apply_all(loc=True)
        objs = meshes()
        if opt.get("front") == "-x":
            transform_all(Matrix.Rotation(math.radians(90), 4, "Z"))  # -X -> -Y
            apply_all(loc=True)
        lo, hi = world_bbox(objs)
        size = hi - lo
        if "length" in opt:
            s = opt["length"] / max(size.x, size.y)
        else:
            s = opt["height"] / size.z
        c = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        transform_all(Matrix.Scale(s, 4) @ Matrix.Translation(-c))
        apply_all(loc=True)
        if opt.get("wheels"):
            wheels = [o for o in meshes() if o.name.startswith(opt["wheels"])]
            notes["wheels"] = name_wheels(opt["wheels"])
            join_body(wheels).name = "body"
        else:
            join_body([]).name = name
    path = export(name)
    lo, hi = world_bbox(meshes())
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes())
    print(f"OUT {name} {os.path.getsize(path)} bytes tris={tris} size_m={[round(x, 2) for x in (hi - lo)]} "
          f"lo={[round(x, 2) for x in lo]} nodes={sorted(o.name for o in meshes())} {notes}")

os.makedirs(OUT_DIR, exist_ok=True)
for name, (src, kind, opt) in JOBS.items():
    if ONLY and name not in ONLY:
        continue
    run(name, src, kind, opt)
