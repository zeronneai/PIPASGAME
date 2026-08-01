# PIPERO — Documento de Fase 0 (Greybox, web / iPhone)

**Reemplaza al documento anterior de Godot.** El stack cambió porque la plataforma objetivo es iPhone y el canal es un link compartible, sin instalación.

**Objetivo de esta fase:** un prototipo jugable en tu iPhone, todo en cubos grises, donde puedas caminar, correr, subirte a la pipa, manejarla sintiendo el peso del agua, bajarte, y acercarte a un local. Sin arte, sin misiones, sin economía.

Si esto se siente bien en tu teléfono, el juego existe.

**Tiempo estimado:** 2 a 3 semanas de trabajo real con Claude Code.

---

## 1. Stack y decisiones fijas

| Pieza | Elección | Por qué |
|---|---|---|
| Build | **Vite + React + TypeScript** | Rápido, es tu terreno, Vercel lo despliega solo. |
| 3D | **three.js + @react-three/fiber** | El estándar de 3D en web. R3F te deja escribir la escena como componentes de React. |
| Helpers | **@react-three/drei** | Cámaras, loaders, instancing, controles. Te ahorra semanas. |
| Física | **@react-three/rapier** | Rapier es física en Rust compilado a WASM, rápida. Trae controlador de vehículo por raycast, justo lo que necesita la pipa. |
| Estado | **zustand** | Estado global simple fuera del árbol de React. Crítico: la lógica del juego NO debe vivir en `useState` o vas a re-renderizar 60 veces por segundo. |
| Renderer | **WebGL2 como base, WebGPU con detección** | WebGL2 corre en todo. WebGPU está en Safari desde iOS 26 y da mucho más rendimiento. Se detecta con `navigator.gpu` y se cae a WebGL2 solo. |
| Despliegue | **Vercel** | Push a main, listo. |
| Instalación | **PWA, "Agregar a pantalla de inicio"** | Quita la barra de Safari y se ve como app. |
| Orientación | Horizontal, con pantalla de "gira tu teléfono" | Ver la advertencia de la sección 3. |
| FPS objetivo | 60 en iPhone 12 o más nuevo, 30 aceptable en modelos viejos | |
| Tamaño del mapa Fase 0 | 200 x 200 metros | La colonia final crece a lo mucho al doble. |

**Dependencias iniciales:**
```
three @react-three/fiber @react-three/drei @react-three/rapier zustand
```
Dev: `vite`, `typescript`, `vite-plugin-pwa`

---

## 2. Presupuestos de rendimiento (Safari en iPhone)

Safari en iOS es más estricto con memoria que Chrome en desktop. Si te pasas, la pestaña se recarga sola en medio del juego. Respeta esto desde el greybox.

**Lo más importante de todo: limitar el device pixel ratio.**
El iPhone reporta un DPR de 3. Renderizar a 3x es la causa número uno de que un juego 3D vaya a 15 FPS en iPhone. Se limita a 1.5 máximo:
```js
<Canvas dpr={[1, 1.5]} />
```
Esto solo puede ser la diferencia entre 20 y 60 FPS. No es negociable.

**Geometría**
- Máximo ~120,000 triángulos visibles a la vez
- Personaje: máximo 10,000 tris
- Pipa: máximo 20,000 tris
- Edificio de fondo: 200 a 800 tris
- Usa `InstancedMesh` para todo lo repetido (postes, botes, bardas, banquetas). Cientos de copias, un solo draw call.
- Objetivo: menos de 100 draw calls por frame

**Texturas**
- Máximo 1024x1024 para personaje y pipa, 512x512 para lo demás
- Formato KTX2 con compresión Basis (se descomprime en GPU, ocupa mucho menos memoria que PNG)
- Atlas compartido para todos los props del ambiente
- Presupuesto total de descarga: menos de 20 MB para que cargue rápido en datos móviles

**Modelos**
- GLB con compresión Draco o Meshopt
- Un solo GLB para todo el ambiente estático, no 40 archivos

**Iluminación**
- Una `directionalLight` (el sol) más una `ambientLight` o `hemisphereLight`
- Sombras: una sola cascada, `shadow-mapSize` de 1024, y `shadow-camera` ajustada apretada alrededor del jugador. O mejor: sombra tipo blob (un círculo bajo el personaje y la pipa) y sombras horneadas en las texturas.
- **Prohibido en Fase 0:** postprocessing pesado, SSAO, bloom, reflejos. Si quieres bloom después, mídelo antes.

