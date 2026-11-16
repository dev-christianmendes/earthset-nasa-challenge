# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Monta o astronauta a partir do manequim CC0 da Universal Animation Library (Quaternius).

Corpo e esqueleto: UAL1_Standard.glb (manequim). Clipes: UAL1 + UAL2 (mesmo esqueleto).
Traje: materiais trocados (branco, juntas cinza, luvas e botas cinza), cabeça removida e
capacete com viseira, gola, mochila (PLSS) e caixa de peito presos aos ossos. Sem rosto.
O clipe "wave" é feito aqui (braço direito sobre o Idle_Loop), pois as bibliotecas não têm aceno.

Uso:
  blender -b --factory-startup -P assets-src/blender/build_ext_astronaut.py -- public/models/ext
Saída: public/models/ext/astronaut.glb (Y para cima, metros, origem no chão entre os pés,
frente do personagem em +Z no glTF).
"""
import math
import os
import sys

import bmesh
import bpy
from bpy_extras import anim_utils
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXT = os.path.join(ROOT, "assets-src", "external")
UAL1 = os.path.join(EXT, "quaternius-universal-animation-library", "x",
                    "Universal Animation Library[Standard]", "Unreal-Godot", "UAL1_Standard.glb")
UAL2 = os.path.join(EXT, "quaternius-universal-animation-library-2", "x",
                    "Universal Animation Library 2[Standard]", "Unreal-Godot", "UAL2_Standard.glb")
OUT_DIR = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(ROOT, "public", "models", "ext")
OUT = os.path.join(OUT_DIR, "astronaut.glb")

CLIPS = {
    "idle": "Idle_Loop",
    "walk": "Walk_Loop",
    "run": "Jog_Fwd_Loop",
    "sprint": "Sprint_Loop",
    "work": "Fixing_Kneeling",
    "interact": "Interact",
    "pickup": "PickUp_Table",
    "carry": "Walk_Carry_Loop",
    "plant": "Farm_PlantSeed",
    "harvest": "Farm_Harvest",
    "water": "Farm_Watering",
    "yes": "Yes",
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

objs = import_glb(UAL1)
arm = next(o for o in objs if o.type == "ARMATURE")
body = next(o for o in objs if o.type == "MESH" and o.name.startswith("Mannequin"))
for o in objs:
    if o not in (arm, body):
        bpy.data.objects.remove(o, do_unlink=True)
actions_before = set(bpy.data.actions)
objs2 = import_glb(UAL2)
for o in objs2:
    bpy.data.objects.remove(o, do_unlink=True)
by_name = {}
for a in bpy.data.actions:
    by_name.setdefault(a.name.split(".")[0], a)
arm.animation_data_clear()
arm.data.pose_position = "REST"
bpy.context.view_layer.update()

def mat(name, rgb, rough=0.6, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = 2.0
    return m

SUIT = mat("suit_white", (0.82, 0.82, 0.80), 0.65)
SEAM = mat("suit_seam", (0.20, 0.21, 0.23), 0.55)
GLOVE = mat("suit_glove", (0.32, 0.33, 0.35), 0.7)
ACCENT = mat("suit_accent", (0.90, 0.42, 0.08), 0.5)
VISOR = mat("visor_gold", (0.95, 0.66, 0.25), 0.12, 1.0)
METAL = mat("suit_metal", (0.55, 0.56, 0.58), 0.35, 0.8)
LIGHT = mat("suit_light", (0.6, 0.9, 1.0), 0.4, 0.0, emit=(0.5, 0.85, 1.0))

me = body.data
me.materials.clear()
for m in (SUIT, SEAM, GLOVE):
    me.materials.append(m)
# índices originais: 0 = M_Main, 1 = M_Joints (preservados pelo clear/append na mesma ordem)
vg_names = {g.index: g.name for g in body.vertex_groups}

def dominant(v):
    best = max(v.groups, key=lambda g: g.weight, default=None)
    return vg_names.get(best.group, "") if best else ""

GLOVE_KEYS = ("hand_", "index_", "middle_", "ring_", "pinky_", "thumb_", "foot_", "ball_")
head_pts = []
bm = bmesh.new()
bm.from_mesh(me)
deform = bm.verts.layers.deform.verify()
head_faces = []
for f in bm.faces:
    names = []
    for v in f.verts:
        d = v[deform]
        if d:
            g = max(d.items(), key=lambda kv: kv[1])[0]
            names.append(vg_names.get(g, ""))
        else:
            names.append("")
    if all(n == "Head" for n in names):
        head_faces.append(f)
        head_pts.extend(body.matrix_world @ v.co for v in f.verts)
        continue
    if all(n.startswith(GLOVE_KEYS) for n in names):
        f.material_index = 2
torso_pts = [body.matrix_world @ v.co for v in bm.verts
             if v[deform] and vg_names.get(max(v[deform].items(), key=lambda kv: kv[1])[0], "") in ("spine_02", "spine_03")]
bmesh.ops.delete(bm, geom=head_faces, context="FACES")
bm.normal_update()
for v in bm.verts:
    d = v[deform]
    if not d:
        continue
    g = vg_names.get(max(d.items(), key=lambda kv: kv[1])[0], "")
    push = 0.004 if g.startswith(GLOVE_KEYS[:6]) else (0.010 if g.startswith(("foot_", "ball_")) else 0.016)
    v.co += v.normal * push
bm.to_mesh(me)
bm.free()

def bbox(pts):
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

hlo, hhi = bbox(head_pts)
tlo, thi = bbox(torso_pts)
hc = (hlo + hhi) / 2
hr = max(hhi - hlo) / 2 * 1.08
print("HEAD", hlo, hhi, "TORSO", tlo, thi)

def attach(obj, bone):
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw

def finish(obj, material, bevel=None, smooth=True):
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj

def sphere(name, loc, scale, material, segs=28, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material)

def box(name, loc, size, material, bevel=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, bevel=bevel, smooth=False)

def cyl(name, loc, r, depth, material, rot=(0, 0, 0), verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return finish(o, material, bevel=min(r, depth) * 0.25, smooth=True)

front = tlo.y  # personagem olha para -Y no Blender
back = thi.y
helmet = sphere("helmet", hc + Vector((0, 0.0, 0.01)), (hr, hr * 1.02, hr * 1.02), SUIT)
visor = sphere("visor", hc + Vector((0, -hr * 0.40, hr * 0.08)), (hr * 0.82, hr * 0.68, hr * 0.58), VISOR, segs=40, rings=24)
attach(helmet, "Head")
attach(visor, "Head")
lamp = box("helmet_lamp", hc + Vector((hr * 0.86, -hr * 0.22, hr * 0.42)), (hr * 0.22, hr * 0.42, hr * 0.20), SEAM, bevel=0.006)
lamp_lens = box("helmet_lamp_lens", hc + Vector((hr * 0.86, -hr * 0.44, hr * 0.42)), (hr * 0.16, hr * 0.02, hr * 0.13), LIGHT, bevel=0.002)
attach(lamp, "Head")
attach(lamp_lens, "Head")
neck_z = hlo.z - 0.005
bpy.ops.mesh.primitive_torus_add(major_radius=hr * 0.78, minor_radius=hr * 0.16, location=(0, (front + back) / 2 - 0.005, neck_z),
                                 major_segments=28, minor_segments=10)
collar = finish(bpy.context.active_object, SEAM)
collar.name = "collar"
attach(collar, "spine_03")

tw = thi.x - tlo.x
pz = (tlo.z + thi.z) / 2 + 0.03
pack = box("backpack", (0, back + 0.085, pz), (tw * 0.80, 0.17, 0.46), SUIT, bevel=0.03)
pack_top = box("backpack_top", (0, back + 0.09, pz + 0.255), (tw * 0.70, 0.13, 0.05), SEAM, bevel=0.012)
stripe_l = box("backpack_stripe_l", (tw * 0.40 + 0.002, back + 0.085, pz), (0.01, 0.12, 0.30), ACCENT, bevel=0.003)
stripe_r = box("backpack_stripe_r", (-tw * 0.40 - 0.002, back + 0.085, pz), (0.01, 0.12, 0.30), ACCENT, bevel=0.003)
tank = cyl("backpack_tank", (0, back + 0.18, pz - 0.03), 0.045, 0.34, METAL)
ant = cyl("backpack_antenna", (tw * 0.28, back + 0.06, pz + 0.38), 0.008, 0.26, METAL, verts=8)
for o in (pack, pack_top, stripe_l, stripe_r, tank, ant):
    attach(o, "spine_03")
chest = box("chest_unit", (0, front - 0.035, pz - 0.05), (tw * 0.42, 0.07, 0.12), SEAM, bevel=0.01)
chest_btn = box("chest_light", (-tw * 0.10, front - 0.071, pz - 0.04), (0.035, 0.008, 0.025), LIGHT, bevel=0.002)
chest_btn2 = box("chest_accent", (tw * 0.10, front - 0.071, pz - 0.04), (0.035, 0.008, 0.025), ACCENT, bevel=0.002)
for o in (chest, chest_btn, chest_btn2):
    attach(o, "spine_03")

arm.data.pose_position = "POSE"
arm.animation_data_create()
ad = arm.animation_data

def slot_of(action):
    return action.slots[0]

def make_wave():
    idle = by_name["Idle_Loop"]
    wave = idle.copy()
    wave.name = "wave"
    slot = slot_of(wave)
    cb = anim_utils.action_get_channelbag_for_slot(wave, slot)
    bones = ("upperarm_r", "lowerarm_r", "hand_r")
    for fc in list(cb.fcurves):
        if any(f'pose.bones["{b}"]' in fc.data_path for b in bones):
            cb.fcurves.remove(fc)
        elif any(f'pose.bones["{k}' in fc.data_path and '_r"]' in fc.data_path
                 for k in ("index_", "middle_", "ring_", "pinky_", "thumb_")):
            cb.fcurves.remove(fc)
    ad.action = wave
    ad.action_slot = slot
    f0, f1 = (int(x) for x in idle.frame_range)
    n = 8
    pb = {b: arm.pose.bones[b] for b in bones}
    for b in bones:
        pb[b].rotation_mode = "QUATERNION"
    fingers = [p for p in arm.pose.bones
               if p.name.endswith("_r") and p.name.startswith(("index_", "middle_", "ring_", "pinky_", "thumb_"))]
    for p in fingers:
        p.rotation_mode = "QUATERNION"
        p.rotation_quaternion = (1, 0, 0, 0)
        p.keyframe_insert("rotation_quaternion", frame=f0)
        p.keyframe_insert("rotation_quaternion", frame=f1)
    for k in range(n + 1):
        fr = f0 + round((f1 - f0) * k / n)
        scene.frame_set(fr)
        for b in bones:
            pb[b].rotation_quaternion = (1, 0, 0, 0)
        bpy.context.view_layer.update()
        sway = 0.38 if k % 2 == 0 else -0.38
        targets = {
            "upperarm_r": Vector((-0.62, -0.05, 0.55)).normalized(),
            "lowerarm_r": Vector((-0.12 + sway, -0.10, 1.0)).normalized(),
            "hand_r": Vector((-0.10 + sway * 1.2, -0.10, 1.0)).normalized(),
        }
        for b in bones:
            p = pb[b]
            m = p.matrix.copy()
            cur = m.to_3x3().col[1].normalized()
            q = cur.rotation_difference(targets[b])
            new = (q.to_matrix().to_4x4() @ Matrix.Translation(-m.translation)) @ m
            new.translation = m.translation
            p.matrix = new
            bpy.context.view_layer.update()
            p.keyframe_insert("rotation_quaternion", frame=fr)
    ad.action = None
    return wave

wave = make_wave()
chosen = {k: by_name[v] for k, v in CLIPS.items()}
chosen["wave"] = wave
for name, act in chosen.items():
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, int(act.frame_range[0]), act)
    try:
        st.action_slot = slot_of(act)
    except Exception:
        pass
    tr.mute = False
ad.action = None

for o in list(bpy.context.scene.objects):
    o.select_set(o == arm or o.parent == arm)
os.makedirs(OUT_DIR, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_skins=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_optimize_animation_size=True,
    export_force_sampling=True,
    export_frame_step=1,
    export_image_format="NONE",
)
print("EXPORTED", OUT, os.path.getsize(OUT))
print("CLIPS", {k: (v.name, tuple(v.frame_range)) for k, v in chosen.items()})
