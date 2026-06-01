import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Dimensions } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'

const SCREEN_W = Dimensions.get('window').width

export default function SimuladorScreen() {
  const [proyeccion, setProyeccion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saldoInicial, setSaldoInicial] = useState('')
  const [gastoExtra, setGastoExtra] = useState('')
  const [ingresoExtra, setIngresoExtra] = useState('')
  const [meses, setMeses] = useState('12')
  const [simulado, setSimulado] = useState(null)

  useEffect(() => {
    api.get('/finanzas/proyeccion-acumulada/?months=12&past_months=1')
      .then(({ data }) => {
        setProyeccion(data)
        setSaldoInicial(String(data.starting_balance ?? ''))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function simular() {
    if (!proyeccion?.series) return
    const plazo = Math.min(Math.max(parseInt(meses) || 12, 1), 120)
    const extra_ingreso = parseFloat(ingresoExtra) || 0
    const extra_gasto = parseFloat(gastoExtra) || 0
    const saldo = parseFloat(saldoInicial) || 0

    let balance = saldo
    const puntos = []

    const serie = proyeccion.series.filter((p) => !p.is_real).slice(0, plazo)

    serie.forEach((p, i) => {
      const gap = Number(p.projected_gap) + extra_ingreso - extra_gasto
      balance += gap
      if (i % Math.max(1, Math.floor(plazo / 8)) === 0 || i === serie.length - 1) {
        puntos.push({ mes: p.label?.split(' ')[0]?.slice(0, 3) || `M${i + 1}`, balance })
      }
    })

    setSimulado({ puntos, final: balance, plazo })
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#C487F6" size="large" /></View>

  const chartData = simulado?.puntos || []
  const values = chartData.map((p) => p.balance)
  const labels = chartData.map((p) => p.mes)
  const finalPositivo = simulado ? simulado.final >= 0 : true

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Simulador</Text>
      <Text style={s.sub}>Proyectá escenarios ajustando tus variables</Text>

      <View style={s.form}>
        <View style={s.row}>
          <View style={s.fieldHalf}>
            <Text style={s.label}>Saldo inicial</Text>
            <TextInput style={s.input} value={saldoInicial} onChangeText={setSaldoInicial} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.3)" />
          </View>
          <View style={s.fieldHalf}>
            <Text style={s.label}>Meses</Text>
            <TextInput style={s.input} value={meses} onChangeText={setMeses} keyboardType="number-pad" placeholder="12" placeholderTextColor="rgba(255,255,255,0.3)" />
          </View>
        </View>

        <View style={s.row}>
          <View style={s.fieldHalf}>
            <Text style={s.label}>+ Ingreso extra/mes</Text>
            <TextInput style={[s.input, s.inputGreen]} value={ingresoExtra} onChangeText={setIngresoExtra} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.3)" />
          </View>
          <View style={s.fieldHalf}>
            <Text style={s.label}>+ Gasto extra/mes</Text>
            <TextInput style={[s.input, s.inputRed]} value={gastoExtra} onChangeText={setGastoExtra} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.3)" />
          </View>
        </View>

        <TouchableOpacity style={s.btn} onPress={simular}>
          <Text style={s.btnText}>Simular</Text>
        </TouchableOpacity>
      </View>

      {simulado && (
        <>
          <View style={[s.resultCard, { borderColor: finalPositivo ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)' }]}>
            <Text style={s.resultLabel}>Saldo proyectado en {simulado.plazo} meses</Text>
            <Text style={[s.resultValue, { color: finalPositivo ? '#10B981' : '#F87171' }]}>
              {formatMoney(simulado.final)}
            </Text>
            <Text style={s.resultSub}>
              {finalPositivo ? '✅ Situación financiera positiva' : '⚠️ Déficit proyectado'}
            </Text>
          </View>

          {values.length > 1 && (
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Evolución del saldo</Text>
              <LineChart
                data={{ labels, datasets: [{ data: values, strokeWidth: 2 }] }}
                width={SCREEN_W - 64}
                height={160}
                withDots={false}
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLines={false}
                yAxisLabel="$"
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: '#0F1B35',
                  backgroundGradientTo: '#0F1B35',
                  decimalPlaces: 0,
                  color: (opacity = 1) => finalPositivo ? `rgba(16,185,129,${opacity})` : `rgba(248,113,113,${opacity})`,
                  labelColor: () => 'rgba(255,255,255,0.35)',
                  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.06)' },
                  propsForLabels: { fontSize: 9 },
                }}
                bezier
                style={{ borderRadius: 12, marginLeft: -8 }}
              />
            </View>
          )}
        </>
      )}

      {!simulado && proyeccion && (
        <View style={s.hint}>
          <Text style={s.hintText}>Ajustá los valores y tocá Simular para ver la proyección</Text>
          <Text style={s.hintSub}>Gap mensual base: {formatMoney(proyeccion.smoothed_variable_gap ?? 0)}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 2 },
  sub: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 20 },
  form: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 11, color: '#fff', fontSize: 14 },
  inputGreen: { borderColor: 'rgba(16,185,129,0.3)' },
  inputRed: { borderColor: 'rgba(248,113,113,0.3)' },
  btn: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, alignItems: 'center', gap: 6 },
  resultLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  resultValue: { fontSize: 32, fontWeight: '800' },
  resultSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chartTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 12 },
  hint: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  hintText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' },
  hintSub: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },
})
