import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Line, Path } from 'react-native-svg'

import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { formatMoney, formatDate } from '../../utils/formatters'
import { montoEfectivoMes } from '../../utils/frecuencias'
import NotificationBell from '../../components/ui/NotificationBell'
import SaludFinancieraCard from '../../components/ui/SaludFinancieraCard'
import { getApiErrorMessage } from '../../api/errors'
import { useTopInset } from '../../hooks/useTopInset'
import { useOfflineCache } from '../../hooks/useOfflineCache'
import { colors } from '../../theme/theme'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Los cuatro registros mas frecuentes, el del dia a dia primero. Navegan a la
// pestaña con el formulario ya abierto en el tipo correcto. Antes se llamaban
// "Gasto / Consumo / Ingreso / Puntual", nombres internos que nadie entendia.
const QUICK_ACTIONS = [
  { key: 'hoy', icon: 'cafe-outline', label: 'Gasto de hoy', screen: 'Gastos', tab: 'puntuales' },
  { key: 'fijo', icon: 'repeat', label: 'Gasto fijo', screen: 'Gastos', tab: 'fijos' },
  { key: 'variable', icon: 'pulse', label: 'Gasto variable', screen: 'Gastos', tab: 'variables' },
  { key: 'ingreso', icon: 'cash-outline', label: 'Ingreso', screen: 'Ingresos', tab: 'fijos' },
]

const EMPTY_MOVEMENTS = {
  ingresos: [],
  ingresosPuntuales: [],
  gastosCorrientes: [],
  gastosNoCorrientes: [],
  diferidos: [],
}

// El ahorro inicial se guarda como un ingreso puntual con esta descripcion; asi
// se reconoce para marcar el primer paso como hecho.
const AHORRO_INICIAL = 'Ahorros iniciales'
// La cache del resumen sirve para abrir al instante; pasado esto ya no se usa.
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date, amount) {
  return startOfMonth(new Date(date.getFullYear(), date.getMonth() + amount, 1))
}