**Física**
- Colisiones con `cuboid`, `ball`, `capsule`. Nada de trimesh para el mundo salvo el suelo.
- Física a paso fijo de 60 Hz aunque el render vaya a 30

---

## 3. Cosas específicas de iOS que hay que resolver desde el día uno

Estas te van a morder si las dejas para después.

**No hay API de pantalla completa en Safari de iPhone.** No puedes forzar fullscreen desde el código. La única forma de quitar la barra del navegador es que el usuario haga "Agregar a pantalla de inicio" y que el manifest tenga `"display": "standalone"`. Hay que poner una pantalla que le explique esto al jugador la primera vez.

**No se puede bloquear la orientación.** iOS ignora el campo `orientation` del manifest y no soporta `screen.orientation.lock()`. La solución: detectar con CSS o `matchMedia` cuando está en vertical y mostrar una pantalla de "gira tu teléfono".

**El audio necesita un gesto del usuario.** Nada de sonido puede arrancar hasta que el jugador toque algo. Se resuelve con una pantalla de "Tocar para empezar" que además sirve para lo anterior.

**El notch y la barra de gestos.** Hay que usar `viewport-fit=cover` en el meta viewport y `env(safe-area-inset-*)` en el CSS del HUD. Nada tocable en las esquinas superiores ni pegado al borde inferior.

**El navegador puede matar la pestaña si te pasas de memoria.** Por eso los presupuestos de arriba.

**Gestos del sistema.** Hay que prevenir el zoom por doble tap, el pull-to-refresh y la selección de texto: `touch-action: none`, `user-select: none`, `overscroll-behavior: none`.

---

## 4. Controles táctiles

Es la parte que decide si el juego se siente bien o no. Todo con Pointer Events, no con eventos de mouse.

### A pie
- **Joystick virtual izquierdo:** dinámico, aparece donde el pulgar toque dentro de la mitad izquierda de la pantalla. No fijo.
- **Mitad derecha:** arrastrar para orbitar la cámara. Sin botón visible.
- **Correr:** automático al empujar el joystick al tope, con barra de resistencia. Cero botones extra.
- **Botón de contexto (abajo a la derecha):** aparece solo cuando hay algo cerca. Cambia de etiqueta: "Subir", "Entrar", "Ofrecer servicio".

### Manejando
- **Volante:** hay que probar las tres en el teléfono, no decidirlo en papel
  - A: botones táctiles izquierda/derecha abajo a la izquierda
  - B: giroscopio, inclinar el teléfono (en iOS requiere pedir permiso con `DeviceOrientationEvent.requestPermission()` tras un gesto del usuario)
  - C: joystick virtual solo horizontal
- **Acelerador y freno:** botones grandes a la derecha
- **Cámara:** automática detrás, con arrastre libre que regresa solo
- **Bajarse:** el botón solo aparece con velocidad en cero

### Reglas de UI móvil
- Ningún elemento tocable menor a 44x44 px CSS (mínimo de Apple)
- Multitouch real: joystick y cámara al mismo tiempo, cada uno rastreando su propio `pointerId`
- El HUD nunca tapa el centro de la pantalla
- El HUD va en DOM sobre el canvas, no dentro de la escena 3D

---

## 5. Estructura del proyecto

```
pipero/
├── index.html                     # meta viewport con viewport-fit=cover
├── vite.config.ts
├── public/
│   ├── manifest.webmanifest
│   └── models/                    # GLB (vacío en Fase 0)
└── src/
    ├── main.tsx
    ├── App.tsx                    # gates: orientación, tap-to-start, canvas
    ├── game/
    │   ├── Scene.tsx              # <Canvas> + <Physics> + mundo
    │   ├── player/
    │   │   ├── Player.tsx
    │   │   └── usePlayerMovement.ts
    │   ├── vehicle/
    │   │   ├── Pipa.tsx
    │   │   ├── useVehicleController.ts
    │   │   └── useTankSlosh.ts
    │   ├── camera/
    │   │   └── ThirdPersonCamera.tsx
    │   ├── world/
    │   │   ├── ColoniaGreybox.tsx
    │   │   └── Interactable.tsx
    │   └── systems/
    │       └── useInteractionScan.ts
    ├── state/
    │   ├── gameStore.ts           # zustand: modo, posición de la pipa, nivel del tanque
    │   └── inputStore.ts          # zustand: estado de los controles táctiles
    ├── ui/
    │   ├── HUD.tsx
    │   ├── VirtualJoystick.tsx
    │   ├── DriveControls.tsx
    │   ├── ContextButton.tsx
    │   ├── OrientationGate.tsx
    │   └── TapToStart.tsx
    └── styles/
        └── global.css             # touch-action, safe-area, sin selección
```

