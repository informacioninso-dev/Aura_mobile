import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import FormModal from '../../components/ui/FormModal'
import SwipeableRow from '../../components/ui/SwipeableRow'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'
import { colors } from '../../theme/theme'

const FIELDS = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Crédito auto' },
  { key: 'monto_total', label: 'Monto total', type: 'number', placeholder: '0.00' },
  { key: 'cuota_mensual', label: 'Cuota mensual', type: 'number', placeholder: '0.00' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
  { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date' },
  { key: 'fecha_fin', label: 'Fecha fin', type: 'date' },
]

export default function DeferidosScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ visible: false, item: null })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/finanzas/diferidos/')
      .then(({ data }) => setItems(data.results ?? data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(values) {
    setSaving(true)
    const payload = {
      ...values,
      monto_total: parseFloat(values.monto_total) || 0,
      cuota_mensual: parseFloat(values.cuota_mensual) || 0,
      activo: true,
    }
    try {
      if (modal.item) await api.patch(`/finanzas/diferidos/${modal.item.id}/`, payload)
      else await api.post('/finanzas/diferidos/', payload)
      setModal({ visible: false, item: null })
      cargar()
    } catch { Alert.alert('Error', 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  async function eliminar(item) {
    Alert.alert('Eliminar', `¿Eliminar "${item.descripcion}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await api.delete(`/finanzas/diferidos/${item.id}/`)
          cargar()
        },
      },
    ])
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const defaults = { categoria: 'deudas', fecha_inicio: hoy, fecha_fin: '', activo: true }
  const topPad = useTopInset()

  return (
    <GestureHandlerRootView style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Gastos a cuotas" subtitle="Créditos y cuotas mensuales" padded />

      {loading
        ? <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        : <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No hay diferidos registrados</Text>}
          renderItem={({ item }) => (
            <SwipeableRow onEdit={() => setModal({ visible: true, item })} onDelete={() => eliminar(item)}>
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.desc}>{item.descripcion}</Text>
                  <Text style={s.meta}>{item.fecha_inicio} → {item.fecha_fin}</Text>
                  {item.categoria ? <Text style={s.tag}>{item.categoria}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.cuota}>{formatMoney(item.cuota_mensual)}<Text style={s.cuotaLabel}>/mes</Text></Text>
                  <Text style={s.total}>Total: {formatMoney(item.monto_total)}</Text>
                </View>
              </View>
            </SwipeableRow>
          )}
        />
      }

      <TouchableOpacity style={s.fab} onPress={() => setModal({ visible: true, item: null, defaults })}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <FormModal
        visible={modal.visible}
        onClose={() => setModal({ visible: false, item: null })}
        onSave={guardar}
        title={modal.item ? 'Editar diferido' : 'Nuevo diferido'}
        fields={FIELDS}
        initialValues={modal.item || modal.defaults || defaults}
        loading={saving}
      />
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.borderAccent },
  desc: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tag: { color: colors.primary, fontSize: 11, marginTop: 4 },
  cuota: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  cuotaLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '400' },
  total: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryStrong, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primaryStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: colors.text, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
