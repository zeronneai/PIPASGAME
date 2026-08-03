import { balance, type Balance } from '../balance'
import type { Rng } from './acceptance'
import type { Cliente, PerfilCliente } from './clients'

/*
 * Clientes efímeros (cambio de diseño de Fase 1): casas y obras que
 * aparecen y desaparecen sobre los spots del layout, para que el mundo no
 * se sienta un circuito de 6 paradas. Son Clientes de verdad —el sistema
 * de aceptación, el radio y la entrega los tratan igual— pero con fecha de
 * salida. Su entrega es en su propio spot: la casa pide para sí.
 */

export type EphemeralClient = Cliente & {
  tipo: 'casa' | 'obra'
  pos: [number, number, number]
  spotId: string
  /** Segundo del día en que se va. Un pedido activo no lo retiene: el
   *  pedido ya copió nombre y entrega, y sobrevive solo. */
  hastaSeconds: number
}

const NOMBRES_CASA = [
  'Casa de los García',
  'Casa de doña Mari',
  'Casa de los Ceballos',
  'Casa de don Beto',
  'Casa de la esquina',
  'Casa de los Fuentes',
]

const NOMBRES_OBRA = [
  'Obra del segundo piso',
  'Obra de la barda',
  'Cuadrilla del canal',
  'Obra de la bodega',
]

const pick = <T,>(arr: T[], rng: Rng) =>
  arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]

/**
 * Arma un efímero sobre un spot. Las casas son paciente o normal; las
 * obras, normal o exigente (una obra apurada paga bien y no perdona). El
 * rng es inyectable, como en todo el sistema de aceptación.
 */
export function generarEfimero(
  spot: { id: string; tipo: 'casa' | 'obra'; pos: [number, number, number] },
  seq: number,
  daySeconds: number,
  b: Balance = balance,
  rng: Rng = Math.random,
): EphemeralClient {
  const e = b.efimeros
  const perfil: PerfilCliente =
    spot.tipo === 'casa'
      ? rng() < 0.55
        ? 'paciente'
        : 'normal'
      : rng() < 0.55
        ? 'exigente'
        : 'normal'
  const vidaMin = e.vidaMin + rng() * (e.vidaMax - e.vidaMin)
  return {
    id: `efimero-${seq}`,
    name: pick(spot.tipo === 'casa' ? NOMBRES_CASA : NOMBRES_OBRA, rng),
    perfil,
    colonia: 'centro',
    // Las obras trabajan en horario de obra; las casas están casi siempre.
    horario: spot.tipo === 'casa' ? { abre: 7, cierra: 20 } : { abre: 8, cierra: 18 },
    tipo: spot.tipo,
    pos: spot.pos,
    spotId: spot.id,
    hastaSeconds: daySeconds + vidaMin * 60,
  }
}

/** Segundos hasta el siguiente intento de aparición. */
export function intervaloSpawn(b: Balance = balance, rng: Rng = Math.random): number {
  const e = b.efimeros
  return e.spawnMin + rng() * (e.spawnMax - e.spawnMin)
}
