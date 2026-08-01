class_name Interactable
extends Area3D
## Clase base para todo lo interactuable: la puerta de la pipa, los locales, el pozo.
## El sensor del jugador los detecta y el botón de contexto muestra su prompt.

signal interacted

@export var prompt := "Interactuar"


func _ready() -> void:
	collision_layer = 8
	collision_mask = 0
	monitoring = false


func interact() -> void:
	interacted.emit()
	_on_interact()


func _on_interact() -> void:
	print("Interacción: ", prompt)
