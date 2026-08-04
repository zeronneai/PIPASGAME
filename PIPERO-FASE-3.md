# PIPERO — Documento de Fase 3 (Arte y dirección visual)

**Continúa desde la Fase 2**, taggeada como `v0.3-fase2`.

**Objetivo de esta fase:** que el juego se vea como un juego y no como un prototipo. El sistema completo ya funciona; aquí se le pone cara.

**Tiempo estimado:** 4 a 6 semanas. Es la fase más larga y la que más depende de tu criterio visual, no del código.

---

## 1. La dirección visual

**Estilizado con toque de rótulo mexicano.** Colores saturados, texturas pintadas a mano, formas legibles.

Y esto no es solo gusto: **es la decisión técnicamente más inteligente que podías tomar para un juego en celular.**

Un estilo realista necesita PBR, normal maps, roughness maps, iluminación cara y texturas de 2K. En Safari de iPhone eso te tumba los FPS y te infla el bundle. El estilo pintado a mano hace lo contrario: la información visual vive en la textura, no en la iluminación, así que puedes usar materiales baratísimos y aun así verte bien.

Además es el estilo que envejece mejor. Un juego realista de 2026 se ve viejo en 2029; uno estilizado bien hecho no.

### Especificaciones concretas

**Modelo de sombreado:** `MeshLambertMaterial` o `MeshToonMaterial`, nunca `MeshStandardMaterial`. Sin normal maps, sin roughness, sin metalness. La luz aporta poco, la textura aporta todo.

**Paleta:** saturada y cálida. Cal, ocre, terracota, azul añil, verde limón, rosa mexicano. Los rótulos y anuncios pintados son los acentos de máximo contraste. El asfalto y el cielo son lo único desaturado, para que todo lo demás resalte.

**Texturas:** planas y pintadas, con la sombra ya incluida en el dibujo. Nada de fotos. 512x512 para casi todo, 1024 solo para el personaje y la pipa.

**Colores por vértice para los edificios.** Esto es clave: la mayoría de la colonia no necesita textura, solo color plano por vértice más un poco de variación. Cero memoria de textura, cero draw calls extra, y encaja perfecto con el estilo.

**Referencias que definen el look:** las fachadas pintadas de una colonia, los rótulos de lonchería hechos a mano, los tinacos negros y las bardas de bloque con cal encima. Eso es la textura del juego.

---

## 2. Cómo resolver los modelos sin Blender

No saber Blender no te bloquea. Este es el pipeline que sí funciona.

### 2.1 De dónde salen los modelos

**Packs de assets gratuitos, para lo genérico.** Kenney y Quaternius tienen colecciones low-poly en licencia CC0 (uso libre, sin atribución). Postes, botes, bancas, señales, árboles, mobiliario urbano. Es la base más rápida y ya vienen optimizados.

**Generación por IA, para lo específico.** Lo que no existe en ningún pack: el tinaco elevado, la parroquia, la pipa detallada, los puestos de la calle. Tienes Higgsfield conectado, que puede generar mallas GLB directamente y también imágenes para las texturas.

**Generado por código, para lo repetitivo.** Los edificios de la colonia no se modelan uno por uno: se generan por código a partir del layout que ya existe, con variación de altura, color y detalles. Ya lo estás haciendo en gris; aquí solo se le agrega variedad visual.

**El personaje es caso aparte.** Necesita esqueleto y animaciones, y eso sí es trabajo de Blender. La salida: usar un personaje ya riggeado y animado de Quaternius o Kenney (vienen con caminar, correr e idle incluidos) y solo cambiarle la textura al estilo del juego. Te ahorras la parte más difícil por completo.

### 2.2 Cómo optimizarlos sin Blender

Este es el reemplazo de Blender y funciona desde la terminal:

```
npx @gltf-transform/cli optimize entrada.glb salida.glb
```

Eso hace, en un comando: comprimir la geometría, reducir y comprimir las texturas, quitar datos que no se usan, y unir materiales. Un GLB de 8 MB puede bajar a 400 KB sin que se note.

**Regla:** ningún modelo entra al proyecto sin pasar por ahí. Ninguno.

### 2.3 Las texturas pintadas

Las genera Higgsfield como imágenes y se usan directamente, o se generan por código con canvas para las cosas simples (asfalto, cal, bloque). Los rótulos con texto se generan en tiempo real con canvas, que además es lo que ya necesitas para los rótulos personalizados de la pipa de la Fase 2.

---

## 3. Presupuestos (ahora sí es donde se rompen)

Todo lo anterior sigue vigente, y estos son los que hay que vigilar de cerca:

| Concepto | Límite |
|---|---|
| Triángulos visibles | 120,000 |
| Draw calls | menos de 100 |
| Bundle inicial | menos de 100 kB gzip |
| Assets totales descargados | menos de 20 MB |
| Texturas | 512 casi todo, 1024 solo personaje y pipa |
| Formato de textura | KTX2 con compresión Basis |
| Formato de modelo | GLB con Draco o Meshopt |
| FPS | 60 en iPhone 12 o más nuevo |

