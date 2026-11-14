# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Gera prévias PNG de cada GLB em public/models, com o próprio Blender (renderização simples).

Uso: blender --background --factory-startup --python assets-src/blender/preview_assets.py -- public/models assets-src/blender/previews
"""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
MODELS, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)

for name in ["habitat", "rover", "solar_panel", "greenhouse", "antenna", "astronaut"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f"{name}.glb"))
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector(min(a, b) for a, b in zip(lo, w))
            hi = Vector(max(a, b) for a, b in zip(hi, w))
    center = (lo + hi) / 2
    size = max(hi - lo)
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    dist = size * 2.2
    cam.location = center + Vector((dist * 0.7, -dist * 0.9, dist * 0.55))
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4
    sun_obj = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in bpy.context.scene.render.bl_rna.properties["engine"].enum_items else "BLENDER_WORKBENCH"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.filepath = os.path.join(OUT, f"{name}.png")
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.06, 0.08, 0.11)
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", scene.render.filepath)
