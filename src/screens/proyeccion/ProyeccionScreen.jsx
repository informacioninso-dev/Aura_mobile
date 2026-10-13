import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { useAuth } from '../../context/AuthContext'
import { useTopInset } from '../../hooks/useTopInset'
import BalanceChart from '../../components/ui/BalanceChart'
import { MODE_OPTIONS, HISTORY_OPTIONS, getProjectionHelp } from '../../utils/proyeccionOpciones'
import { formatMoney } from '../../utils/formatters'
import { TIPOS_SIMULACION, simular } from '../../utils/simulacion'
import { colors } from '../../theme/theme'

const HORIZONTES = [
  { value: 6, label: '6 meses' },
  { value: 12, label: '1 año' },
  { value: 24, label: '2 años' },
  { value: 60, label: '5 años' },
  { value: 120, label: '10 años' },
  { value: 240, label: '20 años' },
  { value: 480, label: '40 años' },
]
const MONTOS_RAPIDOS = {
  contado: [100, 500, 1000, 5000],
  cuotas: [1000, 5000, 10000, 20000],
  recurrente: [20, 50, 100, 300],
}
const PLAZOS = {
  cuotas: [6, 12, 24, 36, 48, 60],
  recurrente: [3, 6, 12, 24],
}
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function shortLabel(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number)
  return m ? `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}` : ''
}

function fechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const parseMonto = (v) => Number(String(v).replace(',', '.')) || 0

/**
 * Proyección + simulador en una sola pantalla: ver hacia dónde va tu saldo y
 * probar una decisión encima, con el resultado en vivo. Se abre desde el
 * Dashboard ("Si sigues así") y desde Más → Simulador (con el simulador abierto).
 */
