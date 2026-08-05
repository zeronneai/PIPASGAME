import { balance, type Balance } from '../balance'
import { CLIENTES, type PerfilCliente } from './clients'
import { deliveryPayment, refillCost } from './economy'
import { tipRepFactor } from './reputation'
import {
  CATEGORIAS,
  MEJORAS,
  MODELOS,
  computeStats,
  pipaDeFabrica,
  precioMejora,
  precioModelo,
  type Categoria,
  type ModeloId,
  type Nivel,
  type PipaConfig,
} from './garage'

/*
 * LA PROYECCIÓN DE LA ECONOMÍA (Fase 2, Paso 7).
 *
 * El Paso 7 pide tres cosas medibles: que la primera mejora se alcance en dos
 * o tres jornadas, la segunda pipa en diez o quince, y que nunca pasen cinco
 * jornadas sin poder comprar nada. Eso no se puede afinar a ojo — son quince
 * precios y tres perfiles de cliente empujándose entre sí.
 *
 * Así que aquí vive el modelo: cuánto deja una jornada y cuántas jornadas
 * cuesta cada cosa, CALCULADO desde `balance` en vez de escrito a mano. Dos
 * consecuencias, que son la razón de que este archivo exista:
 *
 *   1. La tabla no se vuelve mentira. Mueves un precio en leva y las jornadas
 *      se recalculan solas; un documento con la tabla pegada envejece mal.
 *   2. Las metas del Paso 7 se vuelven TESTS. `proyeccion.test.ts` falla si
 *      un ajuste saca la primera mejora de su ventana, que es exactamente el
 *      error que de otro modo se descubre jugando veinte minutos.
 *
 * Es un modelo, no una medición: predice al jugador competente que no pierde
 * el tiempo. El jugador real anda abajo los primeros días y arriba cuando ya
 * se sabe el mapa. Sirve para comparar y para poner los precios en su orden
 * de magnitud, no para prometer un número exacto.
 */

/* ---- El modelo del ciclo ---- */

/**
 * Cuánto tarda UNA entrega, en las partes que no salen de `balance`.
 *
 * Esto NO es balance y por eso no va en `balance.ts`: son hechos del mundo y
 * de cómo se juega —qué tan lejos queda todo, qué tan rápido se maneja de
 * verdad— y moverlos no rebalancea el juego, le miente al modelo. Los que sí
 * son perillas (precio del agua, litros por segundo, duración de la jornada)
 * se leen de `balance` y por eso no están aquí.
 */
export const MODELO_JORNADA = {
  /**
   * Distancia en línea recta del pozo a un domicilio, promediada sobre los
   * seis locales. Medida del layout; `proyeccion.test.ts` la vuelve a medir y
   * falla si la traza cambia lo suficiente para invalidarla.
   */
  distanciaMediaMetros: 103,
  /** Las calles no van en línea recta: en una retícula se recorre más. */
  factorRuta: 1.35,
  /**
   * Qué fracción de la velocidad tope se sostiene de verdad, con vueltas,
   * topes y frenadas. La mitad es lo que da manejar una colonia de 200 m.
   * Sale de la pipa equipada, así que mejorar el motor SÍ mueve la proyección.
   */
  fraccionDeVelocidadTope: 0.5,
  /** Atinarle al marcador de conexión antes de que fluya el agua. */
  conexionSegundos: 3,
  /** Bajarse, ofrecer, aceptar, subirse — en el cliente y en la entrega. */
  tramiteSegundos: 12,
  /** Lo que cuesta un «no»: llegar al siguiente y volver a bajarse. */
  intentoFallidoSegundos: 18,
  /**
   * Cuántas veces se le alcanza a preguntar a un mismo cliente en un día. Un
   * «no» no lo quema: `cooldownMinutes` lo deja volver a preguntar, y en una
   * jornada de 12 minutos eso da varias vueltas. Sin esto el modelo trata
   * cada rechazo como definitivo y subestima el día entero.
   */
  intentosPorCliente: 2,
}

/**
 * Cómo se reparten los perfiles entre los clientes efímeros (`ephemeral.ts`):
 * un tercio de los spots son obra y dos tercios casa; la casa sale paciente o
 * normal a volados, y la obra normal o exigente. De ahí estos pesos.
 *
 * Los locales no se declaran: se cuentan de `CLIENTES`, que es el catálogo.
 */
const MEZCLA_EFIMEROS: Record<PerfilCliente, number> = {
  paciente: 1 / 3,
  normal: 1 / 2,
  exigente: 1 / 6,
}

