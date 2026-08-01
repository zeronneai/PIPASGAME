# PIPERO — Documento de Fase 0 (Greybox mobile-first)

**Objetivo de esta fase:** tener un prototipo jugable en celular, todo en cubos grises, donde puedas caminar, correr, subirte a la pipa, manejarla sintiendo el peso del agua, bajarte, y entrar a un local. Sin arte, sin misiones, sin economía.

Si esto se siente bien en tu teléfono, el juego existe. Si no, no importa qué tan bonito lo hagas después.

**Tiempo estimado:** 1 a 2 semanas de trabajo real con Claude Code.

---

## 1. Decisiones fijas (no cambiar durante Fase 0)

Estas se toman ahora porque cambiarlas después cuesta rehacer trabajo.

| Decisión | Valor | Por qué |
|---|---|---|
| Motor | Godot 4, versión estable más reciente | Proyecto en texto plano, Claude Code lo edita completo. Exporta a Android nativo Y a web desde el mismo código. |
| Renderer | **Compatibility** (OpenGL ES 3.0 / WebGL2) | Corre en gama media y baja de Android, y es el único que da un build web decente. Vulkan Mobile se ve mejor pero deja fuera muchos teléfonos. |
| Plataforma principal | **Android nativo (APK)** | Es donde el juego de verdad corre. |
| Plataforma secundaria | Build web para link compartible | Demo recortada, no la experiencia completa. |
| iOS | Fase 3 o después | Requiere Mac para compilar y cuenta de Apple Developer anual. No bloquea nada. |
| Orientación | **Horizontal (landscape) forzada** | Un juego de manejo en vertical no funciona. |
| FPS objetivo | 30 FPS estables en gama media, 60 en gama alta | 30 estable se siente mucho mejor que 45 con tirones. |
| Tamaño del mapa Fase 0 | 200 x 200 metros | Suficiente para probar todo. La colonia final crece a lo mucho al doble. |

---

## 2. Presupuestos de rendimiento (mobile-first)

Esto es lo que cambia de verdad al hacerlo para celular. Respétalos desde el greybox o vas a tener que rehacer arte en Fase 3.

**Geometría**
- Máximo ~80,000 triángulos visibles en pantalla a la vez
- Personaje: máximo 8,000 tris
- Pipa: máximo 15,000 tris
- Edificio de fondo: 200 a 800 tris
- Usa `MultiMeshInstance3D` para todo lo repetido (postes, botes de basura, bardas, banquetas). Cientos de copias con un solo draw call.
- Objetivo: menos de 150 draw calls por frame

**Texturas**
- Máximo 1024x1024 para el personaje y la pipa, 512x512 para todo lo demás
- Compresión VRAM (ETC2/ASTC en Android)
- Atlas: mete todos los props del ambiente en una sola textura compartida
- Presupuesto total de assets: menos de 60 MB para el APK, menos de 25 MB si quieres que el build web cargue en tiempo razonable

**Iluminación**
- **Una** luz direccional (el sol) y nada más
- Sombras solo del sol, con `directional_shadow_max_distance` corto (40 a 60 m)
- Todo lo estático con lightmap horneado (`LightmapGI`), cero luces dinámicas en edificios
- **Prohibido:** SDFGI, SSAO, SSR, Volumetric Fog, glow pesado. Matan el celular.
- Ambiente: un `WorldEnvironment` simple con sky procedural o color plano más niebla lineal barata

**Física**
- Colisiones con formas primitivas (Box, Sphere, Capsule). Nada de `ConcavePolygonShape3D` para el mundo salvo el terreno.
- Physics tick a 60 Hz aunque el render vaya a 30

---

## 3. Controles táctiles (esto es lo más importante de la fase)

Un juego así se hunde o flota por los controles. Godot no trae joystick virtual, hay que hacerlo.

### A pie
- **Joystick virtual izquierdo:** movimiento. Dinámico, o sea aparece donde el pulgar toque dentro de la zona izquierda de la pantalla, no fijo en una posición.
- **Zona derecha de la pantalla:** arrastrar para mover la cámara. Sin botón visible.
- **Correr:** automático al empujar el joystick al tope, con una barra de resistencia. Cero botones extra.
- **Botón de contexto (abajo a la derecha):** aparece solo cuando hay algo con qué interactuar. Dice "Subir", "Entrar", "Ofrecer servicio". Un solo botón que cambia de etiqueta.

### Manejando
- **Volante:** dos opciones a probar, y hay que probar las dos con el teléfono en la mano
  - Opción A: botones táctiles izquierda/derecha en la parte baja
  - Opción B: giroscopio (inclinar el teléfono)
  - Opción C: joystick virtual solo horizontal
