# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Gera os modelos 3D do Earthset em GLB, a partir de geometria procedural no Blender.

Autoria: geometria escrita neste script (formas arredondadas por biséis, curvas e esferas),
materiais na paleta de docs/VISUAL_DIRECTION.md. Nenhuma imagem ou modelo de IA, nenhum
ativo de terceiros.

Convenção: unidades em metros. Escala no Blender = tamanho total (cubo de tamanho 1 com escala 2 mede 2 m; cilindro de profundidade 1 com escala r, h mede raio r e comprimento h). Z é a altura no Blender; o exportador glTF converte para Y-up
(three.js). Origem de cada modelo = origem do grupo que o recebe em src/render/scene.ts:
  habitat      centro do casco (eixo X)            -> grupo em (0, 2.2, 0)
  greenhouse   nível do chão, centro da cúpula     -> grupo em (-5.5, 0, 3)
  solar_panel  nível do chão, pé do suporte        -> grupo de cada unidade
  rover        nível do chão, centro do chassi     -> grupo do robô
  antenna      nível do chão, pé do mastro         -> grupo em (1.2, 4.4, 0)

Uso:
  blender --background --factory-startup --python assets-src/blender/build_assets.py -- public/models
"""

import math
import os
import sys

import bmesh
import bpy

OUT_DIR = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "public/models"

# Paleta (docs/VISUAL_DIRECTION.md)
HABITAT_WHITE = "#E8E5DA"
LIFE_TEAL = "#56B9A4"
SOLAR_AMBER = "#F3A847"
WATER_BLUE = "#6D9FE8"
GROWTH_GREEN = "#83B96C"
LUNAR_GRAY = "#78818B"
HATCH_DARK = "#2A2C33"
PANEL_BLUE = "#2F5E8E"


def hex_rgb(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


_MATS: dict = {}


def material(name: str, color: str, metallic: float = 0.0, rough: float = 0.5,
             alpha: float = 1.0, emission: str | None = None, emission_strength: float = 0.0):
    key = (name, color, metallic, rough, alpha, emission, emission_strength)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_rgb(color)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    p.inputs["Alpha"].default_value = alpha
    if emission:
        p.inputs["Emission Color"].default_value = hex_rgb(emission)
        p.inputs["Emission Strength"].default_value = emission_strength
    _MATS[key] = m
    return m


def bevel(obj, width: float = 0.04, segments: int = 2) -> None:
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"


def paint(obj, mat) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def add(kind: str, name: str, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1, depth=1, location=location)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=location)
    else:
        raise ValueError(kind)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rotation
    o.scale = scale
    return o


def half_dome(radius: float, name: str, location=(0, 0, 0), upper: bool = True):
    o = add("sphere", name, location)
    o.scale = (radius, radius, radius)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    drop = [v for v in bm.verts if (v.co.z < -1e-4 if upper else v.co.z > 1e-4)]
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return o


def arc_tube(points, radius: float, name: str):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for i, (x, y, z) in enumerate(points):
        sp.points[i].co = (x, y, z, 1.0)
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.active_object


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


def export(objects, filename: str) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print("EXPORTED", path, os.path.getsize(path))


# ---------- Habitat: casco arredondado com faixa de cor, tampas, escotilha e janelas ----------
def build_habitat() -> None:
    clear_scene()
    white = material("habitat_white", HABITAT_WHITE, metallic=0.2, rough=0.45)
    teal = material("habitat_teal", LIFE_TEAL, rough=0.35)
    dark = material("hatch_dark", HATCH_DARK, rough=0.6)
    glass = material("window_glow", WATER_BLUE, rough=0.2, emission=WATER_BLUE, emission_strength=2.0)

    hull = add("cylinder", "habitat_hull", rotation=(0, math.radians(90), 0), scale=(2.2, 2.2, 6.0))
    bpy.ops.object.transform_apply(scale=True)
    bevel(hull, 0.15, 3)
    paint(hull, white)
    parts = [hull]

    for x, label in ((-3.02, "cap_neg"), (3.02, "cap_pos")):
        cap = add("cylinder", label, location=(x, 0, 0), rotation=(0, math.radians(90), 0), scale=(2.25, 2.25, 0.06))
        bpy.ops.object.transform_apply(scale=True)
        bevel(cap, 0.02, 2)
        paint(cap, teal)
        parts.append(cap)

    band = add("cylinder", "habitat_band", rotation=(0, math.radians(90), 0), scale=(2.23, 2.23, 0.3))
    bpy.ops.object.transform_apply(scale=True)
    paint(band, teal)
    parts.append(band)

    # Escotilha: na frente (eixo -Y do Blender = +Z do three.js), na altura do centro.
    hatch = add("cube", "hatch", location=(0, -2.25, -0.6), scale=(1.2, 0.3, 1.6))
    bpy.ops.object.transform_apply(scale=True)
    bevel(hatch, 0.05, 2)
    paint(hatch, dark)
    parts.append(hatch)

    for i, x in enumerate((-1.6, 0.0, 1.6)):
        win = add("cube", f"window_{i}", location=(x, -2.22, 0.9), scale=(0.9, 0.04, 0.56))
        bpy.ops.object.transform_apply(scale=True)
        paint(win, glass)
        parts.append(win)

    export(parts, "habitat.glb")


# ---------- Rover: chassi arredondado, rodas que giram, mastro com câmera e farol ----------
def build_rover() -> None:
    clear_scene()
    body_mat = material("rover_amber", SOLAR_AMBER, metallic=0.1, rough=0.4)
    dark = material("rover_track", HATCH_DARK, rough=0.85)
    mast_mat = material("rover_mast", HABITAT_WHITE, metallic=0.4, rough=0.4)
    beacon = material("rover_beacon", WATER_BLUE, rough=0.2, emission=WATER_BLUE, emission_strength=3.0)
    lens = material("rover_lens", LUNAR_GRAY, metallic=0.6, rough=0.2)
    parts = []

    chassis = add("cube", "chassis", location=(0, 0, 0.35), scale=(0.9, 0.8, 0.4))
    bpy.ops.object.transform_apply(scale=True)
    bevel(chassis, 0.09, 3)
    paint(chassis, body_mat)
    parts.append(chassis)

    # Rodas: três por lado, eixo ao longo de Y do Blender (Z do three.js). Nome começa com "wheel" para animar.
    for side, by in (("L", 0.5), ("R", -0.5)):
        for i, bx in enumerate((-0.35, 0.0, 0.35)):
            wheel = add("cylinder", f"wheel_{side}{i}", location=(bx, by, 0.11),
                        rotation=(math.radians(90), 0, 0), scale=(0.11, 0.11, 0.18))
            bpy.ops.object.transform_apply(scale=True)
            bevel(wheel, 0.02, 2)
            paint(wheel, dark)
            parts.append(wheel)

    mast = add("cylinder", "mast", location=(0.3, 0, 1.05), scale=(0.03, 0.03, 0.5))
    bpy.ops.object.transform_apply(scale=True)
    paint(mast, mast_mat)
    parts.append(mast)

    cam = add("cube", "camera_head", location=(0.3, 0, 1.3), scale=(0.32, 0.24, 0.24))
    bpy.ops.object.transform_apply(scale=True)
    bevel(cam, 0.03, 2)
    paint(cam, mast_mat)
    parts.append(cam)

    eye = add("cylinder", "camera_lens", location=(0.3, -0.13, 1.3), rotation=(math.radians(90), 0, 0),
              scale=(0.05, 0.05, 0.03))
    bpy.ops.object.transform_apply(scale=True)
    paint(eye, lens)
    parts.append(eye)

    light = add("sphere", "beacon", location=(0.3, 0, 1.6), scale=(0.08, 0.08, 0.08))
    bpy.ops.object.transform_apply(scale=True)
    paint(light, beacon)
    parts.append(light)

    export(parts, "rover.glb")


# ---------- Painel solar: suporte e painel inclinado ----------
def build_solar_panel() -> None:
    clear_scene()
    post_mat = material("panel_post", HABITAT_WHITE, metallic=0.4, rough=0.4)
    cell = material("panel_cell", PANEL_BLUE, metallic=0.5, rough=0.2)
    parts = []

    post = add("cylinder", "post", location=(0, 0, 0.6), scale=(0.05, 0.05, 1.2))
    bpy.ops.object.transform_apply(scale=True)
    paint(post, post_mat)
    parts.append(post)

    panel = add("cube", "panel", location=(0, 0, 1.2), rotation=(math.radians(-26), 0, 0),
                scale=(1.6, 1.1, 0.08))
    bpy.ops.object.transform_apply(scale=True)
    bevel(panel, 0.015, 1)
    paint(panel, cell)
    parts.append(panel)

    export(parts, "solar_panel.glb")


# ---------- Estufa: cúpula translúcida com nervuras ----------
def build_greenhouse() -> None:
    clear_scene()
    glass = material("greenhouse_glass", GROWTH_GREEN, rough=0.1, alpha=0.35)
    rib_mat = material("greenhouse_rib", HABITAT_WHITE, metallic=0.4, rough=0.4)
    parts = []

    dome = half_dome(2.4, "dome", upper=True)
    paint(dome, glass)
    parts.append(dome)

    radius = 2.4
    for i in range(3):
        phi = math.radians(60 * i)
        pts = []
        for k in range(0, 33):
            t = math.pi * k / 32
            pts.append((radius * math.cos(t) * math.cos(phi), radius * math.cos(t) * math.sin(phi),
                        radius * math.sin(t)))
        rib = arc_tube(pts, 0.05, f"rib_{i}")
        paint(rib, rib_mat)
        parts.append(rib)

    export(parts, "greenhouse.glb")


# ---------- Antena: mastro e prato parabólico ----------
def build_antenna() -> None:
    clear_scene()
    mast_mat = material("antenna_mast", HABITAT_WHITE, metallic=0.4, rough=0.4)
    dish_mat = material("antenna_dish", "#E8ECF2", metallic=0.3, rough=0.35)
    parts = []

    mast = add("cylinder", "antenna_mast", location=(0, 0, 0.9), scale=(0.06, 0.06, 1.8))
    bpy.ops.object.transform_apply(scale=True)
    paint(mast, mast_mat)
    parts.append(mast)

    dish = half_dome(0.7, "antenna_dish", upper=True)
    dish.location = (0, 0, 1.8)
    bpy.ops.object.transform_apply(location=True)
    dish.rotation_euler = (math.radians(-35), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    paint(dish, dish_mat)
    parts.append(dish)

    export(parts, "antenna.glb")


# ---------- Astronauta genérico: corpo, capacete com viseira, mochila e membros articulados ----------
def limb(name: str, joint: tuple, length: float, radius: float, mat):
    """Membro com a origem no ponto de articulação (topo); a geometria desce `length` metros."""
    import mathutils

    o = add("cylinder", name, location=joint, scale=(radius, radius, length))
    bpy.ops.object.transform_apply(scale=True)
    o.data.transform(mathutils.Matrix.Translation((0, 0, -length / 2)))
    o.location = joint
    bevel(o, radius * 0.4, 2)
    paint(o, mat)
    return o


def build_astronaut() -> None:
    clear_scene()
    suit = material("suit_white", HABITAT_WHITE, metallic=0.05, rough=0.6)
    accent = material("suit_accent", SOLAR_AMBER, rough=0.5)
    visor = material("visor_glass", LIFE_TEAL, metallic=0.3, rough=0.08)
    pack = material("backpack", LUNAR_GRAY, rough=0.7)
    parts = []

    torso = add("cylinder", "torso", location=(0, 0, 1.12), scale=(0.2, 0.2, 0.55))
    bpy.ops.object.transform_apply(scale=True)
    bevel(torso, 0.07, 3)
    paint(torso, suit)
    parts.append(torso)

    chest = add("cube", "chest_stripe", location=(0, -0.19, 1.2), scale=(0.2, 0.03, 0.06))
    bpy.ops.object.transform_apply(scale=True)
    paint(chest, accent)
    parts.append(chest)

    helmet = add("sphere", "helmet", location=(0, 0, 1.58), scale=(0.19, 0.19, 0.19))
    bpy.ops.object.transform_apply(scale=True)
    paint(helmet, suit)
    parts.append(helmet)

    vis = add("sphere", "visor", location=(0, -0.13, 1.6), scale=(0.14, 0.09, 0.11))
    bpy.ops.object.transform_apply(scale=True)
    paint(vis, visor)
    parts.append(vis)

    bag = add("cube", "backpack", location=(0, 0.2, 1.15), scale=(0.3, 0.12, 0.42))
    bpy.ops.object.transform_apply(scale=True)
    bevel(bag, 0.04, 2)
    paint(bag, pack)
    parts.append(bag)

    # Membros: origem na articulação, para o balanço da caminhada girar em torno do ombro/quadril.
    parts.append(limb("arm_L", (0.25, 0, 1.36), 0.55, 0.06, suit))
    parts.append(limb("arm_R", (-0.25, 0, 1.36), 0.55, 0.06, suit))
    parts.append(limb("leg_L", (0.1, 0, 0.8), 0.8, 0.08, suit))
    parts.append(limb("leg_R", (-0.1, 0, 0.8), 0.8, 0.08, suit))

    export(parts, "astronaut.glb")


if __name__ == "__main__":
    build_habitat()
    build_rover()
    build_solar_panel()
    build_greenhouse()
    build_antenna()
    build_astronaut()