function parseLocalDate(value) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonthKey(value) {
  const [y, m] = String(value).split('-').map(Number)
  return new Date(y, m - 1, 1)
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function overlapsMonth(item, monthDate) {
  if (!item?.activo) return false
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const start = parseLocalDate(item.fecha_inicio)
  const end = item.fecha_fin ? parseLocalDate(item.fecha_fin) : null
  return Boolean(start && start <= monthEnd && (!end || end >= monthStart))
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "2028-08-31" -> "ago 2028"
function mesAnioCorto(value) {
  if (!value) return ''
  const [y, m] = String(value).split('-').map(Number)
  return `${MESES_CORTOS[m - 1]} ${y}`
}

// Avance de un diferido al mes de referencia: en que cuota va (X de N) y % pagado.
function cuotaProgreso(item, monthDate) {
  const total = Number(item?.num_cuotas) || 0
  if (!total || !item?.fecha_inicio) return null
  const inicio = startOfMonth(parseLocalDate(item.fecha_inicio))
  const ref = startOfMonth(monthDate)
  const transcurridas =
    (ref.getFullYear() - inicio.getFullYear()) * 12 + (ref.getMonth() - inicio.getMonth()) + 1
  const actual = Math.max(0, Math.min(transcurridas, total))
  return { actual, total, pct: Math.round((actual / total) * 100) }
}

function occursInMonth(item, monthDate, dateField = 'fecha') {
  const targetDate = parseLocalDate(item?.[dateField])
  if (!targetDate) return false
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  return targetDate >= monthStart && targetDate <= monthEnd
}

// Un rubro variable vale su gasto REAL del mes; si sigue pendiente (sin
// registrar) cuenta como 0, igual que en la pantalla de Gastos variables, para
// que el total del dashboard cuadre con esa vista. Los fijos siempre valen su
// monto. El backend entrega monto_real_mes solo para el mes consultado.
function montoDelMes(item) {
  if (item?.tipo_monto === 'variable') return item?.monto_real_mes ?? 0
  return item?.monto_real_mes ?? item?.monto
}

// La ultima cuota de un diferido absorbe el residuo del redondeo, asi que no
// siempre vale lo mismo que cuota_mensual.
function cuotaDelMes(item) {
  return Number(item?.cuota_mes ?? item?.cuota_mensual ?? 0)
}

function getFrequencyLabel(value) {
  const labels = {
    diario: 'Diario',
    semanal: 'Semanal',
    quincenal: 'Quincenal',
    mensual: 'Mensual',
    bimestral: 'Bimestral',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
  }
  return labels[value] || 'Mensual'
}

// Una frase corta que traduce la tasa de ahorro a "como voy".
function estadoDelMes({ totalIngresos, totalGastos, tasa, mesLabel }) {
  if (totalIngresos <= 0 && totalGastos <= 0) return { text: `Aún no hay movimientos en ${mesLabel}`, color: colors.textMuted }
  if (totalIngresos <= 0) return { text: `Aún no registras ingresos en ${mesLabel}`, color: colors.warning }
  if (tasa < 0) return { text: 'Gastas más de lo que entra', color: colors.danger }
  const pct = `${Math.round(tasa)}%`
  if (tasa >= 20) return { text: `Vas bien: ahorras el ${pct}`, color: colors.success }
  if (tasa >= 10) return { text: `Vas justo: ahorras el ${pct}`, color: colors.warning }
  return { text: `Al límite: ahorras el ${pct}`, color: colors.orange }
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth()
  const userKey = user?.id ?? user?.email ?? 'anon'
  // Se desestructura: el objeto que devuelve el hook es nuevo en cada render y,
  // usado como dependencia, dispararia una recarga infinita.
  const { guardar: guardarCache, leer: leerCache } = useOfflineCache(`dashboard_${userKey}`)
  const currentMonth = useMemo(() => startOfMonth(new Date()), [])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [ahorroInicial, setAhorroInicial] = useState('')
  const [savingAhorro, setSavingAhorro] = useState(false)
  const [sinAhorro, setSinAhorro] = useState(false)
  const [movements, setMovements] = useState(EMPTY_MOVEMENTS)
  const [report, setReport] = useState(null)
  const [reportMonthKey, setReportMonthKey] = useState('')
  const [projection, setProjection] = useState(null)
  const [cuentasPersonas, setCuentasPersonas] = useState({ meDeben: 0, debo: 0 })
  const [showNegDetail, setShowNegDetail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const [detalleTipo, setDetalleTipo] = useState('expense') // 'expense' | 'income'
  const reportRequestRef = useRef(0)
  const tieneDatosRed = useRef(false)
  const topPad = useTopInset()

  // El Dashboard pide la proyeccion con el horizonte por defecto del plan; los
  // ajustes finos viven en la pantalla Proyeccion.
  const projectionDisplayMonths = Math.max(2, Number(user?.feature_access?.projection_months || 6))
  const freeFutureMonths = Math.max(1, Math.floor(projectionDisplayMonths / 2))
  const freePastMonths = Math.max(1, projectionDisplayMonths - freeFutureMonths)
  const advancedProjectionEnabled = Boolean(user?.feature_access?.advanced_projection_enabled)
  const advancedProjectionMaxMonths = Math.max(1, Number(user?.feature_access?.advanced_projection_months || 120))
  const futureMonths = advancedProjectionEnabled ? Math.min(12, advancedProjectionMaxMonths) : freeFutureMonths
  const pastMonths = advancedProjectionEnabled ? 6 : freePastMonths

  const onbKey = `aura_onb_sin_ahorro_${userKey}`
  useEffect(() => {
    AsyncStorage.getItem(onbKey).then((v) => setSinAhorro(v === '1')).catch(() => {})
  }, [onbKey])

  function omitirAhorro() {
    setSinAhorro(true)
    AsyncStorage.setItem(onbKey, '1').catch(() => {})
  }

  const loadBase = useCallback(async (month, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    try {
      // El mes va en la peticion: el backend resuelve con el los montos que
      // dependen del periodo (consumo real de un rubro variable y la cuota que
      // toca de un diferido). Sin el, al navegar a otro mes se mostrarian los
      // valores del mes actual.
      const [dashboardResponse, projectionResponse] = await Promise.all([
        api.get(`/finanzas/dashboard/?anio=${month.getFullYear()}&mes=${month.getMonth() + 1}`),
        api.get(`/finanzas/proyeccion-acumulada/?months=${futureMonths}&past_months=${pastMonths}`),
      ])

      const nextMovements = {
        ingresos: dashboardResponse.data.ingresos || [],
        ingresosPuntuales: dashboardResponse.data.ingresos_puntuales || [],
        gastosCorrientes: dashboardResponse.data.gastos_corrientes || [],
        gastosNoCorrientes: dashboardResponse.data.gastos_no_corrientes || [],
        diferidos: dashboardResponse.data.diferidos || [],
      }
      tieneDatosRed.current = true
      setMovements(nextMovements)
      setProjection(projectionResponse.data || null)
      return { movements: nextMovements, projection: projectionResponse.data || null }
    } catch (err) {
      if (!tieneDatosRed.current) {
        setMovements(EMPTY_MOVEMENTS)
        setProjection(null)
      }
      setError(getApiErrorMessage(err, 'No pudimos cargar tu resumen. Intenta de nuevo.'))
      return null
    } finally {
      setLoading(false)
    }
  }, [futureMonths, pastMonths])

  const loadReport = useCallback(async (month, { silent = false } = {}) => {
    const requestId = reportRequestRef.current + 1
    const targetMonthKey = formatMonthKey(month)
    reportRequestRef.current = requestId

    if (!silent) setReportLoading(true)

    try {
      const { data } = await api.get(
        `/finanzas/reporte/?anio=${month.getFullYear()}&mes=${month.getMonth() + 1}`,
      )
      if (requestId !== reportRequestRef.current) return null
      setReport(data)
      setReportMonthKey(targetMonthKey)
      return data
    } catch (err) {
      if (requestId !== reportRequestRef.current) return null
      if (!silent) {
        setReport(null)
        setReportMonthKey('')
        setError(getApiErrorMessage(err, 'No pudimos cargar el resumen del mes. Intenta de nuevo.'))
      }
      return null
    } finally {
      if (requestId === reportRequestRef.current) {
        setReportLoading(false)
      }
    }
  }, [])

  // Saldos pendientes con personas: el atajo solo aparece si hay algo que cobrar
  // o pagar, en vez de ocupar siempre el primer lugar de la pantalla.
  const loadCuentasPersonas = useCallback(async () => {
    try {
      const { data } = await api.get('/finanzas/cuentas-por-cobrar/')
      const items = data?.results ?? data ?? []
      const pendientes = items.filter((i) => i.estado !== 'pagado')
      const suma = (meDeben) => pendientes
        .filter((i) => (i.direccion === 'me_deben') === meDeben)
        .reduce((acc, i) => acc + Number(i.saldo_pendiente || 0), 0)
      setCuentasPersonas({ meDeben: suma(true), debo: suma(false) })
    } catch {
      // Es un atajo: si falla, simplemente no se muestra.
    }
  }, [])

  // Abrir al instante con el ultimo resumen guardado; la red lo reemplaza apenas
  // responde. Solo aplica al mes actual, que es el que se abre siempre.
  useEffect(() => {
    let active = true
    leerCache(CACHE_MAX_AGE).then((c) => {
      if (!active || !c || tieneDatosRed.current) return
      setMovements(c.movements || EMPTY_MOVEMENTS)
      setProjection(c.projection || null)
      if (c.report) {
        setReport(c.report)
        setReportMonthKey(c.reportMonthKey)
      }
      setLoading(false)
      setReportLoading(false)
    })
    return () => { active = false }
  }, [leerCache])

  const cargarTodo = useCallback(async (month, opts) => {
    const [base, rep] = await Promise.all([loadBase(month, opts), loadReport(month, opts)])
    if (base && rep && formatMonthKey(month) === formatMonthKey(currentMonth)) {
      guardarCache({ ...base, report: rep, reportMonthKey: formatMonthKey(month) })
    }
  }, [loadBase, loadReport, guardarCache, currentMonth])

  useEffect(() => {
    void cargarTodo(selectedMonth, { silent: tieneDatosRed.current })
  }, [cargarTodo, selectedMonth])

  useEffect(() => { void loadCuentasPersonas() }, [loadCuentasPersonas])

  // Al volver a esta pestaña (por ejemplo, despues de registrar un gasto) se
  // actualiza sin spinner. Las funciones van por ref para que cambiar de mes no
  // dispare una segunda carga ademas del efecto de arriba.
  const latest = useRef({})
  latest.current = { cargarTodo, loadCuentasPersonas, selectedMonth }
  const primerFoco = useRef(true)
  useFocusEffect(useCallback(() => {
    if (primerFoco.current) {
      primerFoco.current = false
      return
    }
    const { cargarTodo: recargar, loadCuentasPersonas: recargarCuentas, selectedMonth: mes } = latest.current
    void recargar(mes, { silent: true })
    void recargarCuentas()
  }, []))

  // El ahorro inicial se guarda como un ingreso puntual con fecha de hoy, igual
  // que en la web: asi la proyeccion y el colchon arrancan desde el saldo real
  // en vez de desde cero.
  async function guardarAhorroInicial() {
    const monto = parseFloat(String(ahorroInicial).replace(',', '.'))
    if (!monto || monto <= 0 || savingAhorro) return
    setSavingAhorro(true)
    try {
      const hoy = new Date()
      const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      await api.post('/finanzas/ingresos-puntuales/', {
        descripcion: AHORRO_INICIAL,
        monto,
        fecha,
        notas: 'Saldo con el que empiezas en Aura',
        incluir_en_proyeccion: true,
      })
      setAhorroInicial('')
      await cargarTodo(selectedMonth, { silent: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'No pudimos guardar tu ahorro inicial. Intenta de nuevo.'))
    } finally {
      setSavingAhorro(false)
    }
  }

  async function onRefresh() {
    setRefreshing(true)
    setError('')
    try {
      await Promise.all([cargarTodo(selectedMonth, { silent: true }), loadCuentasPersonas()])
    } finally {
      setRefreshing(false)
    }
  }

  const monthBounds = useMemo(() => {
    const minCandidates = [currentMonth]
    const maxCandidates = [addMonths(currentMonth, 12)]

    movements.ingresos.forEach((item) => {
      const start = parseLocalDate(item.fecha_inicio)
      const end = item.fecha_fin ? parseLocalDate(item.fecha_fin) : null
      if (start) minCandidates.push(startOfMonth(start))
      maxCandidates.push(end ? startOfMonth(end) : addMonths(currentMonth, 12))
    })

    movements.gastosCorrientes.forEach((item) => {
      const start = parseLocalDate(item.fecha_inicio)
      const end = item.fecha_fin ? parseLocalDate(item.fecha_fin) : null
      if (start) minCandidates.push(startOfMonth(start))
      maxCandidates.push(end ? startOfMonth(end) : addMonths(currentMonth, 12))
    })

    movements.diferidos.forEach((item) => {
      const start = parseLocalDate(item.fecha_inicio)
      const end = item.fecha_fin ? parseLocalDate(item.fecha_fin) : null
      if (start) minCandidates.push(startOfMonth(start))
      if (end) maxCandidates.push(startOfMonth(end))
    })

    movements.ingresosPuntuales.forEach((item) => {
      const date = parseLocalDate(item.fecha)
      if (date) {
        minCandidates.push(startOfMonth(date))
        maxCandidates.push(startOfMonth(date))
      }
    })

    movements.gastosNoCorrientes.forEach((item) => {
      const date = parseLocalDate(item.fecha)
      if (date) {
        minCandidates.push(startOfMonth(date))
        maxCandidates.push(startOfMonth(date))
      }
    })

    const minMonth = minCandidates.reduce((earliest, candidate) => (
      candidate < earliest ? candidate : earliest
    ), minCandidates[0])
    const fallbackMaxMonth = maxCandidates.reduce((latestMonth, candidate) => (
      candidate > latestMonth ? candidate : latestMonth
    ), maxCandidates[0])
    const projectionStart = projection?.series?.[0]?.month ? parseMonthKey(projection.series[0].month) : null
    const projectionEnd = projection?.series?.length
      ? parseMonthKey(projection.series[projection.series.length - 1].month)
      : null

    return {
      minMonth: projectionStart && projectionStart < minMonth ? projectionStart : minMonth,
      maxMonth: projectionEnd || fallbackMaxMonth,
    }
  }, [currentMonth, movements, projection])

  useEffect(() => {
    setSelectedMonth((current) => {
      if (current < monthBounds.minMonth) return monthBounds.minMonth
      if (current > monthBounds.maxMonth) return monthBounds.maxMonth
      return current
    })
  }, [monthBounds])

  const selectedMonthName = MESES[selectedMonth.getMonth()]
  const selectedMonthLabel = `${selectedMonthName} ${selectedMonth.getFullYear()}`
  const selectedMonthKey = formatMonthKey(selectedMonth)
  const isCurrentMonth = selectedMonthKey === formatMonthKey(currentMonth)
  const isFutureMonth = selectedMonth > currentMonth
  const canGoPrevMonth = selectedMonth > monthBounds.minMonth
  const canGoNextMonth = selectedMonth < monthBounds.maxMonth
  const activeReport = reportMonthKey === selectedMonthKey ? report : null
  const reportSummary = activeReport?.resumen

  const fixedIncomesThisMonth = useMemo(
    () => movements.ingresos.filter((item) => overlapsMonth(item, selectedMonth)),
    [movements.ingresos, selectedMonth],
  )
  const punctualIncomesThisMonth = useMemo(
    () => movements.ingresosPuntuales.filter((item) => occursInMonth(item, selectedMonth)),
    [movements.ingresosPuntuales, selectedMonth],
  )
  const fixedExpensesThisMonth = useMemo(
    () => movements.gastosCorrientes.filter((item) => overlapsMonth(item, selectedMonth)),
    [movements.gastosCorrientes, selectedMonth],
  )
  const punctualExpensesThisMonth = useMemo(
    () => movements.gastosNoCorrientes.filter((item) => occursInMonth(item, selectedMonth)),
    [movements.gastosNoCorrientes, selectedMonth],
  )
  const installmentsThisMonth = useMemo(
    () => movements.diferidos.filter((item) => overlapsMonth(item, selectedMonth)),
    [movements.diferidos, selectedMonth],
  )

  const incomeDetailItems = useMemo(() => {
    return [
      ...fixedIncomesThisMonth.map((item) => ({
        id: `income-fixed-${item.id}`,
        label: item.descripcion,
        meta: `${getFrequencyLabel(item.frecuencia)} · al mes`,
        amount: montoEfectivoMes(item.monto, item.frecuencia, item.fecha_inicio, selectedMonth.getFullYear(), selectedMonth.getMonth() + 1),
      })),
      ...punctualIncomesThisMonth.map((item) => ({
        id: `income-punctual-${item.id}`,
        label: item.descripcion,
        meta: `Puntual · ${formatDate(item.fecha)}`,
        amount: Number(item.monto || 0),
      })),
    ].sort((a, b) => b.amount - a.amount)
  }, [fixedIncomesThisMonth, punctualIncomesThisMonth, selectedMonth])

  const expenseDetailItems = useMemo(() => {
    return [
      ...fixedExpensesThisMonth.map((item) => ({
        id: `expense-fixed-${item.id}`,
        label: item.descripcion,
        meta: `${item.categoria || 'Sin categoría'} · ${getFrequencyLabel(item.frecuencia)}`,
        amount: montoEfectivoMes(montoDelMes(item), item.frecuencia, item.fecha_inicio, selectedMonth.getFullYear(), selectedMonth.getMonth() + 1),
      })),
      ...installmentsThisMonth.map((item) => {
        const prog = cuotaProgreso(item, selectedMonth)
        return {
          id: `expense-installment-${item.id}`,
          label: item.descripcion,
          meta: prog
            ? `${item.categoria || 'Sin categoría'} · ${prog.actual}/${prog.total}`
              + (item.fecha_fin ? ` · termina ${mesAnioCorto(item.fecha_fin)}` : '')
            : `${item.categoria || 'Sin categoría'} · cuota mensual`,
          amount: cuotaDelMes(item),
          progress: prog ? prog.pct : null,
        }
      }),
      ...punctualExpensesThisMonth.map((item) => ({
        id: `expense-punctual-${item.id}`,
        label: item.descripcion,
        meta: `${item.categoria || 'Sin categoría'} · ${formatDate(item.fecha)}`,
        amount: Number(item.monto || 0),
      })),
    ].sort((a, b) => b.amount - a.amount)
  }, [fixedExpensesThisMonth, installmentsThisMonth, punctualExpensesThisMonth, selectedMonth])

  const fixedIncomeTotal = useMemo(
    () => fixedIncomesThisMonth.reduce((sum, item) => sum + montoEfectivoMes(item.monto, item.frecuencia, item.fecha_inicio, selectedMonth.getFullYear(), selectedMonth.getMonth() + 1), 0),
    [fixedIncomesThisMonth, selectedMonth],
  )
  const punctualIncomeTotal = useMemo(
    () => punctualIncomesThisMonth.reduce((sum, item) => sum + Number(item.monto || 0), 0),
    [punctualIncomesThisMonth],
  )
  const fixedExpenseTotal = useMemo(
    () => fixedExpensesThisMonth.reduce((sum, item) => sum + montoEfectivoMes(montoDelMes(item), item.frecuencia, item.fecha_inicio, selectedMonth.getFullYear(), selectedMonth.getMonth() + 1), 0),
    [fixedExpensesThisMonth, selectedMonth],
  )
  const installmentTotal = useMemo(
    () => installmentsThisMonth.reduce((sum, item) => sum + cuotaDelMes(item), 0),
    [installmentsThisMonth],
  )
  const punctualExpenseTotal = useMemo(
    () => punctualExpensesThisMonth.reduce((sum, item) => sum + Number(item.monto || 0), 0),
    [punctualExpensesThisMonth],
  )

  const gastosFijos = Number(reportSummary?.gastos_corrientes ?? fixedExpenseTotal)
  const gastosCuotas = Number(reportSummary?.cuotas ?? installmentTotal)
  const gastosPuntuales = Number(reportSummary?.gastos_puntuales ?? punctualExpenseTotal)
  const breakdownIncome = [
    { id: 'income-fixed', label: 'Ingresos fijos', value: Number(reportSummary?.ingresos_fijos ?? fixedIncomeTotal), color: colors.success },
    { id: 'income-punctual', label: 'Ingresos puntuales', value: Number(reportSummary?.ingresos_puntuales ?? punctualIncomeTotal), color: '#34D399' },
  ]
  const breakdownExpense = [
    { id: 'expense-fixed', label: 'Gastos fijos', value: gastosFijos, color: colors.danger },
    { id: 'expense-installments', label: 'Cuotas', value: gastosCuotas, color: colors.orange },
    { id: 'expense-punctual', label: 'Gastos puntuales', value: gastosPuntuales, color: '#FCA5A5' },
  ]

  const totalIngresos = Number(reportSummary?.total_ingresos ?? (fixedIncomeTotal + punctualIncomeTotal))
  const totalGastos = Number(reportSummary?.total_gastos ?? (fixedExpenseTotal + installmentTotal + punctualExpenseTotal))
  const totalBalance = Number(reportSummary?.balance ?? (totalIngresos - totalGastos))
  const tasaAhorro = Number(
    reportSummary?.tasa_ahorro
    ?? (totalIngresos > 0 ? ((totalBalance / totalIngresos) * 100) : 0),
  )
  const gastoPct = totalIngresos > 0 ? Math.round((totalGastos / totalIngresos) * 100) : 0
  const estado = estadoDelMes({ totalIngresos, totalGastos, tasa: tasaAhorro, mesLabel: selectedMonthName.toLowerCase() })
  // La barra mide los gastos contra lo que entro; si se gasto mas, contra el gasto.
  const barBase = Math.max(totalIngresos, totalGastos, 1)
  const heroLabel = isCurrentMonth
    ? 'Te queda este mes'
    : isFutureMonth ? `Te quedaría en ${selectedMonthName.toLowerCase()}` : `Te quedó en ${selectedMonthName.toLowerCase()}`

  // Ultimo punto proyectado: su saldo de cierre es "con lo que terminarias".
  const series = projection?.series || []
  const projLast = series.length ? series[series.length - 1] : null
  const projCierre = Number(projLast?.closing_balance ?? 0)
  const proyectados = series.filter((p) => !p.is_real)
  const mesesEnRojo = proyectados.filter((p) => Number(p.closing_balance ?? 0) < 0)
  const mesesEnPositivo = proyectados.length - mesesEnRojo.length

  // Pasos del primer uso.
  const tieneAhorro = movements.ingresosPuntuales.some((i) => i.descripcion === AHORRO_INICIAL)
  const ingresosReales = movements.ingresos.length
    + movements.ingresosPuntuales.filter((i) => i.descripcion !== AHORRO_INICIAL).length
  const gastosRegistrados = movements.gastosCorrientes.length + movements.gastosNoCorrientes.length + movements.diferidos.length
  const pasos = { ahorro: tieneAhorro || sinAhorro, ingreso: ingresosReales > 0, gasto: gastosRegistrados > 0 }
  const pasosListos = Object.values(pasos).filter(Boolean).length
  // Sin ingresos ni gastos no hay nada que mostrar con montos: en vez de veinte
  // "$0.00", solo los pasos para empezar.
  const cuentaNueva = !pasos.ingreso && !pasos.gasto

  if (loading && reportLoading) {
    return <DashboardSkeleton topPad={topPad} />
  }

  const checklist = pasosListos < 3 ? (
    <Onboarding
      pasos={pasos}
      pasosListos={pasosListos}
      ahorroInicial={ahorroInicial}
      setAhorroInicial={setAhorroInicial}
      savingAhorro={savingAhorro}
      onGuardarAhorro={guardarAhorroInicial}
      onOmitirAhorro={omitirAhorro}
      onIngreso={() => navigation.navigate('Ingresos', { autoNew: true, tab: 'fijos' })}
      onGasto={() => navigation.navigate('Gastos', { autoNew: true, tab: 'puntuales' })}
      onDileAAura={() => navigation.navigate('Aura')}
    />
  ) : null

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: topPad }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>
            {cuentaNueva ? 'Hola' : getGreeting()}
            {user?.username ? `, ${user.username}` : ''}
          </Text>
          {cuentaNueva
            ? <Text style={s.subtitle}>Tres pasos y Aura ya puede decirte cómo vas.</Text>
            : <SaludFinancieraCard variant="chip" navigation={navigation} />}
        </View>
        <NotificationBell />
      </View>

      {error ? (
        <View style={s.errorCard}>
          <Text style={s.errorTitle}>No pudimos cargar todo tu resumen</Text>
          <Text style={s.errorBody}>{error}</Text>
        </View>
      ) : null}

      {cuentaNueva ? (
        <>
          {checklist}
          <View style={[s.card, s.lockCard]}>
            <Text style={s.cardTitle}>Si sigues así</Text>
            <Sparkline values={[2, 2.4, 2.2, 3, 3.4, 3.2, 4, 4.6]} height={52} muted />
            <View style={s.lockVeil}>
              <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
              <Text style={s.lockText}>Tu proyección aparece cuando registres tu ingreso.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Más', { screen: 'Importar' })} style={s.importLink}>
            <Text style={s.importText}>¿Vienes de otra app? <Text style={s.link}>Importa tus movimientos</Text></Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Numero protagonista: el balance REAL del mes (lo que entro menos lo
              que salio), no el saldo proyectado; un numero grande basado en la
              proyeccion da una falsa tranquilidad. */}
          <View style={s.hero}>
            <View style={s.heroTop}>
              <Text style={s.heroLabel}>{heroLabel}</Text>
              <View style={s.monthNav}>
                <TouchableOpacity
                  style={[s.monthBtn, !canGoPrevMonth && s.monthBtnOff]}
                  onPress={() => setSelectedMonth((current) => addMonths(current, -1))}
                  disabled={!canGoPrevMonth}
                  accessibilityLabel="Mes anterior"
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.primary} />
                </TouchableOpacity>
                <Text style={s.monthText}>{selectedMonthName.slice(0, 3)} {String(selectedMonth.getFullYear()).slice(2)}</Text>
                <TouchableOpacity
                  style={[s.monthBtn, !canGoNextMonth && s.monthBtnOff]}
                  onPress={() => setSelectedMonth((current) => addMonths(current, 1))}
                  disabled={!canGoNextMonth}
                  accessibilityLabel="Mes siguiente"
                  hitSlop={8}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.heroValueRow}>
              <Text style={[s.heroValue, { color: totalBalance >= 0 ? colors.success : colors.danger }]}>
                {formatMoney(totalBalance)}
              </Text>
              {reportLoading ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
            </View>
            {isFutureMonth ? <Text style={s.heroProjected}>Proyectado con lo que tienes registrado</Text> : null}
            <View style={s.segTrack}>
              <View style={{ width: `${(gastosFijos / barBase) * 100}%`, backgroundColor: colors.danger }} />
              <View style={{ width: `${(gastosCuotas / barBase) * 100}%`, backgroundColor: colors.orange }} />
              <View style={{ width: `${(gastosPuntuales / barBase) * 100}%`, backgroundColor: '#FCA5A5' }} />
            </View>
            <View style={s.heroLegend}>
              <Text style={s.heroLegendText}>Entró <Text style={s.heroLegendStrong}>{formatMoney(totalIngresos)}</Text></Text>
              <Text style={s.heroLegendText}>
                Gastaste <Text style={s.heroLegendStrong}>{formatMoney(totalGastos)}</Text>{totalIngresos > 0 ? ` (${gastoPct}%)` : ''}
              </Text>
            </View>
            <View style={s.heroFooter}>
              <View style={[s.estadoPill, { backgroundColor: `${estado.color}22` }]}>
                <Text style={[s.estadoText, { color: estado.color }]}>{estado.text}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetalleAbierto((v) => !v)} hitSlop={8} style={s.detalleBtn}>
                <Text style={s.link}>{detalleAbierto ? 'Ocultar' : 'Ver detalle'}</Text>
                <Ionicons name={detalleAbierto ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {detalleAbierto ? (
            <DetailCard
              tipo={detalleTipo}
              onTipo={setDetalleTipo}
              breakdown={detalleTipo === 'income' ? breakdownIncome : breakdownExpense}
              items={detalleTipo === 'income' ? incomeDetailItems : expenseDetailItems}
              total={detalleTipo === 'income' ? totalIngresos : totalGastos}
              mesLabel={selectedMonthLabel.toLowerCase()}
            />
          ) : null}

          {/* Registrar es lo que mas se repite en el dia a dia: desde aqui es un
              solo toque en vez de entrar a la pestaña y buscar el boton. */}
          <View style={s.quickRow}>
            {QUICK_ACTIONS.map((accion) => (
              <TouchableOpacity
                key={accion.key}
                style={s.quickBtn}
                onPress={() => navigation.navigate(accion.screen, { autoNew: true, tab: accion.tab })}
              >
                <Ionicons name={accion.icon} size={20} color={colors.primary} />
                <Text style={s.quickLabel}>{accion.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {checklist}

          {cuentasPersonas.meDeben > 0 || cuentasPersonas.debo > 0 ? (
            <TouchableOpacity style={[s.card, s.rowCard]} onPress={() => navigation.navigate('Más', { screen: 'Cobros' })}>
              <Text style={s.rowIcon}>🐭</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Cuentas con personas</Text>
                <Text style={s.rowHint}>
                  {[
                    cuentasPersonas.meDeben > 0 ? `Te deben ${formatMoney(cuentasPersonas.meDeben)}` : null,
                    cuentasPersonas.debo > 0 ? `Debes ${formatMoney(cuentasPersonas.debo)}` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}

          {projection && series.length > 1 ? (
            <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => navigation.navigate('Proyeccion')}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>Si sigues así</Text>
                <Text style={s.link}>Ver y simular ›</Text>
              </View>
              <View style={s.projRow}>
                <Text style={[s.projValue, { color: projCierre >= 0 ? colors.primary : colors.danger }]}>{formatMoney(projCierre)}</Text>
                <Text style={s.projWhen}>al cierre de {projLast?.label}</Text>
              </View>
              <Sparkline values={series.map((p) => Number(p.closing_balance ?? 0))} height={44} />
              {proyectados.length > 0 ? (
                <Text style={s.projOutlook}>
                  <Text style={{ color: colors.success, fontWeight: '800' }}>{mesesEnPositivo} {mesesEnPositivo === 1 ? 'mes' : 'meses'} en positivo</Text>
                  {' · '}
                  <Text style={{ color: mesesEnRojo.length ? colors.danger : colors.textMuted, fontWeight: '800' }}>{mesesEnRojo.length} en rojo</Text>
                </Text>
              ) : null}
              {mesesEnRojo.length > 0 ? (
                <>
                  <TouchableOpacity onPress={() => setShowNegDetail((v) => !v)} activeOpacity={0.7}>
                    <Text style={s.projOutlookToggle}>
                      {showNegDetail
                        ? 'Ocultar el detalle'
                        : `Ver ${mesesEnRojo.length === 1 ? 'el mes en rojo' : `los ${mesesEnRojo.length} meses en rojo`}`}
                    </Text>
                  </TouchableOpacity>
                  {showNegDetail ? (
                    <View style={s.projOutlookList}>
                      {mesesEnRojo.slice(0, 4).map((m) => (
                        <View key={m.month} style={s.projOutlookItem}>
                          <Text style={s.projOutlookItemLabel}>{m.label}</Text>
                          <Text style={s.projOutlookItemVal}>{formatMoney(Number(m.closing_balance ?? 0))}</Text>
                        </View>
                      ))}
                      {mesesEnRojo.length > 4 ? (
                        <Text style={s.projOutlookMore}>
                          y {mesesEnRojo.length - 4} {mesesEnRojo.length - 4 === 1 ? 'mes más' : 'meses más'} en rojo
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}
            </TouchableOpacity>
          ) : null}

          {activeReport?.categorias?.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>Por categoría</Text>
                <Text style={s.cardHint}>{selectedMonthLabel}</Text>
              </View>
              {activeReport.categorias.map((cat) => (
                <View key={cat.categoria} style={s.categoryRow}>
                  <Text style={s.categoryIcon}>{cat.icono || '📦'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.categoryName}>{cat.categoria}</Text>
                    {cat.limite != null && (
                      <Text style={s.categoryLimit}>Límite: {formatMoney(cat.limite)}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.categoryAmount}>{formatMoney(cat.total)}</Text>
                    {cat.pct_limite != null && (
                      <Text style={[s.categoryPct, { color: cat.pct_limite > 100 ? colors.danger : colors.success }]}>
                        {cat.pct_limite}%
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeReport?.top_gastos?.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>Gastos puntuales más altos</Text>
                <Text style={s.cardHint}>{selectedMonthLabel}</Text>
              </View>
              {activeReport.top_gastos.slice(0, 5).map((item, index) => (
                <View key={`${item.descripcion}-${item.fecha}-${index}`} style={s.topExpenseRow}>
                  <View style={s.topExpenseIndex}>
                    <Text style={s.topExpenseIndexText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.topExpenseLabel}>{item.descripcion}</Text>
                    <Text style={s.topExpenseMeta}>
                      {item.categoria} · {formatDate(item.fecha)}
                    </Text>
                  </View>
                  <Text style={s.topExpenseAmount}>{formatMoney(item.monto)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

// Linea del saldo de cierre mes a mes. Si cruza a negativo se marca el cero.
function Sparkline({ values, height = 44, muted = false }) {
  const [width, setWidth] = useState(0)
  const pts = values.length > 1 ? values : [0, 0]
  const min = Math.min(...pts, 0)
  const max = Math.max(...pts, 0)
  const range = max - min || 1
  const pad = 3
  const x = (i) => (i / (pts.length - 1)) * width
  const y = (v) => pad + (1 - (v - min) / range) * (height - pad * 2)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const stroke = muted ? colors.textFaint : colors.primary
  return (
    <View style={{ height, marginTop: 6 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {min < 0 ? <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={colors.danger} strokeOpacity={0.5} strokeDasharray="4 3" /> : null}
          <Path d={area} fill={stroke} fillOpacity={0.14} />
          <Path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  )
}

function Onboarding({
  pasos, pasosListos, ahorroInicial, setAhorroInicial, savingAhorro,
  onGuardarAhorro, onOmitirAhorro, onIngreso, onGasto, onDileAAura,
}) {
  return (
    <View style={[s.card, s.onbCard]}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Arranquemos</Text>
        <Text style={s.cardHint}>{pasosListos} de 3 {pasosListos === 1 ? 'listo' : 'listos'}</Text>
      </View>
      <View style={s.onbTrack}><View style={[s.onbFill, { width: `${(pasosListos / 3) * 100}%` }]} /></View>

      <Paso n={1} hecho={pasos.ahorro} titulo="¿Con cuánto empiezas?" texto="Lo que tienes hoy en tu cuenta o ahorrado.">
        <View style={s.onbActions}>
          <View style={s.ahorroInputWrap}>
            <Text style={s.ahorroPrefix}>$</Text>
            <TextInput
              style={s.ahorroInput}
              value={ahorroInicial}
              onChangeText={setAhorroInicial}
              placeholder="Ej: 500"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              editable={!savingAhorro}
            />
          </View>
          <TouchableOpacity
            style={[s.btnPrimary, (!ahorroInicial || savingAhorro) && s.btnOff]}
            onPress={onGuardarAhorro}
            disabled={!ahorroInicial || savingAhorro}
          >
            {savingAhorro ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={s.btnPrimaryText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onOmitirAhorro} hitSlop={6}>
          <Text style={s.onbSkip}>No tengo ahorros por ahora</Text>
        </TouchableOpacity>
      </Paso>

      <Paso n={2} hecho={pasos.ingreso} titulo="Tu ingreso principal" texto="Tu sueldo o lo que te entra cada mes.">
        <View style={s.onbActions}>
          <TouchableOpacity style={s.btnPrimary} onPress={onIngreso}>
            <Text style={s.btnPrimaryText}>Registrar ingreso</Text>
          </TouchableOpacity>
        </View>
      </Paso>

      <Paso n={3} hecho={pasos.gasto} titulo="Tu primer gasto" texto="O díselo a Aura: «gasté 5 en almuerzo».">
        <View style={s.onbActions}>
          <TouchableOpacity style={s.btnGhost} onPress={onGasto}>
            <Text style={s.btnGhostText}>Registrar gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGhost} onPress={onDileAAura}>
            <Text style={s.btnGhostText}>✦ Dile a Aura</Text>
          </TouchableOpacity>
        </View>
      </Paso>
    </View>
  )
}

function Paso({ n, hecho, titulo, texto, children }) {
  return (
    <View style={[s.paso, n > 1 && s.pasoBorde]}>
      <View style={[s.pasoDot, hecho && s.pasoDotDone]}>
        {hecho
          ? <Ionicons name="checkmark" size={13} color="#06231A" />
          : <Text style={s.pasoNum}>{n}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.pasoTitulo, hecho && s.pasoTituloDone]}>{titulo}</Text>
        {hecho ? null : (
          <>
            <Text style={s.pasoTexto}>{texto}</Text>
            {children}
          </>
        )}
      </View>
    </View>
  )
}

function DetailCard({ tipo, onTipo, breakdown, items, total, mesLabel }) {
  const accent = tipo === 'income' ? colors.success : colors.danger
  return (
    <View style={s.card}>
      <View style={s.segmented}>
        {[{ k: 'expense', l: 'Gastos' }, { k: 'income', l: 'Ingresos' }].map((o) => (
          <TouchableOpacity key={o.k} style={[s.segBtn, tipo === o.k && s.segBtnOn]} onPress={() => onTipo(o.k)}>
            <Text style={[s.segText, tipo === o.k && s.segTextOn]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.breakdown}>
        {breakdown.map((b) => (
          <View key={b.id} style={s.breakdownRow}>
            <View style={[s.breakdownDot, { backgroundColor: b.color }]} />
            <Text style={s.breakdownLabel}>{b.label}</Text>
            <Text style={[s.breakdownValue, { color: b.color }]}>{formatMoney(b.value)}</Text>
          </View>
        ))}
        <View style={[s.breakdownRow, s.breakdownTotal]}>
          <Text style={[s.breakdownLabel, { color: colors.text, fontWeight: '700' }]}>Total</Text>
          <Text style={[s.breakdownValue, { color: accent }]}>{formatMoney(total)}</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={s.emptyListText}>
          {tipo === 'income' ? `No tienes ingresos guardados en ${mesLabel}.` : `No tienes gastos guardados en ${mesLabel}.`}
        </Text>
      ) : items.map((item) => (
        <View key={item.id} style={s.detailRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.detailLabel}>{item.label}</Text>
            <Text style={s.detailMeta}>{item.meta}</Text>
            {item.progress != null && (
              <View style={s.cuotaTrack}>
                <View style={[s.cuotaFill, { width: `${item.progress}%` }]} />
              </View>
            )}
          </View>
          <Text style={[s.detailAmount, { color: accent }]}>{formatMoney(item.amount)}</Text>
        </View>
      ))}
    </View>
  )
}

// La primera vez (sin cache) se ve la forma del Dashboard en vez de un spinner
// a pantalla completa.
function DashboardSkeleton({ topPad }) {
  return (
    <View style={[s.root, s.content, { paddingTop: topPad }]}>
      <View style={[s.skel, { width: '55%', height: 26 }]} />
      <View style={[s.skel, { height: 150, borderRadius: 18 }]} />
      <View style={s.quickRow}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={[s.skel, { flex: 1, height: 62 }]} />)}
      </View>
      <View style={[s.skel, { height: 130 }]} />
      <View style={[s.skel, { height: 110 }]} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greeting: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  errorCard: {
    backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.22)',
  },
  errorTitle: { color: colors.danger, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  errorBody: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 18 },

  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  cardHint: { color: colors.textFaint, fontSize: 12 },

  // Héroe
  hero: {
    borderRadius: 18, padding: 16, borderWidth: 1,
    backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  monthBtnOff: { opacity: 0.3 },
  monthText: { color: colors.text, fontSize: 13, fontWeight: '700', minWidth: 50, textAlign: 'center', textTransform: 'capitalize' },
  heroValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  heroValue: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  heroProjected: { color: colors.warning, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  segTrack: { flexDirection: 'row', height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, marginBottom: 8 },
  heroLegend: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  heroLegendText: { color: colors.textMuted, fontSize: 12 },
  heroLegendStrong: { color: colors.text, fontWeight: '700' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  estadoPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 1 },
  estadoText: { fontSize: 12, fontWeight: '700' },
  detalleBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // Detalle
  segmented: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3, marginBottom: 12 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segBtnOn: { backgroundColor: 'rgba(196,135,246,0.18)' },
  segText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: colors.primary },
  breakdown: { gap: 6, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1 },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  breakdownTotal: { marginTop: 4 },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  detailLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  detailMeta: { color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 2 },
  cuotaTrack: { marginTop: 6, height: 5, maxWidth: 190, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  cuotaFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  detailAmount: { fontSize: 13, fontWeight: '700' },
  emptyListText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },

  // Accesos rápidos
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  quickLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Cuentas con personas
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: { fontSize: 22 },
  rowTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  rowHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  // Proyección compacta
  projRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  projValue: { fontSize: 22, fontWeight: '800' },
  projWhen: { color: colors.textMuted, fontSize: 12 },
  projOutlook: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  projOutlookToggle: { color: colors.danger, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline', marginTop: 8 },
  projOutlookList: { marginTop: 8, gap: 4 },
  projOutlookItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9,
  },
  projOutlookItemLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  projOutlookItemVal: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  projOutlookMore: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 2 },

  // Cuenta nueva
  onbCard: { borderColor: 'rgba(16,185,129,0.28)' },
  onbTrack: { height: 5, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 4 },
  onbFill: { height: '100%', backgroundColor: colors.success, borderRadius: 999 },
  paso: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  pasoBorde: { borderTopWidth: 1, borderTopColor: colors.border },
  pasoDot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  pasoDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  pasoNum: { color: colors.text, fontSize: 12, fontWeight: '800' },
  pasoTitulo: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pasoTituloDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  pasoTexto: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  onbActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  onbSkip: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline', marginTop: 8 },
  ahorroInputWrap: {
    flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg,
    borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 10,
  },
  ahorroPrefix: { color: colors.textMuted, fontSize: 15, fontWeight: '600', marginRight: 4 },
  ahorroInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 15 },
  btnPrimary: { backgroundColor: colors.primaryStrong, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', minWidth: 92 },
  btnPrimaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  btnOff: { opacity: 0.4 },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(196,135,246,0.35)', backgroundColor: 'rgba(196,135,246,0.08)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnGhostText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  lockCard: { overflow: 'hidden' },
  lockVeil: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  lockText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  importLink: { alignItems: 'center', paddingVertical: 6 },
  importText: { color: colors.textMuted, fontSize: 13 },

  // Categorías y top gastos
  categoryRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  categoryIcon: { fontSize: 17, width: 24 },
  categoryName: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  categoryLimit: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  categoryAmount: { color: colors.text, fontWeight: '700', fontSize: 13 },
  categoryPct: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  topExpenseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  topExpenseIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(248,113,113,0.15)', justifyContent: 'center', alignItems: 'center' },
  topExpenseIndexText: { color: colors.danger, fontWeight: '800', fontSize: 11 },
  topExpenseLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  topExpenseMeta: { color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 2 },
  topExpenseAmount: { color: colors.danger, fontWeight: '700', fontSize: 13 },

  skel: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14 },
})
