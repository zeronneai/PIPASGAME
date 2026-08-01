extends Node3D
## Escena raíz: orquesta jugador, pipa, cámara y HUD, y maneja el ciclo
## de subir/bajar del vehículo.

@onready var player: PlayerController = $Player
@onready var pipa: PipaController = $Pipa
@onready var camera_rig: CameraRig = $CameraRig
@onready var hud: HUD = $HUD
@onready var interaction: PlayerInteraction = $Player/InteractionArea


func _ready() -> void:
	hud.joystick.output_changed.connect(player.set_move_input)
	hud.camera_touch.camera_drag.connect(camera_rig.apply_drag)
	hud.context_pressed.connect(_on_context_pressed)
	hud.exit_vehicle_pressed.connect(_exit_vehicle)
	interaction.interactable_changed.connect(_on_interactable_changed)
	pipa.door_area.interacted.connect(func(_i: Interactable) -> void: _enter_vehicle())

	camera_rig.set_target(player)
	GameState.set_mode(GameState.Mode.ON_FOOT)


func _physics_process(_delta: float) -> void:
	if GameState.is_driving():
		# Táctil y teclado alimentan a la pipa por el mismo canal.
		pipa.throttle_input = maxf(1.0 if hud.accelerate_held else 0.0, Input.get_action_strength("accelerate"))
		pipa.brake_input = maxf(1.0 if hud.brake_held else 0.0, Input.get_action_strength("brake"))
		var kb_steer := Input.get_action_strength("steer_left") - Input.get_action_strength("steer_right")
		pipa.steer_input = clampf(hud.steer_axis + kb_steer, -1.0, 1.0)
	elif Input.is_action_just_pressed("interact"):
		interaction.try_interact()


func _on_context_pressed() -> void:
	interaction.try_interact()


func _on_interactable_changed(interactable: Interactable) -> void:
	hud.set_context_prompt(interactable.prompt_text if interactable else "")


func _enter_vehicle() -> void:
	if GameState.is_driving():
		return
	GameState.set_mode(GameState.Mode.DRIVING)
	player.visible = false
	player.process_mode = Node.PROCESS_MODE_DISABLED
	camera_rig.set_target(pipa)
	hud.set_context_prompt("")


func _exit_vehicle() -> void:
	if not GameState.is_driving() or not pipa.is_stopped():
		return
	GameState.set_mode(GameState.Mode.ON_FOOT)
	# El personaje reaparece a un lado de la puerta (izquierda de la pipa).
	var side: Vector3 = pipa.global_basis.x * 2.5
	player.global_position = pipa.global_position + side + Vector3(0, 0.5, 0)
	player.velocity = Vector3.ZERO
	player.visible = true
	player.process_mode = Node.PROCESS_MODE_INHERIT
	camera_rig.set_target(player)
