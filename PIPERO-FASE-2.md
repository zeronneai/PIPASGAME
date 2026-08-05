# PIPERO — Documento de Fase 2 (Progresión y personalización)

**Continúa desde la Fase 1**, taggeada como `v0.2-fase1`.

**Objetivo de esta fase:** darle destino al dinero. Hasta ahora ganas y el número sube, nada más. Aquí ese número se convierte en una pipa mejor, y la pipa mejor te deja tomar trabajos que antes no podías.

Sigue siendo greybox, con una excepción que se explica en la sección 6.

**Tiempo estimado:** 3 a 4 semanas.

---

## 1. Las tres decisiones que definen esta fase

**Modelos base más mejoras por partes.** Compras una pipa distinta (el salto grande, ocasional) y además mejoras la que traes pieza por pieza (el avance constante). Los dos ejes se necesitan: sin modelos base no hay momento de "por fin", sin mejoras no hay progreso entre uno y otro.

**La personalización visual es solo estética.** No sube tasas de aceptación ni da bonos. Y está bien que así sea: en cuanto lo cosmético afecta el rendimiento, el jugador deja de elegir lo que le gusta y empieza a elegir lo óptimo. Al separarlo, cada quien arma su pipa como se le antoje sin sentir que se castiga solo. Es lo que hace que la gente comparta capturas.

**La segunda se desbloquea con reputación, no con dinero.** Es un logro, no una compra. Ganarte una colonia te da algo que el dinero no compra, y eso le da peso a la reputación más allá de que te acepten pedidos.

---

## 2. El garage

Todo esto vive en un lugar físico del mapa: **el taller** (o el lote, según lo que compres). Un punto al que llegas manejando, no un menú que abres desde cualquier lado.

Que sea un lugar importa: te obliga a decidir cuándo vale la pena interrumpir la jornada para ir. Comprar deja de ser gratis y se vuelve parte de la planeación.

Dentro del taller, tres pestañas:

- **Lote:** comprar un modelo base distinto
- **Mejoras:** subir de nivel las partes de la pipa que traes
- **Estilo:** pintura, rótulos, calcas, cromo

---

## 3. Los modelos base

Tres, con perfiles claramente distintos. No es que uno sea mejor: es que cada uno abre un tipo de trabajo.

| | **La heredada** | **La mediana** | **La grandota** |
|---|---|---|---|
| Capacidad | 5,000 L | 10,000 L | 20,000 L |
| Tara | Ligera | Media | Pesada |
| Manejo | Ágil, cabe en callejones | Equilibrada | Torpe, no entra a todos lados |
| Velocidad | Media | Media | Baja pero constante |
| Precio | Con la que empiezas | Media | Alta |
| Sirve para | Muchas entregas chicas, colonias apretadas | Todo | Obras y pedidos grandes |

**La clave del diseño:** la grandota no debe ser simplemente mejor. Debe haber calles del mapa donde no quepa, clientes a los que no puedas llegar, y maniobras que se vuelvan un martirio. Si la grandota es superior en todo, los otros dos modelos dejan de existir y la progresión se acaba.

Cuando compras un modelo nuevo, **conservas el anterior** y puedes cambiar entre ellos en el taller. Elegir con qué pipa sales hoy es parte del juego.

---

## 4. Las mejoras por partes

Seis categorías, tres niveles cada una. Cada nivel cuesta más que el anterior.

| Parte | Qué mejora | Qué cuesta |
|---|---|---|
| **Tanque** | Capacidad en litros | Sube la tara, se vuelve más pesada |
| **Motor** | Aceleración y velocidad máxima | Se calienta más rápido |
| **Bomba** | Velocidad de carga en el pozo y de descarga | Nada, es mejora limpia |
| **Suspensión** | Aguanta topes y baches, menos vuelco | Sube la tara |
| **Llantas** | Agarre en curva, frenado | Se desgastan más rápido |
| **Enfriamiento** | Aguantas más la segunda antes de sobrecalentar | Nada, pero es cara |

**Regla de diseño:** casi toda mejora debe traer un costo, no solo un beneficio. Si todas son puro sí, no hay decisión, solo hay orden de compra. Las dos que no tienen costo (bomba y enfriamiento) se compensan con precio alto.

Las mejoras son **por pipa**, no globales. Si compras la grandota, empieza sin mejoras. Eso hace que cambiar de modelo sea una decisión real y no un upgrade automático.

---

## 5. El estilo

Puramente cosmético. Cero efecto en el juego.

- **Pintura:** color de la cabina y color del tanque, por separado
- **Rótulos:** el texto que va en el tanque o la defensa, escrito por el jugador ("Chuy el Pipero", "Aguas de la Colonia", lo que sea)
- **Calcas:** un conjunto de calcomanías que se colocan en zonas definidas del tanque
- **Cromo:** defensa, espejos, escapes, rines
- **Detalles:** claxon, luces de colores, cortinas

Todo esto es barato comparado con las mejoras. La idea es que puedas verte bien desde temprano, no que sea el premio final.