- **Acelerador y freno:** botones grandes a la derecha
- **Cámara:** automática detrás del vehículo, con arrastre para mirar libre que regresa solo
- **Botón de bajarse:** solo aparece si la velocidad es cero

### Reglas de UI móvil
- Ningún elemento tocable menor a 48x48 dp
- Nada crítico en las esquinas superiores (ahí van el notch y la barra de estado)
- Zona segura: 5% de margen en todos los lados
- El HUD nunca tapa el centro de la pantalla

---

## 4. Estructura del proyecto

```
pipero/
├── project.godot
├── scenes/
│   ├── main.tscn                 # escena raíz, orquesta todo
│   ├── player/
│   │   └── player.tscn           # CharacterBody3D + CollisionShape + malla cápsula
│   ├── vehicle/
│   │   └── pipa.tscn             # VehicleBody3D + 4x VehicleWheel3D + tanque
│   ├── world/
│   │   └── colonia_greybox.tscn  # calles, banquetas, edificios en cubos
│   ├── camera/
│   │   └── camera_rig.tscn       # SpringArm3D + Camera3D
│   └── ui/
│       ├── hud.tscn
│       └── virtual_joystick.tscn
├── scripts/
│   ├── autoload/
│   │   └── game_state.gd         # singleton: modo actual, referencias globales
│   ├── player/
│   │   ├── player_controller.gd
│   │   └── player_interaction.gd
│   ├── vehicle/
│   │   ├── pipa_controller.gd
│   │   └── tank_slosh.gd
│   ├── camera/
│   │   └── camera_rig.gd
│   ├── world/
│   │   └── interactable.gd       # clase base para locales, pozo, etc.
│   └── ui/
│       ├── virtual_joystick.gd
│       ├── touch_input.gd
│       └── hud.gd
└── assets/
    └── (vacío en Fase 0)
```

---

## 5. Orden exacto de construcción

Este es el orden en que le pides las cosas a Claude Code. **Uno a la vez, probando en el celular antes de pasar al siguiente.** No le pidas todo de un jalón.

### Paso 1 — Proyecto base y configuración móvil
Crear el proyecto de Godot con el renderer en Compatibility, orientación landscape forzada, resolución base 1280x720 con modo de estirado `canvas_items` y aspecto `expand`. Configurar el mapa de inputs. Un `main.tscn` con un plano y una luz direccional.

*Prueba:* exporta el APK y ábrelo. Debe verse un plano gris en horizontal.

### Paso 2 — Joystick virtual
`virtual_joystick.gd` como `Control` que maneja `InputEventScreenTouch` y `InputEventScreenDrag`, con modo dinámico, zona muerta y salida normalizada de Vector2. Multitouch real: el joystick y el arrastre de cámara tienen que funcionar al mismo tiempo, cada uno rastreando su propio índice de dedo.

*Prueba:* dos dedos a la vez en el celular, sin que se peleen.

### Paso 3 — Personaje a pie
`player_controller.gd` sobre `CharacterBody3D`. Movimiento relativo a la cámara, aceleración y desaceleración suaves, gravedad, caminar y correr con barra de resistencia, y rotación del modelo hacia la dirección de movimiento.

*Prueba:* caminar sobre el plano se siente responsivo, sin patinar ni sentirse pesado.

### Paso 4 — Cámara en tercera persona
`camera_rig.gd` sobre `SpringArm3D`. Sigue al jugador con suavizado, arrastre táctil para orbitar, límites verticales de ángulo, y el `SpringArm3D` resolviendo la colisión con paredes automáticamente. FOV distinto a pie (70) y manejando (78).

*Prueba:* caminar pegado a una pared sin que la cámara atraviese.

### Paso 5 — Mundo greybox
`colonia_greybox.tscn`: cuadrícula de 4x4 manzanas, calles de 8 m de ancho, banquetas de 15 cm de alto, edificios como cajas de alturas variadas, 6 locales marcados con color distinto, un pozo o toma de agua en una esquina, algunos topes y baches. Todo con `CSGBox3D` o cajas simples. 200x200 m.

*Prueba:* correr de un extremo al otro toma entre 60 y 90 segundos. Si toma más, el mapa está muy grande.

### Paso 6 — La pipa (manejo)
`pipa_controller.gd` sobre `VehicleBody3D` con 4 `VehicleWheel3D`. Masa alta (unos 12,000 kg cargada), aceleración lenta, frenado largo, radio de giro amplio. **Debe sentirse pesada, no como un carro deportivo.** Ese es el punto.

*Prueba:* frenar desde velocidad máxima toma varios segundos y se siente satisfactorio, no frustrante.