export default function ProyeccionScreen({ navigation, route }) {
  const { user, fetchMe } = useAuth()
  const topPad = useTopInset()
  const desdeSimulador = Boolean(route?.params?.simular)

  const pro = Boolean(user?.feature_access?.advanced_projection_enabled)
  const maxMeses = Math.max(1, Number(user?.feature_access?.advanced_projection_months || 120))
  const freeMeses = Math.max(2, Number(user?.feature_access?.projection_months || 6))
  const horizontes = pro ? HORIZONTES.filter((h) => h.value <= maxMeses) : []

  // Gratis: 1 mes proyectado (lo impone el backend; se muestra lo que responde).
  const [futuro, setFuturo] = useState(pro ? Math.min(12, maxMeses) : 1)
  const [pasado, setPasado] = useState(pro ? 6 : Math.max(1, freeMeses - Math.floor(freeMeses / 2)))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [scrubbing, setScrubbing] = useState(false)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)
  const [modo, setModo] = useState(pro ? (user?.projection_mode || 'automatica') : 'simple')
  const [guardandoModo, setGuardandoModo] = useState(false)
  const [recalculando, setRecalculando] = useState(false)

  // Simulación
  const [tipo, setTipo] = useState(desdeSimulador ? 'contado' : null)
  const [monto, setMonto] = useState('')
  const [nombre, setNombre] = useState('')
  const [plazo, setPlazo] = useState(12)
  const [tasa, setTasa] = useState('')
  const [inicioOffset, setInicioOffset] = useState(0)
  const [agregando, setAgregando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: resp } = await api.get(`/finanzas/proyeccion-acumulada/?months=${futuro}&past_months=${pasado}`)
      setData(resp)
    } catch (err) {
      setError(getApiErrorMessage(err, 'No pudimos cargar tu proyección. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }, [futuro, pasado])

  useEffect(() => { void cargar() }, [cargar])

  const series = data?.series || []
  const currentIdx = series.findIndex((p) => p.is_current)
  const montoNum = parseMonto(monto)
  const simActiva = Boolean(tipo) && montoNum > 0 && series.length > 0
  // Meses desde hoy hasta el final: limite para "¿cuándo?".
  const mesesDisponibles = Math.max(1, series.length - Math.max(0, currentIdx))

  const sim = useMemo(() => (simActiva
    ? simular(series, { tipo, monto: montoNum, tasaAnual: parseMonto(tasa), plazoMeses: plazo, inicioOffset })
    : null), [simActiva, series, tipo, montoNum, tasa, plazo, inicioOffset])

  const points = useMemo(() => series.map((p, i) => ({
    key: p.month,
    label: p.label,
    short: shortLabel(p.month),
    balance: Number(p.closing_balance ?? 0),
    ingresos: Number(p.monthly_ingresos ?? 0),
    gastos: Number(p.monthly_gastos ?? 0),
    simBalance: sim?.puntos[i]?.simBalance ?? null,
    simGastos: sim?.puntos[i]?.simGastos ?? null,
    isReal: Boolean(p.is_real),
    isCurrent: Boolean(p.is_current),
  })), [series, sim])

  // Al cambiar el horizonte o simular, el foco va al ultimo mes (el resultado);
  // si la decision te deja en rojo, al primer mes en rojo.
  useEffect(() => {
    if (!points.length) return
    if (sim?.primerRojoIdx != null) setSelected(sim.primerRojoIdx)
    else setSelected(points.length - 1)
  }, [points.length, sim?.primerRojoIdx, sim != null]) // eslint-disable-line react-hooks/exhaustive-deps

  const last = points[points.length - 1]
  const baseFinal = last?.balance ?? 0
  const finalMostrado = sim ? sim.final : baseFinal
  const inicioLabel = series[Math.max(0, currentIdx) + inicioOffset]?.label || 'este mes'

  async function cambiarModo(next) {
    if (!pro || next === modo || guardandoModo) return
    const previo = modo
    setModo(next)
    setGuardandoModo(true)
    try {
      await api.patch('/usuarios/perfil/', { projection_mode: next })
      await fetchMe()
      await cargar()
    } catch (err) {
      setModo(previo)
      setError(getApiErrorMessage(err, 'No pudimos cambiar el modo. Intenta de nuevo.'))
    } finally {
      setGuardandoModo(false)
    }
  }

  async function recalcular() {
    if (recalculando) return
    setRecalculando(true)
    try {
      await api.post('/finanzas/saldo-mes/recalcular/')
      await cargar()
    } catch (err) {
      setError(getApiErrorMessage(err, 'No pudimos recalcular tu saldo. Intenta de nuevo.'))
    } finally {
      setRecalculando(false)
    }
  }

  function elegirTipo(next) {
    setTipo(next)
    setMonto('')
    setPlazo(next === 'cuotas' ? 12 : 6)
    setTasa('')
    setInicioOffset(0)
  }

  function limpiarSimulacion() {
    setTipo(null)
    setMonto('')
    setNombre('')
  }

  // Mismo destino que en la web: pago unico -> gasto puntual a futuro, gasto
  // mensual -> gasto fijo acotado al plazo, prestamo -> gasto a cuotas.
  async function agregarAMisGastos({ confirmarDuplicado = false } = {}) {
    if (!sim || agregando) return
    const descripcion = nombre.trim()
    if (!descripcion) {
      Alert.alert('Ponle un nombre', 'Escribe qué es (por ejemplo, "Viaje a Galápagos") para guardarlo en tus gastos.')
      return
    }
    const hoy = new Date()
    const inicio = inicioOffset === 0 ? hoy : new Date(hoy.getFullYear(), hoy.getMonth() + inicioOffset, 1)
    const finMes = (meses) => new Date(inicio.getFullYear(), inicio.getMonth() + meses, 0)
    setAgregando(true)
    try {
      if (tipo === 'contado') {
        await api.post('/finanzas/gastos-no-corrientes/', {
          descripcion, categoria: 'otro', monto: sim.terms.total, fecha: fechaISO(inicio),
          incluir_en_proyeccion: true, permitir_futuro: true,
        })
      } else if (tipo === 'recurrente') {
        await api.post('/finanzas/gastos-corrientes/', {
          descripcion, categoria: 'otro', monto: sim.terms.cuota, tipo_monto: 'fijo', frecuencia: 'mensual',
          fecha_inicio: fechaISO(inicio), fecha_fin: fechaISO(finMes(sim.terms.meses)), activo: true, permitir_futuro: true,
        })
      } else {
        const fin = new Date(inicio.getFullYear(), inicio.getMonth() + sim.terms.meses - 1, inicio.getDate())
        await api.post('/finanzas/diferidos/', {
          descripcion, categoria: 'otro', monto_total: sim.terms.total, num_cuotas: sim.terms.meses,
          cuota_mensual: sim.terms.cuota, fecha_inicio: fechaISO(inicio), fecha_fin: fechaISO(fin),
          activo: true, confirmar_duplicado: confirmarDuplicado,
        })
      }
      const mensajes = {
        contado: 'Quedó agregado como gasto puntual en tu plan.',
        recurrente: 'Quedó agregado a tus gastos fijos.',
        cuotas: 'Quedó agregado a tus gastos a cuotas.',
      }
      Alert.alert('Listo', mensajes[tipo])
      limpiarSimulacion()
      await cargar()
    } catch (err) {
      const dup = err?.response?.data?.duplicado
      if (tipo === 'cuotas' && dup && !confirmarDuplicado) {
        Alert.alert('¿Ya lo tienes registrado?', String(Array.isArray(dup) ? dup.join(' ') : dup), [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar igual', onPress: () => agregarAMisGastos({ confirmarDuplicado: true }) },
        ])
        return
      }
      Alert.alert('No pudimos agregarlo', getApiErrorMessage(err, 'No pudimos agregar a tus gastos. Intenta de nuevo.'))
    } finally {
      setAgregando(false)
    }
  }

  const veredicto = sim
    ? sim.primerRojoIdx != null
      ? { color: colors.danger, icon: 'alert-circle', text: `Te quedarías en rojo desde ${points[sim.primerRojoIdx]?.label} (${sim.mesesEnRojo} ${sim.mesesEnRojo === 1 ? 'mes' : 'meses'}).` }
      : { color: colors.success, icon: 'checkmark-circle', text: `Te alcanza. Tu saldo más bajo sería ${formatMoney(sim.peorSaldo)} en ${points[sim.peorIdx]?.label}.` }
    : null

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad }]}
        scrollEnabled={!scrubbing}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Volver" hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>{desdeSimulador ? 'Simulador' : 'Proyección'}</Text>
          <TouchableOpacity onPress={() => setAjustesAbiertos((v) => !v)} style={s.backBtn} accessibilityLabel="Ajustes de la proyección" hitSlop={8}>
            <Ionicons name="options-outline" size={20} color={ajustesAbiertos ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Resumen: la respuesta primero */}
        <View style={s.summary}>
          <Text style={s.summaryLabel}>{sim ? 'Con esta decisión terminarías con' : 'Si sigues así, terminarías con'}</Text>
          <Text style={[s.summaryValue, { color: finalMostrado >= 0 ? colors.text : colors.danger }]}>{formatMoney(finalMostrado)}</Text>
          <Text style={s.summaryHint}>
            al cierre de {last?.label || '...'}
            {sim ? (
              <Text style={{ color: sim.diferencia < 0 ? colors.danger : colors.success, fontWeight: '700' }}>
                {'  '}{sim.diferencia < 0 ? '−' : '+'}{formatMoney(Math.abs(sim.diferencia))} vs. hoy
              </Text>
            ) : null}
          </Text>
        </View>

        {pro ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {horizontes.map((h) => (
              <TouchableOpacity key={h.value} style={[s.chip, futuro === h.value && s.chipOn]} onPress={() => setFuturo(h.value)}>
                <Text style={[s.chipText, futuro === h.value && s.chipTextOn]}>{h.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={s.lockedNote}>
            {(() => {
              const m = Number(data?.months ?? futuro)
              return `Con el plan Gratis ves ${m === 1 ? 'el próximo mes' : `${m} meses hacia adelante`}. Con Pro, hasta 40 años.`
            })()}
          </Text>
        )}

        <View style={s.card}>
          {loading && !data ? (
            <View style={s.loader}><ActivityIndicator color={colors.primary} /></View>
          ) : points.length > 1 ? (
            <BalanceChart
              points={points}
              selected={selected ?? points.length - 1}
              onSelect={setSelected}
              onScrubChange={setScrubbing}
              hasSim={Boolean(sim)}
            />
          ) : (
            <Text style={s.empty}>Registra tu ingreso y tus gastos fijos para ver hacia dónde va tu saldo.</Text>
          )}
          {loading && data ? <ActivityIndicator style={s.reloading} color={colors.primary} size="small" /> : null}
        </View>

        {ajustesAbiertos ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Cómo se calcula</Text>
            <Text style={s.groupLabel}>{pro ? 'Modo' : 'Modo · Pro'}</Text>
            <View style={s.chipsWrap}>
              {MODE_OPTIONS.map((o) => (
                <TouchableOpacity key={o.value} disabled={!pro || guardandoModo} style={[s.chip, modo === o.value && s.chipOn, !pro && s.chipOff]} onPress={() => cambiarModo(o.value)}>
                  <Text style={[s.chipText, modo === o.value && s.chipTextOn]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {pro ? (
              <>
                <Text style={s.groupLabel}>Meses atrás en la gráfica</Text>
                <View style={s.chipsWrap}>
                  {HISTORY_OPTIONS.map((o) => (
                    <TouchableOpacity key={o.value} style={[s.chip, pasado === o.value && s.chipOn]} onPress={() => setPasado(o.value)}>
                      <Text style={[s.chipText, pasado === o.value && s.chipTextOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={s.help}>
              {getProjectionHelp(modo, Number(data?.variable_history_months_used ?? 0), Number(data?.variable_history_observations ?? 0))}
            </Text>
            <TouchableOpacity style={s.secondaryBtn} onPress={recalcular} disabled={recalculando}>
              {recalculando ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={16} color={colors.primary} />}
              <Text style={s.secondaryText}>Recalcular mis saldos</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ¿Y si...? */}
        <View style={[s.card, tipo && s.simCard]}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>¿Y si...?</Text>
            {tipo ? (
              <TouchableOpacity onPress={limpiarSimulacion} hitSlop={8}><Text style={s.link}>Quitar</Text></TouchableOpacity>
            ) : null}
          </View>
          {!tipo ? <Text style={s.cardSub}>Prueba una decisión antes de tomarla y mira cómo cambia tu saldo.</Text> : null}

          <View style={s.tipoRow}>
            {TIPOS_SIMULACION.map((t) => (
              <TouchableOpacity key={t.value} style={[s.tipoBtn, tipo === t.value && s.tipoBtnOn]} onPress={() => elegirTipo(t.value)}>
                <Ionicons name={t.icon} size={20} color={tipo === t.value ? colors.primary : colors.textMuted} />
                <Text style={[s.tipoText, tipo === t.value && s.tipoTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tipo ? (
            <>
              <Text style={s.tipoHint}>{TIPOS_SIMULACION.find((t) => t.value === tipo)?.hint}</Text>

              <Text style={s.groupLabel}>{tipo === 'recurrente' ? '¿Cuánto al mes?' : tipo === 'cuotas' ? '¿Cuánto te prestan?' : '¿Cuánto cuesta?'}</Text>
              <View style={s.amountWrap}>
                <Text style={s.amountPrefix}>$</Text>
                <TextInput
                  style={s.amountInput}
                  value={monto}
                  onChangeText={setMonto}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={s.chipsWrap}>
                {MONTOS_RAPIDOS[tipo].map((v) => (
                  <TouchableOpacity key={v} style={[s.chip, montoNum === v && s.chipOn]} onPress={() => setMonto(String(v))}>
                    <Text style={[s.chipText, montoNum === v && s.chipTextOn]}>{formatMoney(v, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tipo !== 'contado' ? (
                <>
                  <Text style={s.groupLabel}>{tipo === 'cuotas' ? '¿En cuántas cuotas?' : '¿Por cuántos meses?'}</Text>
                  <View style={s.chipsWrap}>
                    {PLAZOS[tipo].map((v) => (
                      <TouchableOpacity key={v} style={[s.chip, plazo === v && s.chipOn]} onPress={() => setPlazo(v)}>
                        <Text style={[s.chipText, plazo === v && s.chipTextOn]}>{v} meses</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              {tipo === 'cuotas' ? (
                <>
                  <Text style={s.groupLabel}>Tasa de interés anual</Text>
                  <View style={s.rateRow}>
                    <View style={[s.amountWrap, { flex: 1 }]}>
                      <TextInput
                        style={[s.amountInput, { fontSize: 18 }]}
                        value={tasa}
                        onChangeText={setTasa}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                      />
                      <Text style={s.amountPrefix}>%</Text>
                    </View>
                    <Text style={s.rateHint}>{parseMonto(tasa) > 0 ? 'Con interés' : 'Sin interés'}</Text>
                  </View>
                </>
              ) : null}

              <Text style={s.groupLabel}>{tipo === 'contado' ? '¿Cuándo lo pagas?' : '¿Desde cuándo?'}</Text>
              <View style={s.stepper}>
                <TouchableOpacity onPress={() => setInicioOffset((v) => Math.max(0, v - 1))} disabled={inicioOffset === 0} style={s.stepBtn} accessibilityLabel="Antes">
                  <Ionicons name="remove" size={18} color={inicioOffset === 0 ? colors.textFaint : colors.primary} />
                </TouchableOpacity>
                <Text style={s.stepText}>{inicioOffset === 0 ? 'Este mes' : inicioLabel}</Text>
                <TouchableOpacity onPress={() => setInicioOffset((v) => Math.min(mesesDisponibles - 1, v + 1))} disabled={inicioOffset >= mesesDisponibles - 1} style={s.stepBtn} accessibilityLabel="Después">
                  <Ionicons name="add" size={18} color={inicioOffset >= mesesDisponibles - 1 ? colors.textFaint : colors.primary} />
                </TouchableOpacity>
              </View>

              {sim ? (
                <View style={s.result}>
                  {tipo !== 'contado' ? (
                    <Text style={s.resultTerms}>
                      {tipo === 'cuotas' ? 'Cuota' : 'Pagas'} <Text style={s.resultStrong}>{formatMoney(sim.terms.cuota)}</Text> al mes
                      {' · '}total <Text style={s.resultStrong}>{formatMoney(sim.terms.total)}</Text>
                    </Text>
                  ) : null}
                  <View style={[s.verdict, { borderColor: `${veredicto.color}55`, backgroundColor: `${veredicto.color}14` }]}>
                    <Ionicons name={veredicto.icon} size={18} color={veredicto.color} />
                    <Text style={[s.verdictText, { color: veredicto.color }]}>{veredicto.text}</Text>
                  </View>

                  <Text style={s.groupLabel}>¿Qué es? (para guardarlo)</Text>
                  <TextInput
                    style={s.input}
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder={tipo === 'cuotas' ? 'Ej: Préstamo del carro' : tipo === 'recurrente' ? 'Ej: Gimnasio' : 'Ej: Viaje a Galápagos'}
                    placeholderTextColor={colors.placeholder}
                  />
                  <TouchableOpacity style={[s.primaryBtn, agregando && { opacity: 0.6 }]} onPress={() => agregarAMisGastos()} disabled={agregando}>
                    {agregando
                      ? <ActivityIndicator color={colors.text} />
                      : <Text style={s.primaryText}>{tipo === 'cuotas' ? 'Agregar a mis gastos a cuotas' : 'Agregar a mis gastos'}</Text>}
                  </TouchableOpacity>
                  <Text style={s.fine}>Solo se guarda si tocas el botón. Mientras tanto es una prueba.</Text>
                </View>
              ) : (
                <Text style={s.cardSub}>Escribe un monto y mira el cambio en la gráfica.</Text>
              )}
            </>
          ) : null}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 13, backgroundColor: 'rgba(248,113,113,0.08)', padding: 10, borderRadius: 10 },

  summary: { paddingVertical: 4, gap: 2 },
  summaryLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  summaryValue: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  summaryHint: { color: colors.textMuted, fontSize: 13 },
  lockedNote: { color: colors.textMuted, fontSize: 12 },

  chips: { gap: 8, paddingRight: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: 'rgba(196,135,246,0.18)', borderColor: colors.primary },
  chipOff: { opacity: 0.45 },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.primary },

  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10 },
  simCard: { borderColor: 'rgba(196,135,246,0.3)' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  loader: { height: 260, justifyContent: 'center', alignItems: 'center' },
  reloading: { position: 'absolute', top: 12, right: 12 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 40, lineHeight: 19 },
  groupLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(196,135,246,0.3)', borderRadius: 12, paddingVertical: 11 },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tipoBtnOn: { borderColor: colors.primary, backgroundColor: 'rgba(196,135,246,0.12)' },
  tipoText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  tipoTextOn: { color: colors.primary },
  tipoHint: { color: colors.textFaint, fontSize: 12 },

  amountWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 14 },
  amountPrefix: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  amountInput: { flex: 1, color: colors.text, fontSize: 26, fontWeight: '800', paddingVertical: 10, marginLeft: 6 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rateHint: { color: colors.textMuted, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 6 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  stepText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  result: { gap: 10, marginTop: 6 },
  resultTerms: { color: colors.textMuted, fontSize: 13 },
  resultStrong: { color: colors.text, fontWeight: '800' },
  verdict: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  verdictText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  primaryBtn: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryStrong },
  primaryText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  fine: { color: colors.textFaint, fontSize: 11, textAlign: 'center' },
})
