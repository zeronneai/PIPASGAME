class_name PipaController
extends VehicleBody3D
## La pipa. Masa alta, aceleración lenta, frenado largo, giro amplio.
## Debe sentirse pesada — ese es el punto del juego.

@export_group("Motor")
@export var max_engine_force: float = 16000.0
@export var max_brake_force: float = 400.0
@export var reverse_force_fraction: float = 0.55
@export var max_speed_kmh: float = 65.0

@export_group("Dirección")
@export var max_steer_deg: float = 28.0
@export var steer_speed: float = 1.2
## A alta velocidad el volante responde menos (evita volantazos irreales).
@export var steer_reduction_at_speed: float = 0.5

@export_group("Masa")
@export var base_mass_kg: float = 8000.0
## Masa del agua con tanque lleno. Cargada ronda las 12 toneladas.
@export var water_mass_kg: float = 4000.0

var throttle_input: float = 0.0
var brake_input: float = 0.0
var steer_input: float = 0.0

var _current_steer: float = 0.0

@onready var tank_slosh: TankSlosh = $TankSlosh
@onready var door_area: Interactable = $DoorArea


func _ready() -> void:
	GameState.pipa = self
	global_transform = GameState.pipa_transform
	can_sleep = false  # dormida no respondería al acelerador al volver a subir
	_update_mass()


func _physics_process(delta: float) -> void:
	# Guarda la posición siempre: la pipa vive en GameState, no en la escena.
	GameState.pipa_transform = global_transform

	if not GameState.is_driving():
		engine_force = 0.0
		brake = max_brake_force * 0.4
		return

	var speed_kmh := linear_velocity.length() * 3.6

	# Dirección con suavizado y reducción a alta velocidad.
	var speed_factor := clampf(speed_kmh / max_speed_kmh, 0.0, 1.0)
	var steer_limit := deg_to_rad(max_steer_deg) * lerpf(1.0, steer_reduction_at_speed, speed_factor)
	_current_steer = move_toward(_current_steer, steer_input * steer_limit, steer_speed * delta)
	steering = _current_steer

	var forward_speed := -global_basis.z.dot(linear_velocity)

	if throttle_input > 0.0:
		if speed_kmh < max_speed_kmh:
			engine_force = throttle_input * max_engine_force
		else:
			engine_force = 0.0
		brake = 0.0
	elif brake_input > 0.0:
		if forward_speed > 0.5:
			# Frenar: largo y pesado.
			engine_force = 0.0
			brake = brake_input * max_brake_force
		else:
			# Detenido: reversa lenta.
			engine_force = -brake_input * max_engine_force * reverse_force_fraction
			brake = 0.0
	else:
		engine_force = 0.0
		brake = max_brake_force * 0.05


func get_speed_kmh() -> float:
	return linear_velocity.length() * 3.6


func is_stopped() -> bool:
	return linear_velocity.length() < 0.3


func set_fill_level(value: float) -> void:
	GameState.pipa_fill_level = clampf(value, 0.0, 1.0)
	_update_mass()


func _update_mass() -> void:
	mass = base_mass_kg + water_mass_kg * GameState.pipa_fill_level
