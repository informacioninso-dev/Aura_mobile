import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import FormModal from '../../components/ui/FormModal'
import SwipeableRow from '../../components/ui/SwipeableRow'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'

const FREQ = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }

const FIELDS_FIJO = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Salario' },
  { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
  { key: 'frecuencia', label: 'Frecuencia', type: 'chips' },
  { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date' },
]

const FIELDS_PUNTUAL = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Bono' },
  { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
  { key: 'fecha', label: 'Fecha', type: 'date' },
]

export default function IngresosScreen({ route, navigation }) {
  const [fijos, setFijos] = useState([])
  const [puntuales, setPuntuales] = useState([])
  const [tab, setTab] = useState(route?.params?.tab || 'fijos')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ visible: false, item: null })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    Promise.all([api.get('/finanzas/ingresos/'), api.get('/finanzas/ingresos-puntuales/')])
      .then(([f, p]) => { setFijos(f.data.results ?? f.data); setPuntuales(p.data.results ?? p.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Acceso rapido desde el dashboard: abre el formulario sin pasos intermedios.
  useEffect(() => {
    const params = route?.params
    if (!params?.autoNew) return
    if (params.tab) setTab(params.tab)
    navigation?.setParams?.({ autoNew: false })
    const timer = setTimeout(() => abrirCrear(params.tab || tab), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.autoNew, route?.params?.tab])

  function abrirCrear(tipoTab = tab) {
    const defaults = tipoTab === 'fijos'
      ? { frecuencia: 'mensual', fecha_inicio: new Date().toISOString().slice(0, 10), activo: true }
      : { fecha: new Date().toISOString().slice(0, 10) }
    setModal({ visible: true, item: null, defaults })
  }

  function abrirEditar(item) {
    setModal({ visible: true, item })
  }

  async function guardar(values) {
    setSaving(true)
    const payload = { ...values, monto: parseFloat(values.monto) || 0 }
    const esFijo = tab === 'fijos'
    const endpoint = esFijo ? '/finanzas/ingresos/' : '/finanzas/ingresos-puntuales/'
    try {
      if (modal.item) await api.patch(`${endpoint}${modal.item.id}/`, payload)
      else await api.post(endpoint, payload)
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
          const ep = tab === 'fijos' ? `/finanzas/ingresos/${item.id}/` : `/finanzas/ingresos-puntuales/${item.id}/`
          await api.delete(ep)
          cargar()
        },
      },
    ])
  }

  const data = tab === 'fijos' ? fijos : puntuales
  const fields = tab === 'fijos' ? FIELDS_FIJO : FIELDS_PUNTUAL
  const topPad = useTopInset()

  return (
    <GestureHandlerRootView style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Lo que ganas" padded />

      <View style={s.tabs}>
        {['fijos', 'puntuales'].map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <View style={s.center}><ActivityIndicator color="#C487F6" /></View>
        : <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No hay registros aún</Text>}
          renderItem={({ item }) => (
            <SwipeableRow onEdit={() => abrirEditar(item)} onDelete={() => eliminar(item)}>
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.desc}>{item.descripcion}</Text>
                  <Text style={s.meta}>{tab === 'fijos' ? (FREQ[item.frecuencia] || item.frecuencia) : item.fecha}</Text>
                </View>
                <Text style={s.monto}>{formatMoney(item.monto)}</Text>
              </View>
            </SwipeableRow>
          )}
        />
      }

      <TouchableOpacity style={s.fab} onPress={abrirCrear}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <FormModal
        visible={modal.visible}
        onClose={() => setModal({ visible: false, item: null })}
        onSave={guardar}
        title={modal.item ? 'Editar ingreso' : `Nuevo ingreso ${tab === 'fijos' ? 'fijo' : 'puntual'}`}
        fields={fields}
        initialValues={modal.item || modal.defaults || {}}
        loading={saving}
      />
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  desc: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  monto: { color: '#10B981', fontWeight: '700', fontSize: 16 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
