class_name HUD
extends CanvasLayer
## HUD mínimo: velocímetro, nivel del tanque, barra de resistencia,
## botón de contexto, controles de manejo y overlay de debug.
## Todo respeta la zona segura y tamaños táctiles de 48dp mínimo.

signal context_pressed
signal exit_vehicle_pressed

var accelerate_held: bool = false
var brake_held: bool = false
var steer_axis: float = 0.0

var _debug_visible: bool = false
var _steer_left_held: bool = false
var _steer_right_held: bool = false

@onready var joystick: VirtualJoystick = $Joystick
@onready var camera_touch: TouchCameraInput = $CameraTouch
@onready var context_button: Button = $SafeArea/ContextButton
@onready var stamina_bar: ProgressBar = $SafeArea/StaminaBar
@onready var drive_controls: Control = $SafeArea/DriveControls
@onready var accel_button: Button = $SafeArea/DriveControls/AccelButton
@onready var brake_button: Button = $SafeArea/DriveControls/BrakeButton
@onready var steer_left_button: Button = $SafeArea/DriveControls/SteerLeft
@onready var steer_right_button: Button = $SafeArea/DriveControls/SteerRight
@onready var exit_button: Button = $SafeArea/DriveControls/ExitButton
@onready var speed_label: Label = $SafeArea/DriveControls/SpeedLabel
@onready var tank_bar: ProgressBar = $SafeArea/DriveControls/TankBar
@onready var debug_label: Label = $SafeArea/DebugLabel
@onready var debug_button: Button = $SafeArea/DebugButton


func _ready() -> void:
	GameState.hud = self
	GameState.mode_changed.connect(_on_mode_changed)
	context_button.pressed.connect(_emit_context)
	exit_button.pressed.connect(_emit_exit)
	debug_button.pressed.connect(_toggle_debug)

	_bind_hold(accel_button, _set_accel)
	_bind_hold(brake_button, _set_brake)
	_bind_hold(steer_left_button, _set_steer_left)
	_bind_hold(steer_right_button, _set_steer_right)

	context_button.visible = false
	debug_label.visible = false
	_on_mode_changed(GameState.mode)


func _bind_hold(button: BaseButton, setter: Callable) -> void:
	button.button_down.connect(setter.bind(true))
	button.button_up.connect(setter.bind(false))


func _emit_context() -> void:
	context_pressed.emit()


func _emit_exit() -> void:
	exit_vehicle_pressed.emit()


func _set_accel(held: bool) -> void:
	accelerate_held = held


func _set_brake(held: bool) -> void:
	brake_held = held


func _set_steer_left(held: bool) -> void:
	_steer_left_held = held
	_update_steer()


func _set_steer_right(held: bool) -> void:
	_steer_right_held = held
	_update_steer()


func _update_steer() -> void:
	steer_axis = (1.0 if _steer_left_held else 0.0) - (1.0 if _steer_right_held else 0.0)


func _on_mode_changed(mode: GameState.Mode) -> void:
	var driving := mode == GameState.Mode.DRIVING
	drive_controls.visible = driving
	joystick.visible = not driving
	stamina_bar.visible = not driving
	if driving:
		context_button.visible = false


func set_context_prompt(text: String) -> void:
	context_button.text = text
	context_button.visible = not text.is_empty() and not GameState.is_driving()


func _process(_delta: float) -> void:
	if GameState.player and not GameState.is_driving():
		var pc := GameState.player as PlayerController
		stamina_bar.value = pc.stamina
		stamina_bar.visible = pc.stamina < pc.stamina_max - 0.5

	if GameState.is_driving() and GameState.pipa:
		var pipa := GameState.pipa as PipaController
		speed_label.text = "%d km/h" % int(pipa.get_speed_kmh())
		tank_bar.value = GameState.pipa_fill_level * 100.0
		exit_button.visible = pipa.is_stopped()

	if _debug_visible:
		_update_debug()

	if Input.is_action_just_pressed("debug_toggle"):
		_toggle_debug()


func _toggle_debug() -> void:
	_debug_visible = not _debug_visible
	debug_label.visible = _debug_visible


func _update_debug() -> void:
	var lines: Array[String] = []
	lines.append("FPS: %d" % Engine.get_frames_per_second())
	var rid := get_viewport().get_viewport_rid()
	lines.append("Draw calls: %d" % RenderingServer.viewport_get_render_info(
		rid, RenderingServer.VIEWPORT_RENDER_INFO_TYPE_VISIBLE,
		RenderingServer.VIEWPORT_RENDER_INFO_DRAW_CALLS_IN_FRAME))
	lines.append("Modo: %s" % ("MANEJANDO" if GameState.is_driving() else "A PIE"))
	if GameState.pipa:
		var pipa := GameState.pipa as PipaController
		lines.append("Vel: %.1f km/h  Masa: %d kg" % [pipa.get_speed_kmh(), int(pipa.mass)])
		lines.append("Tanque: %d%%  Chapoteo: %.2f" % [
			int(GameState.pipa_fill_level * 100.0),
			pipa.tank_slosh.current_slosh_magnitude()])
	debug_label.text = "\n".join(lines)
