import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import FormModal from '../../components/ui/FormModal'
import SwipeableRow from '../../components/ui/SwipeableRow'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'

const FIELDS = [
  { key: 'nombre', label: 'Categoría', type: 'chips' },
  { key: 'limite_mensual', label: 'Límite mensual', type: 'number', placeholder: '0.00' },
]

const ICONOS = { vivienda: '🏠', alimentacion: '🛒', transporte: '🚗', salud: '💊', educacion: '📚', entretenimiento: '🎬', ropa: '👕', servicios: '💡', tecnologia: '💻', deudas: '💳', ahorro: '🐷', otro: '📦' }

export default function PresupuestoScreen() {
  const [items, setItems] = useState([])
  const [gastosMes, setGastosMes] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ visible: false, item: null })
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(() => {
    const hoy = new Date()
    setLoading(true)
    Promise.all([
      api.get('/finanzas/categorias/'),
      api.get(`/finanzas/reporte/?anio=${hoy.getFullYear()}&mes=${hoy.getMonth() + 1}`),
    ]).then(([cats, rep]) => {
      setItems(cats.data.results ?? cats.data)
      const mapa = {}
      ;(rep.data.categorias || []).forEach((c) => { mapa[c.categoria] = c.total })
      setGastosMes(mapa)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(values) {
    setSaving(true)
    const payload = { nombre: values.nombre, limite_mensual: parseFloat(values.limite_mensual) || null, icono: ICONOS[values.nombre] || '📦' }
    try {
      if (modal.item) await api.patch(`/finanzas/categorias/${modal.item.id}/`, payload)
      else await api.post('/finanzas/categorias/', payload)
      setModal({ visible: false, item: null })
      cargar()
    } catch { Alert.alert('Error', 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  async function eliminar(item) {
    Alert.alert('Eliminar', `¿Eliminar categoría "${item.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await api.delete(`/finanzas/categorias/${item.id}/`); cargar() } },
    ])
  }

  const topPad = useTopInset()

  return (
    <GestureHandlerRootView style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Presupuesto" subtitle="Límites mensuales por categoría" padded />

      {loading
        ? <View style={s.center}><ActivityIndicator color="#C487F6" /></View>
        : <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={s.empty}>No hay categorías configuradas</Text>}
          renderItem={({ item }) => {
            const gasto = gastosMes[item.nombre] || 0
            const limite = Number(item.limite_mensual) || 0
            const pct = limite > 0 ? Math.min((gasto / limite) * 100, 100) : 0
            const color = pct >= 100 ? '#F87171' : pct >= 80 ? '#F59E0B' : '#10B981'
            return (
              <SwipeableRow onEdit={() => setModal({ visible: true, item })} onDelete={() => eliminar(item)}>
                <View style={s.card}>
                  <Text style={s.icono}>{item.icono || ICONOS[item.nombre] || '📦'}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={s.cardHeader}>
                      <Text style={s.nombre}>{item.nombre}</Text>
                      <Text style={s.montos}>
                        <Text style={{ color }}>{formatMoney(gasto)}</Text>
                        {limite > 0 && <Text style={s.limite}> / {formatMoney(limite)}</Text>}
                      </Text>
                    </View>
                    {limite > 0 && (
                      <View style={s.barBg}>
                        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                      </View>
                    )}
                  </View>
                </View>
              </SwipeableRow>
            )
          }}
        />
      }

      <TouchableOpacity style={s.fab} onPress={() => setModal({ visible: true, item: null, defaults: { nombre: 'otro' } })}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <FormModal
        visible={modal.visible}
        onClose={() => setModal({ visible: false, item: null })}
        onSave={guardar}
        title={modal.item ? 'Editar categoría' : 'Nueva categoría'}
        fields={FIELDS}
        initialValues={modal.item || modal.defaults || { nombre: 'otro' }}
        loading={saving}
      />
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  icono: { fontSize: 22 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nombre: { color: '#fff', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  montos: { fontSize: 13, fontWeight: '600' },
  limite: { color: 'rgba(255,255,255,0.35)', fontWeight: '400' },
  barBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
