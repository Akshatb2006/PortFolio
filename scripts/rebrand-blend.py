"""
Rebrands the 3D world's Bruno-specific text by:
  1. Backing up the original .blend.
  2. Editing the standalone "BRUNO SIMON" FONT object → "AKSHAT BARANWAL".
  3. Replacing each careerText.* mesh (UZIK, HETIC, IMMERSIVE GARDEN, …) with
     new mesh data generated from a temporary FONT object using the same font
     (Neue Montreal Bold) the existing Text.003 already references.
  4. Saving as a new .blend (`folio-2025.akshat.blend`) — original untouched.
  5. Exporting the `areas` collection as a fresh `static/areas/areas.glb`.

Run with:
  blender --background resources/folio-2025.blend --python scripts/rebrand-blend.py

You can re-tune the AKSHAT_CAREER_TEXTS table below if any line looks wrong
in the resulting GLB and re-run.
"""

import bpy
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_SRC = os.path.join(ROOT, 'resources', 'folio-2025.blend')
BLEND_DST = os.path.join(ROOT, 'resources', 'folio-2025.akshat.blend')
GLB_DST   = os.path.join(ROOT, 'static', 'areas', 'areas.glb')

# Original career-sign company names → Akshat replacements, mapped per material
# slot since that's the stable identifier for each careerText.* mesh.
AKSHAT_CAREER_TEXTS = {
    'careerTextUzik':          'AUTOMETA',
    'careerTextImmersive':     'APARTMENTHUB',
    'careerTextOnlineTeacher': 'GSoC 2025',
    'careerTextFreelancer':    'FREELANCE',
    'careerTextIRLTeacher':    'SoB 2025',
    'careerTextHetic':         'POLARIS',
}

print(f"\n=== Rebrand step 1: backup original ===")
if not os.path.exists(BLEND_DST) or os.path.getmtime(BLEND_DST) < os.path.getmtime(BLEND_SRC):
    shutil.copy2(BLEND_SRC, BLEND_DST + '.bak')
    print(f"Wrote backup: {BLEND_DST}.bak")

print(f"\n=== Rebrand step 2: edit FONT 'BRUNO SIMON' ===")
font_obj = bpy.data.objects.get('Text.003')
if font_obj and font_obj.type == 'FONT' and font_obj.data.body == 'BRUNO SIMON':
    font_obj.data.body = 'AKSHAT BARANWAL'
    print(f"  Text.003.body → 'AKSHAT BARANWAL'")
else:
    print(f"  WARNING: Text.003 not found or already changed (body={font_obj.data.body if font_obj else 'N/A'!r})")

print(f"\n=== Rebrand step 3: replace careerText.* meshes ===")

# Bruno's blend referenced "Neue Montreal Bold" via a macOS Library path that
# isn't on this machine, so Blender falls back to Bfont and the new text would
# look obviously different from the rest of the world. Load Inter Bold (a
# similar grotesk sans) from resources/fonts/ as a substitute.
inter_path = os.path.join(ROOT, 'resources', 'fonts', 'Inter-Bold.ttf')
neue_font = None
if os.path.exists(inter_path):
    neue_font = bpy.data.fonts.load(inter_path, check_existing=True)
    print(f"  Loaded substitute font: {inter_path}")

    # Point every FONT object that referenced the missing "Neue Montreal Bold"
    # datablock at the Inter font we just loaded, so they render with a real
    # font during GLTF export instead of Bfont.
    for o in bpy.data.objects:
        if o.type == 'FONT' and o.data and o.data.font and o.data.font.name == 'Neue Montreal Bold':
            o.data.font = neue_font
            print(f"  Retargeted {o.name}.data.font → Inter-Bold.ttf")
else:
    neue_font = bpy.data.fonts.get('Neue Montreal Bold')
    print("  WARNING: Inter-Bold.ttf not found — using whatever Blender picks.")

# Find every careerText* mesh and replace its mesh-data with a freshly
# generated extruded text mesh. Keep object name, transform, and material slot
# untouched so the JS side keeps finding it.
career_meshes = [o for o in bpy.data.objects if o.name.startswith('careerText') and o.type == 'MESH']
print(f"  Found {len(career_meshes)} careerText meshes")

