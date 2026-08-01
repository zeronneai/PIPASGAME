# PIPERO — Fase 0 (Greybox mobile-first)

Prototipo jugable en celular, todo en cubos grises: caminar, correr, subirte a
la pipa, manejarla sintiendo el peso del agua, bajarte y acercarte a un local.
Sin arte, sin misiones, sin economía.

## Cómo abrirlo

1. Instala **Godot 4** (versión estándar, renderer Compatibility ya configurado).
2. Abre `project.godot` con el editor.
3. Presiona ▶ para probar en escritorio (el mouse emula un dedo), o usa
   *Remote Deploy* para correrlo en tu Android (ver sección 7 del documento de fase).

## Controles

**A pie**
- Joystick virtual dinámico en la zona izquierda: aparece donde toque el pulgar.
- Empuja el joystick al tope para correr (gasta la barra de resistencia).
- Arrastra en la zona derecha para orbitar la cámara.
- Botón de contexto (abajo a la derecha) cuando hay algo con qué interactuar:
  "Subir", "Ofrecer servicio", "Cargar agua".
- Teclado (solo pruebas de escritorio): WASD para moverse, E para interactuar.

**Manejando**
- Botones ◀ ▶ abajo a la izquierda: volante.
- GAS y FRENO abajo a la derecha. Con la pipa detenida, FRENO mete reversa.
- "Bajar" aparece solo con la pipa detenida.
- Teclado (pruebas): W gas, S freno/reversa, A/D volante.

**Debug**
- Botón `DBG` (arriba a la derecha) o F1: overlay con FPS, draw calls,
  velocidad, masa y magnitud del chapoteo.

## Qué probar (criterios de la fase)

- La pipa se siente **pesada**: arranca lento, frena largo, gira amplio.
- El **chapoteo**: con el tanque a la mitad (`GameState.pipa_fill_level = 0.5`,
  el valor inicial) un volantazo se siente notoriamente distinto que lleno o
  vacío. El efecto es máximo en 0.5 y nulo en 0.0 y 1.0.
- La pipa **se queda donde la dejaste**: su posición vive en el autoload
  `GameState`, no en la escena.
- Multitouch real: joystick + cámara a la vez; GAS + volante a la vez.

## Tuning

Todos los números de sensación son `@export` y se ajustan desde el inspector
sin tocar código:

- `scripts/vehicle/pipa_controller.gd` — masa, fuerza de motor, freno, dirección.
- `scripts/vehicle/tank_slosh.gd` — rigidez, amortiguación y respuesta del agua.
- `scripts/player/player_controller.gd` — velocidades, resistencia.
- `scripts/camera/camera_rig.gd` — FOV, largo de brazo, sensibilidad, auto-alineado.

## Estructura

```
scenes/          escenas (main, player, pipa, mundo, cámara, UI)
scripts/         GDScript (autoload, player, vehicle, camera, world, ui)
assets/          vacío en Fase 0
```

El mundo greybox (`scripts/world/colonia_greybox.gd`) se genera por código:
cuadrícula 4x4 de manzanas en 200x200 m, calles de 8 m, banquetas de 15 cm,
6 locales naranjas, pozo azul en una esquina y topes amarillos.