**El de assets totales es el nuevo enemigo.** Hasta ahora no tenías arte y por eso ibas holgado. Cada modelo y cada textura que agregues come de esos 20 MB. Mide después de cada paso.

**Carga progresiva:** los assets no se descargan todos al inicio. Lo esencial primero (personaje, pipa, calle), el resto mientras el jugador ya está jugando.

---

## 4. Orden de construcción

Tu orden: colonia, personaje, pipa. Lo respeto, con una nota al final.

### Paso 1 — El sistema de materiales y la paleta
Antes de meter un solo modelo. Definir la paleta completa en `theme.css` y en un archivo de materiales del juego. Cambiar todos los materiales de la escena de `MeshStandardMaterial` a Lambert o Toon. Cielo con gradiente, niebla lineal cálida, y la luz direccional recalibrada para el nuevo sombreado.

*Prueba:* el greybox gris ahora se ve con color y ambiente, aunque siga siendo cubos. Los FPS deben **subir**, no bajar.

### Paso 2 — La colonia: fachadas y color
Los edificios generados por código dejan de ser cajas grises: colores por vértice, variación de altura y ancho, bardas, portones, ventanas, azoteas con tinaco. Todo procedural, sin modelos externos.

*Prueba:* la colonia se siente un lugar, no un diagrama. Draw calls bajo control.

### Paso 3 — La colonia: props y detalle
Aquí entran los packs y lo generado por IA: postes, cables, botes, letreros, puestos, tinacos, antenas, macetas, ropa tendida. Todo con `InstancedMesh`.

*Prueba:* caminar por una calle se siente denso y con vida. Sigue en 60 FPS.

### Paso 4 — Los cuatro hitos
La parroquia, el tinaco elevado, la bodega y la escuela dejan de ser cajas altas y se vuelven referencias reconocibles. Son lo que ves desde lejos, así que merecen atención individual.

*Prueba:* puedes navegar la colonia sin minimapa, orientándote solo por ellos.

### Paso 5 — Las calles
Asfalto con textura, banquetas, guarniciones, rayado, baches visibles, topes pintados de amarillo, coladeras.

*Prueba:* manejar se siente distinto porque ahora lees la calle.

### Paso 6 — El personaje
Modelo riggeado de un pack, retexturizado al estilo del juego, con animaciones de idle, caminar, correr, subir y bajar de la pipa, y el minijuego de la manguera. Adiós a la cápsula con punto azul.

*Prueba:* correr por la calle se ve bien desde la cámara de tercera persona.

### Paso 7 — La pipa
Modelo detallado respetando la jerarquía separada de partes que existe desde la Fase 0, para que la personalización de la Fase 2 siga funcionando. Cabina, tanque, defensa, rines, zona de calcas, manguera, escaleras.

*Prueba:* toda la personalización de la Fase 2 sigue funcionando sobre el modelo nuevo.

### Paso 8 — Iluminación y ambiente final
Sombras horneadas donde se pueda, un ciclo de luz simple (mañana, mediodía, tarde) ligado a la hora de la jornada que ya existe, y ajuste final de color.

*Prueba:* las tres horas del día se sienten distintas sin costar FPS.

### Paso 9 — Audio
Motor, agua, calle, claxon, radio. No es arte visual pero cierra la fase, y es lo que más cambia la sensación por lo poco que cuesta.

---

## 5. Criterios de aceptación

- [ ] 60 FPS en iPhone con la colonia completa, props, personaje y pipa
- [ ] Assets totales por debajo de 20 MB
- [ ] Bundle inicial por debajo de 100 kB gzip
- [ ] Carga inicial en menos de 5 segundos en datos móviles
- [ ] Todo lo de las Fases 1 y 2 sigue funcionando idéntico
- [ ] La personalización de la Fase 2 funciona sobre la pipa nueva
- [ ] Puedes navegar sin minimapa usando los hitos
- [ ] Una captura del juego se ve lo suficientemente bien como para querer compartirla

**El último punto es el criterio real de la fase.**

---

## 6. Lo que NO se hace en Fase 3

- Más colonias (queda para después, según tu decisión)
- Tráfico y peatones
- Clima
- Cinemáticas o historia

---

## 7. Notas

- **Mide después de cada paso.** FPS, draw calls, triángulos y peso de assets. En esta fase el rendimiento se degrada poco a poco y si no mides, te das cuenta cuando ya es tarde y no sabes qué lo causó.
- **Ningún modelo entra sin pasar por `gltf-transform`.**
- Trabaja el Paso 1 completo antes de meter un solo asset. Si los materiales y la paleta no están definidos, cada modelo va a llegar con su propio look y va a quedar un collage.
- **Una nota sobre tu orden:** el personaje está en el Paso 6, pero es lo que ves el 100% del tiempo que juegas. Si en algún momento la cápsula te empieza a estorbar más que la colonia gris, adelántalo sin culpa. El orden es una guía, no una regla.
