class_name TouchCameraPad
extends Control
## Zona de arrastre para la cámara, sin botón visible.
## Rastrea su propio dedo para funcionar en paralelo con el joystick.

signal look_delta(delta: Vector2)

var _finger := -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		var e := make_input_local(event) as InputEventScreenTouch
		if e.pressed:
			if _finger == -1 and Rect2(Vector2.ZERO, size).has_point(e.position):
				_finger = e.index
		elif e.index == _finger:
			_finger = -1
	elif event is InputEventScreenDrag and event.index == _finger:
		var d := make_input_local(event) as InputEventScreenDrag
		look_delta.emit(d.relative)


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		_finger = -1
