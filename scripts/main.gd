extends Node3D
## Escena raíz: registra las referencias globales en GameState y
## conecta el HUD con el jugador, la pipa y la cámara.

@onready var player: PlayerController = $Player
@onready var pipa: PipaController = $Pipa
@onready var camera_rig: CameraRig = $CameraRig
@onready var hud: CanvasLayer = $HUD
@onready var sensor: PlayerInteraction = $Player/InteractionSensor


func _ready() -> void:
	GameState.player = player
	GameState.pipa = pipa
	GameState.camera_rig = camera_rig
	GameState.hud = hud

	# El sol: una sola luz direccional con sombras cortas (presupuesto móvil).
	$Sun.rotation_degrees = Vector3(-50.0, 35.0, 0.0)

	player.joystick = hud.joystick
	hud.camera_pad.look_delta.connect(camera_rig.apply_look)
	sensor.prompt_changed.connect(hud.set_context_prompt)
	hud.context_pressed.connect(sensor.interact)
	hud.exit_pressed.connect(GameState.exit_vehicle)

	camera_rig.set_target(player)
	camera_rig.global_position = player.global_position
