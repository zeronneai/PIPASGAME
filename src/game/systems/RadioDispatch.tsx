import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { balance } from '../balance'
import { useGameStore } from '../../state/gameStore'
import { horaDelDia } from './acceptance'
import { CLIENTES, COLONIAS } from './clients'
import {
  elegiblesParaRadio,
  generarLlamada,
  intervaloLlamada,
} from './radio'
import { isRadioUnlocked, tipRepFactor } from './reputation'

/** En Fase 1 hay una sola colonia; el radio despacha sobre ella. */
const COLONIA = Object.keys(COLONIAS)[0]

/**
 * El despachador (Paso 7): con el radio desbloqueado, agenda la siguiente
 * llamada contra el reloj de la jornada y la dispara si hay algún cliente
 * elegible. Toda la lógica está en radio.ts; aquí solo el calendario.
 *
 * El «se siente como recompensa» vive aquí: al CRUZAR el umbral la primera
 * llamada se agenda a segundos, no a un intervalo normal. Quien carga una
 * partida ya desbloqueada no repite esa fanfarria.
 */
export function RadioDispatch() {
  const nextAt = useRef<number | null>(null)
  /** null = primer frame (para no confundir «cargué desbloqueado» con
   *  «acabo de desbloquear»). */
  const wasUnlocked = useRef<boolean | null>(null)
  const dia = useRef(-1)

  useFrame(() => {
    const s = useGameStore.getState()
    // Con el resumen en pantalla el despacho también descansa.
    if (s.summary) return
    // Día nuevo: el reloj volvió a cero, la agenda del día anterior no vale.
    if (dia.current !== s.economy.day) {
      dia.current = s.economy.day
      nextAt.current = null
    }
    const t = s.clock.daySeconds
    const rep = s.economy.reputation[COLONIA] ?? 0
    const unlocked = isRadioUnlocked(rep)

    if (wasUnlocked.current === null) {
      wasUnlocked.current = unlocked
    } else if (!wasUnlocked.current && unlocked) {
      // El momento de la recompensa: el radio suena casi de inmediato.
      nextAt.current = t + balance.radio.primeraLlamada
      wasUnlocked.current = true
    } else if (wasUnlocked.current && !unlocked) {
      // La reputación cayó del umbral: el despacho deja de llamar.
      nextAt.current = null
      wasUnlocked.current = false
    }
    if (!unlocked) return

    // La llamada en pantalla expira sola; dejarla morir cuenta como rechazo.
    const call = s.radioCall
    if (call && t > call.expiresAt) {
      s.rejectRadioCall('EXPIRO')
      return
    }

    if (nextAt.current === null)
      nextAt.current = t + intervaloLlamada(s.economy.radioPrioridad)

    if (!call && t >= nextAt.current) {
      const elegibles = elegiblesParaRadio({
        clientes: Object.values(CLIENTES),
        orders: s.economy.orders,
        history: s.economy.clientHistory,
        day: s.economy.day,
        hora: horaDelDia(t),
      })
      if (elegibles.length > 0) {
        const cliente = elegibles[Math.floor(Math.random() * elegibles.length)]
        s.offerRadioCall(
          generarLlamada(cliente, { tipFactor: tipRepFactor(rep), ahora: t }),
        )
      }
      // Se reagenda haya sonado o no: sin elegibles, el radio calla un rato.
      nextAt.current = t + intervaloLlamada(s.economy.radioPrioridad)
    }
  })

  return null
}
