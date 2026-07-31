import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Dimensions } from 'react-native'
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'
import { colors } from '../../theme/theme'

const SCREEN_W = Dimensions.get('window').width
const CW = SCREEN_W - 64
const CH = 140

function SvgChart({ values, labels, positive }) {
  const color = positive ? colors.success : colors.danger
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const getX = (i) => 8 + (i / (values.length - 1)) * (CW - 16)
  const getY = (v) => 10 + (1 - (v - min) / range) * (CH - 38)
  const points = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')
  const step = Math.max(1, Math.floor(labels.length / 5))

  return (
    <Svg width={CW} height={CH}>
      {min < 0 && max > 0 && (
        <Line x1={8} y1={getY(0)} x2={CW - 8} y2={getY(0)} stroke="rgba(248,113,113,0.3)" strokeWidth="1" strokeDasharray="4,3" />
      )}
      <Polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {labels.filter((_, i) => i % step === 0 || i === labels.length - 1).map((lbl, i) => {
        const idx = i * step >= labels.length ? labels.length - 1 : i * step
        return <SvgText key={idx} x={getX(idx)} y={CH - 4} fontSize="9" fill="rgba(255,255,255,0.35)" textAnchor="middle">{lbl}</SvgText>
      })}
    </Svg>
  )
}

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
  const topPad = useTopInset()

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: topPad }]} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Simulador" subtitle="Proyectá escenarios ajustando tus variables" />

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
            <Text style={[s.resultValue, { color: finalPositivo ? colors.success : colors.danger }]}>
              {formatMoney(simulado.final)}
            </Text>
            <Text style={s.resultSub}>
              {finalPositivo ? '✅ Situación financiera positiva' : '⚠️ Déficit proyectado'}
            </Text>
          </View>

          {values.length > 1 && (
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Evolución del saldo</Text>
              <SvgChart values={values} labels={labels} positive={finalPositivo} />
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  form: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 11, color: colors.text, fontSize: 14 },
  inputGreen: { borderColor: 'rgba(16,185,129,0.3)' },
  inputRed: { borderColor: 'rgba(248,113,113,0.3)' },
  btn: { backgroundColor: colors.primaryStrong, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  resultCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, alignItems: 'center', gap: 6 },
  resultLabel: { color: colors.textMuted, fontSize: 13 },
  resultValue: { fontSize: 32, fontWeight: '800' },
  resultSub: { color: colors.textMuted, fontSize: 13 },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  chartTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 },
  hint: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  hintText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  hintSub: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },
})
