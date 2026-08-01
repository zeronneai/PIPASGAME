class_name CameraRig
extends Node3D
## Cámara en tercera persona: sigue al objetivo con suavizado, orbita con
## arrastre táctil, y el SpringArm3D resuelve colisiones con paredes.
## Manejando se centra sola detrás de la pipa tras un momento sin tocar.

@export var follow_speed := 10.0
## Radianes por pixel de arrastre.
@export var look_sensitivity := 0.0045
@export var pitch_min_deg := -55.0
@export var pitch_max_deg := 10.0

@export_group("A pie")
@export var fov_on_foot := 70.0
@export var spring_on_foot := 4.5
@export var height_on_foot := 1.6

@export_group("Manejando")
@export var fov_driving := 78.0
@export var spring_driving := 9.0
@export var height_driving := 2.6
## Segundos sin arrastrar antes de re-centrarse detrás del vehículo.
@export var auto_center_delay := 1.2
@export var auto_center_speed := 2.5

## Qué tan rápido convergen posición/FOV/brazo al cambiar de modo (~medio segundo).
@export var transition_speed := 6.0

var target: Node3D

var _yaw := 0.0
var _pitch := -0.35
var _last_look := -10.0

@onready var _pitch_node: Node3D = $Pitch
@onready var _arm: SpringArm3D = $Pitch/SpringArm3D
@onready var _cam: Camera3D = $Pitch/SpringArm3D/Camera3D


func set_target(t: Node3D) -> void:
	target = t
	if target and not is_inside_tree():
		global_position = target.global_position


func apply_look(delta_px: Vector2) -> void:
	_yaw -= delta_px.x * look_sensitivity
	_pitch = clampf(_pitch - delta_px.y * look_sensitivity,
			deg_to_rad(pitch_min_deg), deg_to_rad(pitch_max_deg))
	_last_look = Time.get_ticks_msec() / 1000.0


func _physics_process(delta: float) -> void:
	if target == null:
		return
	var driving := GameState.mode == GameState.Mode.DRIVING
	var height := height_driving if driving else height_on_foot

	var focus := target.global_position + Vector3.UP * height
	var w := 1.0 - exp(-follow_speed * delta)
	global_position = global_position.lerp(focus, w)

	if driving and Time.get_ticks_msec() / 1000.0 - _last_look > auto_center_delay:
		var vz := target.global_basis.z
		if Vector2(vz.x, vz.z).length() > 0.1:
			var behind_yaw := atan2(vz.x, vz.z)
			_yaw = lerp_angle(_yaw, behind_yaw, 1.0 - exp(-auto_center_speed * delta))
			_pitch = lerpf(_pitch, -0.25, 1.0 - exp(-auto_center_speed * delta))

	rotation.y = _yaw
	_pitch_node.rotation.x = _pitch

	var tw := 1.0 - exp(-transition_speed * delta)
	_arm.spring_length = lerpf(_arm.spring_length,
			spring_driving if driving else spring_on_foot, tw)
	_cam.fov = lerpf(_cam.fov, fov_driving if driving else fov_on_foot, tw)
