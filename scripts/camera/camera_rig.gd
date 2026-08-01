class_name CameraRig
extends Node3D
## Cámara en tercera persona sobre SpringArm3D. Sigue al objetivo con
## suavizado, orbita con arrastre táctil, y en modo manejo se auto-alinea
## detrás del vehículo regresando sola tras un arrastre libre.

@export_group("Seguimiento")
@export var follow_speed: float = 8.0
@export var height_offset: float = 1.5

@export_group("Órbita")
@export var drag_sensitivity: float = 0.005
@export var pitch_min_deg: float = -55.0
@export var pitch_max_deg: float = 35.0

@export_group("A pie")
@export var fov_on_foot: float = 70.0
@export var arm_length_on_foot: float = 4.5

@export_group("Manejando")
@export var fov_driving: float = 78.0
@export var arm_length_driving: float = 8.0
## Qué tan rápido la cámara vuelve sola detrás del vehículo.
@export var auto_align_speed: float = 2.5
## Segundos sin tocar antes de que la cámara regrese sola.
@export var auto_align_delay: float = 1.2

@export_group("Transición")
@export var mode_blend_time: float = 0.5

var target: Node3D = null

var _yaw: float = 0.0
var _pitch: float = -0.25
var _time_since_drag: float = 999.0
var _blend: float = 0.0

@onready var spring_arm: SpringArm3D = $SpringArm3D
@onready var camera: Camera3D = $SpringArm3D/Camera3D


func _ready() -> void:
	GameState.camera_rig = self
	GameState.mode_changed.connect(_on_mode_changed)
	spring_arm.spring_length = arm_length_on_foot
	camera.fov = fov_on_foot
	top_level = true


func _physics_process(delta: float) -> void:
	if target == null:
		return
	_time_since_drag += delta

	# Posición: sigue al objetivo con suavizado.
	var goal := target.global_position + Vector3(0.0, height_offset, 0.0)
	global_position = global_position.lerp(goal, 1.0 - exp(-follow_speed * delta))

	# En manejo, regresa sola detrás del vehículo tras un rato sin tocar.
	if GameState.is_driving() and _time_since_drag > auto_align_delay:
		var behind := target.global_rotation.y
		_yaw = lerp_angle(_yaw, behind, 1.0 - exp(-auto_align_speed * delta))

	_pitch = clampf(_pitch, deg_to_rad(pitch_min_deg), deg_to_rad(pitch_max_deg))
	rotation = Vector3(_pitch, _yaw, 0.0)

	# Mezcla suave de FOV y largo de brazo al cambiar de modo.
	var t := clampf(delta / maxf(mode_blend_time, 0.01), 0.0, 1.0)
	var goal_fov := fov_driving if GameState.is_driving() else fov_on_foot
	var goal_arm := arm_length_driving if GameState.is_driving() else arm_length_on_foot
	camera.fov = lerpf(camera.fov, goal_fov, t)
	spring_arm.spring_length = lerpf(spring_arm.spring_length, goal_arm, t)


func apply_drag(relative: Vector2) -> void:
	_yaw -= relative.x * drag_sensitivity
	_pitch -= relative.y * drag_sensitivity
	_time_since_drag = 0.0


func set_target(new_target: Node3D) -> void:
	target = new_target
	# El brazo no debe chocar contra el propio objetivo (jugador o pipa).
	spring_arm.clear_excluded_objects()
	if new_target is PhysicsBody3D:
		spring_arm.add_excluded_object(new_target.get_rid())


func _on_mode_changed(_mode: GameState.Mode) -> void:
	_time_since_drag = 999.0
