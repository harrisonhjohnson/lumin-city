"""Build the swing-city kit of parts from the bible and export public/city/kit.glb + kit.json.
blender/bible.json is a copy of KIT/PALETTE/BUDGET from src/world/city/bible.js; refresh it with
  node -e "import('./src/world/city/bible.js').then(b=>require('fs').writeFileSync('blender/bible.json',JSON.stringify({KIT:b.KIT,PALETTE:b.PALETTE,BUDGET:b.BUDGET},null,1)))"
Run inside Blender (MCP or `blender -b --python blender/build_kit.py -- <repo>`).
Every part: one mesh, origin at the centre of its footprint on its base plane, colours
baked as vertex colours from the palette, triangle count checked against the budget."""
import bpy, bmesh, json, os, sys, math

REPO = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.environ.get('KIT_REPO', os.path.expanduser('~/site-work/harrison-build'))
BIBLE = json.load(open(os.path.join(REPO, 'blender', 'bible.json')))
KIT, PALETTE, BUDGET = BIBLE['KIT'], BIBLE['PALETTE'], BIBLE['BUDGET']

def rgb(name):
    # Palette values are sRGB; FLOAT_COLOR attributes are linear, so convert or the kit
    # renders washed out next to the palette-coloured boxes.
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    h = PALETTE[name]; return (lin((h >> 16 & 255) / 255), lin((h >> 8 & 255) / 255), lin((h & 255) / 255), 1)

