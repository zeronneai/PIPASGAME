class_name VirtualJoystick
extends Control
## Joystick virtual dinámico: aparece donde el pulgar toque dentro de esta zona
## y rastrea únicamente su propio dedo, para que conviva con el arrastre de cámara.

@export var radius := 110.0
@export var knob_radius := 42.0
@export_range(0.0, 0.5) var deadzone := 0.18
@export var horizontal_only := false

## Salida normalizada (-1..1 por eje), con zona muerta ya aplicada.
var output := Vector2.ZERO
## Magnitud cruda sin zona muerta; 1.0 = empujado al tope (dispara correr).
var raw_magnitude := 0.0

var _finger := -1
var _origin := Vector2.ZERO


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
				_origin = e.position
				_update(e.position)
		elif e.index == _finger:
			_release()
	elif event is InputEventScreenDrag and event.index == _finger:
		var d := make_input_local(event) as InputEventScreenDrag
		_update(d.position)


func _update(pos: Vector2) -> void:
	var v := (pos - _origin) / radius
	if horizontal_only:
		v.y = 0.0
	raw_magnitude = minf(v.length(), 1.0)
	if v.length() > 1.0:
		v = v.normalized()
	var mag := v.length()
	if mag < deadzone:
		output = Vector2.ZERO
	else:
		output = v / mag * ((mag - deadzone) / (1.0 - deadzone))
	queue_redraw()


func _release() -> void:
	_finger = -1
	output = Vector2.ZERO
	raw_magnitude = 0.0
	queue_redraw()


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		_release()


func _draw() -> void:
	if _finger == -1:
		return
	draw_circle(_origin, radius, Color(1, 1, 1, 0.08))
	draw_arc(_origin, radius, 0.0, TAU, 48, Color(1, 1, 1, 0.35), 3.0)
	var knob_pos := _origin + output * radius
	draw_circle(knob_pos, knob_radius, Color(1, 1, 1, 0.45))
