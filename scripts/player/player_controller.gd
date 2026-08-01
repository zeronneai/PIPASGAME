class_name PlayerController
extends CharacterBody3D
## Movimiento a pie relativo a la cámara, con aceleración suave, correr
## automático al empujar el joystick al tope, y barra de resistencia.

@export_group("Movimiento")
@export var walk_speed := 3.2
@export var run_speed := 6.5
@export var acceleration := 14.0
@export var deceleration := 18.0
@export var rotation_speed := 12.0
@export var gravity := 20.0

@export_group("Resistencia")
## Segundos de sprint continuo.
@export var stamina_max := 6.0
## Recuperación por segundo (estando sin correr).
@export var stamina_regen := 1.6
## Magnitud de joystick que dispara el sprint (empujado al tope).
@export_range(0.5, 1.0) var run_input_threshold := 0.92
## Al agotarse, no puede volver a correr hasta recuperar esta fracción.
@export_range(0.0, 1.0) var stamina_recover_ratio := 0.3

var stamina := 0.0
var is_running := false
var joystick: VirtualJoystick

var _exhausted := false


func _ready() -> void:
	stamina = stamina_max


func set_driving(driving: bool) -> void:
	visible = not driving
	set_physics_process(not driving)
	$CollisionShape3D.disabled = driving
	$InteractionSensor.set_active(not driving)
	velocity = Vector3.ZERO


func _physics_process(delta: float) -> void:
	var input := Vector2.ZERO
	var wants_run := false
	if joystick and joystick.output != Vector2.ZERO:
		input = joystick.output
		wants_run = joystick.raw_magnitude >= run_input_threshold
	else:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
		wants_run = Input.is_action_pressed("run")

	var mag := minf(input.length(), 1.0)

	if wants_run and mag > 0.0 and not _exhausted and is_on_floor():
		is_running = true
		stamina -= delta
		if stamina <= 0.0:
			stamina = 0.0
			_exhausted = true
			is_running = false
	else:
		is_running = false

	if not is_running:
		stamina = minf(stamina + stamina_regen * delta, stamina_max)
		if _exhausted and stamina >= stamina_max * stamina_recover_ratio:
			_exhausted = false

	# Dirección relativa a la cámara (solo el plano horizontal).
	var cam_basis: Basis = global_basis
	if GameState.camera_rig:
		cam_basis = GameState.camera_rig.global_basis
	var fwd := -cam_basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var right := cam_basis.x
	right.y = 0.0
	right = right.normalized()
	var dir := right * input.x - fwd * input.y

	var target_speed := (run_speed if is_running else walk_speed) * mag
	var hvel := Vector3(velocity.x, 0.0, velocity.z)
	var target := dir.normalized() * target_speed if dir.length() > 0.01 else Vector3.ZERO
	var rate := acceleration if target.length() > hvel.length() else deceleration
	hvel = hvel.move_toward(target, rate * delta)
	velocity.x = hvel.x
	velocity.z = hvel.z

	if is_on_floor():
		velocity.y = -0.5
	else:
		velocity.y -= gravity * delta

	move_and_slide()

	# Rotar el modelo hacia la dirección de movimiento.
	if hvel.length() > 0.5:
		rotation.y = lerp_angle(rotation.y, atan2(-hvel.x, -hvel.z), rotation_speed * delta)
