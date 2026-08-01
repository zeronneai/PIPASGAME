class_name TankSlosh
extends Node
## El chapoteo del agua — el gancho del juego. Desplaza el centro de masa
## del VehicleBody3D según la aceleración, con retraso e inercia: el agua
## responde tarde y se sigue moviendo cuando ya frenaste.
##
## Regla de diseño: media pipa es más difícil que llena o vacía.
## El efecto es máximo en fill_level = 0.5 y mínimo en 0.0 y 1.0.

## Desplazamiento máximo del centro de masa (metros) con efecto al máximo.
@export var max_offset_m: float = 0.55
## Rigidez del "resorte" del agua: qué tan fuerte regresa al centro.
@export var slosh_stiffness: float = 4.0
## Amortiguación: qué tanto se sigue meciendo después de frenar.
@export var slosh_damping: float = 1.1
## Cuánta aceleración del vehículo empuja al agua.
@export var accel_response: float = 0.12
## Altura del centro de masa del agua sobre el chasis (sube el balanceo).
@export var water_height_m: float = 0.4

var vehicle: VehicleBody3D

var _slosh: Vector2 = Vector2.ZERO          # desplazamiento lateral (x) y longitudinal (y), espacio local
var _slosh_vel: Vector2 = Vector2.ZERO
var _prev_velocity: Vector3 = Vector3.ZERO
var _base_com: Vector3 = Vector3.ZERO


func _ready() -> void:
	vehicle = get_parent() as VehicleBody3D
	assert(vehicle != null, "TankSlosh debe ser hijo de un VehicleBody3D")
	vehicle.center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	_base_com = vehicle.center_of_mass


func _physics_process(delta: float) -> void:
	if delta <= 0.0:
		return

	# Aceleración del vehículo en espacio local (x lateral, z longitudinal).
	var accel_world := (vehicle.linear_velocity - _prev_velocity) / delta
	_prev_velocity = vehicle.linear_velocity
	var accel_local := vehicle.global_basis.inverse() * accel_world
	var drive := Vector2(accel_local.x, accel_local.z) * accel_response

	# Masa-resorte-amortiguador: el agua empuja contra la aceleración,
	# regresa al centro y se sigue meciendo (inercia).
	var spring := -_slosh * slosh_stiffness
	var damp := -_slosh_vel * slosh_damping
	_slosh_vel += (drive + spring + damp) * delta
	_slosh += _slosh_vel * delta
	_slosh = _slosh.limit_length(1.0)

	var intensity := slosh_intensity()
	var offset := Vector3(_slosh.x, water_height_m * _slosh.length(), _slosh.y) * max_offset_m * intensity
	vehicle.center_of_mass = _base_com + offset


## 0 en tanque vacío o lleno, 1 en medio tanque. Parábola 4·f·(1-f).
func slosh_intensity() -> float:
	var f: float = GameState.pipa_fill_level
	return 4.0 * f * (1.0 - f)


## Magnitud actual del chapoteo, para el HUD/debug (0 a 1).
func current_slosh_magnitude() -> float:
	return _slosh.length() * slosh_intensity()
