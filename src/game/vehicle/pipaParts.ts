/*
 * Datos de la pipa: dónde amanece, de qué color es cada parte y qué mide cada
 * pieza. Separado del componente a propósito, igual que world/layout.ts: en la
 * Fase 2 la personalización va a leer y escribir esto sin tocar el render.
 */

/**
 * Dónde amanece estacionada. Sobre la calle x = 0, a 16 m del spawn del
 * jugador: verificado contra world/layout.ts que no cae en un bache ni en un
 * tope, con un tope a 56 m al norte y otro a 40 m al sur para poder probarlos.
 *
 * La altura deja las ruedas justo sobre el asfalto; la suspensión asienta el
 * resto en el primer segundo.
 */
export const PIPA_SPAWN: [number, number, number] = [0, 1.25, 16]

/** Un color por parte. En la Fase 2 esto se vuelve el punto de personalización. */
export const PIPA_MATERIALS = {
  bastidor: '#3f4149',
  cabina: '#8f9299',
  cabinaVidrio: '#2b3a45',
  faro: '#e8e3c8',
  tanque: '#a9adb4',
  tanqueTapa: '#8f9299',
  escotilla: '#7b7f87',
  calca: '#c9ccd2', // zona lista para recibir un map en la Fase 2
  defensa: '#54575f',
  llanta: '#232428',
  rin: '#b9bcc2',
}

/** Medidas del cuerpo. Solo geometría visual; la física va en tuning. */
export const PIPA_BODY = {
  bastidor: { size: [2.3, 0.35, 7.5] as [number, number, number], y: -0.2 },
  cabina: { size: [2.3, 1.9, 2.3] as [number, number, number], y: 0.95, z: 2.5 },
  tanque: { radius: 1.05, length: 4.8, y: 0.75, z: -0.9 },
  defensaFrente: {
    size: [2.5, 0.35, 0.35] as [number, number, number],
    y: -0.15,
    z: 3.85,
  },
  defensaAtras: {
    size: [2.5, 0.35, 0.35] as [number, number, number],
    y: -0.15,
    z: -3.85,
  },
  /** Placas planas montadas sobre el tanque: el área de calcas o rótulos. */
  calcaLateral: { size: [3.2, 1, 0.04] as [number, number, number], x: 1.07 },
  calcaTrasera: { size: [1.6, 0.7, 0.04] as [number, number, number], z: -2.45 },
}
