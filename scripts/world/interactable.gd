class_name Interactable
extends Area3D
## Clase base para todo lo interactuable: locales, la puerta de la pipa,
## el pozo. Expone un texto de prompt y una señal al activarse.

signal interacted(interactable: Interactable)

## Texto del botón de contexto: "Subir", "Entrar", "Ofrecer servicio".
@export var prompt_text: String = "Interactuar"


func interact() -> void:
	interacted.emit(self)
	_on_interact()


## Sobrescribir en clases hijas.
func _on_interact() -> void:
	print("Interacción con: %s (%s)" % [name, prompt_text])