for mesh_obj in career_meshes:
    # Identify which company this mesh represents via its first material.
    mat_name = mesh_obj.material_slots[0].material.name if mesh_obj.material_slots and mesh_obj.material_slots[0].material else None
    new_text = AKSHAT_CAREER_TEXTS.get(mat_name)
    if new_text is None:
        print(f"  SKIP {mesh_obj.name}: no mapping for material {mat_name}")
        continue

    # Estimate font size to roughly match the original mesh's local Y dimension
    # (which is text height before rotation). Bevel/extrude kept at 0 to match
    # the original flat-mesh look.
    target_height = 0.6  # local-space height; matches the ~0.59 dim.y observed
    font_size = target_height / 0.64  # 0.64 ≈ Neue Montreal Bold cap-height ratio

    # Create a temporary FONT object, set its text, convert to mesh, then steal
    # its mesh-data into the existing mesh object. Preserve the original mesh
    # data's material list — Blender's GLTF exporter pulls materials from
    # `mesh.materials`, so we have to copy them onto the new mesh data.
    tmp_curve = bpy.data.curves.new(name=f"tmp_{mesh_obj.name}", type='FONT')
    tmp_curve.body = new_text
    tmp_curve.font = neue_font if neue_font else tmp_curve.font
    tmp_curve.size = font_size
    tmp_curve.align_x = 'CENTER'
    tmp_curve.align_y = 'CENTER'
    tmp_curve.extrude = 0.0
    tmp_obj = bpy.data.objects.new(name=f"tmp_{mesh_obj.name}", object_data=tmp_curve)
    bpy.context.collection.objects.link(tmp_obj)

    # Convert curve → mesh.
    bpy.ops.object.select_all(action='DESELECT')
    tmp_obj.select_set(True)
    bpy.context.view_layer.objects.active = tmp_obj
    bpy.ops.object.convert(target='MESH')

    # Snapshot the materials list from the old mesh data BEFORE we drop it.
    old_data = mesh_obj.data
    saved_materials = [m for m in old_data.materials]

    mesh_obj.data = tmp_obj.data
    mesh_obj.data.name = old_data.name

    # Re-attach the original materials in the same slot order. Slot indices on
    # the mesh primitives stay valid because the new mesh has just one primitive
    # which will use slot 0.
    for mat in saved_materials:
        mesh_obj.data.materials.append(mat)

    # Make every mesh-data face point at slot 0 so the glTF primitive picks up
    # the material we just attached.
    if saved_materials:
        for poly in mesh_obj.data.polygons:
            poly.material_index = 0

    # Clean up the temporary object and orphaned mesh.
    bpy.data.objects.remove(tmp_obj, do_unlink=True)
    if old_data.users == 0:
        bpy.data.meshes.remove(old_data)

    print(f"  {mesh_obj.name} ({mat_name}) → {new_text!r}")

print(f"\n=== Rebrand step 4: save modified .blend ===")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_DST)
print(f"Saved: {BLEND_DST}")

print(f"\n=== Rebrand step 5: export areas.glb ===")
# Find the layer-collection corresponding to `areas` and make it active so that
# `use_active_collection=True` exports its (nested) contents. The original
# folio-2025 stores all area geometry inside the `areas` collection's nested
# children (landing, career, projects, lab, …) — using `use_active_collection_with_nested`
# pulls all of them in.
def find_layer_coll(layer_coll, target_name):
    if layer_coll.collection.name == target_name:
        return layer_coll
    for child in layer_coll.children:
        hit = find_layer_coll(child, target_name)
        if hit:
            return hit
    return None

areas_layer_coll = find_layer_coll(bpy.context.view_layer.layer_collection, 'areas')
if areas_layer_coll is None:
    print("  WARNING: 'areas' layer collection not found, skipping GLB export")
else:
    bpy.context.view_layer.active_layer_collection = areas_layer_coll
    bpy.ops.export_scene.gltf(
        filepath=GLB_DST,
        export_format='GLB',
        use_active_collection=True,
        use_active_collection_with_nested=True,
        use_active_scene=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
    )
    print(f"Wrote: {GLB_DST}")

print("\nDone.")