class Part:
    """Accumulates coloured primitives into one bmesh. Coordinates: x right, y up, z toward
    the viewer, exactly as three.js sees them; converted to Blender's z-up on commit."""
    def __init__(self, name): self.name, self.bm, self.faces = name, bmesh.new(), []
    def _add(self, verts, faces, colour):
        vs = [self.bm.verts.new((x, -z, y)) for x, y, z in verts]
        for f in faces:
            face = self.bm.faces.new([vs[i] for i in f]); self.faces.append((face, colour))
    def box(self, cx, cy, cz, w, h, d, colour='trim'):
        x0, x1, y0, y1, z0, z1 = cx - w / 2, cx + w / 2, cy, cy + h, cz - d / 2, cz + d / 2
        v = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
        self._add(v, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], colour)
    def cylinder(self, cx, cy, cz, r0, r1, h, n=8, colour='trim', cap=True):
        ring = lambda r, y: [(cx + r * math.cos(2 * math.pi * i / n), y, cz + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
        v = ring(r0, cy) + ring(r1, cy + h)
        faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        if cap: faces += [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        self._add(v, faces, colour)
    def cone(self, cx, cy, cz, r, h, n=8, colour='trim'):
        v = [(cx + r * math.cos(2 * math.pi * i / n), cy, cz + r * math.sin(2 * math.pi * i / n)) for i in range(n)] + [(cx, cy + h, cz)]
        self._add(v, [(i, n, (i + 1) % n) for i in range(n)] + [tuple(range(n - 1, -1, -1))], colour)
    def wedge(self, cx, cy, cz, w, h, d, colour='trim'):
        # A pitched roof: ridge along x at the top.
        x0, x1, z0, z1 = cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2
        v = [(x0, cy, z0), (x1, cy, z0), (x1, cy, z1), (x0, cy, z1), (x0, cy + h, cz), (x1, cy + h, cz)]
        self._add(v, [(0, 3, 2, 1), (0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4)], colour)
    def commit(self):
        self.bm.faces.index_update()
        face_colour = {f.index: c for f, c in self.faces}
        me = bpy.data.meshes.new(self.name); self.bm.to_mesh(me); self.bm.free()
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = col; me.color_attributes.render_color_index = 0
        for poly in me.polygons:
            for li in poly.loop_indices: col.data[li].color = rgb(face_colour.get(poly.index, 'trim'))
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        me.calc_loop_triangles(); return ob, len(me.loop_triangles)

def build(name):
    p = Part(name); w, h, d = KIT[name]['size']
    if name == 'waterTower':
        for sx in (-1, 1):
            for sz in (-1, 1): p.box(sx * w * 0.32, 0, sz * d * 0.32, 0.22, h * 0.36, 0.22)
        p.box(0, h * 0.34, 0, w * 0.8, 0.18, d * 0.8)
        p.cylinder(0, h * 0.36, 0, w * 0.46, w * 0.5, h * 0.44, 10, 'facade1')
        p.cone(0, h * 0.8, 0, w * 0.54, h * 0.2, 10)
    elif name == 'roofTank':
        p.box(0, 0, 0, w * 0.9, 0.3, d * 0.9); p.cylinder(0, 0.3, 0, w * 0.48, w * 0.48, h - 0.5, 10, 'stone'); p.cylinder(0, h - 0.2, 0, w * 0.5, w * 0.5, 0.2, 10)
    elif name == 'hvacBox':
        p.box(0, 0, 0, w, h * 0.8, d, 'stone'); p.cylinder(0, h * 0.8, 0, w * 0.3, w * 0.3, h * 0.2, 8, 'trim', cap=True)
    elif name == 'stairBulkhead':
        p.box(0, 0, 0, w, h, d, 'stone'); p.box(0, 0, d / 2 + 0.03, 1.0, 2.1, 0.06)
    elif name == 'rooftopShack':
        p.box(0, 0, 0, w, h * 0.7, d, 'facade3'); p.wedge(0, h * 0.7, 0, w + 0.3, h * 0.3, d + 0.3)
    elif name == 'billboardFrame':
        for sx in (-0.35, 0.35): p.box(sx * w, 0, 0, 0.3, h * 0.45, 0.3)
        p.box(0, h * 0.4, 0, w, h * 0.6, 0.25, 'windowLit'); p.box(0, h * 0.4, 0, w, h * 0.6, 0.12); p.box(0, h * 0.36, d / 2, w, 0.1, d * 0.6)
    elif name == 'antenna':
        p.box(0, 0, 0, 0.6, 0.4, 0.6); p.cylinder(0, 0.4, 0, 0.1, 0.06, h - 0.4, 6)
        for i, y in enumerate((0.4, 0.6, 0.8)): p.box(0, h * y, 0, w * (1 - i * 0.25), 0.05, 0.05)
    elif name == 'chimney':
        p.box(0, 0, 0, w, h * 0.85, d, 'facade1'); p.box(0, h * 0.85, 0, w + 0.2, h * 0.15, d + 0.2)
    elif name == 'cornice':
        p.box(0, 0, 0, 1, h * 0.4, d * 0.6); p.box(0, h * 0.4, 0, 1, h * 0.6, d)
    elif name == 'parapet':
        p.box(0, 0, 0, 1, h, d, 'stone')
    elif name == 'fireEscape':
        p.box(0, 0, 0, w, 0.08, d, 'trim')
        for x in (-w / 2, w / 2): p.box(x, 0, 0, 0.05, 1.0, d)
        p.box(0, 0.95, -d / 2, w, 0.05, 0.05); p.box(0, 0, -d / 2 + 0.02, w, 1.0, 0.03)
        for i in range(8): p.box(-w * 0.25 + i * 0.3, 0.1 + i * 0.42, d * 0.15, 0.7, 0.05, 0.25)
    elif name == 'storefront':
        p.box(0, 0, 0, 1, h * 0.72, d * 0.5, 'window'); p.box(0, h * 0.72, 0, 1, h * 0.28, d, 'facade3')
    elif name == 'awning':
        p.wedge(0, 0, 0, w, h, d, 'cab'); p.box(0, -0.05, -d / 2, w, 0.05, 0.05)
    elif name == 'scaffolding':
        for x in (-w / 2, 0, w / 2):
            for z in (-d / 2, d / 2): p.cylinder(x, 0, z, 0.05, 0.05, h, 5, 'stone', cap=False)
        for lvl in (0.45, 0.95): p.box(0, h * lvl, 0, w, 0.06, d, 'facade3')
        p.box(0, h * 0.5, d / 2 + 0.05, w, 0.05, 0.05, 'stone')
    elif name == 'cab':
        p.box(0, 0.35, 0, w, 0.55, d, 'cab'); p.box(0, 0.9, -0.2, w * 0.9, 0.5, d * 0.5, 'window'); p.box(0, 1.4, -0.2, 0.7, 0.18, 0.3)
        for x in (-w / 2 + 0.1, w / 2 - 0.1):
            for z in (-d * 0.3, d * 0.3): p.cylinder(x - 0.1 if x < 0 else x + 0.1, 0.0, z, 0.3, 0.3, 0.2, 6)
    return p.commit()

for ob in [o for o in bpy.context.scene.objects if o.name in KIT]: bpy.data.objects.remove(ob, do_unlink=True)
for me in [m for m in bpy.data.meshes if m.users == 0]: bpy.data.meshes.remove(me)
report = {}
mat = bpy.data.materials.get('kit') or bpy.data.materials.new('kit'); mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF'); attr = mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.75
for i, name in enumerate(KIT):
    ob, tris = build(name); ob.data.materials.append(mat)
    ob.location.x = (i % 8) * 8; ob.location.y = -(i // 8) * 12   # laid out for viewing; reset on export
    report[name] = {'tris': tris, 'budget': BUDGET['trisPerPart'], 'size': KIT[name]['size']}
over = [n for n, r in report.items() if r['tris'] > r['budget']]
os.makedirs(os.path.join(REPO, 'public', 'city'), exist_ok=True)
for name in KIT: bpy.data.objects[name].location = (0, 0, 0)
bpy.ops.object.select_all(action='DESELECT')
for name in KIT: bpy.data.objects[name].select_set(True)
glb = os.path.join(REPO, 'public', 'city', 'kit.glb')
try: bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True, export_yup=True, export_vertex_color='ACTIVE', export_materials='EXPORT')
except TypeError: bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True, export_yup=True, export_materials='EXPORT')
json.dump({'parts': report, 'over': over, 'source': 'blender/build_kit.py'}, open(os.path.join(REPO, 'public', 'city', 'kit.json'), 'w'), indent=1)
for i, name in enumerate(KIT): bpy.data.objects[name].location = ((i % 8) * 8, -(i // 8) * 12, 0)
result = {'parts': {n: r['tris'] for n, r in report.items()}, 'over_budget': over}
