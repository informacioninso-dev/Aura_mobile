import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { colors } from '../../theme/theme'
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

import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { formatMoney, formatDate } from '../../utils/formatters'
import { montoEfectivoMes } from '../../utils/frecuencias'
import ProjectionChart from '../../components/ui/ProjectionChart'
import NotificationBell from '../../components/ui/NotificationBell'
import SaludFinancieraCard from '../../components/ui/SaludFinancieraCard'
import { getApiErrorMessage } from '../../api/errors'
import { useTopInset } from '../../hooks/useTopInset'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Los cuatro registros mas frecuentes. Navegan al tab con el formulario ya
// abierto en el tipo correcto.
const QUICK_ACTIONS = [
  { key: 'gasto', icon: '💸', label: 'Gasto', screen: 'Gastos', tab: 'fijos' },
  { key: 'variable', icon: '🛒', label: 'Consumo', screen: 'Gastos', tab: 'variables' },
  { key: 'ingreso', icon: '💰', label: 'Ingreso', screen: 'Ingresos', tab: 'fijos' },
  { key: 'puntual', icon: '⚡', label: 'Puntual', screen: 'Gastos', tab: 'puntuales' },
]

const EMPTY_MOVEMENTS = {
  ingresos: [],
  ingresosPuntuales: [],
  gastosCorrientes: [],
  gastosNoCorrientes: [],
  diferidos: [],
}

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

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth()
  const currentMonth = useMemo(() => startOfMonth(new Date()), [])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [ahorroInicial, setAhorroInicial] = useState('')
  const [savingAhorro, setSavingAhorro] = useState(false)
  const [movements, setMovements] = useState(EMPTY_MOVEMENTS)
  const [report, setReport] = useState(null)
  const [reportMonthKey, setReportMonthKey] = useState('')
  const [projection, setProjection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [expandedDetail, setExpandedDetail] = useState(null) // 'income' | 'expense' | null
  const reportRequestRef = useRef(0)

  const projectionDisplayMonths = Math.max(2, Number(user?.feature_access?.projection_months || 6))
  const freeFutureMonths = Math.max(1, Math.floor(projectionDisplayMonths / 2))
  const freePastMonths = Math.max(1, projectionDisplayMonths - freeFutureMonths)
  const advancedProjectionEnabled = Boolean(user?.feature_access?.advanced_projection_enabled)
  const advancedProjectionMaxMonths = Math.max(1, Number(user?.feature_access?.advanced_projection_months || 120))
  const projectionFutureMonths = advancedProjectionEnabled ? Math.min(12, advancedProjectionMaxMonths) : freeFutureMonths
  const projectionPastMonths = advancedProjectionEnabled ? 6 : freePastMonths

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
        api.get(`/finanzas/proyeccion-acumulada/?months=${projectionFutureMonths}&past_months=${projectionPastMonths}`),
      ])

      setMovements({
        ingresos: dashboardResponse.data.ingresos || [],
        ingresosPuntuales: dashboardResponse.data.ingresos_puntuales || [],
        gastosCorrientes: dashboardResponse.data.gastos_corrientes || [],
        gastosNoCorrientes: dashboardResponse.data.gastos_no_corrientes || [],
        diferidos: dashboardResponse.data.diferidos || [],
      })
      setProjection(projectionResponse.data || null)
    } catch (err) {
      setMovements(EMPTY_MOVEMENTS)
      setProjection(null)
      setError(getApiErrorMessage(err, 'No se pudo cargar el dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [projectionFutureMonths, projectionPastMonths])

  const loadReport = useCallback(async (month, { silent = false } = {}) => {
    const requestId = reportRequestRef.current + 1
    const targetMonthKey = formatMonthKey(month)
    reportRequestRef.current = requestId

    if (!silent) setReportLoading(true)

    try {
      const { data } = await api.get(
        `/finanzas/reporte/?anio=${month.getFullYear()}&mes=${month.getMonth() + 1}`,
      )
      if (requestId !== reportRequestRef.current) return
      setReport(data)
      setReportMonthKey(targetMonthKey)
    } catch (err) {
      if (requestId !== reportRequestRef.current) return
      setReport(null)
      setReportMonthKey('')
      if (!silent) {
        setError(getApiErrorMessage(err, 'No se pudo cargar el resumen del mes.'))
      }
    } finally {
      if (requestId === reportRequestRef.current) {
        setReportLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadBase(selectedMonth)
  }, [loadBase, selectedMonth])

  useEffect(() => {
    void loadReport(selectedMonth)
  }, [loadReport, selectedMonth])

  // El ahorro inicial se guarda como un ingreso puntual con fecha de hoy, igual
  // que en la web: asi la proyeccion y el colchon arrancan desde el saldo real
  // en vez de desde cero.
  async function guardarAhorroInicial() {
    const monto = parseFloat(ahorroInicial)
    if (!monto || monto <= 0 || savingAhorro) return
    setSavingAhorro(true)
    try {
      const hoy = new Date()
      const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      await api.post('/finanzas/ingresos-puntuales/', {
        descripcion: 'Ahorros iniciales',
        monto,
        fecha,
        notas: 'Saldo con el que empiezo a usar Aura',
        incluir_en_proyeccion: true,
      })
      setAhorroInicial('')
      await Promise.all([
        loadBase(selectedMonth, { silent: true }),
        loadReport(selectedMonth, { silent: true }),
      ])
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar tu ahorro inicial.'))
    } finally {
      setSavingAhorro(false)
    }
  }

  async function onRefresh() {
    setRefreshing(true)
    setError('')
    try {
      await Promise.all([
        loadBase(selectedMonth, { silent: true }),
        loadReport(selectedMonth, { silent: true }),
      ])
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
    const fallbackMaxMonth = maxCandidates.reduce((latest, candidate) => (
      candidate > latest ? candidate : latest
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

  const selectedMonthLabel = `${MESES[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`
  const selectedMonthKey = formatMonthKey(selectedMonth)
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
        meta: `${getFrequencyLabel(item.frecuencia)} · impacto mensual`,
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
      ...installmentsThisMonth.map((item) => ({
        id: `expense-installment-${item.id}`,
        label: item.descripcion,
        meta: `${item.categoria || 'Sin categoría'} · cuota mensual`,
        amount: cuotaDelMes(item),
      })),
      ...punctualExpensesThisMonth.map((item) => ({
        id: `expense-punctual-${item.id}`,
        label: item.descripcion,
        meta: `${item.categoria || 'Sin categoría'} · ${formatDate(item.fecha)}`,
        amount: Number(item.monto || 0),
      })),
    ].sort((a, b) => b.amount - a.amount)
  }, [fixedExpensesThisMonth, installmentsThisMonth, punctualExpensesThisMonth, selectedMonth])

  const movementCount = (
    movements.ingresos.length
    + movements.ingresosPuntuales.length
    + movements.gastosCorrientes.length
    + movements.gastosNoCorrientes.length
    + movements.diferidos.length
  )

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

  const breakdownItems = [
    { id: 'income-fixed', label: 'Ingresos fijos', value: Number(reportSummary?.ingresos_fijos ?? fixedIncomeTotal), color: colors.success },
    { id: 'income-punctual', label: 'Ingresos puntuales', value: Number(reportSummary?.ingresos_puntuales ?? punctualIncomeTotal), color: '#34D399' },
    { id: 'expense-fixed', label: 'Gastos fijos', value: Number(reportSummary?.gastos_corrientes ?? fixedExpenseTotal), color: colors.danger },
    { id: 'expense-installments', label: 'Cuotas / diferidos', value: Number(reportSummary?.cuotas ?? installmentTotal), color: '#FB923C' },
    { id: 'expense-punctual', label: 'Gastos puntuales', value: Number(reportSummary?.gastos_puntuales ?? punctualExpenseTotal), color: '#FCA5A5' },
  ]

  const selectedProjectionPoint = projection?.series?.find(
    (item) => item.month === selectedMonthKey,
  ) || null
  const currentProjectionPoint = projection?.series?.find((item) => item.is_current) || null
  const heroValue = selectedProjectionPoint
    ? Number(selectedProjectionPoint.closing_balance || 0)
    : Number(reportSummary?.balance ?? 0)
  const heroLabel = selectedProjectionPoint
    ? (selectedProjectionPoint.is_real ? 'Saldo al cierre' : 'Saldo proyectado al cierre')
    : 'Balance del mes'
  const heroSub = selectedProjectionPoint
    ? (selectedProjectionPoint.is_real
        ? 'Calculado con los movimientos del mes seleccionado'
        : 'Estimado con tu proyección actual')
    : 'Ingresos menos gastos del mes seleccionado'
  const availableBalance = currentProjectionPoint
    ? Number(currentProjectionPoint.closing_balance || 0)
    : Number(reportSummary?.balance ?? 0)
  const availableBalanceLabel = currentProjectionPoint?.label || `${MESES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`

  const totalIngresos = Number(reportSummary?.total_ingresos ?? (fixedIncomeTotal + punctualIncomeTotal))
  const totalGastos = Number(reportSummary?.total_gastos ?? (fixedExpenseTotal + installmentTotal + punctualExpenseTotal))
  const totalBalance = Number(reportSummary?.balance ?? (totalIngresos - totalGastos))
  const tasaAhorro = Number(
    reportSummary?.tasa_ahorro
    ?? (totalIngresos > 0 ? (((totalBalance / totalIngresos) * 100).toFixed(1)) : 0),
  )
  const tasaPct = Math.min(Math.max(tasaAhorro, 0), 100)
  const gastoPct = totalIngresos > 0 ? Math.min(100, Math.round((totalGastos / totalIngresos) * 100)) : 0
  const gastoPctColor = gastoPct >= 90 ? colors.danger : gastoPct >= 75 ? '#FB923C' : gastoPct >= 50 ? '#FBBF24' : colors.success

  const projectionWindowCopy = projection
    ? `${projection.display_past_months || projectionPastMonths} meses reales · ${projection.months || projectionFutureMonths} proyectados`
    : `${projectionPastMonths} meses reales · ${projectionFutureMonths} proyectados`

  // Ultimo punto proyectado: su saldo de cierre es "con lo que terminarias".
  const projLast = projection?.series?.length ? projection.series[projection.series.length - 1] : null
  const projCierre = Number(projLast?.closing_balance ?? 0)
  const esModoSimple = projection?.projection_mode === 'simple'
  const topPad = useTopInset()

  if (loading && reportLoading) {
    return (
      <View style={s.loaderScreen}>
        <ActivityIndicator color="#C487F6" size="large" />
        <Text style={s.loaderText}>Cargando tu dashboard...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: topPad }]}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#C487F6"
        />
      )}
    >
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>
            {getGreeting()}
            {user?.username ? `, ${user.username}` : ''}
          </Text>
          <Text style={s.subtitle}>Tu mes, claro y sin vueltas.</Text>
        </View>
        <NotificationBell />
        <View style={s.planBadge}>
          <Text style={s.planText}>Plan {user?.plan?.name || 'Gratis'}</Text>
        </View>
      </View>

      <View style={s.monthSwitcher}>
        <TouchableOpacity
          style={[s.monthNavBtn, !canGoPrevMonth && s.monthNavBtnDisabled]}
          onPress={() => setSelectedMonth((current) => addMonths(current, -1))}
          disabled={!canGoPrevMonth}
        >
          <Text style={s.monthNavArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.monthSwitcherCenter}>
          <Text style={s.monthSwitcherLabel}>{selectedMonthLabel}</Text>
          {isFutureMonth && <Text style={s.monthFutureHint}>Proyectado</Text>}
        </View>
        <TouchableOpacity
          style={[s.monthNavBtn, !canGoNextMonth && s.monthNavBtnDisabled]}
          onPress={() => setSelectedMonth((current) => addMonths(current, 1))}
          disabled={!canGoNextMonth}
        >
          <Text style={s.monthNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={s.shortcutCard}
        onPress={() => navigation.navigate('Más', { screen: 'Cobros' })}
      >
        <Text style={s.shortcutIcon}>💳</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.shortcutTitle}>Cobros y deudas</Text>
          <Text style={s.shortcutHint}>Qué te deben y qué debés</Text>
        </View>
        <Text style={s.shortcutArrow}>›</Text>
      </TouchableOpacity>

      {error ? (
        <View style={s.errorCard}>
          <Text style={s.errorTitle}>No pudimos cargar todo el dashboard</Text>
          <Text style={s.errorBody}>{error}</Text>
        </View>
      ) : null}

      {movementCount === 0 && (
        <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>Empieza en 10 segundos</Text>
          <Text style={s.emptyText}>
            Carga un ingreso, un gasto o importa tu historial. Con eso Aura ya te empieza a mostrar tu panorama.
          </Text>

          <View style={s.ahorroBlock}>
            <Text style={s.ahorroLabel}>¿Ya tienes ahorros? Empieza con tu saldo real</Text>
            <View style={s.ahorroRow}>
              <Text style={s.ahorroPrefix}>$</Text>
              <TextInput
                style={s.ahorroInput}
                value={ahorroInicial}
                onChangeText={setAhorroInicial}
                placeholder="Ej: 500"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                editable={!savingAhorro}
              />
              <TouchableOpacity
                style={[s.ahorroBtn, (!ahorroInicial || savingAhorro) && s.ahorroBtnOff]}
                onPress={guardarAhorroInicial}
                disabled={!ahorroInicial || savingAhorro}
              >
                {savingAhorro
                  ? <ActivityIndicator color="#07131F" size="small" />
                  : <Text style={s.ahorroBtnText}>Empezar</Text>}
              </TouchableOpacity>
            </View>
            <Text style={s.ahorroHint}>
              Suma todo lo que tengas ahorrado hoy. Es el punto de partida para que tu
              proyeccion y tu colchon arranquen bien.
            </Text>
          </View>
        </View>
      )}

      {/* El dashboard NO encabeza con el saldo de cierre / disponible: un numero
          grande basado en la proyeccion da una falsa tranquilidad. En su lugar
          va el score de salud financiera (para quien lo tiene). El saldo del
          cierre sigue disponible, pero contextualizado dentro de la proyeccion. */}
      <SaludFinancieraCard navigation={navigation} />

      {reportLoading && !reportSummary ? (
        <View style={s.summaryLoadingCard}>
          <ActivityIndicator color="#C487F6" />
          <Text style={s.summaryLoadingText}>Actualizando el resumen de {selectedMonthLabel.toLowerCase()}...</Text>
        </View>
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
            <Text style={s.quickIcon}>{accion.icon}</Text>
            <Text style={s.quickLabel}>{accion.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.grid}>
        <StatCard
          label="Ingresos" value={totalIngresos} color="#10B981" icon="💰"
          expanded={expandedDetail === 'income'}
          onPress={() => setExpandedDetail((p) => (p === 'income' ? null : 'income'))}
        />
        <StatCard
          label="Gastos" value={totalGastos} color="#F87171" icon="💸"
          expanded={expandedDetail === 'expense'}
          onPress={() => setExpandedDetail((p) => (p === 'expense' ? null : 'expense'))}
        />
      </View>

      {expandedDetail === 'income' ? (
        <DetailCard
          title={`Detalle de ingresos · ${selectedMonthLabel}`}
          total={totalIngresos}
          items={incomeDetailItems}
          emptyLabel={`No tienes ingresos guardados en ${selectedMonthLabel.toLowerCase()}.`}
          accent="#10B981"
          showAll
        />
      ) : null}
      {expandedDetail === 'expense' ? (
        <DetailCard
          title={`Detalle de gastos · ${selectedMonthLabel}`}
          total={totalGastos}
          items={expenseDetailItems}
          emptyLabel={`No tienes gastos guardados en ${selectedMonthLabel.toLowerCase()}.`}
          accent="#F87171"
          showAll
        />
      ) : null}

      <View style={s.balanceCard}>
        <View style={s.balanceRow}>
          <Text style={s.balanceLabel}>Balance del mes</Text>
          <Text style={[s.balanceValue, { color: totalBalance >= 0 ? colors.success : colors.danger }]}>
            {formatMoney(totalBalance)}
          </Text>
        </View>
        {totalIngresos > 0 && (
          <>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${tasaPct}%`, backgroundColor: tasaPct >= 20 ? colors.success : tasaPct >= 10 ? '#F59E0B' : colors.danger },
                ]}
              />
            </View>
            <Text style={s.tasaText}>
              Tasa de ahorro:{' '}
              <Text style={s.tasaStrong}>{tasaAhorro}%</Text>
            </Text>
          </>
        )}
      </View>

      {totalIngresos > 0 && (
        <View style={s.healthCard}>
          <View style={s.healthHeader}>
            <Text style={s.healthLabel}>Gastos vs ingresos</Text>
            <Text style={[s.healthPct, { color: gastoPctColor }]}>{gastoPct}%</Text>
          </View>
          <View style={s.healthTrack}>
            <View style={[s.healthFill, { width: `${gastoPct}%`, backgroundColor: gastoPctColor }]} />
          </View>
          <Text style={s.healthHint}>
            {gastoPct >= 90
              ? 'Atención: casi sin margen'
              : gastoPct >= 75
                ? 'Cuidado: margen estrecho'
                : gastoPct >= 50
                  ? 'Moderado: todavía hay espacio'
                  : 'Saludable: buen colchón'}
          </Text>
        </View>
      )}

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Desglose del mes</Text>
          <Text style={s.sectionHint}>{selectedMonthLabel}</Text>
        </View>
        {breakdownItems.map((item, index) => (
          <View key={item.id}>
            {index === 2 ? <View style={s.breakdownDivider} /> : null}
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>{item.label}</Text>
              <Text style={[s.breakdownValue, { color: item.color }]}>{formatMoney(item.value)}</Text>
            </View>
          </View>
        ))}
      </View>

      {activeReport?.categorias?.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Por categoría</Text>
            <Text style={s.sectionHint}>{selectedMonthLabel}</Text>
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
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Top gastos puntuales</Text>
            <Text style={s.sectionHint}>{selectedMonthLabel}</Text>
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

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Proyección de saldo</Text>
          <Text style={s.sectionHint}>{advancedProjectionEnabled ? 'Pro' : 'Gratis'}</Text>
        </View>
        <Text style={s.projectionCopy}>
          {projectionWindowCopy}
        </Text>

        {projection ? (
          <View style={s.projTiles}>
            <View style={[s.projTile, s.projTileWide]}>
              <Text style={s.projTileLabel}>Si sigues así, terminarías con</Text>
              <Text style={[s.projTileVal, { color: projCierre >= 0 ? colors.primary : colors.danger }]}>{formatMoney(projCierre)}</Text>
              <Text style={s.projTileHint}>Saldo estimado al cierre de {projLast?.label || 'el horizonte'}</Text>
            </View>
            <View style={s.projTile}>
              <Text style={s.projTileLabel}>Hoy partes con</Text>
              <Text style={s.projTileVal}>{formatMoney(Number(projection.starting_balance ?? 0))}</Text>
              <Text style={s.projTileHint}>Saldo con el que arranca</Text>
            </View>
            <View style={s.projTile}>
              <Text style={s.projTileLabel}>Gastos variables / mes</Text>
              <Text style={[s.projTileVal, { color: colors.danger }]}>{formatMoney(Number(projection.variable_monthly_estimate ?? 0))}</Text>
              <Text style={s.projTileHint}>{esModoSimple ? 'Con tus estimados' : 'Estimado del historial (ponderado)'}</Text>
            </View>
            {advancedProjectionEnabled ? (
              <View style={[s.projTile, s.projTileWide]}>
                <Text style={s.projTileLabel}>Cálculo de variables</Text>
                <Text style={[s.projTileVal, { color: colors.text }]}>{esModoSimple ? 'Estimado' : 'Ponderado'}</Text>
                <Text style={s.projTileHint}>
                  {esModoSimple
                    ? 'Usa los montos que registraste'
                    : `${Number(projection.variable_history_observations ?? 0)} ${Number(projection.variable_history_observations ?? 0) === 1 ? 'registro' : 'registros'} · el último año pesa doble`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <ProjectionChart
          data={projection}
          loading={loading}
          showHeader={false}
          advancedProjectionEnabled={advancedProjectionEnabled}
        />
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function StatCard({ label, value, color, icon, onPress, expanded }) {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper style={[s.statCard, { borderColor: `${color}33` }, expanded && { borderColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{formatMoney(value)}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {onPress ? (
        <Text style={[s.statDetail, { color }]}>{expanded ? 'Ocultar ▲' : 'Ver detalle ▾'}</Text>
      ) : null}
    </Wrapper>
  )
}

function DetailCard({ title, total, items, emptyLabel, accent, showAll }) {
  const visibles = showAll ? items : items.slice(0, 4)
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={[s.sectionTotal, { color: accent }]}>{formatMoney(total)}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={s.emptyListText}>{emptyLabel}</Text>
      ) : (
        <>
          {visibles.map((item) => (
            <View key={item.id} style={s.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.detailLabel}>{item.label}</Text>
                <Text style={s.detailMeta}>{item.meta}</Text>
              </View>
              <Text style={[s.detailAmount, { color: accent }]}>{formatMoney(item.amount)}</Text>
            </View>
          ))}
          {!showAll && items.length > 4 && (
            <Text style={s.moreText}>y {items.length - 4} más</Text>
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  loaderScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greeting: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4 },
  planBadge: {
    backgroundColor: 'rgba(196,135,246,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(196,135,246,0.25)',
  },
  planText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
  },
  monthNavBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  monthNavBtnDisabled: { opacity: 0.35 },
  monthNavArrow: { color: colors.primary, fontSize: 24, lineHeight: 26 },
  monthSwitcherCenter: { flex: 1, alignItems: 'center', gap: 2 },
  monthSwitcherLabel: { color: colors.text, fontWeight: '700', fontSize: 16 },
  monthFutureHint: { color: '#FBBF24', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  shortcutIcon: { fontSize: 22 },
  shortcutTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  shortcutHint: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  shortcutArrow: { color: 'rgba(196,135,246,0.6)', fontSize: 22 },
  errorCard: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.22)',
  },
  errorTitle: { color: colors.danger, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  errorBody: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 18 },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 6 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 18 },
  ahorroBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  ahorroLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  ahorroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ahorroPrefix: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  ahorroInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15 },
  ahorroBtn: { backgroundColor: '#16C79A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, minWidth: 92, alignItems: 'center' },
  ahorroBtnOff: { opacity: 0.4 },
  ahorroBtnText: { color: '#07131F', fontSize: 14, fontWeight: '800' },
  ahorroHint: { color: colors.textFaint, fontSize: 11, lineHeight: 15 },
  heroCard: {
    backgroundColor: 'rgba(196,135,246,0.08)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(196,135,246,0.22)',
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heroLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  heroBadge: {
    color: colors.primary,
    backgroundColor: 'rgba(196,135,246,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  heroBadgeFuture: {
    color: '#FBBF24',
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  heroValue: { fontSize: 34, fontWeight: '900', marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.42)', fontSize: 12, lineHeight: 18 },
  availableCard: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availableLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  availableValue: { fontSize: 26, fontWeight: '900', marginBottom: 4 },
  availableHint: { color: 'rgba(255,255,255,0.38)', fontSize: 12, lineHeight: 18 },
  summaryLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  summaryLoadingText: { color: 'rgba(255,255,255,0.48)', fontSize: 12, flex: 1 },
  grid: { flexDirection: 'row', gap: 12 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border },
  quickIcon: { fontSize: 20 },
  quickLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: 'rgba(255,255,255,0.42)', fontSize: 12 },
  statDetail: { fontSize: 11, fontWeight: '700', marginTop: 6, opacity: 0.85 },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  balanceValue: { fontSize: 22, fontWeight: '800' },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  tasaText: { color: 'rgba(255,255,255,0.42)', fontSize: 12 },
  tasaStrong: { color: colors.text, fontWeight: '700' },
  healthCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  healthLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  healthPct: { fontWeight: '800', fontSize: 14 },
  healthTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  healthFill: { height: '100%', borderRadius: 999 },
  healthHint: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  breakdownLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sectionHint: { color: colors.textFaint, fontSize: 11 },
  sectionTotal: { fontSize: 14, fontWeight: '800' },
  projectionCopy: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 12 },
  projTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  projTile: {
    flexGrow: 1, flexBasis: '47%', minWidth: 130,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12,
  },
  projTileWide: { flexBasis: '100%' },
  projTileLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  projTileVal: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 3 },
  projTileHint: { color: colors.textMuted, fontSize: 11, marginTop: 3, lineHeight: 15 },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  detailLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  detailMeta: { color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 2 },
  detailAmount: { fontSize: 13, fontWeight: '700' },
  moreText: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  emptyListText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  categoryRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  categoryIcon: { fontSize: 17, width: 24 },
  categoryName: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  categoryLimit: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  categoryAmount: { color: colors.text, fontWeight: '700', fontSize: 13 },
  categoryPct: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  topExpenseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  topExpenseIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(248,113,113,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topExpenseIndexText: { color: colors.danger, fontWeight: '800', fontSize: 11 },
  topExpenseLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  topExpenseMeta: { color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 2 },
  topExpenseAmount: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  logoutBtn: {
    marginTop: 4,
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.22)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
})