/**
 * Con qué perfil te topas y con qué frecuencia, contando locales y efímeros.
 * Es lo que hace que subirle el precio al exigente mueva la jornada solo en
 * la proporción en que de verdad aparece.
 */
export function mezclaClientes(): Record<PerfilCliente, number> {
  const locales = Object.values(CLIENTES)
  const efimeros = efimerosPorJornada()
  const total = locales.length + efimeros
  const mezcla: Record<PerfilCliente, number> = {
    paciente: 0,
    normal: 0,
    exigente: 0,
  }
  for (const c of locales) mezcla[c.perfil] += 1 / total
  for (const perfil of Object.keys(mezcla) as PerfilCliente[]) {
    mezcla[perfil] += (MEZCLA_EFIMEROS[perfil] * efimeros) / total
  }
  return mezcla
}

/**
 * Cuántos efímeros distintos alcanzan a pasar por el mundo en una jornada:
 * los espacios activos, rotando cada vez que uno cumple su vida.
 */
function efimerosPorJornada(b: Balance = balance): number {
  const vidaSegundos = ((b.efimeros.vidaMin + b.efimeros.vidaMax) / 2) * 60
  const jornadaSegundos = b.jornada.minutosReales * 60
  return (b.efimeros.maxActivos * jornadaSegundos) / vidaSegundos
}

/**
 * A cuántos clientes DISTINTOS se les puede surtir en un día. Importa porque
 * es un techo independiente del tiempo: una vez surtido, `servedTodayFactor`
 * deja a un cliente prácticamente fuera del resto de la jornada.
 */
export function clientesPorJornada(b: Balance = balance): number {
  return Object.keys(CLIENTES).length + efimerosPorJornada(b)
}

/* ---- El escenario ---- */

/**
 * Un momento de la progresión. Las jornadas de una compra se cuentan en el
 * escenario en el que de verdad la comprarías: contar la grandota con los
 * ingresos del día uno da un número que no significa nada.
 */
export type Escenario = {
  nombre: string
  pipa: PipaConfig
  reputacion: number
  /** Fracción de pedidos que entran por el radio (0 hasta desbloquearlo). Los
   *  del radio pagan mejor y no cuestan búsqueda: llegan solos. */
  fraccionPorRadio: number
  /** Fracción de entregas que llegan a tiempo. */
  puntualidad: number
  /** Fracción de entregas sin derrame, que es el bono limpio. */
  limpieza: number
}

/** Una pipa con todas sus categorías al mismo nivel. Para los escenarios. */
function pipaConMejoras(modelo: ModeloId, nivel: Nivel): PipaConfig {
  const pipa = pipaDeFabrica(modelo)
  for (const cat of CATEGORIAS) pipa.mejoras[cat] = nivel
  return pipa
}

/**
 * Los tres momentos que importan para el Paso 7.
 *
 * ARRANQUE es el que manda sobre la primera mejora: es el jugador del día
 * uno, con la heredada pelona y la reputación de arranque. ASENTADO es donde
 * se compra la mediana —ya con radio, ya con reputación—, y VETERANO existe
 * para ver que la grandota siga siendo una meta y no un trámite.
 *
 * Las reputaciones van como literales y NO leídas de `balance`: esto es un
 * marco de referencia, y un marco que se mueve cada vez que tocas una perilla
 * no sirve para comparar. Si mueves `reputacion.start`, el escenario de
 * arranque sigue midiendo «un jugador con 50», que es lo que quieres saber.
 */
export const ESCENARIOS: Record<'arranque' | 'asentado' | 'veterano', Escenario> = {
  arranque: {
    nombre: 'Arranque',
    pipa: pipaDeFabrica('heredada'),
    reputacion: 50,
    fraccionPorRadio: 0,
    puntualidad: 0.8,
    limpieza: 0.6,
  },
  asentado: {
    nombre: 'Asentado',
    pipa: pipaConMejoras('heredada', 1),
    reputacion: 75,
    fraccionPorRadio: 0.5,
    puntualidad: 0.9,
    limpieza: 0.8,
  },
  veterano: {
    nombre: 'Veterano',
    pipa: pipaConMejoras('mediana', 2),
    reputacion: 90,
    fraccionPorRadio: 0.7,
    puntualidad: 0.95,
    limpieza: 0.9,
  },
}

/* ---- El cálculo ---- */

