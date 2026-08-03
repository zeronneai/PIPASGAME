# PIPERO — Documento de Fase 1 (El loop económico)

**Continúa desde la Fase 0**, que está completa y taggeada como `v0.1-fase0`.

**Objetivo de esta fase:** que el juego se pueda jugar. Ofreces servicio, a veces te aceptan, arranca el reloj, cargas agua, entregas, cobras. Repetible diez veces seguidas sin bugs, y con ganas de repetirlo una vez más.

Sigue todo en cubos grises. Nada de arte todavía.

**Tiempo estimado:** 3 a 4 semanas.

---

## 1. Las tres decisiones que definen esta fase

**Los pedidos salen de dos lados.** Tocando puertas a pie desde el inicio. El radio de despacho se desbloquea con reputación, y es la primera recompensa real de progresión del juego.

**El castigo por llegar tarde depende del cliente.** No hay una sola regla. Doña Chela te perdona diez minutos; el gerente de la obra no te perdona ninguno. Eso convierte cada pedido en información que vale la pena leer.

**El agua se cobra por litros, y un tanque puede surtir a varios clientes.** Esta es la decisión más importante de las tres, porque convierte el juego de "haz un mandado" a "planea una ruta". Ahora tienes que decidir a quién le dices que sí, en qué orden vas, y si te alcanza el tanque o tienes que regresar al pozo a media ruta.

---

## 2. Los sistemas

### 2.1 El tanque y los litros

- Capacidad inicial: **10,000 litros** (la pipa mediana estándar en México)
- `fillLevel` de la Fase 0 pasa a ser `litrosActuales / capacidad`. Ya no es un deslizador de debug, ahora es estado real del juego.
- Cada entrega descuenta litros. La masa y el chapoteo responden solos, porque ya están conectados a `fillLevel`.
- Si te quedas sin litros a media ruta, tienes que ir al pozo, y el reloj de los pedidos pendientes no se detiene.

### 2.2 El pozo

- Uno solo en el mapa de Fase 1, el que ya está en el greybox.
- Cargar cuesta dinero: **precio por litro de compra**. Ahí está tu margen.
- Cargar toma tiempo real, proporcional a los litros. Llenar de cero toma cerca de un minuto de juego. No es tiempo muerto: es el costo de no haber planeado bien.
- Un medidor mientras carga, y puedes cortar la carga cuando quieras (cargar solo lo que necesitas es más rápido y te deja más ágil).

### 2.3 Los clientes

Cada local del greybox tiene un **perfil** que no cambia, y el jugador lo va aprendiendo. Tres arquetipos:

| Perfil | Ventana de tiempo | Si llegas tarde | Paga | Pide |
|---|---|---|---|---|
| **Paciente** | Amplia | Perdona bastante, pierdes poca propina | Poco por litro | Poco volumen |
| **Normal** | Media | Cobras menos, baja algo la reputación | Medio | Medio |
| **Exigente** | Corta | Cancela el pedido, castigo fuerte de reputación | Bien por litro | Mucho volumen |

El exigente es el que paga mejor y el que más te puede quemar. Ese es el trade-off central de cada decisión de aceptar o no.

**Importante:** el perfil debe ser legible antes de aceptar. No adivinanza. Un ícono, un color, algo que le diga al jugador en qué se está metiendo.

### 2.4 El sistema de aceptación

Nada de azar puro. Probabilidad ponderada por estos factores:

- **Reputación en esa colonia** (el factor de mayor peso)
- **Hora del día** (a las 7 am una fonda sí te compra, a las 4 pm ya no)
- **Historial con ese cliente** (si le has surtido bien, casi siempre acepta; si le fallaste, casi nunca)
- **Si ya tiene agua** (si le surtiste ayer, no necesita hoy)
- **Estado de la pipa** (esto se vuelve relevante en Fase 2 con la personalización, pero el gancho se deja puesto ahora)