### Paso 7 — Chapoteo del agua (el gancho)
`tank_slosh.gd`. Lleva una variable `fill_level` de 0 a 1. Calcula un desplazamiento del centro de masa según la aceleración lateral y longitudinal del vehículo, con retraso e inercia (el agua responde tarde y se sigue moviendo cuando ya frenaste). Mueve `center_of_mass` del `VehicleBody3D` en modo custom.

Regla de diseño: **media pipa debe ser más difícil de manejar que llena o vacía.** El efecto es máximo cerca de 0.5 y mínimo en 0.0 y 1.0.

*Prueba:* con el tanque a la mitad, un volantazo se siente notoriamente distinto que con el tanque lleno. Si no lo notas, súbele hasta que se note, luego bájale hasta que sea justo.

### Paso 8 — Subir y bajar del vehículo
`game_state.gd` como autoload con un enum de modo (`ON_FOOT`, `DRIVING`). Un `Area3D` en la puerta de la pipa. Al entrar, el botón de contexto dice "Subir". Al presionarlo: se esconde el personaje, la cámara se transfiere a la pipa con una transición suave de medio segundo, y el HUD cambia a controles de manejo. Al bajar, el personaje reaparece a un lado de la puerta.

**La pipa se queda exactamente donde la dejaste.** Su posición vive en `game_state`, no en la escena.

*Prueba:* subir, manejar tres cuadras, bajar, caminar de regreso al inicio, voltear. La pipa sigue donde la dejaste.

### Paso 9 — Interacción con locales
`interactable.gd` como clase base con un `Area3D` y un texto de prompt. Los 6 locales del greybox lo usan. Por ahora solo muestra "Ofrecer servicio" y al presionar imprime un mensaje. La lógica de aceptación es Fase 1.

### Paso 10 — HUD mínimo
Velocímetro, nivel del tanque, barra de resistencia al correr, botón de contexto, joystick. Nada más. Todo con tamaños táctiles correctos y respetando la zona segura.

---

## 6. Criterios de aceptación de Fase 0

No pases a Fase 1 hasta que **todos** se cumplan **en un teléfono real**, no en el editor:

- [ ] Corre a 30 FPS estables o más en un Android de gama media
- [ ] El APK pesa menos de 60 MB
- [ ] Los controles táctiles responden sin lag perceptible
- [ ] Multitouch funciona: mover y girar cámara al mismo tiempo
- [ ] La pipa se siente pesada y creíble
- [ ] El chapoteo del agua se nota y cambia cómo manejas
- [ ] Subir y bajar funciona sin bugs, 20 veces seguidas
- [ ] La pipa permanece donde se estacionó, siempre
- [ ] Caminar 3 minutos por el mapa se siente bien, no aburrido ni tedioso
- [ ] Nada del HUD queda tapado por el notch o los gestos del sistema

---

## 7. Qué necesitas instalar tú

1. **Godot 4** (versión estándar, no la .NET, salvo que quieras C# en vez de GDScript)
2. **JDK 17** (para compilar Android)
3. **Android SDK** vía Android Studio, o solo las command line tools
4. En Godot: `Editor > Manage Export Templates` y descargar las plantillas
5. En Godot: `Project > Install Android Build Template`
6. Generar un debug keystore y apuntarlo en `Editor Settings > Export > Android`
7. En tu teléfono: activar Opciones de desarrollador y Depuración USB

Con eso, Godot te instala y corre el juego en tu teléfono con un solo botón (`Remote Deploy`). Ese loop de "cambio algo, lo veo en el cel en 30 segundos" es lo que hace que esta fase avance rápido.

---

## 8. Cómo trabajar con Claude Code

- Inicializa el repo en Git antes de nada. Un commit por cada paso de la sección 5.
- Dale este documento como contexto al inicio de la sesión.
- **Un paso a la vez.** Pídele el Paso 3, pruébalo en el celular, commit, luego el Paso 4.
- Cuando algo se sienta mal, descríbelo con sensación, no con números: "se siente resbaloso", "tarda mucho en arrancar", "la cámara marea". Deja que él proponga los valores.
- Los números de tuning (masa, aceleración, fuerza del chapoteo) van todos como `@export` para que los ajustes desde el inspector de Godot sin tocar código.
- Pídele que ponga un modo debug con overlay de FPS, draw calls y estado del vehículo. Te va a ahorrar horas.

---

## 9. Lo que NO se hace en Fase 0

Para que no te distraigas:

- Nada de arte, texturas ni modelos
- Nada de audio
- Nada de sistema de misiones ni economía
- Nada de personalización de la pipa
- Nada de tráfico ni peatones
- Nada de menús ni guardado
- Nada de ciclo día/noche

Todo eso viene después y es mucho más fácil de agregar sobre una base que ya se siente bien.