/** Litros de un pedido promedio de este perfil, topados por lo que te cabe:
 *  se cobra lo ENTREGADO, así que el tanque chico recorta el pedido grande. */
function litrosDe(
  perfil: PerfilCliente,
  capacidad: number,
  b: Balance = balance,
): number {
  const p = b.perfiles[perfil]
  return Math.min(capacidad, (p.litros.min + p.litros.max) / 2)
}

/**
 * Probabilidad de que te acepten, con historial neutro y dentro de horario.
 * Es la parte de `acceptanceChance` que depende de la reputación, que es la
 * única que cambia entre escenarios.
 */
function probAceptacion(rep: number, b: Balance = balance): number {
  const a = b.aceptacion
  const norm = Math.min(1, Math.max(0, rep / b.reputacion.max))
  const cruda = a.repChanceMin + (a.repChanceMax - a.repChanceMin) * norm
  return Math.min(a.chanceMax, Math.max(a.chanceMin, cruda))
}

export type EntregaProyectada = {
  perfil: PerfilCliente
  litros: number
  /** Lo cobrado: pago ponderado por puntualidad, con radio y bono limpio. */
  ingreso: number
  gastoAgua: number
  neta: number
  segundos: number
}

/** Una entrega promedio de este perfil en este escenario: lo que deja y lo
 *  que tarda. Las dos mitades del problema del Paso 7 en un solo lugar. */
export function entregaProyectada(
  perfil: PerfilCliente,
  esc: Escenario,
  b: Balance = balance,
): EntregaProyectada {
  const stats = computeStats(esc.pipa, undefined, b)
  const litros = litrosDe(perfil, stats.capacidadLitros, b)
  const tipFactor = tipRepFactor(esc.reputacion, b)

  // Lo que se cobra es la mezcla de llegar a tiempo y llegar tarde. Muy tarde
  // no entra: el jugador competente que modelamos no lo hace, y meterlo aquí
  // escondería el castigo en un promedio en vez de dejarlo donde se siente.
  const aTiempo = deliveryPayment(
    { liters: litros, perfil, puntualidad: 'A_TIEMPO', tipFactor },
    b,
  ).total
  const tarde = deliveryPayment(
    { liters: litros, perfil, puntualidad: 'TARDE', tipFactor },
    b,
  ).total
  const cobro = esc.puntualidad * aTiempo + (1 - esc.puntualidad) * tarde

  // El radio paga mejor, pero solo los pedidos que entran por el radio.
  const pago = cobro * (1 + esc.fraccionPorRadio * (b.radio.payFactor - 1))
  const bono = pago * esc.limpieza * b.entrega.cleanBonusPct
  const gastoAgua = refillCost(litros, b)

  const velocidad = stats.fisica.maxSpeed * MODELO_JORNADA.fraccionDeVelocidadTope
  const viaje =
    (2 * MODELO_JORNADA.distanciaMediaMetros * MODELO_JORNADA.factorRuta) /
    velocidad
  const carga = litros / (b.pozo.litersPerSecond * stats.bomba.carga)
  const manguera = litros / (b.entrega.flowInZone * stats.bomba.descarga)
  // Los «no» solo cuestan cuando sales a buscar: el radio te habla a ti.
  const busqueda =
    (1 - esc.fraccionPorRadio) *
    (1 / probAceptacion(esc.reputacion, b) - 1) *
    MODELO_JORNADA.intentoFallidoSegundos

  return {
    perfil,
    litros,
    ingreso: pago + bono,
    gastoAgua,
    neta: pago + bono - gastoAgua,
    segundos:
      viaje +
      carga +
      manguera +
      MODELO_JORNADA.conexionSegundos +
      MODELO_JORNADA.tramiteSegundos +
      busqueda,
  }
}

export type Proyeccion = {
  escenario: string
  entregas: number
  litros: number
  ingresos: number
  gastoAgua: number
  /** Lo que de verdad importa: ingresos menos agua. Es la misma cuenta que
   *  hace el resumen de la jornada (`jornada.ts`), para poder compararlas. */
  neta: number
  segundosPorEntrega: number
  /** true cuando el día no se acaba por tiempo sino porque ya no hay a quién
   *  surtirle. Si esto se prende, subir la velocidad no sube el ingreso. */
  limitadaPorClientes: boolean
}

