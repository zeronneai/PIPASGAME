extends CanvasLayer
## HUD mínimo: joystick, arrastre de cámara, botón de contexto, velocímetro,
## nivel del tanque, barra de resistencia y overlay de debug.
## Cambia de layout según el modo (a pie / manejando).

signal context_pressed
signal exit_pressed

@onready var joystick: VirtualJoystick = $Root/Joystick
@onready var camera_pad: TouchCameraPad = $Root/CameraPad
@onready var context_button: TouchButton = $Root/ContextButton
@onready var accel_button: TouchButton = $Root/AccelButton
@onready var brake_button: TouchButton = $Root/BrakeButton
@onready var exit_button: TouchButton = $Root/ExitButton
@onready var speed_label: Label = $Root/TopLeft/SpeedLabel
@onready var tank_bar: ProgressBar = $Root/TopLeft/TankBar
@onready var stamina_bar: ProgressBar = $Root/TopLeft/StaminaBar
@onready var debug_button: TouchButton = $Root/DebugButton
@onready var debug_panel: PanelContainer = $Root/DebugPanel
@onready var debug_label: Label = $Root/DebugPanel/VBox/DebugLabel


func _ready() -> void:
	context_button.pressed_down.connect(func(): context_pressed.emit())
	exit_button.pressed_down.connect(func(): exit_pressed.emit())
	debug_button.pressed_down.connect(func(): debug_panel.visible = not debug_panel.visible)
	$Root/DebugPanel/VBox/TankButtons/TankMinus.pressed_down.connect(
			func(): GameState.set_tank_fill(GameState.tank_fill - 0.25))
	$Root/DebugPanel/VBox/TankButtons/TankPlus.pressed_down.connect(
			func(): GameState.set_tank_fill(GameState.tank_fill + 0.25))
	GameState.mode_changed.connect(set_mode)
	set_mode(GameState.mode)
	set_context_prompt("")
	debug_panel.visible = false


func set_mode(mode: int) -> void:
	var driving := mode == GameState.Mode.DRIVING
	joystick.horizontal_only = driving
	accel_button.visible = driving
	brake_button.visible = driving
	speed_label.visible = driving
	stamina_bar.visible = not driving
	exit_button.visible = false
	if driving:
		context_button.visible = false


func set_context_prompt(text: String) -> void:
	context_button.label_text = text
	context_button.visible = text != "" and GameState.mode == GameState.Mode.ON_FOOT


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_debug"):
		debug_panel.visible = not debug_panel.visible
	elif event.is_action_pressed("interact") and context_button.visible:
		context_pressed.emit()


func _process(_delta: float) -> void:
	tank_bar.value = GameState.tank_fill

	var player := GameState.player
	if player and stamina_bar.visible:
		stamina_bar.max_value = player.stamina_max
		stamina_bar.value = player.stamina

	var pipa := GameState.pipa
	var driving := GameState.mode == GameState.Mode.DRIVING
	if pipa and driving:
		speed_label.text = "%d km/h" % roundi(pipa.speed_kmh())
		exit_button.visible = pipa.can_exit()
		# Empujar entradas táctiles al vehículo.
		pipa.throttle_input = 1.0 if accel_button.is_pressed else 0.0
		pipa.brake_input = 1.0 if brake_button.is_pressed else 0.0
		pipa.steer_input = joystick.output.x

	if debug_panel.visible:
		var fps := Performance.get_monitor(Performance.TIME_FPS)
		var draws := Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
		var mode_name := "MANEJANDO" if driving else "A PIE"
		var vel := 0.0
		if pipa:
			vel = pipa.speed_kmh()
		debug_label.text = "FPS: %d\nDraw calls: %d\nModo: %s\nPipa: %.1f km/h\nTanque: %.0f%%" \
				% [fps, draws, mode_name, vel, GameState.tank_fill * 100.0]
