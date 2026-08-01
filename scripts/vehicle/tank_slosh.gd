class_name TankSlosh
extends Node
## Chapoteo del agua: desplaza el centro de masa de la pipa según la
## aceleración lateral y longitudinal, con retraso e inercia (resorte
## amortiguado): el agua responde tarde y se sigue moviendo cuando ya frenaste.
##
## Regla de diseño: media pipa es MÁS difícil que llena o vacía.
## El efecto escala con 4·fill·(1−fill): máximo en 0.5, cero en 0.0 y 1.0.

## Centro de masa del camión vacío.
@export var base_center_of_mass := Vector3(0, 0.85, 0.2)
## Masa del camión vacío y masa del agua a tanque lleno (12,000 kg cargada).
@export var tare_mass := 5500.0
@export var water_mass := 6500.0

@export_group("Sensación del chapoteo")
## Qué tan rápido reacciona el agua (rigidez del resorte). Menos = más tardado.
@export var stiffness := 4.0
## Cuánto se sigue moviendo después (amortiguación). Menos = más olas.
@export var damping := 1.6
## Metros de desplazamiento del centro de masa por m/s² de aceleración.
@export var accel_to_offset := 0.22
## Límite del desplazamiento (x lateral, y, z longitudinal), en metros.
@export var max_offset := Vector3(1.0, 0.0, 1.8)
## Cuánto sube el centro de masa con el tanque lleno (camión más volcable).
@export var full_com_raise := 0.45

var vehicle: VehicleBody3D

var _offset := Vector3.ZERO
var _vel := Vector3.ZERO
var _prev_lin := Vector3.ZERO


func _ready() -> void:
	vehicle = get_parent() as VehicleBody3D
	_prev_lin = vehicle.linear_velocity


func _physics_process(delta: float) -> void:
	var fill: float = GameState.tank_fill
	vehicle.mass = tare_mass + water_mass * fill

	var accel := (vehicle.linear_velocity - _prev_lin) / delta
	_prev_lin = vehicle.linear_velocity
	var local_accel := vehicle.global_basis.inverse() * accel
	local_accel.y = 0.0

	# Máximo cerca de 0.5, mínimo en 0.0 y 1.0.
	var slosh_factor := 4.0 * fill * (1.0 - fill)

	var target := -local_accel * accel_to_offset * slosh_factor
	target = target.clamp(-max_offset * slosh_factor, max_offset * slosh_factor)

	# Resorte amortiguado (subamortiguado): retraso, rebase y oscilación.
	_vel += (stiffness * (target - _offset) - damping * _vel) * delta
	_offset += _vel * delta

	vehicle.center_of_mass = base_center_of_mass \
			+ Vector3(0, full_com_raise * fill, 0) + _offset
