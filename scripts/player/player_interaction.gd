class_name PlayerInteraction
extends Area3D
## Detecta interactuables cerca del jugador y alimenta el botón de contexto
## del HUD. Un solo botón que cambia de etiqueta ("Subir", "Ofrecer servicio"...).

signal interactable_changed(interactable: Interactable)

var current: Interactable = null


func _ready() -> void:
	area_entered.connect(_on_area_entered)
	area_exited.connect(_on_area_exited)


func _on_area_entered(area: Area3D) -> void:
	if area is Interactable:
		current = area
		interactable_changed.emit(current)


func _on_area_exited(area: Area3D) -> void:
	if area == current:
		current = null
		# Busca otro interactuable que siga dentro del área.
		for other in get_overlapping_areas():
			if other is Interactable:
				current = other
				break
		interactable_changed.emit(current)


func try_interact() -> void:
	if current and not GameState.is_driving():
		current.interact()
