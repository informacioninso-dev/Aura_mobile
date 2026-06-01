import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'
import ProjectionChart from '../../components/ui/ProjectionChart'
import { useOfflineCache } from '../../hooks/useOfflineCache'
import { notificarPresupuesto } from '../../hooks/useNotifications'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function mesAnterior(anio, mes) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
}
function mesSiguiente(anio, mes) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
}

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const hoy = new Date()
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 })
  const [reporte, setReporte] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const cache = useOfflineCache(`reporte_${periodo.anio}_${periodo.mes}`)

  const esHoy = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1

  const cargar = useCallback(async (p = periodo) => {
    const cacheKey = useOfflineCache(`reporte_${p.anio}_${p.mes}`)
    try {
      // Mostrar caché mientras carga
      const cached = await cache.leer()
      if (cached && !refreshing) setReporte(cached)

      const { data } = await api.get(`/finanzas/reporte/?anio=${p.anio}&mes=${p.mes}`)
      setReporte(data)
      await cache.guardar(data)

      // Notificar si alguna categoría supera el 80% del límite
      if (p.anio === hoy.getFullYear() && p.mes === hoy.getMonth() + 1) {
        for (const cat of data.categorias || []) {
          if (cat.pct_limite >= 80) await notificarPresupuesto(cat.categoria, cat.pct_limite)
        }
      }
    } catch {
      const cached = await cache.leer(60 * 60 * 1000) // 1h en offline
      if (cached) setReporte(cached)
    }
    finally { setLoading(false); setRefreshing(false) }
  }, [periodo])

  useEffect(() => { setLoading(true); cargar(periodo) }, [periodo])

  function onRefresh() { setRefreshing(true); cargar(periodo) }

  const r = reporte?.resumen
  const ingresos = Number(r?.total_ingresos ?? 0)
  const gastos = Number(r?.total_gastos ?? 0)
  const balance = Number(r?.balance ?? 0)
  const tasa = Number(r?.tasa_ahorro ?? 0)
  const tasaPct = Math.min(Math.max(tasa, 0), 100)

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C487F6" />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hola, {user?.first_name || 'bienvenido'} 👋</Text>
          <Text style={s.plan}>{user?.plan_name || 'Plan gratuito'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Navegación de mes */}
      <View style={s.navMes}>
        <TouchableOpacity style={s.navBtn} onPress={() => setPeriodo((p) => mesAnterior(p.anio, p.mes))}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.navLabel}>{MESES[periodo.mes - 1]} {periodo.anio}</Text>
        <TouchableOpacity style={s.navBtn} onPress={() => setPeriodo((p) => mesSiguiente(p.anio, p.mes))} disabled={esHoy}>
          <Text style={[s.navArrow, esHoy && { opacity: 0.2 }]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#C487F6" size="large" /></View>
      ) : (
        <>
          {/* Stats principales */}
          <View style={s.grid}>
            <StatCard label="Ingresos" value={ingresos} color="#10B981" icon="💰" />
            <StatCard label="Gastos" value={gastos} color="#F87171" icon="💸" />
          </View>

          {/* Balance + tasa de ahorro */}
          <View style={s.balanceCard}>
            <View style={s.balanceRow}>
              <Text style={s.balanceLabel}>Balance del mes</Text>
              <Text style={[s.balanceValue, { color: balance >= 0 ? '#10B981' : '#F87171' }]}>
                {formatMoney(balance)}
              </Text>
            </View>
            {ingresos > 0 && (
              <>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${tasaPct}%`, backgroundColor: tasaPct >= 20 ? '#10B981' : tasaPct >= 10 ? '#F59E0B' : '#F87171' }]} />
                </View>
                <Text style={s.tasaText}>Tasa de ahorro: <Text style={{ color: '#fff', fontWeight: '700' }}>{tasa}%</Text></Text>
              </>
            )}
          </View>

          {/* Desglose */}
          <View style={s.desglose}>
            <DesgloseFila label="Ingresos fijos" value={r?.ingresos_fijos} color="#10B981" />
            <DesgloseFila label="Ingresos puntuales" value={r?.ingresos_puntuales} color="#34D399" />
            <View style={s.separador} />
            <DesgloseFila label="Gastos fijos" value={r?.gastos_corrientes} color="#F87171" />
            <DesgloseFila label="Cuotas / diferidos" value={r?.cuotas} color="#FB923C" />
            <DesgloseFila label="Gastos puntuales" value={r?.gastos_puntuales} color="#F87171" />
          </View>

          {/* Categorías */}
          {reporte?.categorias?.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Por categoría</Text>
              {reporte.categorias.slice(0, 5).map((cat) => (
                <View key={cat.categoria} style={s.catRow}>
                  <Text style={s.catIcon}>{cat.icono || '📦'}</Text>
                  <Text style={s.catNombre}>{cat.categoria}</Text>
                  <Text style={s.catMonto}>{formatMoney(cat.total)}</Text>
                  {cat.pct_limite != null && (
                    <Text style={[s.catPct, { color: cat.pct_limite > 100 ? '#F87171' : '#10B981' }]}>
                      {cat.pct_limite}%
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Gráfica proyección — solo mes actual */}
          {esHoy && <ProjectionChart />}
        </>
      )}
    </ScrollView>
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={[s.statCard, { borderColor: color + '33' }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{formatMoney(value)}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function DesgloseFila({ label, value, color }) {
  if (!value && value !== 0) return null
  return (
    <View style={s.desgloseRow}>
      <Text style={s.desgloseLabel}>{label}</Text>
      <Text style={[s.desgloseValue, { color }]}>{formatMoney(value)}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 32 },
  center: { height: 200, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { color: '#fff', fontSize: 20, fontWeight: '700' },
  plan: { color: 'rgba(196,135,246,0.7)', fontSize: 12, marginTop: 2 },
  logoutBtn: { paddingVertical: 4 },
  logoutText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 16 },
  navBtn: { padding: 8 },
  navArrow: { color: '#C487F6', fontSize: 28, lineHeight: 30 },
  navLabel: { color: '#fff', fontWeight: '700', fontSize: 16, minWidth: 160, textAlign: 'center' },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderRadius: 16, padding: 14 },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  balanceValue: { fontSize: 20, fontWeight: '800' },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  tasaText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  desglose: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 8 },
  desgloseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  desgloseLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  desgloseValue: { fontWeight: '600', fontSize: 13 },
  separador: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  section: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  catIcon: { fontSize: 16, width: 24 },
  catNombre: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1, textTransform: 'capitalize' },
  catMonto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  catPct: { fontSize: 11, fontWeight: '700', minWidth: 36, textAlign: 'right' },
})
