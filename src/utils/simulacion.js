// Cálculo del simulador "¿Y si...?" sobre la proyección que ya entrega la API.
// Es local a propósito: así el resultado cambia mientras escribes, sin esperar
// a la red. Las fórmulas son las del backend (apps/simulador/services.py).

export const TIPOS_SIMULACION = [
  { value: 'contado', label: 'Pago único', hint: 'Viaje, boda, cirugía o una compra de contado.', icon: 'wallet-outline' },
  { value: 'cuotas', label: 'Préstamo', hint: 'Vehículo, vivienda, equipo o préstamo.', icon: 'card-outline' },
  { value: 'recurrente', label: 'Gasto mensual', hint: 'Mudanza, estudios, un hijo o un nuevo estilo de vida.', icon: 'repeat' },
]

const round2 = (v) => Math.round(v * 100) / 100

// Cuota y total igual que payment_terms del backend: sistema francés con la
// tasa anual / 12; sin tasa, el monto se reparte en partes iguales.
export function terminosDePago(tipo, monto, tasaAnual, plazoMeses) {
  const m = Math.max(0, Number(monto) || 0)
  if (tipo === 'contado') return { cuota: m, total: m, meses: 1 }
  const n = Math.max(1, Math.round(Number(plazoMeses) || 1))
  if (tipo === 'recurrente') return { cuota: m, total: round2(m * n), meses: n }
  const r = (Number(tasaAnual) || 0) / 100 / 12
  const cuota = r > 0 ? (m * r * (1 + r) ** n) / ((1 + r) ** n - 1) : m / n
  return { cuota: round2(cuota), total: round2(round2(cuota) * n), meses: n }
}

/**
 * Aplica la decisión a la serie de la proyección.
 * series: puntos de /finanzas/proyeccion-acumulada/ (closing_balance, monthly_gastos, is_current, is_real).
 * inicioOffset: meses desde el mes actual en que arranca el gasto (0 = este mes).
 * Devuelve, por punto, el saldo y el gasto con la decisión, más un resumen.
 */
export function simular(series, { tipo, monto, tasaAnual = 0, plazoMeses = 12, inicioOffset = 0 }) {
  const terms = terminosDePago(tipo, monto, tasaAnual, plazoMeses)
  const base = series.findIndex((p) => p.is_current)
  const primerProyectado = series.findIndex((p) => !p.is_real)
  const hoy = base >= 0 ? base : Math.max(0, primerProyectado)
  const inicio = hoy + Math.max(0, inicioOffset)

  let acumulado = 0
  const puntos = series.map((p, i) => {
    let delMes = 0
    if (i >= inicio && terms.cuota > 0) {
      const k = i - inicio
      if (tipo === 'contado') delMes = k === 0 ? terms.cuota : 0
      else if (k < terms.meses) delMes = terms.cuota
    }
    acumulado += delMes
    return {
      simBalance: i < hoy ? null : round2(Number(p.closing_balance ?? 0) - acumulado),
      simGastos: i < hoy ? null : round2(Number(p.monthly_gastos ?? 0) + delMes),
    }
  })

  const futuros = puntos
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.simBalance != null)
  const peor = futuros.reduce((acc, p) => (acc == null || p.simBalance < acc.simBalance ? p : acc), null)
  const primerRojo = futuros.find((p) => p.simBalance < 0) || null
  const ultimo = futuros[futuros.length - 1] || null
  const baseFinal = Number(series[series.length - 1]?.closing_balance ?? 0)

  return {
    terms,
    puntos,
    inicioIdx: inicio,
    final: ultimo ? ultimo.simBalance : baseFinal,
    diferencia: ultimo ? round2(ultimo.simBalance - baseFinal) : 0,
    peorIdx: peor ? peor.i : null,
    peorSaldo: peor ? peor.simBalance : null,
    primerRojoIdx: primerRojo ? primerRojo.i : null,
    mesesEnRojo: futuros.filter((p) => p.simBalance < 0).length,
  }
}