/** Lo que deja una jornada completa en este escenario. */
export function proyeccionJornada(
  esc: Escenario,
  b: Balance = balance,
): Proyeccion {
  const mezcla = mezclaClientes()
  const perfiles = Object.keys(mezcla) as PerfilCliente[]
  const entregas = perfiles.map((p) => entregaProyectada(p, esc, b))

  const peso = (i: number) => mezcla[perfiles[i]]
  const promedio = (f: (e: EntregaProyectada) => number) =>
    entregas.reduce((s, e, i) => s + f(e) * peso(i), 0)

  const segundosPorEntrega = promedio((e) => e.segundos)
  const porTiempo = (b.jornada.minutosReales * 60) / segundosPorEntrega
  // Cuántos de los clientes del día terminan diciendo que sí, contando que a
  // cada uno se le pregunta más de una vez: 1 − (probabilidad de que fallen
  // todos los intentos).
  const p = probAceptacion(esc.reputacion, b)
  const convierten = 1 - (1 - p) ** MODELO_JORNADA.intentosPorCliente
  const porClientes = clientesPorJornada(b) * convierten
  const n = Math.min(porTiempo, porClientes)

  return {
    escenario: esc.nombre,
    entregas: n,
    litros: n * promedio((e) => e.litros),
    ingresos: n * promedio((e) => e.ingreso),
    gastoAgua: n * promedio((e) => e.gastoAgua),
    neta: n * promedio((e) => e.neta),
    segundosPorEntrega,
    limitadaPorClientes: porClientes < porTiempo,
  }
}

/** Cuántas jornadas de este escenario cuesta juntar `precio`. */
export function jornadasPara(precio: number, p: Proyeccion): number {
  if (p.neta <= 0) return Infinity
  return precio / p.neta
}

/* ---- La tabla ---- */

export type FilaCompra = {
  concepto: string
  precio: number
  jornadas: number
  /** En qué escenario se contó. La grandota con los ingresos del día uno da
   *  un número que no significa nada. */
  escenario: string
}

/**
 * Todo lo comprable con su costo en jornadas. Es la tabla del Paso 7, y el
 * orden en que sale es el orden en que el juego te la va ofreciendo.
 */
export function tablaCompras(b: Balance = balance): FilaCompra[] {
  const proy = {
    arranque: proyeccionJornada(ESCENARIOS.arranque, b),
    asentado: proyeccionJornada(ESCENARIOS.asentado, b),
    veterano: proyeccionJornada(ESCENARIOS.veterano, b),
  }
  const fila = (
    concepto: string,
    precio: number,
    cual: keyof typeof proy,
  ): FilaCompra => ({
    concepto,
    precio,
    jornadas: jornadasPara(precio, proy[cual]),
    escenario: proy[cual].escenario,
  })

  const filas: FilaCompra[] = []

  // Cada nivel se cuenta en el momento en que de verdad se llega a él: el n1
  // con la jornada del día uno, el n2 ya asentado, el n3 de veterano. Contar
  // los tres con los ingresos del arranque haría ver la escalera el doble de
  // larga de lo que se siente.
  const cuando = ['arranque', 'asentado', 'veterano'] as const
  for (const cat of CATEGORIAS) {
    cuando.forEach((momento, nivel) => {
      const precio = precioMejora(cat, nivel as Nivel, b)
      if (precio === null) return
      filas.push(fila(`${MEJORAS[cat].nombre} n${nivel + 1}`, precio, momento))
    })
  }

  for (const id of Object.keys(MODELOS) as ModeloId[]) {
    const precio = precioModelo(id, b)
    if (precio <= 0) continue
    filas.push(
      fila(MODELOS[id].nombre, precio, id === 'grandota' ? 'veterano' : 'asentado'),
    )
  }

  const e = b.garage.estilo
  filas.push(fila('Pintar la cabina', e.pintura.cabina, 'arranque'))
  filas.push(fila('Pintar el tanque', e.pintura.tanque, 'arranque'))
  filas.push(fila('Un rótulo', e.rotulo, 'arranque'))
  filas.push(fila('Una calca', e.calca, 'arranque'))

  return filas
}

/** El precio de la mejora más barata: lo primero que el jugador puede querer,
 *  y contra lo que se mide la meta de «dos o tres jornadas». */
export function primeraMejora(b: Balance = balance): { cat: Categoria; precio: number } {
  let mejor: { cat: Categoria; precio: number } | null = null
  for (const cat of CATEGORIAS) {
    const precio = b.garage.mejoras[cat].precios[0]
    if (!mejor || precio < mejor.precio) mejor = { cat, precio }
  }
  return mejor!
}
