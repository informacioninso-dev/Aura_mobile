import { useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { useAuth } from '../../context/AuthContext'
import { useTopInset } from '../../hooks/useTopInset'
import { colors } from '../../theme/theme'

function extraerParams(url) {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return {}
  const params = {}
  url.slice(queryIndex + 1).split('&').forEach((pair) => {
    const [key, value] = pair.split('=')
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '')
  })
  return params
}

export default function PagoScreen({ route, navigation }) {
  const { payUrl, planName } = route.params
  const { fetchMe } = useAuth()
  const [fase, setFase] = useState('pago')
  const [mensajeError, setMensajeError] = useState('')
  const confirmado = useRef(false)

  async function onNavigationStateChange(navState) {
    if (confirmado.current) return
    const { url } = navState
    const esAura = url.includes('aura.binnso.com')

    if (esAura && url.includes('/pago/resultado')) {
      const { id, clientTransactionId } = extraerParams(url)
      if (!id || !clientTransactionId) return
      confirmado.current = true
      setFase('verificando')
      try {
        const { data } = await api.post('/usuarios/pago/confirmar/', { id, clientTransactionId })
        if (data.status === 'approved') {
          setFase('approved')
          fetchMe()
        } else if (data.status === 'cancelled') {
          setFase('cancelled')
        } else {
          setFase('error')
        }
      } catch (err) {
        setMensajeError(getApiErrorMessage(err, 'No pudimos confirmar tu pago. Contacta soporte si ya fue debitado.'))
        setFase('error')
      }
    } else if (esAura && url.includes('/planes')) {
      confirmado.current = true
      setFase('cancelled')
    }
  }

  const topPad = useTopInset()

  if (fase === 'pago') {
    return (
      <View style={s.root}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <Text style={s.headerTitle}>Pago seguro</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.headerClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: payUrl }}
          onNavigationStateChange={onNavigationStateChange}
          startInLoadingState
          renderLoading={() => (
            <View style={[s.root, s.center]}>
              <ActivityIndicator color="#C487F6" size="large" />
            </View>
          )}
          style={{ flex: 1, backgroundColor: colors.bg }}
        />
      </View>
    )
  }

  if (fase === 'verificando') {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color="#C487F6" size="large" />
        <Text style={s.statusText}>Verificando pago...</Text>
      </View>
    )
  }

  if (fase === 'approved') {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.statusIcon}>✅</Text>
        <Text style={s.statusTitle}>¡Pago exitoso!</Text>
        <Text style={s.statusText}>
          Tu plan <Text style={{ color: colors.primary, fontWeight: '700' }}>{planName}</Text> ha sido activado.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('Planes')}>
          <Text style={s.primaryBtnText}>Listo</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (fase === 'cancelled') {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.statusIcon}>⚠️</Text>
        <Text style={s.statusTitle}>Pago cancelado</Text>
        <Text style={s.statusText}>No se realizó ningún cobro.</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('Planes')}>
          <Text style={s.primaryBtnText}>Volver a planes</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[s.root, s.center]}>
      <Text style={s.statusIcon}>❌</Text>
      <Text style={s.statusTitle}>Error al verificar</Text>
      <Text style={s.statusText}>{mensajeError || 'No pudimos confirmar tu pago. Contacta soporte si ya fue debitado.'}</Text>
      <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('Planes')}>
        <Text style={s.primaryBtnText}>Volver a planes</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  headerClose: { color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '700', padding: 4 },
  statusIcon: { fontSize: 48 },
  statusTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.primaryStrong, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  primaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
})
