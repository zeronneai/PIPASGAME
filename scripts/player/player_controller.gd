class_name PlayerController
extends CharacterBody3D
## Personaje a pie. Movimiento relativo a la cámara, aceleración suave,
## correr automático al empujar el joystick al tope, con barra de resistencia.

@export_group("Movimiento")
@export var walk_speed: float = 3.2
@export var run_speed: float = 6.0
@export var acceleration: float = 14.0
@export var deceleration: float = 18.0
@export var rotation_speed: float = 10.0
@export var gravity: float = 18.0

@export_group("Resistencia")
## Umbral del joystick a partir del cual se corre (empujado al tope).
@export var run_threshold: float = 0.92
@export var stamina_max: float = 100.0
@export var stamina_drain_per_sec: float = 18.0
@export var stamina_regen_per_sec: float = 24.0
## Con la resistencia agotada hay que recuperar hasta este nivel para volver a correr.
@export var stamina_recover_threshold: float = 30.0

var stamina: float = 100.0
var is_running: bool = false
var move_input: Vector2 = Vector2.ZERO

var _exhausted: bool = false


func _ready() -> void:
	GameState.player = self
	stamina = stamina_max


func _physics_process(delta: float) -> void:
	if GameState.is_driving():
		return

	# Joystick táctil; si está suelto, teclado (para probar en escritorio).
	var input := move_input
	if input.length() < 0.01:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")

	var cam_basis := _camera_basis()
	var direction := (cam_basis * Vector3(input.x, 0.0, input.y))
	direction.y = 0.0
	if direction.length() > 1.0:
		direction = direction.normalized()

	var wants_run := input.length() >= run_threshold
	_update_stamina(wants_run, delta)

	var target_speed := run_speed if is_running else walk_speed
	var target_velocity := direction * target_speed

	var horizontal := Vector3(velocity.x, 0.0, velocity.z)
	var rate := acceleration if target_velocity.length() > horizontal.length() else deceleration
	horizontal = horizontal.move_toward(target_velocity, rate * delta)

	velocity.x = horizontal.x
	velocity.z = horizontal.z
	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		velocity.y = 0.0

	move_and_slide()

	if horizontal.length() > 0.2:
		var target_angle := atan2(horizontal.x, horizontal.z)
		rotation.y = lerp_angle(rotation.y, target_angle, rotation_speed * delta)


func _update_stamina(wants_run: bool, delta: float) -> void:
	if wants_run and not _exhausted:
		is_running = true
		stamina = maxf(stamina - stamina_drain_per_sec * delta, 0.0)
		if stamina <= 0.0:
			_exhausted = true
			is_running = false
	else:
		is_running = false
		stamina = minf(stamina + stamina_regen_per_sec * delta, stamina_max)
		if _exhausted and stamina >= stamina_recover_threshold:
			_exhausted = false


func _camera_basis() -> Basis:
	if GameState.camera_rig:
		var yaw: float = GameState.camera_rig.global_rotation.y
		return Basis(Vector3.UP, yaw)
	return Basis.IDENTITY


func set_move_input(value: Vector2) -> void:
	# El joystick da Y positivo hacia abajo; adelante es -Z en el espacio de cámara.
	move_input = Vector2(value.x, value.y)
