import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import FormModal from '../../components/ui/FormModal'
import SwipeableRow from '../../components/ui/SwipeableRow'
import RubroModal from './RubroModal'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'
import { colors } from '../../theme/theme'

const FREQ = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const FIELDS_FIJO = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Arriendo, Netflix' },
  { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
  { key: 'frecuencia', label: 'Frecuencia', type: 'chips' },
  { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date' },
]

// Un rubro variable se crea solo con nombre + categoria: el monto de cada mes
// se registra despues como compras (consumos). El estimado lo aprende del
// historial, no se pide a mano.
const FIELDS_VARIABLE = [
  { key: 'descripcion', label: '¿En qué se va?', type: 'text', placeholder: 'Ej: Farmacia, súper, gasolina' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
]

const FIELDS_PUNTUAL = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Reparación del auto' },
  { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
  { key: 'categoria', label: 'Categoría', type: 'chips' },
  { key: 'fecha', label: 'Fecha', type: 'date' },
]

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

export default function GastosScreen({ route, navigation }) {
  const [fijos, setFijos] = useState([])
  const [variables, setVariables] = useState([])
  const [puntuales, setPuntuales] = useState([])
  const [tab, setTab] = useState(route?.params?.tab || 'fijos')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ visible: false, item: null })
  const [rubroModal, setRubroModal] = useState({ visible: false, rubro: null })
  const [saving, setSaving] = useState(false)

  // Los rubros variables se registran por mes; se trabaja el mes en curso.
  const hoy = new Date()
  const anioMes = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }

  // Navegador de mes para gastos fijos: muestra los activos en ese mes
  // (segun fecha_inicio/fecha_fin), igual que en la web.
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const fijosAnio = selectedMonth.getFullYear()
  const fijosMes = selectedMonth.getMonth() + 1
  const nextMonthDisabled = new Date(fijosAnio, fijosMes, 1) > new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  function shiftMonth(delta) {
    setSelectedMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1))
  }

  const cargar = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/finanzas/gastos-corrientes/?tipo_monto=fijo&anio=${fijosAnio}&mes=${fijosMes}`),
      api.get(`/finanzas/gastos-corrientes/resumen_variables/?anio=${hoy.getFullYear()}&mes=${hoy.getMonth() + 1}`),
      api.get('/finanzas/gastos-no-corrientes/'),
    ])
      .then(([f, v, p]) => {
        setFijos(f.data.results ?? f.data)
        setVariables(v.data.results ?? v.data)
        setPuntuales(p.data.results ?? p.data)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fijosAnio, fijosMes])

  useEffect(() => { cargar() }, [cargar])

  // Acceso rapido desde el dashboard: abre el formulario del tipo pedido sin
  // que haya que entrar a la pestaña y buscar el boton. El parametro se limpia
  // para que al volver a esta pantalla no se reabra solo.
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
    const hoy = new Date().toISOString().slice(0, 10)
    const defaults = tipoTab === 'puntuales'
      ? { categoria: 'otro', fecha: hoy }
      : {
        frecuencia: 'mensual',
        categoria: 'otro',
        fecha_inicio: hoy,
        activo: true,
        tipo_monto: tipoTab === 'variables' ? 'variable' : 'fijo',
      }
    setModal({ visible: true, item: null, defaults })
  }

  async function guardar(values) {
    setSaving(true)
    let payload
    if (tab === 'variables') {
      // El rubro se crea/edita solo con nombre + categoria; el monto lo llevan
      // las compras del mes. Al crear se manda 0 (el estimado se aprende solo).
      payload = { descripcion: values.descripcion, categoria: values.categoria }
      if (!modal.item) {
        payload = {
          ...payload,
          monto: 0,
          tipo_monto: 'variable',
          frecuencia: 'mensual',
          fecha_inicio: new Date().toISOString().slice(0, 10),
          activo: true,
        }
      }
    } else {
      payload = { ...values, monto: parseFloat(values.monto) || 0 }
      if (tab !== 'puntuales') payload.tipo_monto = 'fijo'
    }
    const { endpoint } = CONFIG_TAB[tab]
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
          await api.delete(`${CONFIG_TAB[tab].endpoint}${item.id}/`)
          cargar()
        },
      },
    ])
  }

  const data = tab === 'fijos' ? fijos : tab === 'variables' ? variables : puntuales
  const { fields, titulo } = CONFIG_TAB[tab]
  const esVariable = tab === 'variables'
  const topPad = useTopInset()

  return (
    <GestureHandlerRootView style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Lo que gastas" padded />

      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.tabHint}>{TABS.find((t) => t.id === tab)?.hint}</Text>

      {tab === 'fijos' && (
        <View style={s.monthNav}>
          <TouchableOpacity style={s.monthNavBtn} onPress={() => shiftMonth(-1)}>
            <Text style={s.monthNavArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthNavLabel}>{MESES[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}</Text>
          <TouchableOpacity
            style={s.monthNavBtn}
            onPress={() => shiftMonth(1)}
            disabled={nextMonthDisabled}
          >
            <Text style={[s.monthNavArrow, nextMonthDisabled && s.monthNavArrowOff]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading
        ? <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        : <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No hay registros aún</Text>}
          renderItem={({ item }) => esVariable ? (
            <SwipeableRow
              onEdit={() => setModal({ visible: true, item: { id: item.id, descripcion: item.descripcion, categoria: item.categoria } })}
              onDelete={() => eliminar(item)}
            >
              <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => setRubroModal({ visible: true, rubro: item })}>
                <View style={{ flex: 1 }}>
                  <Text style={s.desc}>{item.descripcion}</Text>
                  <Text style={s.meta}>{item.categoria}</Text>
                </View>
                <View style={s.cardRight}>
                  {item.real != null
                    ? <Text style={s.monto}>{formatMoney(item.real)}</Text>
                    : <Text style={s.pendiente}>Pendiente</Text>}
                  <Text style={s.estimado}>este mes</Text>
                </View>
              </TouchableOpacity>
            </SwipeableRow>
          ) : (
            <SwipeableRow onEdit={() => setModal({ visible: true, item })} onDelete={() => eliminar(item)}>
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <View style={s.descRow}>
                    <Text style={s.desc}>{item.descripcion}</Text>
                    {item.version_info && (
                      <Text style={s.versionChip}>v{item.version_info.numero}</Text>
                    )}
                  </View>
                  <Text style={s.meta}>
                    {tab === 'puntuales' ? item.fecha : (FREQ[item.frecuencia] || item.frecuencia)}
                    {item.categoria ? ` · ${item.categoria}` : ''}
                  </Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.monto}>{formatMoney(item.monto)}</Text>
                </View>
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

      <RubroModal
        visible={rubroModal.visible}
        rubro={rubroModal.rubro}
        anio={anioMes.anio}
        mes={anioMes.mes}
        onClose={() => setRubroModal({ visible: false, rubro: null })}
        onChanged={cargar}
      />
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.primaryStrong },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.text },
  tabHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginBottom: 6 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 },
  monthNavBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  monthNavArrow: { color: colors.text, fontSize: 20, lineHeight: 22, fontWeight: '700' },
  monthNavArrowOff: { color: 'rgba(255,255,255,0.2)' },
  monthNavLabel: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 150, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.borderExpense },
  cardRight: { alignItems: 'flex-end' },
  descRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  desc: { color: colors.text, fontSize: 15, fontWeight: '600' },
  versionChip: { color: colors.primary, fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(196,135,246,0.14)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  monto: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  pendiente: { color: '#FBBF24', fontWeight: '700', fontSize: 14 },
  estimado: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryStrong, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primaryStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: colors.text, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
