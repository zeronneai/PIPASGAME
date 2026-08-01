extends Node3D
## Colonia greybox 200x200 m: cuadrícula 4x4 de manzanas de 40 m con calles
## de 8 m, banquetas de 15 cm, edificios como cajas, 6 locales de colores,
## un pozo de agua en una esquina, topes, baches y postes con MultiMesh.
## Todo generado por código con semilla fija para que sea reproducible.

const PITCH := 48.0          # manzana 40 + calle 8
const BLOCK := 40.0
const MAP_HALF := 100.0

var _rng := RandomNumberGenerator.new()
var _mat_cache := {}

@export var locale_blocks: Array[Vector2i] = [
	Vector2i(0, 1), Vector2i(1, 3), Vector2i(2, 0),
	Vector2i(2, 2), Vector2i(3, 1), Vector2i(1, 0),
]

const LOCALE_COLORS := [
	Color(0.85, 0.25, 0.2), Color(0.2, 0.7, 0.3), Color(0.9, 0.8, 0.2),
	Color(0.2, 0.7, 0.8), Color(0.8, 0.3, 0.8), Color(0.95, 0.55, 0.15),
]


func _ready() -> void:
	_rng.seed = 7
	_build_ground()
	_build_blocks()
	_build_pozo()
	_build_topes_y_baches()
	_build_postes()


func _mat(color: Color) -> StandardMaterial3D:
	if not _mat_cache.has(color):
		var m := StandardMaterial3D.new()
		m.albedo_color = color
		_mat_cache[color] = m
	return _mat_cache[color]


func _make_box(pos: Vector3, box_size: Vector3, color: Color, collide := true) -> void:
	var mesh := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = box_size
	bm.material = _mat(color)
	mesh.mesh = bm
	mesh.position = pos
	add_child(mesh)
	if collide:
		var body := StaticBody3D.new()
		body.collision_layer = 1
		body.collision_mask = 0
		var cs := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = box_size
		cs.shape = shape
		body.add_child(cs)
		mesh.add_child(body)


func _block_center(i: int, j: int) -> Vector3:
	return Vector3(-MAP_HALF + 8.0 + BLOCK * 0.5 + PITCH * i, 0.0,
			-MAP_HALF + 8.0 + BLOCK * 0.5 + PITCH * j)


func _build_ground() -> void:
	# El piso base es la calle (asfalto gris oscuro).
	_make_box(Vector3(0, -0.2, 0), Vector3(2.0 * MAP_HALF, 0.4, 2.0 * MAP_HALF),
			Color(0.25, 0.25, 0.27))


func _build_blocks() -> void:
	var locale_idx := 0
	for i in 4:
		for j in 4:
			var c := _block_center(i, j)
			# Banqueta: losa de 15 cm que cubre toda la manzana.
			_make_box(c + Vector3(0, 0.075, 0), Vector3(BLOCK, 0.15, BLOCK),
					Color(0.55, 0.55, 0.57))
			var has_locale := Vector2i(i, j) in locale_blocks
			if has_locale:
				_build_locale(c, locale_idx)
				locale_idx += 1
			_build_buildings(c, has_locale)


func _build_buildings(c: Vector3, skip_south: bool) -> void:
	# Edificios de fondo alrededor del perímetro de la manzana, alturas variadas.
	var sides := [Vector3(0, 0, -1), Vector3(0, 0, 1), Vector3(-1, 0, 0), Vector3(1, 0, 0)]
	for s in sides:
		if skip_south and s.z > 0.5:
			continue  # el frente de la manzana con local queda libre
		var count := _rng.randi_range(2, 3)
		for k in count:
			var w := _rng.randf_range(8.0, 13.0)
			var d := _rng.randf_range(6.0, 10.0)
			var h := _rng.randf_range(4.0, 12.0)
			var along := (float(k) + 0.5) / float(count) - 0.5
			var pos: Vector3
			if absf(s.z) > 0.5:
				pos = c + Vector3(along * (BLOCK - 12.0), 0, s.z * (BLOCK * 0.5 - d * 0.5 - 2.0))
			else:
				pos = c + Vector3(s.x * (BLOCK * 0.5 - d * 0.5 - 2.0), 0, along * (BLOCK - 12.0))
				var tmp := w
				w = d
				d = tmp
			var gray := _rng.randf_range(0.38, 0.5)
			_make_box(pos + Vector3(0, 0.15 + h * 0.5, 0), Vector3(w, h, d),
					Color(gray, gray, gray + 0.02))


