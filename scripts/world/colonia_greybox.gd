extends Node3D
## Colonia greybox 200x200 m: cuadrícula 4x4 de manzanas, calles de 8 m,
## banquetas de 15 cm, edificios como cajas de alturas variadas, 6 locales
## marcados con color, un pozo en una esquina, topes y baches.
## Todo generado por código con cajas simples — cero arte.

const MAP_SIZE := 200.0
const STREET_WIDTH := 8.0
const SIDEWALK_HEIGHT := 0.15
const SIDEWALK_WIDTH := 2.0
const BLOCKS := 4

## Tamaño de cada manzana (incluyendo banqueta): (200 - 5 calles de 8) / 4 = 40.
const BLOCK_SIZE := (MAP_SIZE - STREET_WIDTH * (BLOCKS + 1)) / BLOCKS

var _rng := RandomNumberGenerator.new()

var _mat_ground: StandardMaterial3D
var _mat_sidewalk: StandardMaterial3D
var _mat_building: StandardMaterial3D
var _mat_local: StandardMaterial3D
var _mat_pozo: StandardMaterial3D
var _mat_tope: StandardMaterial3D

var _local_spots: Array[Vector3] = []


func _ready() -> void:
	_rng.seed = 12345  # determinista: el mapa es igual en cada corrida
	_make_materials()
	_build_ground()
	_build_blocks()
	_build_locales()
	_build_pozo()
	_build_topes()


func _make_materials() -> void:
	_mat_ground = _flat_material(Color(0.35, 0.35, 0.37))
	_mat_sidewalk = _flat_material(Color(0.55, 0.55, 0.55))
	_mat_building = _flat_material(Color(0.45, 0.45, 0.48))
	_mat_local = _flat_material(Color(0.85, 0.55, 0.2))
	_mat_pozo = _flat_material(Color(0.25, 0.5, 0.85))
	_mat_tope = _flat_material(Color(0.75, 0.72, 0.3))


func _flat_material(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 1.0
	return mat


func _build_ground() -> void:
	# Piso completo (calles) como una sola caja.
	_add_box(self, Vector3(0, -0.25, 0), Vector3(MAP_SIZE, 0.5, MAP_SIZE), _mat_ground, "Ground")


func _build_blocks() -> void:
	for bx in BLOCKS:
		for bz in BLOCKS:
			var center := _block_center(bx, bz)
			_build_block(center, bx * BLOCKS + bz)


func _block_center(bx: int, bz: int) -> Vector3:
	var origin := -MAP_SIZE * 0.5 + STREET_WIDTH + BLOCK_SIZE * 0.5
	var step := BLOCK_SIZE + STREET_WIDTH
	return Vector3(origin + bx * step, 0.0, origin + bz * step)


func _build_block(center: Vector3, index: int) -> void:
	var block := Node3D.new()
	block.name = "Block_%d" % index
	add_child(block)

	# Banqueta: plataforma de 15 cm que ocupa toda la manzana.
	_add_box(block, center + Vector3(0, SIDEWALK_HEIGHT * 0.5, 0),
		Vector3(BLOCK_SIZE, SIDEWALK_HEIGHT, BLOCK_SIZE), _mat_sidewalk, "Sidewalk")

	# Edificios: cuadrícula de 3x3 dentro de la manzana, dejando la banqueta libre.
	var inner := BLOCK_SIZE - SIDEWALK_WIDTH * 2.0
	var cell := inner / 3.0
	for gx in 3:
		for gz in 3:
			# Deja algunos huecos para que no sea una pared sólida.
			if _rng.randf() < 0.2:
				continue
			var h := _rng.randf_range(3.0, 12.0)
			var w := cell * _rng.randf_range(0.7, 0.95)
			var d := cell * _rng.randf_range(0.7, 0.95)
			var px := center.x - inner * 0.5 + cell * (gx + 0.5)
			var pz := center.z - inner * 0.5 + cell * (gz + 0.5)
			_add_box(block, Vector3(px, SIDEWALK_HEIGHT + h * 0.5, pz),
				Vector3(w, h, d), _mat_building, "Building")

	# Guarda el frente de la manzana como posible sitio de local.
	_local_spots.append(center + Vector3(0, 0, BLOCK_SIZE * 0.5 + 1.5))


func _build_locales() -> void:
	# 6 locales repartidos en distintas manzanas, marcados con color distinto.
	var indices := [0, 3, 5, 8, 10, 15]
	for i in 6:
		var spot: Vector3 = _local_spots[indices[i] % _local_spots.size()]
		var local := Node3D.new()
		local.name = "Local_%d" % (i + 1)
		add_child(local)
		local.global_position = spot

		_add_box(local, Vector3(0, 1.5, -2.5), Vector3(6, 3, 3), _mat_local, "LocalBuilding")

		var area := Interactable.new()
		area.name = "InteractArea"
		area.prompt_text = "Ofrecer servicio"
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(7, 3, 5)
		shape.shape = box
		area.add_child(shape)
		area.position = Vector3(0, 1.5, 0)
		local.add_child(area)


func _build_pozo() -> void:
	# Pozo / toma de agua en una esquina del mapa.
	var pos := Vector3(-MAP_SIZE * 0.5 + 12.0, 0.0, -MAP_SIZE * 0.5 + 12.0)
	var pozo := Node3D.new()
	pozo.name = "Pozo"
	add_child(pozo)
	pozo.global_position = pos

	_add_box(pozo, Vector3(0, 1.0, 0), Vector3(3, 2, 3), _mat_pozo, "PozoBody")
	_add_box(pozo, Vector3(0, 3.0, 0), Vector3(0.5, 2.5, 0.5), _mat_pozo, "PozoTower")

	var area := Interactable.new()
	area.name = "InteractArea"
	area.prompt_text = "Cargar agua"
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(8, 3, 8)
	shape.shape = box
	area.add_child(shape)
	area.position = Vector3(0, 1.5, 0)
	pozo.add_child(area)


func _build_topes() -> void:
	# Topes en algunas calles: cajas bajas y anchas que sacuden el tanque.
	var step := BLOCK_SIZE + STREET_WIDTH
	var origin := -MAP_SIZE * 0.5 + STREET_WIDTH * 0.5
	for i in 5:
		var street_idx := _rng.randi_range(1, BLOCKS - 1)
		var along := _rng.randf_range(-MAP_SIZE * 0.4, MAP_SIZE * 0.4)
		var x := origin + street_idx * step
		if i % 2 == 0:
			_add_box(self, Vector3(x, 0.06, along), Vector3(STREET_WIDTH, 0.12, 0.9), _mat_tope, "Tope")
		else:
			_add_box(self, Vector3(along, 0.06, x), Vector3(0.9, 0.12, STREET_WIDTH), _mat_tope, "Tope")


## Caja con malla + colisión, todo primitivas.
func _add_box(parent: Node, pos: Vector3, size: Vector3, mat: StandardMaterial3D, name_prefix: String) -> void:
	var body := StaticBody3D.new()
	body.name = "%s_%d" % [name_prefix, parent.get_child_count()]

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = mat
	body.add_child(mesh_instance)

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)

	parent.add_child(body)
	body.position = pos
