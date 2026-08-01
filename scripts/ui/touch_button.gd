class_name TouchButton
extends Control
## Botón multitouch: los Button normales solo responden al primer dedo (mouse
## emulado), así que acelerar y frenar a la vez los rompería. Este rastrea
## su propio dedo, igual que el joystick.

signal pressed_down
signal released

@export var label_text := "":
	set(v):
		label_text = v
		queue_redraw()
@export var base_color := Color(0.12, 0.13, 0.17, 0.6)
@export var pressed_color := Color(0.35, 0.55, 0.85, 0.8)
@export var font_size := 26

var is_pressed := false

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
				is_pressed = true
				pressed_down.emit()
				queue_redraw()
		elif e.index == _finger:
			_release()


func _release() -> void:
	_finger = -1
	if is_pressed:
		is_pressed = false
		released.emit()
	queue_redraw()


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		_release()


func _draw() -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = pressed_color if is_pressed else base_color
	sb.set_corner_radius_all(16)
	sb.border_width_bottom = 2
	sb.border_color = Color(1, 1, 1, 0.25)
	draw_style_box(sb, Rect2(Vector2.ZERO, size))
	var font := get_theme_default_font()
	var y := size.y * 0.5 + font.get_height(font_size) * 0.5 - font.get_descent(font_size)
	draw_string(font, Vector2(0, y), label_text,
			HORIZONTAL_ALIGNMENT_CENTER, size.x, font_size, Color(1, 1, 1, 0.9))
