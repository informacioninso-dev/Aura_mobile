import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'

const SCREEN_W = Dimensions.get('window').width

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

  const series = data.series.slice(0, 12)
  const values = series.map((p) => Number(p.closing_balance) || 0)
  const labels = series.map((p) => p.label?.split(' ')[0]?.slice(0, 3) || '')
  const currentIdx = series.findIndex((p) => p.is_current)
  const lastProjected = series.filter((p) => !p.is_real).at(-1)

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Proyección de saldo</Text>
        {lastProjected && (
          <Text style={s.projected}>
            En {series.length} meses: <Text style={{ color: Number(lastProjected.closing_balance) >= 0 ? '#10B981' : '#F87171', fontWeight: '700' }}>
              {formatMoney(lastProjected.closing_balance)}
            </Text>
          </Text>
        )}
      </View>

      <LineChart
        data={{
          labels,
          datasets: [{ data: values, strokeWidth: 2 }],
        }}
        width={SCREEN_W - 32}
        height={180}
        yAxisLabel="$"
        yAxisSuffix=""
        withDots={false}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: '#0F1B35',
          backgroundGradientTo: '#0F1B35',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(196,135,246,${opacity})`,
          labelColor: () => 'rgba(255,255,255,0.35)',
          propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.06)' },
          propsForLabels: { fontSize: 10 },
        }}
        bezier
        style={s.chart}
      />

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: '#C487F6' }]} />
          <Text style={s.legendText}>Real</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: '#C487F6', opacity: 0.4 }]} />
          <Text style={s.legendText}>Proyectado</Text>
        </View>
        {currentIdx >= 0 && (
          <Text style={s.hoy}>Hoy: mes {currentIdx + 1}</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(196,135,246,0.15)' },
  loader: { height: 200, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15 },
  projected: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'right', flex: 1, marginLeft: 8 },
  chart: { borderRadius: 12, marginLeft: -12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  hoy: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginLeft: 'auto' },
})
