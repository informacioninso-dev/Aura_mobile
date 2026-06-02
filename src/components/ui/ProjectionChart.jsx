import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native'
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'

const W = Dimensions.get('window').width - 64
const H = 140
const PL = 8, PR = 8, PT = 10, PB = 28

function toPoints(values) {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = PL + (i / (values.length - 1)) * (W - PL - PR)
      const y = PT + (1 - (v - min) / range) * (H - PT - PB)
      return `${x},${y}`
    })
    .join(' ')
}

export default function ProjectionChart() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/finanzas/proyeccion-acumulada/?months=6&past_months=1')
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={s.loader}><ActivityIndicator color="#C487F6" /></View>
  if (!data?.series?.length) return null

  const series = data.series.slice(0, 10)
  const values = series.map((p) => Number(p.closing_balance) || 0)
  const lastReal = series.filter((p) => p.is_real).at(-1)
  const lastProj = series.filter((p) => !p.is_real).at(-1)
  const realValues = series.filter((p) => p.is_real).map((p) => Number(p.closing_balance))
  const projValues = series.filter((p, i) => !p.is_real || i === series.findIndex((x, j) => !x.is_real) - 1)
    .map((p) => Number(p.closing_balance))

  const allPositive = values.every((v) => v >= 0)
  const lineColor = allPositive ? '#10B981' : '#F87171'

  // Labels each 2 months
  const labels = series
    .filter((_, i) => i % 2 === 0 || i === series.length - 1)
    .map((p, i) => ({
      label: p.label?.split(' ')[0]?.slice(0, 3) || '',
      idx: series.indexOf(series.filter((_, j) => j % 2 === 0 || j === series.length - 1)[i]),
    }))

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const getX = (i) => PL + (i / (series.length - 1)) * (W - PL - PR)
  const getY = (v) => PT + (1 - (v - min) / range) * (H - PT - PB)

  const points = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Proyección de saldo</Text>
        {lastProj && (
          <Text style={[s.final, { color: Number(lastProj.closing_balance) >= 0 ? '#10B981' : '#F87171' }]}>
            {formatMoney(lastProj.closing_balance)}
          </Text>
        )}
      </View>

      <Svg width={W} height={H}>
        {/* Zero line */}
        {min < 0 && max > 0 && (
          <Line
            x1={PL} y1={getY(0)}
            x2={W - PR} y2={getY(0)}
            stroke="rgba(248,113,113,0.3)"
            strokeWidth="1"
            strokeDasharray="4,3"
          />
        )}
        {/* Main line */}
        <Polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* X axis labels */}
        {labels.map(({ label, idx }) => (
          <SvgText
            key={idx}
            x={getX(idx)}
            y={H - 4}
            fontSize="9"
            fill="rgba(255,255,255,0.35)"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </Svg>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: lineColor }]} />
          <Text style={s.legendText}>Saldo proyectado</Text>
        </View>
        {lastReal && (
          <Text style={s.hoy}>Hoy: {formatMoney(lastReal.closing_balance)}</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(196,135,246,0.15)' },
  loader: { height: 160, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15 },
  final: { fontWeight: '700', fontSize: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  hoy: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginLeft: 'auto' },
})
