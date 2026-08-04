import { useGameStore, type GarageState } from '../../state/gameStore'
import type { ClientHistory } from './clients'
import {
  CALCAS,
  COLORES,
  PIEZAS,
  sanitizarRotulo,
  type Estilo,
  type InventarioEstilo,
} from './estilo'

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
/** v3: la colonia se rediseñó otra vez (manzanas macizas), y una posición
 *  guardada del trazo viejo deja al jugador o a la pipa DENTRO de un edificio
 *  —ahora sí macizo—. Un guardado viejo arranca partida nueva. */
export const SAVE_VERSION = 3

export type SaveData = {
  version: number
  money: number
  liters: number
  day: number
  reputation: Record<string, number>
  clientHistory: Record<string, ClientHistory>
  /** Prioridad en el despacho (Paso 7). Opcional: guardados anteriores al
   *  radio no la traen y se hidrata con 1. */
  radioPrioridad?: number
  vehiclePos: { x: number; y: number; z: number }
  vehicleRot: { x: number; y: number; z: number; w: number }
  /** Posición y rumbo del jugador. Opcionales por los guardados viejos,
   *  que despiertan en el centro como siempre lo hicieron. */
  playerPos?: { x: number; y: number; z: number }
  playerYaw?: number
  /** El garage (Fase 2): qué pipas tienes, con qué mejoras, y cuál traes.
   *  Opcional a propósito, para no invalidar los guardados de la Fase 1: sin
   *  él se hidrata el garage inicial y sigues con la heredada de fábrica. */
  garage?: GarageState
  /** Lo comprado del estilo (global del jugador). Opcional: un guardado sin
   *  él se hidrata dando por pagado lo que las pipas traigan puesto. */
  inventarioEstilo?: InventarioEstilo
}

type StoreState = ReturnType<typeof useGameStore.getState>

export function snapshotSave(s: StoreState): SaveData {
  const { economy, vehicle, player } = s
  return {
    version: SAVE_VERSION,
    money: economy.money,
    liters: economy.liters,
    day: economy.day,
    reputation: economy.reputation,
    // Sin los efímeros: sus ids no vuelven a existir y su historial sería
    // basura acumulándose en localStorage para siempre.
    clientHistory: Object.fromEntries(
      Object.entries(economy.clientHistory).filter(
        ([id]) => !id.startsWith('efimero-'),
      ),
    ),
    radioPrioridad: economy.radioPrioridad,
    // Copias, no referencias: vehicle.pos se muta cada frame y un snapshot
    // que apunte al objeto vivo cambiaría después de tomado.
    vehiclePos: { x: vehicle.pos.x, y: vehicle.pos.y, z: vehicle.pos.z },
    vehicleRot: {
      x: vehicle.rot.x,
      y: vehicle.rot.y,
      z: vehicle.rot.z,
      w: vehicle.rot.w,
    },
    playerPos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    playerYaw: player.yaw,
    // Copia también: las mejoras se reemplazan con set() pero la referencia
    // viva no tiene por qué acabar dentro de un JSON a medio serializar.
    garage: {
      equipada: s.garage.equipada,
      pipas: Object.fromEntries(
        Object.entries(s.garage.pipas).map(([id, cfg]) => [
          id,
          {
            modelo: cfg.modelo,
            mejoras: { ...cfg.mejoras },
            // El estilo también en copia, y solo si existe: una pipa sin
            // pintar no gasta llave en el JSON.
            ...(cfg.estilo && {
              estilo: {
                ...cfg.estilo,
                pintura: { ...cfg.estilo.pintura },
                cromo: { ...cfg.estilo.cromo },
                detalles: { ...cfg.estilo.detalles },
              },
            }),
          },
        ]),
      ),
    },
    inventarioEstilo: {
      colores: [...s.inventarioEstilo.colores],
      calcas: [...s.inventarioEstilo.calcas],
      piezas: [...s.inventarioEstilo.piezas],
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
    // El garage es opcional, pero si viene a medias es peor que no venir:
    // equipar una pipa que no está en la lista deja la física sin números.
    if (data.garage && !data.garage.pipas?.[data.garage.equipada])
      delete data.garage
    /*
     * El estilo también es opcional, y además trae TEXTO LIBRE: un guardado
     * editado a mano no puede meterle un libro al CanvasTexture del rótulo.
     * Si la forma viene rota se tira SOLO el estilo (la pipa cae a fábrica),
     * no la partida.
     */
    if (data.garage) {
      for (const cfg of Object.values(data.garage.pipas)) {
        if (cfg.estilo === undefined) continue
        const e = cfg.estilo as Partial<Estilo> | null
        if (
          !e ||
          typeof e.pintura?.cabina !== 'string' ||
          typeof e.rotulo !== 'string' ||
          typeof e.cromo !== 'object' ||
          typeof e.detalles !== 'object'
        ) {
          delete cfg.estilo
          continue
        }
        cfg.estilo = { ...cfg.estilo!, rotulo: sanitizarRotulo(e.rotulo) }
      }
    }
    /*
     * El inventario también trae ids libres: se filtran contra los catálogos
     * (un save editado a mano no da de alta colores fantasma). Si la forma
     * viene rota, se tira solo el inventario — hydrate lo re-deriva de lo
     * que las pipas traigan puesto.
     */
    if (data.inventarioEstilo !== undefined) {
      const inv = data.inventarioEstilo as Partial<InventarioEstilo> | null
      if (
        !inv ||
        !Array.isArray(inv.colores) ||
        !Array.isArray(inv.calcas) ||
        !Array.isArray(inv.piezas)
      ) {
        delete data.inventarioEstilo
      } else {
        data.inventarioEstilo = {
          colores: inv.colores.filter((c) => c in COLORES),
          calcas: inv.calcas.filter((c) => c in CALCAS),
          piezas: inv.piezas.filter((p) => p in PIEZAS),
        }
      }
    }
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
