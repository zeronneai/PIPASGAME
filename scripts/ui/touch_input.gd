class_name TouchCameraInput
extends Control
## Zona derecha de la pantalla: arrastrar para mover la cámara, sin botón
## visible. Rastrea su propio dedo, independiente del joystick.

signal camera_drag(relative: Vector2)

## Fracción de pantalla (desde la derecha) que responde al arrastre de cámara.
@export var active_zone_fraction: float = 0.55

var _touch_index: int = -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if _touch_index == -1 and _in_active_zone(event.position):
				_touch_index = event.index
		elif event.index == _touch_index:
			_touch_index = -1
	elif event is InputEventScreenDrag and event.index == _touch_index:
		camera_drag.emit(event.relative)


func _in_active_zone(pos: Vector2) -> bool:
	var vp := get_viewport_rect().size
	return pos.x > vp.x * (1.0 - active_zone_fraction) and pos.y > vp.y * 0.1
