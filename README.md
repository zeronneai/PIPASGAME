# PIPERO — Fase 0 (Greybox mobile-first)

Prototipo jugable en Godot 4 (renderer **Compatibility**, landscape forzado): caminar, correr,
subirte a la pipa, manejarla sintiendo el peso del agua, bajarte y entrar a un local.
Todo en cubos grises. Sin arte, sin misiones, sin economía.

## Cómo correrlo

1. Instala **Godot 4.3+** (versión estándar, no .NET).
2. Abre `project.godot` y dale Play. En escritorio el mouse emula un dedo
   (`emulate_touch_from_mouse` está activado) y hay controles de teclado:
   WASD para moverse/manejar, Shift correr, E interactuar, Espacio freno de mano, F3 debug.
3. Para el teléfono: JDK 17 + Android SDK, descarga las export templates
   (`Editor > Manage Export Templates`), genera un debug keystore y usa **Remote Deploy**.

## Controles táctiles

- **A pie:** joystick dinámico en la mitad izquierda (aparece donde toques). Empujado al tope = correr
  (con barra de resistencia). Mitad derecha: arrastrar para orbitar la cámara. Botón de contexto
  abajo a la derecha ("Subir", "Ofrecer servicio", "Cargar agua").
- **Manejando:** joystick horizontal (volante, Opción C del doc), botones grandes de acelerar/frenar
  a la derecha, "Bajar" solo aparece detenido. La cámara se centra sola detrás de la pipa.
- **Debug:** botón `DBG` arriba a la derecha — FPS, draw calls, estado del vehículo,
  y botones ±Agua para probar el chapoteo con distintos niveles de tanque.

## Tuning

Todos los números de sensación son `@export`: ajústalos desde el inspector sin tocar código.

| Qué | Dónde |
|---|---|
| Velocidades, resistencia | `scripts/player/player_controller.gd` |
| Peso, motor, frenos, dirección | `scripts/vehicle/pipa_controller.gd` |
| Chapoteo del agua | `scripts/vehicle/tank_slosh.gd` |
| Cámara (FOV, sensibilidad, auto-centrado) | `scripts/camera/camera_rig.gd` |
| Joystick (radio, zona muerta) | `scripts/ui/virtual_joystick.gd` |

Regla de diseño del chapoteo: **media pipa es más difícil de manejar que llena o vacía**
(el efecto escala con `4·fill·(1−fill)`).

## Estado persistente

La posición de la pipa y el nivel del tanque viven en el autoload `GameState`,
no en la escena: la pipa se queda exactamente donde la dejaste.

Los criterios de aceptación de la fase están en el documento de Fase 0 (sección 6):
se validan **en un teléfono real**, no en el editor.
