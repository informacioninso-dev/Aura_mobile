import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'
import { colors } from '../../theme/theme'

// La app no vende planes: las tiendas exigen su propio sistema de cobro para
// contenido digital. Aquí solo se muestra qué incluye cada plan.

function featureLabel(feature) {
  if (feature.value_type === 'bool') return feature.value_bool ? feature.name : null
  if (feature.value_int != null) return `${feature.name}: ${feature.value_int}`
  return feature.value_text || feature.name
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PlanesScreen() {
  const { user } = useAuth()
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/usuarios/planes/')
      .then(({ data }) => setPlanes(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const planActual = user?.plan?.slug
  const vence = user?.plan?.assignment_ends_at
  const topPad = useTopInset()

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: topPad, paddingBottom: 40 }}>
      <ScreenHeader title="Mi plan" subtitle="Lo que incluye cada plan de Aura." />

      {planes.map((plan) => {
        const esActual = planActual === plan.slug
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
            {esActual && !!vence && <Text style={s.planDesc}>Activo hasta el {formatDate(vence)}</Text>}

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
          </View>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 20,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 16, position: 'relative',
  },
  cardActual: { borderColor: 'rgba(196,135,246,0.5)', backgroundColor: 'rgba(196,135,246,0.08)' },
  badge: {
    position: 'absolute', top: 14, right: 14, backgroundColor: colors.borderAccent,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  planName: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4, paddingRight: 90 },
  planDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 },
  featuresList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  featureText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, flex: 1 },
})
