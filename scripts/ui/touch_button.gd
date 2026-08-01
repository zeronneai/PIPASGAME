class_name TouchButton
extends Button
## Botón con multitouch real. Los Button normales solo responden al primer
## dedo (emulación de mouse); este rastrea su propio índice de toque para que
## acelerar y girar funcionen al mismo tiempo.

var _touch_index: int = -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	toggle_mode = true  # solo para el visual de presionado; las señales se emiten a mano
	visibility_changed.connect(_on_visibility_changed)


func _on_visibility_changed() -> void:
	# Si el botón se esconde con un dedo encima, suelta limpio.
	if not is_visible_in_tree() and _touch_index != -1:
		_touch_index = -1
		set_pressed_no_signal(false)
		button_up.emit()


func _input(event: InputEvent) -> void:
	if not visible or not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			if _touch_index == -1 and get_global_rect().has_point(event.position):
				_touch_index = event.index
				set_pressed_no_signal(true)
				button_down.emit()
				get_viewport().set_input_as_handled()
		elif event.index == _touch_index:
			var inside := get_global_rect().has_point(event.position)
			_touch_index = -1
			set_pressed_no_signal(false)
			button_up.emit()
			if inside:
				pressed.emit()
