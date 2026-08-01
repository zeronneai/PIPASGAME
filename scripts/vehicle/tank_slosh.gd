class_name TankSlosh
extends Node
## Chapoteo del agua: desplaza el centro de masa de la pipa según la
## aceleración lateral y longitudinal, con retraso e inercia (resorte
## amortiguado): el agua responde tarde y se sigue moviendo cuando ya frenaste.
##
## Regla de diseño: media pipa es MÁS difícil que llena o vacía.
## El efecto escala con 4·fill·(1−fill): máximo en 0.5, cero en 0.0 y 1.0.

## Centro de masa del camión vacío.
@export var base_center_of_mass := Vector3(0, 0.6, 0.2)
## Masa del camión vacío y masa del agua a tanque lleno (12,000 kg cargada).
@export var tare_mass := 7500.0
@export var water_mass := 4500.0

@export_group("Sensación del chapoteo")
## Qué tan rápido reacciona el agua (rigidez del resorte). Menos = más tardado.
@export var stiffness := 14.0
## Cuánto se sigue moviendo después (amortiguación). Menos = más olas.
@export var damping := 2.2
## Metros que se desplaza el agua por m/s² de aceleración del camión.
@export var accel_to_offset := 0.28
## Límite del desplazamiento del agua (x lateral, y, z longitudinal), en metros.
@export var max_offset := Vector3(0.9, 0.0, 1.5)
## Ganancia de la fuerza de reacción del agua sobre el chasis.
@export var force_scale := 1.0
## Dónde empuja el agua (centro del tanque, local). Alto = más volcadura.
@export var tank_position := Vector3(0, 2.2, 0.9)
## Cuánto se desplaza el centro de masa junto con el agua (efecto secundario).
@export var com_shift_scale := 0.25

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
	var water_accel := stiffness * (target - _offset) - damping * _vel
	_vel += water_accel * delta
	_offset += _vel * delta

	# El agua empuja las paredes del tanque (tercera ley de Newton), arriba del
	# centro de masa. El motor de física ya cuenta la masa del agua a la altura
	# del centro de masa, así que aquí solo se agrega:
	#  - el PAR de llevar esa fuerza a la altura del tanque (volcadura), y
	#  - la reacción del movimiento relativo del agua (te sigue empujando
	#    cuando ya frenaste o giraste).
	var moving_water := water_mass * fill * slosh_factor
	var f_rel := -water_accel * moving_water
	var f_carried := -local_accel * moving_water
	var lever := tank_position - vehicle.center_of_mass
	var torque := lever.cross(f_rel + f_carried) * force_scale
	vehicle.apply_torque(vehicle.global_basis * torque)
	vehicle.apply_central_force(vehicle.global_basis * (f_rel * force_scale))

	vehicle.center_of_mass = base_center_of_mass + _offset * com_shift_scale
