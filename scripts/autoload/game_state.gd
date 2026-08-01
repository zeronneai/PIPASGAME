extends Node
## Singleton de estado global. Modo actual (a pie / manejando) y referencias
## compartidas entre jugador, pipa, cámara y HUD.

enum Mode { ON_FOOT, DRIVING }

signal mode_changed(new_mode: Mode)

var mode: Mode = Mode.ON_FOOT

## La posición de la pipa vive aquí, no en la escena: la pipa se queda
## exactamente donde la dejaste aunque se recargue el mundo.
var pipa_transform: Transform3D = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.8, 12.0))
var pipa_fill_level: float = 0.5

var player: Node3D = null
var pipa: Node3D = null
var camera_rig: Node3D = null
var hud: Node = null


func set_mode(new_mode: Mode) -> void:
	if mode == new_mode:
		return
	mode = new_mode
	mode_changed.emit(new_mode)


func is_driving() -> bool:
	return mode == Mode.DRIVING
