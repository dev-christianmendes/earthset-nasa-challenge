# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Prévias PNG dos GLB v4, reimportando cada arquivo exportado (não a cena em memória).

Uso:
  blender -b --factory-startup -P assets-src/blender/preview_v4.py -- public/models/v4 <pasta_saida> [nome ...]
Gera <nome>.png por GLB, contact_sheet.png e imprime tamanho, triângulos, nós e materiais.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
MODELS, OUT = args[0], args[1]
ONLY = args[2:]
os.makedirs(OUT, exist_ok=True)

names = sorted(f[:-4] for f in os.listdir(MODELS) if f.endswith(".glb"))
if ONLY:
    names = [n for n in names if n in ONLY or n.replace("_v4", "") in ONLY]

def setup_world(scene):
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.11, 0.115, 0.125, 1)
    bg.inputs["Strength"].default_value = 0.6
    scene.world = w

for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(MODELS, f"{name}.glb")
    bpy.ops.import_scene.gltf(filepath=path)
    scene = bpy.context.scene
    objs = [o for o in scene.objects if o.type == "MESH"]
    bpy.context.view_layer.update()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector(min(a, b) for a, b in zip(lo, w))
            hi = Vector(max(a, b) for a, b in zip(hi, w))
        me = o.evaluated_get(dg).data
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
    mats = sorted({s.material.name for o in objs for s in o.material_slots if s.material})
    nodes = sorted(o.name for o in scene.objects)
    dims = hi - lo
    print(f"STAT {name} size={os.path.getsize(path)} tris={tris} dims(x,y,z blender)="
          f"{dims.x:.2f},{dims.y:.2f},{dims.z:.2f} zmin={lo.z:.3f}")
    print(f"NODES {name} {nodes}")
    print(f"MATS {name} {mats}")
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("ground")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.08, 0.085, 0.09, 1)
    gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    ground.data.materials.append(gm)
    center = (lo + hi) / 2
    size = max(dims.x, dims.y, dims.z * 1.2)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    dist = size * 2.1 + 0.5
    cam.location = center + Vector((dist * 0.62, -dist * 0.78, dist * 0.42))
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for nm, energy, rot in (("key", 4.0, (50, 0, 35)), ("fill", 1.2, (65, 0, -120)), ("rim", 2.0, (35, 0, 170))):
        ld = bpy.data.lights.new(nm, "SUN")
        ld.energy = energy
        ld.angle = math.radians(2)
        lo_ = bpy.data.objects.new(nm, ld)
        scene.collection.objects.link(lo_)
        lo_.rotation_euler = tuple(math.radians(v) for v in rot)
    setup_world(scene)
    eng = scene.render.bl_rna.properties["engine"].enum_items
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in eng else "BLENDER_EEVEE_NEXT"
    try:
        scene.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", scene.render.filepath)
    cam.location = center + Vector((-dist * 0.62, dist * 0.78, dist * 0.42))
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, f"{name}_rear.png")
    bpy.ops.render.render(write_still=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
pngs = [os.path.join(OUT, f) for f in sorted(os.listdir(OUT)) if f.endswith("_v4.png")]
if pngs:
    cols = 4
    tw, th = 400, 300
    rows = math.ceil(len(pngs) / cols)
    sheet = bpy.data.images.new("sheet", cols * tw, rows * th)
    px = [0.0] * (cols * tw * rows * th * 4)
    for i, p in enumerate(pngs):
        img = bpy.data.images.load(p)
        img.scale(tw, th)
        src = list(img.pixels)
        c, r = i % cols, rows - 1 - i // cols
        for y in range(th):
            row0 = ((r * th + y) * cols * tw + c * tw) * 4
            px[row0 : row0 + tw * 4] = src[y * tw * 4 : (y + 1) * tw * 4]
    sheet.pixels = px
    sheet.filepath_raw = os.path.join(OUT, "contact_sheet.png")
    sheet.file_format = "PNG"
    sheet.save()
    print("SHEET", sheet.filepath_raw)
