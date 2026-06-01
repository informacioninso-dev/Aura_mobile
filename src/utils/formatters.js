export function formatMoney(value) {
  const num = Number(value ?? 0)
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