**Regla de arquitectura crítica:** el estado del juego que cambia cada frame (posición, velocidad, input) se lee y escribe con `useRef` y `getState()` de zustand dentro de `useFrame`. **Nunca** con `useState`, o React re-renderiza 60 veces por segundo y se cae el rendimiento. Solo el estado que cambia poco (modo a pie o manejando, texto del botón) va suscrito a React.

---

## 6. Orden exacto de construcción

Este es el orden en que le pides las cosas a Claude Code. **Uno a la vez, probando en tu iPhone antes de pasar al siguiente.**

### Paso 1 — Andamio y gates de iOS
Proyecto Vite + React + TS, dependencias instaladas, `<Canvas>` con `dpr={[1, 1.5]}` mostrando un plano y una luz. Más: gate de orientación, pantalla de tap-to-start, manifest PWA, CSS con `touch-action: none` y safe areas, meta viewport con `viewport-fit=cover`. Deploy a Vercel.

*Prueba:* abre el link en tu iPhone. En vertical debe decir que gires el teléfono. En horizontal, tap para entrar, y ves un plano gris sin barras raras. Agrégalo a pantalla de inicio y vuelve a probar.

### Paso 2 — Joystick virtual y sistema de input
`VirtualJoystick.tsx` con Pointer Events, modo dinámico, zona muerta, salida normalizada. `inputStore` con zustand. Multitouch: joystick y arrastre de cámara con `pointerId` independientes.

*Prueba:* dos dedos a la vez, sin que se peleen. Overlay de debug mostrando los valores.

### Paso 3 — Personaje a pie
Cápsula con `RigidBody` de Rapier en modo kinematic character controller. Movimiento relativo a la cámara, aceleración y desaceleración suaves, gravedad, caminar y correr con barra de resistencia, rotación suave hacia la dirección de movimiento.

*Prueba:* caminar se siente responsivo, sin patinar. 60 FPS en tu iPhone.

### Paso 4 — Cámara en tercera persona
Cámara que sigue con suavizado (lerp con delta time, no valores fijos), arrastre táctil para orbitar, límites de ángulo vertical, y raycast hacia el jugador para acercarla cuando hay una pared. FOV 70 a pie, 78 manejando.

*Prueba:* caminar pegado a una pared sin que la cámara la atraviese.

### Paso 5 — Mundo greybox
Cuadrícula de 4x4 manzanas, calles de 8 m, banquetas de 15 cm, edificios como cajas de alturas variadas, 6 locales de color distinto, un pozo o toma de agua en una esquina, topes y baches. Todo generado por código con `InstancedMesh`, 200x200 m. Colliders primitivos.

*Prueba:* correr de un extremo al otro toma entre 60 y 90 segundos. Draw calls por debajo de 100.

### Paso 6 — La pipa (manejo)
`DynamicRayCastVehicleController` de Rapier con 4 ruedas. Masa alta (unas 12 toneladas cargada), aceleración lenta, frenado largo, radio de giro amplio. **Debe sentirse pesada, no como un carro deportivo.** Ese es el punto.

*Prueba:* frenar desde velocidad máxima toma varios segundos y se siente satisfactorio, no frustrante.

### Paso 7 — Chapoteo del agua (el gancho)
`useTankSlosh.ts`. Una variable `fillLevel` de 0 a 1. Calcula un desplazamiento del centro de masa según la aceleración lateral y longitudinal, con retraso e inercia (el agua responde tarde y se sigue moviendo cuando ya frenaste). Aplica el offset al `centerOfMass` del rigidbody.

