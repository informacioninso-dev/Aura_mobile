import { useCallback, useEffect, useState } from 'react'
import { colors } from '../../theme/theme'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'

import api from '../../api/client'

/**
 * Campana de notificaciones in-app (paridad con la web): muestra el numero de
 * no leidas y, al tocarla, un panel con la lista y "marcar todas leidas".
 */
export default function NotificationBell() {
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/finanzas/notificaciones/')
      setNotifs(data.results ?? data)
    } catch {
      // silencioso: la campana nunca debe tumbar la pantalla
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const noLeidas = notifs.filter((n) => !n.leida).length

  function abrir() {
    setOpen(true)
    cargar()
  }

  async function leer(n) {
    if (n.leida) return
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)))
    try { await api.patch(`/finanzas/notificaciones/${n.id}/leer/`) } catch { cargar() }
  }

  async function marcarTodas() {
    setNotifs((prev) => prev.map((x) => ({ ...x, leida: true })))
    try { await api.post('/finanzas/notificaciones/marcar_todas_leidas/') } catch { cargar() }
  }

  return (
    <>
      <TouchableOpacity style={s.bell} onPress={abrir} activeOpacity={0.7}>
        <Text style={s.bellIcon}>🔔</Text>
        {noLeidas > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{noLeidas > 9 ? '9+' : noLeidas}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.head}>
              <Text style={s.title}>Notificaciones</Text>
              {noLeidas > 0 ? (
                <TouchableOpacity onPress={marcarTodas}>
                  <Text style={s.markAll}>Marcar todas</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : notifs.length === 0 ? (
                <Text style={s.empty}>Sin notificaciones 🎉</Text>
              ) : (
                notifs.map((n) => (
                  <TouchableOpacity key={n.id} style={[s.item, !n.leida && s.itemUnread]} onPress={() => leer(n)}>
                    <View style={s.itemHead}>
                      {!n.leida ? <View style={s.dot} /> : null}
                      <Text style={[s.itemTitle, n.leida && s.itemTitleRead]}>{n.titulo}</Text>
                    </View>
                    <Text style={s.itemMsg}>{n.mensaje}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={s.close} onPress={() => setOpen(false)}>
              <Text style={s.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 18 },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0F1B35', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, maxHeight: '80%' },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  markAll: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  item: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  itemUnread: { backgroundColor: 'rgba(196,135,246,0.08)' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  itemTitleRead: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  itemMsg: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3, lineHeight: 18 },
  close: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  closeText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
})
