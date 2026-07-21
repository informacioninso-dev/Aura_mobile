import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import FormModal from '../../components/ui/FormModal'
import SwipeableRow from '../../components/ui/SwipeableRow'

const FREQ = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }

const FIELDS_FIJO = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Arriendo, Netflix' },
  { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
  { key: 'frecuencia', label: 'Frecuencia', type: 'chips' },
  { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date' },
]

const FIELDS_VARIABLE = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Luz, agua, gasolina' },
  { key: 'monto', label: 'Monto estimado', type: 'number', placeholder: '0.00' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
  { key: 'frecuencia', label: 'Frecuencia', type: 'chips' },
  { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date' },
]

const FIELDS_PUNTUAL = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Reparación del auto' },
  { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
  { key: 'fecha', label: 'Fecha', type: 'date' },
]

const FIELDS_MONTO_REAL = [
  { key: 'monto_real', label: '¿Cuánto pagaste?', type: 'number', placeholder: '0.00' },
]

// Un gasto variable se repite igual que un fijo, pero su monto es un estimado
// que se reemplaza con lo que el usuario realmente paga cada mes.
const TABS = [
  { id: 'fijos', label: 'Fijos', hint: 'Mismo monto siempre' },
  { id: 'variables', label: 'Variables', hint: 'El monto cambia' },
  { id: 'puntuales', label: 'Puntuales', hint: 'Una sola vez' },
]

const CONFIG_TAB = {
  fijos: { endpoint: '/finanzas/gastos-corrientes/', fields: FIELDS_FIJO, titulo: 'fijo' },
  variables: { endpoint: '/finanzas/gastos-corrientes/', fields: FIELDS_VARIABLE, titulo: 'variable' },
  puntuales: { endpoint: '/finanzas/gastos-no-corrientes/', fields: FIELDS_PUNTUAL, titulo: 'puntual' },
}

export default function GastosScreen() {
  const [fijos, setFijos] = useState([])
  const [variables, setVariables] = useState([])
  const [puntuales, setPuntuales] = useState([])
  const [tab, setTab] = useState('fijos')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ visible: false, item: null })
  const [realModal, setRealModal] = useState({ visible: false, item: null })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/finanzas/gastos-corrientes/?tipo_monto=fijo'),
      api.get('/finanzas/gastos-corrientes/?tipo_monto=variable'),
      api.get('/finanzas/gastos-no-corrientes/'),
    ])
      .then(([f, v, p]) => {
        setFijos(f.data.results ?? f.data)
        setVariables(v.data.results ?? v.data)
        setPuntuales(p.data.results ?? p.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrirCrear() {
    const hoy = new Date().toISOString().slice(0, 10)
    const defaults = tab === 'puntuales'
      ? { categoria: 'otro', fecha: hoy }
      : {
        frecuencia: 'mensual',
        categoria: 'otro',
        fecha_inicio: hoy,
        activo: true,
        tipo_monto: tab === 'variables' ? 'variable' : 'fijo',
      }
    setModal({ visible: true, item: null, defaults })
  }

  async function guardar(values) {
    setSaving(true)
    const payload = { ...values, monto: parseFloat(values.monto) || 0 }
    if (tab !== 'puntuales') payload.tipo_monto = tab === 'variables' ? 'variable' : 'fijo'
    const { endpoint } = CONFIG_TAB[tab]
    try {
      if (modal.item) await api.patch(`${endpoint}${modal.item.id}/`, payload)
      else await api.post(endpoint, payload)
      setModal({ visible: false, item: null })
      cargar()
    } catch { Alert.alert('Error', 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  async function guardarMontoReal(values) {
    const item = realModal.item
    if (!item) return
    const ahora = new Date()
    setSaving(true)
    try {
      await api.post(`/finanzas/gastos-corrientes/${item.id}/ejecuciones/`, {
        anio: ahora.getFullYear(),
        mes: ahora.getMonth() + 1,
        monto_real: parseFloat(values.monto_real) || 0,
      })
      setRealModal({ visible: false, item: null })
      cargar()
    } catch { Alert.alert('Error', 'No se pudo guardar el monto real.') }
    finally { setSaving(false) }
  }

  async function eliminar(item) {
    Alert.alert('Eliminar', `¿Eliminar "${item.descripcion}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await api.delete(`${CONFIG_TAB[tab].endpoint}${item.id}/`)
          cargar()
        },
      },
    ])
  }

  const data = tab === 'fijos' ? fijos : tab === 'variables' ? variables : puntuales
  const { fields, titulo } = CONFIG_TAB[tab]
  const esVariable = tab === 'variables'

  return (
    <GestureHandlerRootView style={s.root}>
      <Text style={s.title}>Gastos</Text>

      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.tabHint}>{TABS.find((t) => t.id === tab)?.hint}</Text>

      {loading
        ? <View style={s.center}><ActivityIndicator color="#C487F6" /></View>
        : <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No hay registros aún</Text>}
          renderItem={({ item }) => (
            <SwipeableRow onEdit={() => setModal({ visible: true, item })} onDelete={() => eliminar(item)}>
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.desc}>{item.descripcion}</Text>
                  <Text style={s.meta}>
                    {tab === 'puntuales' ? item.fecha : (FREQ[item.frecuencia] || item.frecuencia)}
                    {item.categoria ? ` · ${item.categoria}` : ''}
                  </Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.monto}>{formatMoney(item.monto)}</Text>
                  {esVariable && <Text style={s.estimado}>estimado</Text>}
                </View>
                {esVariable && (
                  <TouchableOpacity
                    style={s.btnReal}
                    onPress={() => setRealModal({ visible: true, item })}
                  >
                    <Text style={s.btnRealText}>Pagué</Text>
                  </TouchableOpacity>
                )}
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
        title={modal.item ? 'Editar gasto' : `Nuevo gasto ${titulo}`}
        fields={fields}
        initialValues={modal.item || modal.defaults || {}}
        loading={saving}
      />

      <FormModal
        visible={realModal.visible}
        onClose={() => setRealModal({ visible: false, item: null })}
        onSave={guardarMontoReal}
        title={realModal.item ? `${realModal.item.descripcion} — este mes` : 'Monto real'}
        fields={FIELDS_MONTO_REAL}
        initialValues={{}}
        loading={saving}
      />
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  tabHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginBottom: 6 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' },
  cardRight: { alignItems: 'flex-end' },
  desc: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  monto: { color: '#F87171', fontWeight: '700', fontSize: 16 },
  estimado: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 },
  btnReal: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)' },
  btnRealText: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
