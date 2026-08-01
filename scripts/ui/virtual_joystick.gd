class_name VirtualJoystick
extends Control
## Joystick virtual dinámico: aparece donde el pulgar toca dentro de la zona
## izquierda. Rastrea su propio índice de dedo para que el multitouch con el
## arrastre de cámara no se pelee.

signal output_changed(value: Vector2)

@export var dead_zone: float = 0.15
@export var radius_px: float = 110.0
@export var knob_radius_px: float = 42.0
## Fracción del ancho de pantalla que responde a este joystick (zona izquierda).
@export var active_zone_fraction: float = 0.45

var output: Vector2 = Vector2.ZERO

var _touch_index: int = -1
var _origin: Vector2 = Vector2.ZERO
var _knob_pos: Vector2 = Vector2.ZERO
var _pressed: bool = false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if _touch_index == -1 and _in_active_zone(event.position):
				_touch_index = event.index
				_origin = event.position
				_knob_pos = event.position
				_pressed = true
				_set_output(Vector2.ZERO)
				queue_redraw()
				get_viewport().set_input_as_handled()
		elif event.index == _touch_index:
			_release()
			get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag and event.index == _touch_index:
		_update_knob(event.position)
		get_viewport().set_input_as_handled()


func _in_active_zone(pos: Vector2) -> bool:
	var vp := get_viewport_rect().size
	return pos.x < vp.x * active_zone_fraction and pos.y > vp.y * 0.25


func _update_knob(pos: Vector2) -> void:
	var delta := pos - _origin
	if delta.length() > radius_px:
		delta = delta.normalized() * radius_px
	_knob_pos = _origin + delta
	var raw := delta / radius_px
	if raw.length() < dead_zone:
		_set_output(Vector2.ZERO)
	else:
		# Reescala para que la salida arranque en 0 justo después de la zona muerta.
		var scaled := (raw.length() - dead_zone) / (1.0 - dead_zone)
		_set_output(raw.normalized() * scaled)
	queue_redraw()


func _release() -> void:
	_touch_index = -1
	_pressed = false
	_set_output(Vector2.ZERO)
	queue_redraw()


func _set_output(value: Vector2) -> void:
	output = value
	output_changed.emit(value)


func _draw() -> void:
	if not _pressed:
		return
	var base := _origin - global_position
	var knob := _knob_pos - global_position
	draw_circle(base, radius_px, Color(1, 1, 1, 0.08))
	draw_arc(base, radius_px, 0.0, TAU, 48, Color(1, 1, 1, 0.35), 3.0)
	draw_circle(knob, knob_radius_px, Color(1, 1, 1, 0.45))