El resultado sigue siendo aleatorio, pero el jugador siente que sus decisiones importan. Esa es toda la diferencia.

**Enfriamiento:** si un cliente te dice que no, no puedes volver a preguntarle inmediatamente. Un rato de espera, o hasta el día siguiente.

### 2.5 El reloj

Ventanas escalonadas, nunca falla dura salvo con el cliente exigente:

- **A tiempo:** pago completo más propina, sube reputación
- **Tarde:** pago reducido, la reputación baja o no según el perfil
- **Muy tarde:** el paciente y el normal te pagan lo mínimo; el exigente cancela

El reloj corre por pedido, no global. Con varios pedidos activos, cada uno tiene el suyo, y ahí está el problema interesante de en qué orden vas.

### 2.6 La entrega

- Te acercas al local con la pipa, no a pie
- Minijuego corto de la manguera: conectar, controlar la presión, no derramar. **Diez segundos máximo.** Si dura más, se vuelve tedioso a la décima entrega.
- Hacerlo bien da un bono; hacerlo mal desperdicia litros
- Se descuentan los litros pedidos, entra el dinero, se actualiza la reputación

### 2.7 Reputación

- Por colonia, no global. En Fase 1 hay una sola colonia, pero el sistema se construye por zona desde ahora para que Fase 3 no requiera rehacerlo.
- Sube: entregas a tiempo, minijuego limpio, surtir a clientes exigentes
- Baja: llegar tarde, cancelaciones, derramar
- **Al llegar a cierto nivel, se desbloquea el radio de despacho.** Ese es el hito de progresión de la fase.

### 2.8 El radio de despacho

Una vez desbloqueado, te llegan pedidos solos sin tener que tocar puertas.

- Notificación con cliente, colonia, litros y ventana de tiempo
- Puedes aceptar o rechazar
- Rechazar muchos seguidos baja un poco tu prioridad en el despacho
- Pagan mejor que los que consigues a pie, porque ya no gastaste tiempo caminando

### 2.9 La jornada

El juego necesita un ciclo con principio y fin, si no, nunca hay momento de "logré algo".

- Un día de juego dura entre 10 y 15 minutos reales
- Al terminar: pantalla de resumen con litros vendidos, dinero ganado, gasto en agua, ganancia neta, entregas a tiempo y tarde, cambio de reputación
- Guardado en `localStorage`: dinero, reputación por colonia, historial por cliente, día actual, posición de la pipa

---

## 3. Presupuestos que siguen vigentes

Todo lo de la sección 2 del documento de Fase 0 sigue aplicando: 120 mil triángulos, menos de 100 draw calls, `dpr` limitado a 1.5, 60 FPS en iPhone.

**Añade uno nuevo:** el bundle inicial se quedó en 67 kB gzip. No dejes que vuelva a crecer. Revisa el tamaño al cerrar cada paso.

**Y una regla de arquitectura:** toda la lógica de economía y estado del juego va en `src/game/systems/`, en funciones puras y testeables, separada de los componentes de React. Vas a querer ajustar los números cien veces, y no quieres estar cazándolos entre JSX.

---

## 4. Orden de construcción

Un paso a la vez, probando en el iPhone, commit por paso.

### Paso 1 — Modelo de datos y economía
`src/game/systems/economy.ts`, `clients.ts` y `reputation.ts` como funciones puras. Extender `gameStore` con dinero, litros, reputación por colonia, historial por cliente, día actual, pedidos activos. Guardado y carga en `localStorage`. Los 6 locales del greybox reciben perfil y colonia.

*Prueba:* recargas la página y el estado persiste.

### Paso 2 — El pozo
Cargar agua con costo, tiempo proporcional, medidor, y poder cortar la carga. Conectado al `fillLevel` que ya existe.

*Prueba:* cargas, se descuenta dinero, la pipa se siente más pesada, el chapoteo cambia.

