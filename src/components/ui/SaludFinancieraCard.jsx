import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { colors } from '../../theme/theme'

function MiniRing({ score, color, size = 64 }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number(score) || 0)) / 100
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[s.ringNum, { color }]}>{Math.round(Number(score) || 0)}</Text>
    </View>
  )
}

/**
 * Resumen de Salud financiera para el dashboard (paridad con la web): mini ring
 * con el score + banda + "Ver detalle" que abre la pantalla completa. Solo para
 * planes con la feature (pro); si no, no se muestra.
 */
export default function SaludFinancieraCard({ navigation, variant = 'card' }) {
  const { user } = useAuth()
  const habilitado = Boolean(user?.feature_access?.health_score_enabled)
  const [data, setData] = useState(null)

  const cargar = useCallback(async () => {
    if (!habilitado) return
    const hoy = new Date()
    try {
      const { data: resp } = await api.get(
        `/finanzas/salud-financiera/?anio=${hoy.getFullYear()}&mes=${hoy.getMonth() + 1}`,
      )
      setData(resp)
    } catch {
      setData(null)
    }
  }, [habilitado])

  useEffect(() => { cargar() }, [cargar])

  if (!habilitado || !data?.disponible) return null

  const color = data?.banda?.color || colors.primary

  if (variant === 'chip') {
    return (
      <TouchableOpacity
        style={s.chip}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Más', { screen: 'SaludFinanciera' })}
      >
        <View style={[s.chipDot, { backgroundColor: color }]} />
        <Text style={s.chipScore}>{Math.round(Number(data.score) || 0)}</Text>
        <Text style={[s.chipBanda, { color }]}>{data?.banda?.label || ''}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('Más', { screen: 'SaludFinanciera' })}
    >
      <MiniRing score={data.score} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>Salud financiera</Text>
        <Text style={[s.banda, { color }]}>{data?.banda?.label || ''}</Text>
        <Text style={s.sub}>Como la mide un banco: ingresos, gastos, cuotas y ahorro.</Text>
      </View>
      <Text style={s.verMas}>Ver{'\n'}detalle ›</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(196,135,246,0.15)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  ringNum: { fontSize: 20, fontWeight: '800' },
  kicker: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  banda: { fontSize: 17, fontWeight: '800', marginTop: 1 },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  verMas: { color: colors.primary, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  chip: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipScore: { color: colors.text, fontSize: 12, fontWeight: '800' },
  chipBanda: { fontSize: 11, fontWeight: '700' },
})
