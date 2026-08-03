import { useGameStore } from '../../state/gameStore'
import type { ClientHistory } from './clients'

/*
 * Guardado en localStorage (sección 2.9). Se persiste exactamente lo que
 * pide el doc: dinero, reputación por colonia, historial por cliente, día
 * actual, litros y la posición de la pipa. Los pedidos activos NO: son
 * transitorios de la jornada.
 *
 * snapshotSave y parseSave son puras; el I/O con localStorage vive en
 * saveGame/loadGame y está envuelto en try/catch porque en Safari en modo
 * privado localStorage LANZA al escribir, y perder el guardado es molesto
 * pero tirar el juego entero sería peor.
 */

const SAVE_KEY = 'pipero-save'
export const SAVE_VERSION = 1

export type SaveData = {
  version: number
  money: number
  liters: number
  day: number
  reputation: Record<string, number>
  clientHistory: Record<string, ClientHistory>
  vehiclePos: { x: number; y: number; z: number }
  vehicleRot: { x: number; y: number; z: number; w: number }
}

type StoreState = ReturnType<typeof useGameStore.getState>

export function snapshotSave(s: StoreState): SaveData {
  const { economy, vehicle } = s
  return {
    version: SAVE_VERSION,
    money: economy.money,
    liters: economy.liters,
    day: economy.day,
    reputation: economy.reputation,
    clientHistory: economy.clientHistory,
    // Copias, no referencias: vehicle.pos se muta cada frame y un snapshot
    // que apunte al objeto vivo cambiaría después de tomado.
    vehiclePos: { x: vehicle.pos.x, y: vehicle.pos.y, z: vehicle.pos.z },
    vehicleRot: {
      x: vehicle.rot.x,
      y: vehicle.rot.y,
      z: vehicle.rot.z,
      w: vehicle.rot.w,
    },
  }
}

/** Valida lo mínimo para no hidratar basura de un guardado corrupto. */
export function parseSave(json: string | null): SaveData | null {
  if (!json) return null
  try {
    const data = JSON.parse(json) as Partial<SaveData>
    if (data.version !== SAVE_VERSION) return null
    if (
      typeof data.money !== 'number' ||
      typeof data.liters !== 'number' ||
      typeof data.day !== 'number' ||
      typeof data.reputation !== 'object' ||
      typeof data.clientHistory !== 'object' ||
      typeof data.vehiclePos?.x !== 'number' ||
      typeof data.vehicleRot?.w !== 'number'
    )
      return null
    return data as SaveData
  } catch {
    return null
  }
}

/** Se recuerda lo último escrito para no tocar localStorage sin cambios. */
let lastWritten: string | null = null

export function saveGame() {
  try {
    const json = JSON.stringify(snapshotSave(useGameStore.getState()))
    if (json === lastWritten) return
    localStorage.setItem(SAVE_KEY, json)
    lastWritten = json
  } catch {
    // Modo privado o cuota llena: se juega sin persistencia.
  }
}

export function loadGame(): SaveData | null {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY))
  } catch {
    return null
  }
}

/** Borra la partida (lo usa el botón de leva). No recarga: eso lo decide quien llama. */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
    lastWritten = null
  } catch {
    /* nada que borrar si ni leer se puede */
  }
}

/** Cada cuánto se respalda solo, en ms. El resto lo cubren los eventos. */
const AUTOSAVE_MS = 5000

/**
 * Carga la partida, hidrata el store y deja corriendo el autoguardado.
 * Se llama UNA vez, en main.tsx, antes del primer render: así la pipa ya
 * nace donde quedó, porque su componente lee la posición del store al montar.
 */
export function initPersistence() {
  const save = loadGame()
  if (save) useGameStore.getState().hydrate(save)

  setInterval(saveGame, AUTOSAVE_MS)
  // En iOS Safari no hay beforeunload confiable: pagehide y el cambio de
  // visibilidad (ir a home, cambiar de app) son los momentos reales de salida.
  window.addEventListener('pagehide', saveGame)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveGame()
  })
}
