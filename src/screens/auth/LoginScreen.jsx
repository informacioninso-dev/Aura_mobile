import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorMessage } from '../../api/errors'
import { getAccess, getRefresh } from '../../api/authStorage'
import { useBiometrics } from '../../hooks/useBiometrics'
import { registrarNotificaciones } from '../../hooks/useNotifications'
import { colors } from '../../theme/theme'

export default function LoginScreen({ navigation }) {
  const { login, restoreSession } = useAuth()
  const { disponible, habilitado, tipo, autenticar } = useBiometrics()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function autoBiometria() {
      if (!disponible || !habilitado) return
      const [access, refresh] = await Promise.all([getAccess(), getRefresh()])
      if (!mounted || (!access && !refresh)) return
      await intentarBiometria({ silentIfMissing: true })
    }

    autoBiometria()

    return () => {
      mounted = false
    }
  }, [disponible, habilitado])

  async function intentarBiometria({ silentIfMissing = false } = {}) {
    setLoading(true)
    if (!silentIfMissing) setError('')

    try {
      const [access, refresh] = await Promise.all([getAccess(), getRefresh()])
      if (!access && !refresh) {
        if (!silentIfMissing) {
          setError('No hay una sesión guardada para entrar con biometría.')
        }
        return
      }

      const ok = await autenticar()
      if (!ok) return

      const restored = await restoreSession()
      if (!restored && !silentIfMissing) {
        setError('Tu sesión guardada venció. Inicia sesión con tu contraseña.')
        return
      }

      if (restored) {
        await registrarNotificaciones()
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      await login(email.trim().toLowerCase(), password)
      await registrarNotificaciones()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Email o contraseña incorrectos.'))
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoSymbol}>✦</Text>
          </View>
          <Text style={s.logo}>AURA</Text>
        </View>
        <Text style={s.subtitle}>Tu asistente financiero</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.35)"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <View style={s.passWrap}>
          <TextInput
            style={s.passInput}
            placeholder="Contraseña"
            placeholderTextColor="rgba(255,255,255,0.35)"
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass((v) => !v)}>
            <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color={colors.text} />
            : <Text style={s.btnText}>Ingresar</Text>}
        </TouchableOpacity>

        {disponible && habilitado && (
          <TouchableOpacity style={s.bioBtn} onPress={intentarBiometria}>
            <Text style={s.bioBtnText}>{tipo === 'Face ID' ? '😊' : '🔒'} Entrar con {tipo}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.linkButton} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={s.linkText}>Olvide mi contraseña</Text>
        </TouchableOpacity>
        <View style={s.registerRow}>
          <Text style={s.registerCopy}>¿Aun no tienes cuenta? </Text>
          <Text style={s.registerLink} onPress={() => navigation.navigate('Registro')}>Crear cuenta gratis</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  card: { gap: 12 },
  logoWrap: { alignItems: 'center', marginBottom: 8 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(196,135,246,0.15)', borderWidth: 1, borderColor: 'rgba(196,135,246,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoSymbol: { color: colors.primary, fontSize: 28 },
  logo: { color: colors.primary, fontSize: 32, fontWeight: '800', letterSpacing: 6 },
  subtitle: { color: colors.textFaint, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, color: colors.text, fontSize: 15 },
  passWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12 },
  passInput: { flex: 1, padding: 14, color: colors.text, fontSize: 15 },
  eyeBtn: { padding: 14 },
  eyeIcon: { fontSize: 18 },
  btn: { backgroundColor: colors.primaryStrong, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  bioBtn: { borderWidth: 1, borderColor: 'rgba(196,135,246,0.3)', borderRadius: 12, padding: 13, alignItems: 'center', backgroundColor: 'rgba(196,135,246,0.08)' },
  bioBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  linkButton: { alignItems: 'center', paddingVertical: 5 },
  linkText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 2 },
  registerCopy: { color: 'rgba(255,255,255,0.38)', fontSize: 12 },
  registerLink: { color: '#16C79A', fontSize: 12, fontWeight: '800' },
})
