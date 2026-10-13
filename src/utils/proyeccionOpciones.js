// Mismas opciones que la web, para que la proyeccion se pueda reconfigurar igual
// en los dos lados. Los valores viajan tal cual a la API.
export const MODE_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'automatica', label: 'Inteligente' },
  { value: 'conservadora', label: 'Conservadora' },
]

export const HISTORY_OPTIONS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
]

export const HORIZON_OPTIONS = [
  { value: 12, label: '1 año' },
  { value: 24, label: '2 años' },
  { value: 60, label: '5 años' },
  { value: 120, label: '10 años' },
]

export const SERIES_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
]

// Texto que explica de donde salen los numeros segun el modo. Es la misma
// redaccion de la web para que un usuario que use ambas no lea cosas distintas.
export function getProjectionHelp(mode, historyMonths, observations) {
  if (mode === 'simple') {
    return 'Simple proyecta tus fijos, variables y diferidos con los montos estimados que registraste. No proyecta gastos puntuales al futuro.'
  }

  const base = observations > 0
    ? `Toma ${observations} gastos variables reales de ${historyMonths === 1 ? 'el último mes' : `los últimos ${historyMonths} meses`} (máximo 18). El último año cuenta más en el cálculo.`
    : 'Aún no hay montos reales de variables; mientras los registras, usa tus estimados.'

  if (mode === 'conservadora') {
    return `${base} Conservadora también distribuye entre 12 meses los gastos puntuales que marcaste para incluir.`
  }
  return `${base} Inteligente no proyecta gastos puntuales históricos.`
}