Regla de diseño: **media pipa debe ser más difícil de manejar que llena o vacía.** El efecto es máximo cerca de 0.5 y mínimo en 0.0 y 1.0.

*Prueba:* con el tanque a la mitad, un volantazo se siente notoriamente distinto que con el tanque lleno. Si no lo notas, súbele hasta que se note, luego bájale hasta que sea justo.

### Paso 8 — Subir y bajar de la pipa
`gameStore` con modo (`ON_FOOT` o `DRIVING`) y la posición y rotación de la pipa. Zona de detección en la puerta. El botón de contexto dice "Subir". Al presionarlo: se esconde el personaje, la cámara transiciona a la pipa en medio segundo, el HUD cambia a controles de manejo. Al bajar, el personaje reaparece a un lado.

**La pipa se queda exactamente donde la dejaste.** Su transform vive en el store, no en el componente.

*Prueba:* subir, manejar tres cuadras, bajar, caminar de regreso al inicio, voltear. La pipa sigue ahí.

### Paso 9 — Interacción con locales
Componente `Interactable` con radio de detección y texto de prompt. Los 6 locales lo usan. El escaneo de proximidad corre en `useFrame` con throttle (cada 100 ms, no cada frame). Por ahora solo muestra "Ofrecer servicio" y hace un `console.log`.

### Paso 10 — HUD mínimo
Velocímetro, nivel del tanque, barra de resistencia, botón de contexto, joystick. Nada más. Todo en DOM, con tamaños táctiles correctos y safe areas.

---

## 7. Criterios de aceptación de Fase 0

No pases a Fase 1 hasta que **todos** se cumplan **en tu iPhone**, no en el navegador de tu compu:

- [ ] 60 FPS estables en el iPhone (o 30 muy estables si es modelo viejo)
- [ ] La carga inicial toma menos de 5 segundos en datos móviles
- [ ] Instalado en pantalla de inicio, sin barras del navegador
- [ ] El gate de orientación funciona al girar el teléfono
- [ ] Los controles táctiles responden sin lag perceptible
- [ ] Multitouch: mover y girar cámara al mismo tiempo
- [ ] Nada del HUD queda tapado por el notch o la barra de gestos
- [ ] No hay zoom accidental, ni pull-to-refresh, ni selección de texto
- [ ] La pipa se siente pesada y creíble
- [ ] El chapoteo del agua se nota y cambia cómo manejas
- [ ] Subir y bajar funciona sin bugs, 20 veces seguidas
- [ ] La pipa permanece donde se estacionó, siempre
- [ ] La pestaña no se recarga sola después de 10 minutos jugando
- [ ] Caminar 3 minutos por el mapa se siente bien, no tedioso

---

## 8. Cómo trabajar con Claude Code

- **Local, no en la web.** Necesitas correr `npm run dev` y ver la consola.
- Git inicializado con un commit inicial **antes** de la primera sesión. Un commit por cada paso de la sección 6.
- Dale este documento como contexto al inicio de cada sesión.
- **Un paso a la vez.** Pide el Paso 3, pruébalo en el iPhone, commit, luego el Paso 4.
- Para probar en tu iPhone durante desarrollo: `npm run dev -- --host` y abres la IP local de tu compu desde el teléfono, con ambos en el mismo WiFi. Así no tienes que hacer deploy para cada prueba.
- Cuando algo se sienta mal, descríbelo con sensación, no con números: "se siente resbaloso", "tarda mucho en arrancar", "la cámara marea". Deja que él proponga valores.
- Todos los números de tuning (masa, aceleración, fuerza del chapoteo) van en un archivo `tuning.ts` central, y pide un panel de debug con `leva` para ajustarlos en vivo desde el teléfono.
- Pide siempre un overlay de debug con FPS, draw calls, triángulos y estado del vehículo. Te va a ahorrar horas.

---

## 9. Lo que NO se hace en Fase 0

- Nada de arte, texturas ni modelos GLB
- Nada de audio
- Nada de misiones ni economía
- Nada de personalización de la pipa
- Nada de tráfico ni peatones
- Nada de menús ni guardado
- Nada de ciclo día/noche
- Nada de postprocessing

Todo eso es mucho más fácil de agregar sobre una base que ya se siente bien.
