import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { formatMoney } from '../../utils/formatters'

function featureLabel(feature) {
  if (feature.value_type === 'bool') return feature.value_bool ? feature.name : null
  if (feature.value_int != null) return `${feature.name}: ${feature.value_int}`
  return feature.value_text || feature.name
}

export default function PlanesScreen({ navigation }) {
  const { user } = useAuth()
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagando, setPagando] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/usuarios/planes/')
      .then(({ data }) => setPlanes(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function contratar(plan) {
    if (plan.is_default || plan.precio_mensual <= 0) return
    setPagando(plan.id)
    setError('')
    try {
      const { data } = await api.post('/usuarios/pago/iniciar/', { plan_id: plan.id })
      navigation.navigate('Pago', {
        payUrl: data.pay_url,
        clientTransactionId: data.client_transaction_id,
        planName: plan.name,
      })
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo iniciar el pago.'))
    } finally {
      setPagando(null)
    }
  }

  const planActual = user?.plan?.slug

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color="#C487F6" />
      </View>
    )
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={s.title}>Planes</Text>
      <Text style={s.sub}>Elige el plan que mejor se adapte a tus necesidades.</Text>

      {!!error && <Text style={s.errorMsg}>{error}</Text>}

      {planes.map((plan) => {
        const esActual = planActual === plan.slug
        const esGratis = Number(plan.precio_mensual) <= 0
        const features = plan.features.map(featureLabel).filter(Boolean)

        return (
          <View key={plan.id} style={[s.card, esActual && s.cardActual]}>
            {esActual && (
              <View style={s.badge}>
                <Text style={s.badgeText}>PLAN ACTUAL</Text>
              </View>
            )}

            <Text style={s.planName}>{plan.name}</Text>
            {!!plan.description && <Text style={s.planDesc}>{plan.description}</Text>}

            <View style={s.priceRow}>
              {esGratis
                ? <Text style={s.priceFree}>Gratis</Text>
                : (
                  <>
                    <Text style={s.priceValue}>{formatMoney(Number(plan.precio_mensual))}</Text>
                    <Text style={s.pricePeriod}>
                      / {plan.duracion_meses === 1 ? 'mes' : `${plan.duracion_meses} meses`}
                    </Text>
                  </>
                )}
            </View>

            {features.length > 0 && (
              <View style={s.featuresList}>
                {features.map((label, idx) => (
                  <View key={idx} style={s.featureRow}>
                    <Text style={s.featureCheck}>✓</Text>
                    <Text style={s.featureText}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {esActual ? (
              <View style={[s.btn, s.btnDisabled]}>
                <Text style={s.btnTextDisabled}>Plan activo</Text>
              </View>
            ) : esGratis ? (
              <View style={[s.btn, s.btnDisabled]}>
                <Text style={s.btnTextDisabled}>Plan base</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.btn, s.btnPrimary, pagando === plan.id && s.btnDisabled]}
                onPress={() => contratar(plan)}
                disabled={pagando === plan.id}
              >
                {pagando === plan.id
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Contratar</Text>}
              </TouchableOpacity>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 2 },
  sub: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 },
  errorMsg: { color: '#F87171', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16, position: 'relative',
  },
  cardActual: { borderColor: 'rgba(196,135,246,0.5)', backgroundColor: 'rgba(196,135,246,0.08)' },
  badge: {
    position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(196,135,246,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { color: '#C487F6', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  planName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4, paddingRight: 90 },
  planDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14 },
  priceFree: { color: '#fff', fontSize: 26, fontWeight: '800' },
  priceValue: { color: '#fff', fontSize: 26, fontWeight: '800' },
  pricePeriod: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  featuresList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { color: '#C487F6', fontSize: 13, fontWeight: '700' },
  featureText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, flex: 1 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#8B5CF6' },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnTextDisabled: { color: 'rgba(255,255,255,0.35)', fontWeight: '700', fontSize: 14 },
})
