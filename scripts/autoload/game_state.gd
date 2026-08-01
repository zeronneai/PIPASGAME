extends Node
## Singleton: modo actual, referencias globales y estado que sobrevive a las escenas.

enum Mode { ON_FOOT, DRIVING }

signal mode_changed(new_mode: int)
signal tank_changed(fill: float)

var mode: int = Mode.ON_FOOT

var player: Node3D
var pipa: Node3D
var camera_rig: Node3D
var hud: Node

# La pipa vive aquí, no en la escena: se queda exactamente donde la dejaste.
var pipa_transform := Transform3D.IDENTITY
var has_pipa_transform := false

var tank_fill := 0.5


func set_tank_fill(v: float) -> void:
	tank_fill = clampf(v, 0.0, 1.0)
	tank_changed.emit(tank_fill)


func save_pipa_transform() -> void:
	if pipa:
		pipa_transform = pipa.global_transform
		has_pipa_transform = true


func enter_vehicle() -> void:
	if mode == Mode.DRIVING or player == null or pipa == null:
		return
	mode = Mode.DRIVING
	player.set_driving(true)
	pipa.set_controls_enabled(true)
	if camera_rig:
		camera_rig.set_target(pipa)
	mode_changed.emit(mode)


func exit_vehicle() -> void:
	if mode != Mode.DRIVING or player == null or pipa == null:
		return
	if not pipa.can_exit():
		return
	mode = Mode.ON_FOOT
	save_pipa_transform()
	pipa.set_controls_enabled(false)
	player.global_transform = pipa.get_exit_transform()
	player.set_driving(false)
	if camera_rig:
		camera_rig.set_target(player)
	mode_changed.emit(mode)
