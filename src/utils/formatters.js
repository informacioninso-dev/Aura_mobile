// Formato fijo para toda la app: 1,146.42 (coma de miles, punto decimal), igual
// que la web. Antes dependia del idioma del dispositivo, asi que el mismo dato se
// veia "1.234,50" o "1,234.50" segun el telefono, y distinto de la web.
const DEFAULT_LOCALE = 'en-US'

let currentCurrency = 'USD'

export function setMoneyCurrency(currency) {
  currentCurrency = currency || 'USD'
}

function resolveLocale(locale) {
  return locale || DEFAULT_LOCALE
}

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function formatNumber(value, options = {}, locale) {
  return new Intl.NumberFormat(resolveLocale(locale), options).format(toFiniteNumber(value))
}

export function formatMoney(value, options = {}) {
  const { currency = currentCurrency, locale, currencyDisplay = 'symbol', ...restOptions } = options
  const resolvedLocale = resolveLocale(locale)
  const numericValue = toFiniteNumber(value)
  const absoluteValue = Math.abs(numericValue)

  const currencySymbol = new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    currencyDisplay,
  })
    .formatToParts(1)
    .find((part) => part.type === 'currency')?.value || currency

  const hasMinDigits = Object.prototype.hasOwnProperty.call(restOptions, 'minimumFractionDigits')
  const hasMaxDigits = Object.prototype.hasOwnProperty.call(restOptions, 'maximumFractionDigits')
  const numberFormatOptions = {
    style: 'decimal',
    ...restOptions,
  }
  if (!hasMinDigits && !hasMaxDigits) {
    numberFormatOptions.minimumFractionDigits = 2
    numberFormatOptions.maximumFractionDigits = 2
  }

  const numberPortion = new Intl.NumberFormat(resolvedLocale, numberFormatOptions).format(absoluteValue)

  return `${numericValue < 0 ? '-' : ''}${currencySymbol}${numberPortion}`
}

export function formatMoneyAxis(value) {
  return formatMoney(value, {
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
