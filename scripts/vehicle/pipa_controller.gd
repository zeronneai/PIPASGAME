class_name PipaController
extends VehicleBody3D
## La pipa: camión cisterna pesado. Aceleración lenta, frenado largo,
## radio de giro amplio. Debe sentirse pesada, no como un carro deportivo.

@export_group("Motor")
## Fuerza en N: ~12,000 kg cargada → aceleración máxima ~2 m/s².
@export var max_engine_force := 26000.0
@export var max_reverse_force := 14000.0
## Ojo: el freno de VehicleBody3D no está en Newtons; valores chicos frenan mucho.
@export var max_brake_force := 400.0
## Freno ligero permanente cuando sueltas todo (resistencia al rodado).
@export var rolling_brake := 4.0
@export var parking_brake := 80.0
@export var top_speed_kmh := 62.0
@export var max_reverse_kmh := 12.0

@export_group("Dirección")
@export var max_steer_deg := 28.0
## Qué tan rápido responde el volante (lerp por segundo).
@export var steer_speed := 3.5
## Cuánto se reduce la dirección a velocidad tope (0..1).
@export_range(0.0, 1.0) var steer_reduction_at_speed := 0.75

# Entradas que el HUD empuja cada frame (0..1, steer -1..1).
var throttle_input := 0.0
var brake_input := 0.0
var steer_input := 0.0
var controls_enabled := false


func _ready() -> void:
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, 0.6, 0.2)
	if GameState.has_pipa_transform:
		global_transform = GameState.pipa_transform
	if has_node("DoorArea"):
		$DoorArea.interacted.connect(GameState.enter_vehicle)
	for wheel in get_children():
		if wheel is VehicleWheel3D:
			_add_wheel_mesh(wheel)


func _add_wheel_mesh(wheel: VehicleWheel3D) -> void:
	var mesh := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = wheel.wheel_radius
	cyl.bottom_radius = wheel.wheel_radius
	cyl.height = 0.45
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.12, 0.12, 0.12)
	cyl.material = m
	mesh.mesh = cyl
	mesh.rotate_z(PI / 2.0)
	wheel.add_child(mesh)


func speed_kmh() -> float:
	return linear_velocity.length() * 3.6


func forward_speed() -> float:
	return -global_basis.z.dot(linear_velocity)


func can_exit() -> bool:
	return linear_velocity.length() < 0.5


func set_controls_enabled(v: bool) -> void:
	controls_enabled = v
	throttle_input = 0.0
	brake_input = 0.0
	steer_input = 0.0


func get_exit_transform() -> Transform3D:
	# A un lado de la puerta (lado izquierdo de la cabina), viendo hacia afuera.
	var side := -global_basis.x
	var pos := global_position + side * 2.8 - global_basis.z * 2.4
	pos.y = maxf(global_position.y - 0.9, 0.05)
	var t := Transform3D(Basis(Vector3.UP, atan2(-side.x, -side.z) + PI), pos)
	return t


func _physics_process(delta: float) -> void:
	var t := throttle_input
	var b := brake_input
	var s := steer_input

	if controls_enabled:
		t = maxf(t, Input.get_action_strength("move_forward"))
		b = maxf(b, Input.get_action_strength("move_back"))
		s = clampf(s + Input.get_action_strength("move_right")
				- Input.get_action_strength("move_left"), -1.0, 1.0)
		# Guardar dónde quedó: la posición vive en GameState, no en la escena.
		GameState.save_pipa_transform()
	else:
		engine_force = 0.0
		brake = parking_brake
		steering = 0.0
		return

	var kmh := speed_kmh()
	var fwd := forward_speed()

	# Dirección: más lenta y más limitada mientras más rápido vas.
	var limit := deg_to_rad(max_steer_deg) \
			* (1.0 - steer_reduction_at_speed * clampf(kmh / top_speed_kmh, 0.0, 1.0))
	steering = move_toward(steering, -s * limit, steer_speed * delta)

	engine_force = 0.0
	brake = rolling_brake

	if Input.is_action_pressed("handbrake"):
		brake = max_brake_force
		return

	if t > 0.0 and kmh < top_speed_kmh:
		# El empuje se desvanece cerca de la velocidad tope.
		engine_force = t * max_engine_force * clampf(1.0 - kmh / top_speed_kmh + 0.25, 0.0, 1.0)
		brake = 0.0
	elif b > 0.0:
		if fwd > 0.5:
			# Frenado largo: es un camión de 12 toneladas.
			brake = b * max_brake_force
		elif fwd > -max_reverse_kmh / 3.6:
			engine_force = -b * max_reverse_force
			brake = 0.0
		else:
			brake = b * max_brake_force
