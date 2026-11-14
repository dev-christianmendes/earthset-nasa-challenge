# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Converte o astronauta CC0 do OpenGameArt (assets-src/external/astronaut_oga/astronaut.blend) para GLB.

Preserva malha, esqueleto (armature) e clipes. Licença e origem: assets-src/external/astronaut_oga/LICENSE.txt.
Uso: blender --background --factory-startup --python assets-src/blender/convert_oga_astronaut.py -- public/models
"""
import os
import sys

import bpy

SRC = "assets-src/external/astronaut_oga/astronaut.blend"
OUT = os.path.join(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "public/models", "astronaut_oga.glb")

bpy.ops.wm.open_mainfile(filepath=SRC)
for o in bpy.data.objects:
    if o.type not in ("MESH", "ARMATURE"):
        bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.context.scene.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_skins=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
)
print("EXPORTED", OUT, os.path.getsize(OUT))
print("CLIPS", [a.name for a in bpy.data.actions])
