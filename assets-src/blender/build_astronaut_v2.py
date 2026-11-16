# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Astronauta v2 do Earthset: malha única, esqueleto humanoide, skinning automático e clipes.

Convenção: unidades em metros, origem no chão entre os pés, frente = -Y do Blender (vira +Z no three.js).
Saída: public/models/astronaut_v2.glb (malha skinada + armature + clipes idle, walk, run, work).

Uso:
  blender --background --factory-startup --python assets-src/blender/build_astronaut_v2.py -- public/models
"""
import math
import os
import sys

import bpy
from mathutils import Vector

OUT_DIR = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "public/models"

SUIT = "#E8E5DA"
SUIT_SHADE = "#C9C4B6"
ACCENT = "#F3A847"
TEAL = "#56B9A4"
METAL = "#78818B"
DARK = "#2A2C33"
VISOR = "#1B3B4A"

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)

_MATS = {}

def mat(name, color, metallic=0.0, rough=0.5, emission=None, strength=0.0):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_rgb(color)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    if emission:
        p.inputs["Emission Color"].default_value = hex_rgb(emission)
        p.inputs["Emission Strength"].default_value = strength
    _MATS[name] = m
    return m

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()

def smooth(obj, width=0.02, segs=2):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segs
    mod.limit_method = "ANGLE"

def paint(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)

def make(kind, location=(0, 0, 0), scale=(1, 1, 1), rotation=(0, 0, 0)):
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    elif kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1, depth=1, location=location)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=location)
    o = bpy.context.active_object
    o.scale = scale
    o.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True, rotation=True, location=False)
    return o

def segment(p0, p1, radius, m, bevel=0.0):
    a, b = Vector(p0), Vector(p1)
    d = b - a
    length = d.length
    o = make("cyl", location=((a + b) / 2), scale=(radius, radius, length))
    o.rotation_euler = d.normalized().to_track_quat("Z", "Y").to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    if bevel:
        smooth(o, bevel, 2)
    paint(o, m)
    return o

def ball(center, radius, m, scale=(1, 1, 1)):
    o = make("sphere", location=center, scale=(radius * scale[0], radius * scale[1], radius * scale[2]))
    paint(o, m)
    return o

def block(center, size, m, bevel=0.02):
    o = make("cube", location=center, scale=size)
    smooth(o, bevel, 2)
    paint(o, m)
    return o

# Ossos (posições em metros). Mesma referência para malha e esqueleto.
JOINTS = {
    "hips": (0.0, 0.0, 0.94),
    "spine": (0.0, 0.0, 1.16),
    "neck": (0.0, 0.0, 1.36),
    "head": (0.0, 0.0, 1.5),
    "shoulder_L": (0.22, 0.0, 1.34),
    "elbow_L": (0.27, -0.02, 1.07),
    "wrist_L": (0.29, -0.06, 0.84),
    "shoulder_R": (-0.22, 0.0, 1.34),
    "elbow_R": (-0.27, -0.02, 1.07),
    "wrist_R": (-0.29, -0.06, 0.84),
    "hip_L": (0.1, 0.0, 0.94),
    "knee_L": (0.11, 0.0, 0.5),
    "ankle_L": (0.11, 0.0, 0.1),
    "hip_R": (-0.1, 0.0, 0.94),
    "knee_R": (-0.11, 0.0, 0.5),
    "ankle_R": (-0.11, 0.0, 0.1),
}

def build_mesh():
    parts = []
    suit = mat("suit", SUIT, rough=0.55)
    shade = mat("suit_shade", SUIT_SHADE, rough=0.6)
    accent = mat("accent", ACCENT, rough=0.45)
    visor = mat("visor", VISOR, metallic=0.4, rough=0.06)
    teal = mat("teal", TEAL, rough=0.3, emission=TEAL, strength=0.6)
    metal = mat("metal", METAL, metallic=0.7, rough=0.35)
    dark = mat("dark", DARK, rough=0.7)

    parts.append(block((0, 0, 1.2), (0.46, 0.26, 0.52), suit, 0.1))
    parts.append(block((0, 0, 0.93), (0.34, 0.22, 0.2), shade, 0.06))
    for z, w in ((1.42, 0.2), (1.05, 0.2)):
        parts.append(segment((-w, 0, z), (w, 0, z), 0.07, shade, 0.02))
    parts.append(segment((-0.18, 0, 0.99), (0.18, 0, 0.99), 0.03, dark, 0.005))
    parts.append(block((0, -0.135, 1.27), (0.22, 0.02, 0.1), accent, 0.01))
    parts.append(block((0, -0.135, 1.13), (0.26, 0.02, 0.025), accent, 0.005))
    parts.append(ball((0.25, -0.07, 1.22), 0.035, metal))
    parts.append(segment((0.0, -0.13, 1.37), (0.0, -0.17, 1.42), 0.03, metal))

    parts.append(block((0, 0.2, 1.22), (0.34, 0.16, 0.5), shade, 0.05))
    for x in (-0.09, 0.09):
        parts.append(segment((x, 0.28, 1.0), (x, 0.28, 1.42), 0.045, metal, 0.01))
        parts.append(ball((x, 0.28, 1.44), 0.03, teal))
    parts.append(segment((0.0, 0.28, 1.3), (0.0, 0.16, 1.2), 0.015, dark))

    parts.append(segment(JOINTS["neck"], (0, 0, 1.44), 0.075, suit, 0.02))
    parts.append(ball(JOINTS["head"], 0.17, suit, scale=(1, 1.05, 1.1)))
    parts.append(ball((0, -0.12, 1.5), 0.12, visor, scale=(1.0, 0.55, 0.85)))
    parts.append(segment((0, 0, 1.33), (0, 0, 1.36), 0.1, metal, 0.01))

    for side in ("L", "R"):
        sh = JOINTS[f"shoulder_{side}"]
        el = JOINTS[f"elbow_{side}"]
        wr = JOINTS[f"wrist_{side}"]
        parts.append(ball(sh, 0.075, shade))
        parts.append(segment(sh, el, 0.07, suit, 0.02))
        parts.append(ball(el, 0.06, metal))
        parts.append(segment(el, wr, 0.062, suit, 0.02))
        parts.append(ball((wr[0] * 1.02, wr[1], wr[2] - 0.05), 0.075, dark, scale=(1, 1.1, 1.2)))

    for side in ("L", "R"):
        hp = JOINTS[f"hip_{side}"]
        kn = JOINTS[f"knee_{side}"]
        an = JOINTS[f"ankle_{side}"]
        parts.append(ball(hp, 0.095, shade))
        parts.append(segment(hp, kn, 0.115, suit, 0.035))
        parts.append(ball(kn, 0.085, metal))
        parts.append(segment(kn, an, 0.095, suit, 0.03))
        parts.append(segment((kn[0], kn[1] - 0.02, kn[2] + 0.06), (kn[0], kn[1] - 0.02, kn[2] + 0.1), 0.1, shade, 0.01))
        parts.append(block((an[0], an[1] - 0.04, 0.07), (0.14, 0.26, 0.14), dark, 0.04))
        parts.append(block((an[0], an[1] - 0.09, 0.14), (0.14, 0.12, 0.08), teal, 0.02))

    return parts

def join(parts):
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "astronaut_body"
    return body

def build_armature():
    arm_data = bpy.data.armatures.new("astronaut_rig")
    rig = bpy.data.objects.new("astronaut_rig", arm_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = eb[parent]
        return b

    J = JOINTS
    bone("hips", J["hips"], (0, 0, 1.05))
    bone("spine", J["spine"], (0, 0, 1.3), "hips")
    bone("neck", J["neck"], (0, 0, 1.46), "spine")
    bone("head", J["head"], (0, 0, 1.66), "neck")
    for s in ("L", "R"):
        bone(f"shoulder_{s}", (0, 0, 1.34), J[f"shoulder_{s}"], "spine")
        bone(f"upperarm_{s}", J[f"shoulder_{s}"], J[f"elbow_{s}"], f"shoulder_{s}")
        bone(f"forearm_{s}", J[f"elbow_{s}"], J[f"wrist_{s}"], f"upperarm_{s}")
        bone(f"hand_{s}", J[f"wrist_{s}"], (J[f"wrist_{s}"][0], J[f"wrist_{s}"][1], J[f"wrist_{s}"][2] - 0.1), f"forearm_{s}")
        bone(f"thigh_{s}", J[f"hip_{s}"], J[f"knee_{s}"], "hips")
        bone(f"shin_{s}", J[f"knee_{s}"], J[f"ankle_{s}"], f"thigh_{s}")
        bone(f"foot_{s}", J[f"ankle_{s}"], (J[f"ankle_{s}"][0], J[f"ankle_{s}"][1] - 0.18, 0.02), f"shin_{s}")
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig

def skin(body, rig):
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

def key(rig, bone, frame, rot):
    pb = rig.pose.bones[bone]
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = rot
    pb.keyframe_insert("rotation_euler", frame=frame)

def clip(rig, name, length, frames):
    """frames: lista de (frame, {osso: (rx, ry, rz)}). Cria a ação e a deixa ativa só para as chaves."""
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, poses in frames:
        for bone, rot in poses.items():
            key(rig, bone, frame, rot)
    # Laço: último quadro igual ao primeiro.
    rig.animation_data.action.use_fake_user = True
    bpy.context.scene.frame_start = 1
    return action

def cycle(rig, name, period, amp, leg_amp, arm_amp, bob, knee):
    half = period / 2
    frames = []
    for f, sign in ((1, 1), (1 + half, -1), (1 + period, 1)):
        poses = {
            "thigh_L": (leg_amp * sign, 0, 0),
            "thigh_R": (-leg_amp * sign, 0, 0),
            "shin_L": (max(0, -sign) * knee, 0, 0),
            "shin_R": (max(0, sign) * knee, 0, 0),
            "upperarm_L": (-arm_amp * sign, 0, 0),
            "upperarm_R": (arm_amp * sign, 0, 0),
            "hips": (0, 0, 0),
            "spine": (0, 0, 0),
        }
        frames.append((f, poses))
    frames.append((1 + period / 4, {"hips": (0, 0, 0), "spine": (0, 0, 0)}))
    action = clip(rig, name, period, frames)
    bpy.context.scene.frame_end = max(bpy.context.scene.frame_end, int(period))
    return action

def build_clips(rig):
    bpy.context.scene.frame_start = 1
    clip(rig, "idle", 60, [
        (1, {"spine": (0.0, 0, 0), "head": (0.0, 0, 0)}),
        (30, {"spine": (-0.03, 0, 0), "head": (0.02, 0, 0)}),
        (60, {"spine": (0.0, 0, 0), "head": (0.0, 0, 0)}),
    ])
    cycle(rig, "walk", 24, 0.25, 0.55, 0.45, 0.02, 0.9)
    cycle(rig, "run", 16, 0.4, 0.9, 0.85, 0.04, 1.4)
    clip(rig, "work", 48, [
        (1, {"upperarm_R": (-0.7, 0, 0.1), "forearm_R": (-1.9, 0, 0), "spine": (0.12, 0, 0), "head": (0.2, 0, 0)}),
        (24, {"upperarm_R": (-0.85, 0, 0.1), "forearm_R": (-1.5, 0, 0), "spine": (0.15, 0, 0), "head": (0.25, 0, 0)}),
        (48, {"upperarm_R": (-0.7, 0, 0.1), "forearm_R": (-1.9, 0, 0), "spine": (0.12, 0, 0), "head": (0.2, 0, 0)}),
    ])

def export(objs, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]
    path = os.path.join(OUT_DIR, name)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
    )
    print("EXPORTED", path, os.path.getsize(path))

def main():
    clear()
    parts = build_mesh()
    body = join(parts)
    smooth(body, 0.0, 1)
    rig = build_armature()
    skin(body, rig)
    build_clips(rig)
    export([rig, body], "astronaut_v2.glb")
    print("CLIPS", [a.name for a in bpy.data.actions])

main()
