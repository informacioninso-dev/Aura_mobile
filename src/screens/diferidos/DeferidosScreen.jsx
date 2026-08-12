import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native'
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
  const [pago, setPago] = useState({ visible: false, item: null, monto: '' })
  const [pagando, setPagando] = useState(false)

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

  function abrirPago(item) {
    setPago({ visible: true, item, monto: String(item.saldo_pendiente ?? item.cuota_mensual ?? '') })
  }

  async function confirmarPago() {
    if (!pago.item) return
    setPagando(true)
    try {
      await api.post(`/finanzas/diferidos/${pago.item.id}/pagar-el-resto/`, { monto: pago.monto })
      setPago({ visible: false, item: null, monto: '' })
      cargar()
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo registrar el pago.')
    } finally {
      setPagando(false)
    }
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
                  {item.pagada_en
                    ? <Text style={s.pagadaBadge}>✅ Pagada</Text>
                    : <Text style={s.meta}>{item.fecha_inicio} → {item.fecha_fin}</Text>}
                  {item.categoria ? <Text style={s.tag}>{item.categoria}</Text> : null}
                  {!item.pagada_en && item.activo && item.fecha_fin >= hoy && (
                    <TouchableOpacity style={s.payBtn} onPress={() => abrirPago(item)}>
                      <Text style={s.payBtnText}>Pagar el resto</Text>
                    </TouchableOpacity>
                  )}
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

      <Modal visible={pago.visible} transparent animationType="fade" onRequestClose={() => setPago({ visible: false, item: null, monto: '' })}>
        <View style={s.overlay}>
          <View style={s.payModal}>
            <Text style={s.payTitle}>Pagar el resto</Text>
            {pago.item ? <Text style={s.payDesc}>{pago.item.descripcion}</Text> : null}
            <View style={s.payWarn}>
              <Text style={s.payWarnText}>
                💸 Se registra como un gasto de este mes, así que tu saldo baja ahora (sale de tu liquidez).{'\n'}
                ✅ A cambio, dejas de pagar la cuota mensual de aquí en adelante.
              </Text>
            </View>
            <Text style={s.payLabel}>Monto a pagar</Text>
            <TextInput
              style={s.payInput}
              keyboardType="numeric"
              value={pago.monto}
              onChangeText={(t) => setPago((p) => ({ ...p, monto: t }))}
            />
            <Text style={s.payHint}>Edítalo si te dieron descuento por pagar todo.</Text>
            <View style={s.payActions}>
              <TouchableOpacity style={s.payCancel} onPress={() => setPago({ visible: false, item: null, monto: '' })}>
                <Text style={s.payCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.payConfirm, pagando && { opacity: 0.5 }]} onPress={confirmarPago} disabled={pagando}>
                <Text style={s.payConfirmText}>{pagando ? 'Registrando...' : 'Pagar el resto'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  pagadaBadge: { color: colors.success, fontSize: 12, fontWeight: '700', marginTop: 2 },
  payBtn: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(196,135,246,0.4)', backgroundColor: 'rgba(196,135,246,0.08)' },
  payBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 22 },
  payModal: { backgroundColor: '#1B2432', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  payTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  payDesc: { color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 12 },
  payWarn: { backgroundColor: 'rgba(251,146,60,0.10)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.25)', borderRadius: 12, padding: 12, marginBottom: 16 },
  payWarnText: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 19 },
  payLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  payInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: colors.text, fontSize: 16 },
  payHint: { color: colors.textFaint, fontSize: 11, marginTop: 6 },
  payActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  payCancel: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
  payCancelText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  payConfirm: { backgroundColor: colors.primaryStrong, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10 },
  payConfirmText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  cuota: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  cuotaLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '400' },
  total: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryStrong, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primaryStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: colors.text, fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
