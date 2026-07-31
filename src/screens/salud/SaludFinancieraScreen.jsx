import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useTopInset } from '../../hooks/useTopInset'

import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorMessage } from '../../api/errors'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function ScoreRing({ score, color, size = 132 }) {
  const stroke = 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number(score) || 0)) / 100

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          // El arco arranca arriba en vez de a la derecha.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[s.scoreNum, { color }]}>{Math.round(Number(score) || 0)}</Text>
      <Text style={s.scoreMax}>de 100</Text>
    </View>
  )
}

// Cada componente trae su valor en una unidad distinta segun lo que mide.
function valorTexto(comp) {
  if (comp?.valor_pct != null) return `${comp.valor_pct}%`
  if (comp?.valor_meses != null) {
    return `${comp.valor_meses} ${comp.valor_meses === 1 ? 'mes' : 'meses'}`
  }
  return comp?.valor_texto || ''
}

function puntajeColor(puntaje) {
  if (puntaje >= 80) return '#4ADE80'
  if (puntaje >= 60) return '#A3E635'
  if (puntaje >= 40) return '#FBBF24'
  return '#F87171'
}

export default function SaludFinancieraScreen() {
  const { user } = useAuth()
  const habilitado = Boolean(user?.feature_access?.health_score_enabled)

  const hoy = new Date()
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async ({ silent = false } = {}) => {
    if (!habilitado) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      const { data: resp } = await api.get(
        `/finanzas/salud-financiera/?anio=${periodo.anio}&mes=${periodo.mes}`,
      )
      setData(resp)
      setError('')
    } catch (err) {
      setData(null)
      setError(getApiErrorMessage(err, 'No se pudo cargar tu salud financiera.'))
    } finally {
      setLoading(false)
    }
  }, [habilitado, periodo])

  useEffect(() => { void cargar() }, [cargar])

  async function onRefresh() {
    setRefreshing(true)
    try {
      await cargar({ silent: true })
    } finally {
      setRefreshing(false)
    }
  }

  function moverMes(delta) {
    setPeriodo((actual) => {
      const fecha = new Date(actual.anio, actual.mes - 1 + delta, 1)
      const tope = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      if (fecha > tope) return actual
      return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 }
    })
  }

  const topPad = useTopInset()

  // Plan sin la feature: se explica en vez de mostrar una pantalla vacia.
  if (!habilitado) {
    return (
      <View style={[s.root, { paddingTop: topPad }]}>
        <Text style={s.title}>Salud financiera</Text>
        <View style={s.lockedCard}>
          <Text style={s.lockedIcon}>🔒</Text>
          <Text style={s.lockedTitle}>Disponible en el plan Pro</Text>
          <Text style={s.lockedText}>
            El score resume tu capacidad de pago, tu ahorro, tu fondo de emergencia y
            que tan constante eres, en un solo numero del 0 al 100.
          </Text>
        </View>
      </View>
    )
  }

  const banda = data?.banda
  const color = banda?.color || puntajeColor(data?.score || 0)
  const esMesActual = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <Text style={s.title}>Salud financiera</Text>

      <View style={s.monthNav}>
        <TouchableOpacity style={s.monthBtn} onPress={() => moverMes(-1)}>
          <Text style={s.monthBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{MESES[periodo.mes - 1]} {periodo.anio}</Text>
        <TouchableOpacity
          style={[s.monthBtn, esMesActual && s.monthBtnOff]}
          onPress={() => moverMes(1)}
          disabled={esMesActual}
        >
          <Text style={[s.monthBtnText, esMesActual && s.monthBtnTextOff]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#C487F6" /></View>
      ) : error ? (
        <View style={s.center}><Text style={s.empty}>{error}</Text></View>
      ) : !data ? (
        <View style={s.center}><Text style={s.empty}>Sin datos para este mes</Text></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C487F6" />
          }
        >
          <View style={s.scoreCard}>
            <ScoreRing score={data.score} color={color} />
            {banda?.label ? (
              <View style={[s.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                <Text style={[s.badgeText, { color }]}>{banda.label}</Text>
              </View>
            ) : null}
          </View>

          {(data.componentes || []).map((comp) => {
            const cColor = puntajeColor(comp.puntaje)
            return (
              <View key={comp.clave} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.compLabel}>{comp.label}</Text>
                  <Text style={[s.compValor, { color: cColor }]}>{valorTexto(comp)}</Text>
                </View>
                <View style={s.barBg}>
                  <View
                    style={[
                      s.barFill,
                      { width: `${Math.max(0, Math.min(100, comp.puntaje))}%`, backgroundColor: cColor },
                    ]}
                  />
                </View>
                <Text style={s.compDesc}>{comp.descripcion}</Text>
              </View>
            )
          })}

          {(data.consejos || []).length > 0 && (
            <View style={s.consejosCard}>
              <Text style={s.consejosTitle}>Que puedes mejorar</Text>
              {data.consejos.map((consejo, i) => (
                <View key={consejo.clave || i} style={s.consejoRow}>
                  <Text style={s.consejoBullet}>•</Text>
                  <Text style={s.consejoText}>{consejo.texto}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 4 },
  monthBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  monthBtnOff: { opacity: 0.3 },
  monthBtnText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  monthBtnTextOff: { color: 'rgba(255,255,255,0.4)' },
  monthLabel: { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 140, textAlign: 'center' },

  scoreCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingVertical: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  scoreNum: { fontSize: 40, fontWeight: '800' },
  scoreMax: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  compValor: { fontSize: 14, fontWeight: '700' },
  compDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 16 },
  barBg: { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  consejosCard: { backgroundColor: 'rgba(196,135,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(196,135,246,0.25)', gap: 8 },
  consejosTitle: { color: '#C487F6', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  consejoRow: { flexDirection: 'row', gap: 8 },
  consejoBullet: { color: '#C487F6', fontSize: 13, lineHeight: 18 },
  consejoText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18, flex: 1 },

  lockedCard: { margin: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', gap: 10 },
  lockedIcon: { fontSize: 32 },
  lockedTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lockedText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19, textAlign: 'center' },

  empty: { color: 'rgba(255,255,255,0.35)', textAlign: 'center', fontSize: 13 },
})
