class_name PlayerInteraction
extends Area3D
## Sensor del jugador: detecta el Interactable más cercano y avisa al HUD
## qué debe decir el botón de contexto ("" = ocultarlo).

signal prompt_changed(text: String)

var current: Interactable


func _ready() -> void:
	area_entered.connect(func(_a): _refresh())
	area_exited.connect(func(_a): _refresh())


func _refresh() -> void:
	var nearest: Interactable = null
	var best := INF
	for a in get_overlapping_areas():
		if a is Interactable:
			var d := global_position.distance_squared_to(a.global_position)
			if d < best:
				best = d
				nearest = a
	if nearest != current:
		current = nearest
		prompt_changed.emit(current.prompt if current else "")


func set_active(active: bool) -> void:
	monitoring = active
	if not active and current:
		current = null
		prompt_changed.emit("")


func interact() -> void:
	if current:
		current.interact()
