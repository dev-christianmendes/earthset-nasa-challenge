# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Prévias do astronauta v2: pose de descanso e quadros de cada clipe, renderizados com o Blender."""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
GLB, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")

lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for o in bpy.context.scene.objects:
    if o.type == "MESH":
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(min(a, b) for a, b in zip(lo, w))
            hi = Vector(max(a, b) for a, b in zip(hi, w))
center = (lo + hi) / 2
size = max(hi - lo)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.scene.collection.objects.link(cam)
cam.data.lens = 50
cam.location = center + Vector((size * 0.55, -size * 1.9, 0.0))
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4
bpy.context.scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 520
scene.render.resolution_y = 720
scene.world = bpy.data.worlds.new("w")
scene.world.color = (0.06, 0.08, 0.11)

shots = [("rest", None, 1)]
for name in ["idle", "walk", "run", "work"]:
    action = bpy.data.actions.get(name)
    if action is None:
        print("MISSING", name)
        continue
    for i, f in enumerate([1, 1 + (action.frame_range[1] - action.frame_range[0]) / 4]):
        shots.append((name, action, int(round(f))))

for label, action, frame in shots:
    if action is not None:
        if rig.animation_data is None:
            rig.animation_data_create()
        rig.animation_data.action = action
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(OUT, f"astronaut_v2_{label}_{frame}.png")
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", scene.render.filepath)
