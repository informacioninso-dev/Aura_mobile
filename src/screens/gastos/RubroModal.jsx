import { useCallback, useEffect, useState } from 'react'
import { colors } from '../../theme/theme'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'

import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'

// Fecha LOCAL (no UTC) para no registrar un consumo con "fecha futura" en zonas
// UTC- (ej. Ecuador). El backend deriva anio/mes de la fecha.
function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Detalle de un rubro variable (paridad con la web): "Este mes" = suma de las
 * compras del mes, 3 opciones rapidas (repetir el promedio / marcar $0 / anotar
 * el valor real) y la lista de compras con borrado.
 */
export default function RubroModal({ visible, rubro, anio, mes, onClose, onChanged }) {
  const [consumos, setConsumos] = useState([])
  const [loading, setLoading] = useState(false)
  const [monto, setMonto] = useState('')
  const [donde, setDonde] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    if (!rubro) return
    setLoading(true)
    try {
      const { data } = await api.get(
        `/finanzas/gastos-corrientes/${rubro.id}/ejecuciones/?anio=${anio}&mes=${mes}`,
      )
      setConsumos(data.results ?? data)
    } catch {
      setConsumos([])
    } finally {
      setLoading(false)
    }
  }, [rubro, anio, mes])

  useEffect(() => {
    if (visible && rubro) {
      setMonto('')
      setDonde('')
      cargar()
    }
  }, [visible, rubro, cargar])

  const acumulado = consumos.reduce((sum, c) => sum + parseFloat(c.monto_real || 0), 0)
  const sugerido = parseFloat(rubro?.sugerido ?? 0)

  async function postConsumo(montoReal, descripcion) {
    if (saving || !rubro) return false
    setSaving(true)
    try {
      await api.post(`/finanzas/gastos-corrientes/${rubro.id}/ejecuciones/`, {
        fecha: hoyLocal(),
        descripcion,
        monto_real: montoReal,
      })
      await cargar()
      onChanged?.()
      return true
    } catch {
      Alert.alert('Error', 'No se pudo guardar.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function anadirCompra() {
    const m = parseFloat(monto)
    if (Number.isNaN(m) || m < 0) return
    if (await postConsumo(m, donde)) {
      setMonto('')
      setDonde('')
    }
  }

  async function marcarCero() {
    if (await postConsumo(0, 'Sin gasto este mes')) onClose()
  }

  async function repetirPromedio() {
    if (sugerido <= 0) return
    if (await postConsumo(sugerido, 'Igual que el promedio')) onClose()
  }

  async function borrar(id) {
    try {
      await api.delete(`/finanzas/gastos-corrientes/${rubro.id}/ejecuciones/${id}/`)
      await cargar()
      onChanged?.()
    } catch {
      Alert.alert('Error', 'No se pudo eliminar.')
    }
  }

  if (!rubro) return null

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{rubro.descripcion}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.card}>
              <Text style={s.cardLabel}>Este mes</Text>
              <Text style={s.cardValue}>{formatMoney(acumulado)}</Text>
            </View>

            {consumos.length === 0 && (
              <View style={{ marginBottom: 4 }}>
                <Text style={s.qLabel}>¿Qué pasó este mes?</Text>
                <View style={s.choiceRow}>
                  {sugerido > 0 && (
                    <TouchableOpacity
                      style={[s.choice, s.choiceRepeat]}
                      onPress={repetirPromedio}
                      disabled={saving}
                    >
                      <Text style={s.choiceT}>Igual que siempre</Text>
                      <Text style={s.choiceS}>~{formatMoney(sugerido)}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.choice} onPress={marcarCero} disabled={saving}>
                    <Text style={s.choiceT}>No gasté nada</Text>
                    <Text style={s.choiceS}>$0</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.hint}>…o anota abajo el valor exacto o tus compras.</Text>
              </View>
            )}

            <View style={s.form}>
              <Text style={s.label}>¿Cuánto gastaste?</Text>
              <TextInput
                style={s.input}
                value={monto}
                onChangeText={setMonto}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <Text style={s.label}>¿Dónde? (opcional)</Text>
              <TextInput
                style={s.input}
                value={donde}
                onChangeText={setDonde}
                placeholder="Ej: Fybeca, Sana Sana..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity style={s.btnSave} onPress={anadirCompra} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSaveText}>+ Añadir compra</Text>}
              </TouchableOpacity>
            </View>

            <Text style={s.listTitle}>Compras de este mes</Text>
            {loading ? (
              <ActivityIndicator color="#C487F6" style={{ marginVertical: 12 }} />
            ) : consumos.length === 0 ? (
              <Text style={s.empty}>Aún no añades compras. Cada compra suma al total del mes.</Text>
            ) : (
              consumos.map((c) => (
                <View key={c.id} style={s.consumo}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.consumoDesc}>{c.descripcion || 'Compra'}</Text>
                    <Text style={s.consumoFecha}>{c.fecha}</Text>
                  </View>
                  <Text style={s.consumoMonto}>{formatMoney(c.monto_real)}</Text>
                  <TouchableOpacity onPress={() => borrar(c.id)} style={s.del}>
                    <Text style={s.delText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={s.btnClose} onPress={onClose}>
            <Text style={s.btnCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0F1B35', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 16 },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  cardValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  qLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 },
  choiceRepeat: { borderColor: 'rgba(196,135,246,0.4)', backgroundColor: 'rgba(196,135,246,0.10)' },
  choiceT: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  choiceS: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  form: { backgroundColor: 'rgba(196,135,246,0.06)', borderWidth: 1, borderColor: 'rgba(196,135,246,0.16)', borderRadius: 14, padding: 14, marginTop: 16, marginBottom: 16 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: colors.text, fontSize: 15 },
  btnSave: { backgroundColor: colors.primaryStrong, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  btnSaveText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  listTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  consumo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 8 },
  consumoDesc: { color: colors.text, fontSize: 14, fontWeight: '600' },
  consumoFecha: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  consumoMonto: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  del: { padding: 6 },
  delText: { color: 'rgba(248,113,113,0.7)', fontSize: 14, fontWeight: '700' },
  btnClose: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  btnCloseText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
})
