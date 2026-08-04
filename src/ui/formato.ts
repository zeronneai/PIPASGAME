/** Pesos sin centavos, para los botones de compra del taller. */
export const pesos = (n: number) =>
  `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