### Paso 3 — Ofrecer servicio y aceptación
El botón "Ofrecer servicio" del Paso 9 de Fase 0 ahora sí hace algo. Probabilidad ponderada, enfriamiento tras un rechazo, y la pantalla del pedido con cliente, perfil, litros, ventana de tiempo y pago estimado, con opción de aceptar o no.

*Prueba:* ofreces a los 6 locales varias veces. Unos aceptan, otros no, y se siente justificado.

### Paso 4 — Pedidos activos y reloj
Cola de pedidos con su propio reloj cada uno. Lista de pedidos en el HUD. Indicador de dirección hacia el cliente. Estados de a tiempo, tarde y muy tarde.

*Prueba:* aceptas tres pedidos, los relojes corren independientes, y el HUD no estorba.

### Paso 5 — La entrega
Minijuego de manguera de diez segundos, descuento de litros, cálculo del pago según puntualidad y perfil, y entrada de dinero.

*Prueba:* haces diez entregas seguidas y el minijuego no se vuelve tedioso.

### Paso 6 — Reputación y consecuencias
Reputación por colonia conectada a todo: al sistema de aceptación, a los pagos, al desbloqueo del radio. Indicador visible del nivel.

*Prueba:* juegas mal a propósito una jornada y notas que cuesta más que te acepten.

### Paso 7 — El radio de despacho
Desbloqueo por reputación, notificaciones de pedido, aceptar o rechazar, penalización por rechazar de más.

*Prueba:* llegas al nivel, se desbloquea, y se siente como una recompensa.

### Paso 8 — La jornada y el resumen
Ciclo de día de 10 a 15 minutos, pantalla de resumen, guardado del progreso, arranque del día siguiente.

*Prueba:* juegas tres jornadas seguidas y quieres una cuarta.

---

## 5. Criterios de aceptación de Fase 1

En el iPhone, no en el editor:

- [ ] Diez ciclos completos seguidos (ofrecer, aceptar, cargar, entregar, cobrar) sin un solo bug
- [ ] El estado persiste al recargar la página
- [ ] Se siguen manteniendo 60 FPS con pedidos activos y HUD completo
- [ ] El bundle inicial sigue por debajo de 100 kB gzip
- [ ] Los relojes de varios pedidos corren correctos y en paralelo
- [ ] La aceptación se siente justificada, no aleatoria
- [ ] Los tres perfiles de cliente se sienten distintos
- [ ] Surtir a varios clientes con un tanque obliga a planear la ruta
- [ ] Quedarte sin agua a media ruta se siente como un error tuyo, no como algo injusto
- [ ] El desbloqueo del radio se siente ganado
- [ ] Una jornada completa dura entre 10 y 15 minutos
- [ ] Al terminar una jornada quieres jugar otra

**El último punto es el único que importa de verdad.** Si los otros once pasan y ese no, la fase no está lista, y lo que hay que revisar son los números de la economía, no el código.

---

## 6. Lo que NO se hace en Fase 1

- Nada de arte, texturas ni modelos
- Nada de audio
- Nada de personalización de la pipa (eso es Fase 2)
- Nada de mejoras compradas ni progresión de equipo (Fase 2)
- Nada de tráfico ni peatones
- Nada de más colonias (Fase 3)
- Nada de clima ni ciclo día/noche visual

---

## 7. Notas para trabajar con Claude Code

- Usa Plan Mode para los pasos 3, 4 y 6, que son los que tienen lógica interconectada.
- **Todos los números de economía van en un archivo `balance.ts` separado de `tuning.ts`**, y expuestos en leva. Vas a moverlos muchísimo.
- Pídele tests unitarios para `economy.ts` y `reputation.ts`. Son funciones puras y son el corazón del juego: un bug ahí no se ve, se siente como que el juego está mal balanceado, y eso es dificilísimo de diagnosticar a mano.
- Al cerrar cada paso, revisa el tamaño del bundle además de los FPS.
- Recuerda hacer `git pull` al empezar y `git push` al terminar, cada vez que cambies de máquina.
