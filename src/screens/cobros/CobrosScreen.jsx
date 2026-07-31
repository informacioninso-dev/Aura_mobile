import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import FormModal from '../../components/ui/FormModal'
import SwipeableRow from '../../components/ui/SwipeableRow'
import { useTopInset } from '../../hooks/useTopInset'

const FIELDS = [
  { key: 'persona', label: 'Persona', type: 'text', placeholder: 'Nombre' },
  { key: 'concepto', label: 'Concepto', type: 'text', placeholder: 'Ej: Préstamo' },
  { key: 'monto_total', label: 'Monto total', type: 'number', placeholder: '0.00' },
  { key: 'fecha_prestamo', label: 'Fecha', type: 'date' },
]

const ESTADO_COLOR = { pendiente: '#F59E0B', parcial: '#60A5FA', pagado: '#10B981' }
const ESTADO_LABEL = { pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Pagado' }

export default function CobrosScreen() {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('me_deben')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ visible: false, item: null })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/finanzas/cuentas-por-cobrar/')
      .then(({ data }) => setItems(data.results ?? data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(values) {
    setSaving(true)
    const payload = { ...values, monto_total: parseFloat(values.monto_total) || 0, direccion: tab }
    try {
      if (modal.item) await api.patch(`/finanzas/cuentas-por-cobrar/${modal.item.id}/`, payload)
      else await api.post('/finanzas/cuentas-por-cobrar/', payload)
      setModal({ visible: false, item: null })
      cargar()
    } catch { Alert.alert('Error', 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  async function eliminar(item) {
    Alert.alert('Eliminar', `¿Eliminar "${item.concepto}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await api.delete(`/finanzas/cuentas-por-cobrar/${item.id}/`); cargar() } },
    ])
  }

  const data = items.filter((i) => i.direccion === tab)
  const totalPendiente = data.filter((i) => i.estado !== 'pagado').reduce((s, i) => s + Number(i.saldo_pendiente || 0), 0)

  const topPad = useTopInset()

  return (
    <GestureHandlerRootView style={[s.root, { paddingTop: topPad }]}>
      <Text style={s.title}>Cuentas con personas</Text>

      <View style={s.tabs}>
        {[['me_deben', 'Me deben'], ['debo', 'Debo']].map(([val, lbl]) => (
          <TouchableOpacity key={val} style={[s.tab, tab === val && s.tabActive]} onPress={() => setTab(val)}>
            <Text style={[s.tabText, tab === val && s.tabTextActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {totalPendiente > 0 && (
        <View style={s.totalBanner}>
          <Text style={s.totalLabel}>{tab === 'me_deben' ? 'Total por cobrar' : 'Total por pagar'}</Text>
          <Text style={[s.totalValue, { color: tab === 'me_deben' ? '#10B981' : '#F87171' }]}>{formatMoney(totalPendiente)}</Text>
        </View>
      )}

      {loading
        ? <View style={s.center}><ActivityIndicator color="#C487F6" /></View>
        : <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No hay registros</Text>}
          renderItem={({ item }) => {
            const color = tab === 'me_deben' ? '#10B981' : '#F87171'
            const estadoColor = ESTADO_COLOR[item.estado] || '#F59E0B'
            return (
              <SwipeableRow onEdit={() => setModal({ visible: true, item })} onDelete={() => eliminar(item)}>
                <View style={[s.card, { borderColor: color + '33' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.persona}>{item.persona}</Text>
                    <Text style={s.concepto}>{item.concepto}</Text>
                    <Text style={s.fecha}>{item.fecha_prestamo}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[s.monto, { color }]}>{formatMoney(item.monto_total)}</Text>
                    {Number(item.saldo_pendiente) < Number(item.monto_total) && (
                      <Text style={s.saldo}>Pendiente: {formatMoney(item.saldo_pendiente)}</Text>
                    )}
                    <View style={[s.estadoBadge, { backgroundColor: estadoColor + '22' }]}>
                      <Text style={[s.estadoText, { color: estadoColor }]}>{ESTADO_LABEL[item.estado] || item.estado}</Text>
                    </View>
                  </View>
                </View>
              </SwipeableRow>
            )
          }}
        />
      }

      <TouchableOpacity style={s.fab} onPress={() => setModal({ visible: true, item: null, defaults: { fecha_prestamo: new Date().toISOString().slice(0, 10) } })}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <FormModal
        visible={modal.visible}
        onClose={() => setModal({ visible: false, item: null })}
        onSave={guardar}
        title={modal.item ? 'Editar' : tab === 'me_deben' ? 'Me deben' : 'Debo'}
        fields={FIELDS}
        initialValues={modal.item || modal.defaults || {}}
        loading={saving}
      />
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  totalBanner: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 },
  totalLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  totalValue: { fontWeight: '700', fontSize: 15 },
  card: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  persona: { color: '#fff', fontWeight: '700', fontSize: 15 },
  concepto: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  fecha: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },
  monto: { fontWeight: '700', fontSize: 16 },
  saldo: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  estadoBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