func _build_locale(c: Vector3, idx: int) -> void:
	# Local: caja de color distinto al frente (lado sur) de la manzana.
	var color: Color = LOCALE_COLORS[idx % LOCALE_COLORS.size()]
	var pos := c + Vector3(0, 0.15 + 2.0, BLOCK * 0.5 - 4.0)
	_make_box(pos, Vector3(8.0, 4.0, 6.0), color)
	var area := Interactable.new()
	area.name = "Local%d" % idx
	area.prompt = "Ofrecer servicio"
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(8.0, 3.0, 5.0)
	cs.shape = shape
	area.add_child(cs)
	area.position = c + Vector3(0, 1.5, BLOCK * 0.5 + 1.5)
	add_child(area)


func _build_pozo() -> void:
	# Toma de agua en la esquina suroeste: rellena el tanque de la pipa.
	var pos := _block_center(0, 0) + Vector3(-BLOCK * 0.5 + 4.0, 0.15, -BLOCK * 0.5 + 4.0)
	_make_box(pos + Vector3(0, 0.6, 0), Vector3(3.0, 1.2, 3.0), Color(0.15, 0.35, 0.75))
	_make_box(pos + Vector3(0, 2.4, 0), Vector3(0.4, 2.4, 0.4), Color(0.15, 0.35, 0.75))
	var area := Interactable.new()
	area.name = "Pozo"
	area.prompt = "Cargar agua"
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(7.0, 3.0, 7.0)
	cs.shape = shape
	area.add_child(cs)
	area.position = pos + Vector3(0, 1.5, 0)
	add_child(area)
	area.interacted.connect(func():
		GameState.set_tank_fill(1.0)
		print("Tanque lleno"))


func _build_topes_y_baches() -> void:
	var tope_color := Color(0.6, 0.55, 0.3)
	# Topes cruzando las calles verticales (norte-sur) y horizontales.
	for k in 3:
		var street_x := -MAP_HALF + 4.0 + PITCH * (k + 1)
		var z := _rng.randf_range(-70.0, 70.0)
		_make_box(Vector3(street_x, 0.07, z), Vector3(8.0, 0.14, 0.9), tope_color)
	for k in 3:
		var street_z := -MAP_HALF + 4.0 + PITCH * k
		var x := _rng.randf_range(-70.0, 70.0)
		_make_box(Vector3(x, 0.07, street_z), Vector3(0.9, 0.14, 8.0), tope_color)
	# Baches: parches bajitos regados en las calles.
	for k in 12:
		var street := _rng.randi_range(0, 4)
		var coord := -MAP_HALF + 4.0 + PITCH * street
		var other := _rng.randf_range(-90.0, 90.0)
		var pos := Vector3(coord, 0.03, other) if _rng.randf() < 0.5 \
				else Vector3(other, 0.03, coord)
		_make_box(pos, Vector3(_rng.randf_range(0.8, 1.6), 0.06, _rng.randf_range(0.8, 1.6)),
				Color(0.18, 0.18, 0.19))


func _build_postes() -> void:
	# Postes repetidos con un solo draw call (MultiMesh), sin colisión.
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var bm := BoxMesh.new()
	bm.size = Vector3(0.16, 4.5, 0.16)
	bm.material = _mat(Color(0.3, 0.3, 0.32))
	mm.mesh = bm
	var transforms: Array[Transform3D] = []
	for i in 4:
		for j in 4:
			var c := _block_center(i, j)
			for k in 4:
				var along := -BLOCK * 0.5 + 5.0 + k * 10.0
				transforms.append(Transform3D(Basis.IDENTITY,
						c + Vector3(along, 0.15 + 2.25, -BLOCK * 0.5 + 0.6)))
				transforms.append(Transform3D(Basis.IDENTITY,
						c + Vector3(-BLOCK * 0.5 + 0.6, 0.15 + 2.25, along)))
	mm.instance_count = transforms.size()
	for t in transforms.size():
		mm.set_instance_transform(t, transforms[t])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	add_child(mmi)