**El chiste técnico está en la jerarquía separada** que construiste desde el Paso 6 de la Fase 0: cabina, tanque, defensa, rines y zona de calcas ya son objetos independientes. Por eso esto es viable ahora y no habría sido posible con una malla monolítica.

---

## 6. La excepción al greybox

Esta fase toca lo visual por necesidad: la personalización no se puede probar sobre cubos grises idénticos. Pero **no es la fase de arte**.

Lo que sí se hace:
- Materiales con color intercambiable en cabina, tanque, defensa y rines
- Una zona plana definida en el tanque donde caen rótulos y calcas
- Texturas simples generadas o placeholders, sin modelado nuevo
- Que la pipa se vea distinta según lo que le pusiste, aunque sea burdo

Lo que **no** se hace: modelado detallado, texturas finales, iluminación bonita. Eso sigue siendo Fase 3.

Presupuestos de la sección 2 del documento de Fase 0, vigentes. Y cuida el bundle: agregar texturas es la forma más fácil de romper el presupuesto de descarga.

---

## 7. Orden de construcción

### Paso 1 — Modelo de datos del garage
`src/game/systems/garage.ts` con funciones puras: definición de modelos base, definición de mejoras y sus efectos, cálculo de las estadísticas finales de una pipa dada su configuración. Extender el store con las pipas que posees, la que traes equipada, y la configuración de cada una. Persistencia.

**Refactor clave:** la física de la pipa debe leer sus valores del cálculo de estadísticas del garage, no de constantes fijas. Hoy están en `tuning.ts`; pasan a ser el modelo base más las mejoras.

*Prueba:* cambias valores en leva y la pipa responde igual que antes. Nada se rompió.

### Paso 2 — El taller
Ubicación física en el mapa, detección de proximidad, pantalla con las tres pestañas. Por ahora vacías.

*Prueba:* llegas manejando, abres el taller, se ve bien en el teléfono.

### Paso 3 — Mejoras por partes
Las seis categorías con tres niveles, sus precios, sus efectos y sus costos. Comprar aplica cambios inmediatos a la física.

*Prueba:* compras motor nivel 2 y la diferencia se siente al manejar. Compras tanque nivel 2 y la pipa se siente más pesada.

### Paso 4 — Modelos base
Los tres modelos, comprarlos, conservarlos y cambiar entre ellos. Cada uno con sus mejoras independientes.

*Prueba:* manejas los tres y se sienten claramente distintos. La grandota no cabe en al menos dos calles del mapa.

### Paso 5 — El estilo
Pintura, rótulos con texto libre, calcas, cromo. Todo cosmético, guardado en el store, visible en el mundo.

*Prueba:* armas tu pipa, sales a la calle, y se ve distinta a la de inicio.

### Paso 6 — La segunda desbloqueable
Quítala del inicio. Se desbloquea al llegar a cierto nivel de reputación en una colonia, con un momento claro de logro.

*Prueba:* juegas sin ella y se siente que te falta algo. Al desbloquearla, se siente ganada.

### Paso 7 — Balance de la economía completa
Ahora el dinero tiene destino. Hay que rebalancear todo: cuánto ganas por jornada contra cuánto cuestan las cosas, y cuántas jornadas toma cada hito.

*Prueba:* la primera mejora se siente alcanzable en dos o tres jornadas. La segunda pipa, en diez o quince.

---

## 8. Criterios de aceptación de Fase 2

En el iPhone:

- [x] Todo lo de la Fase 1 sigue funcionando igual
- [x] 60 FPS y bundle bajo control
- [x] Los tres modelos base se sienten distintos, y ninguno es superior en todo
- [x] La grandota tiene desventajas reales de navegación en el mapa
- [x] Cada mejora se nota al manejar, no solo en un número
- [x] Las mejoras con costo (tara, calentamiento, desgaste) hacen que dudes antes de comprar
- [x] La personalización visual se ve en el mundo, no solo en el menú
- [x] La segunda se siente ganada, no regalada
- [x] Después de una jornada tienes algo concreto que quieres comprar
- [x] El progreso se siente constante: nunca pasas cinco jornadas sin poder comprar nada

**El penúltimo punto es el que importa.** Si terminas una jornada y no hay nada que quieras, la progresión no está funcionando y lo que hay que mover son los precios, no el código.

---

## 9. Lo que NO se hace en Fase 2

- Arte final, modelado detallado, texturas de producción (Fase 3)
- Audio
- Más colonias
- Tráfico y peatones
- Clima y ciclo día/noche

---

## 10. Notas para trabajar con Claude Code

- El Paso 1 es un refactor y toca todo lo que ya funciona. Usa Plan Mode y no lo apures.
- Todos los precios y efectos en `balance.ts`, expuestos en leva. Vas a moverlos muchísimo en el Paso 7.
- Tests unitarios para `garage.ts`, sobre todo para el cálculo de estadísticas finales. Un bug ahí se siente como que el juego está mal balanceado y es dificilísimo de rastrear a mano.
- Revisa el bundle al cerrar cada paso, sobre todo el Paso 5.
- `git pull` al empezar y `git push` al terminar cada vez que cambies de máquina.
