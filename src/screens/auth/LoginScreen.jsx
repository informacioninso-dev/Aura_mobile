import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorMessage } from '../../api/errors'
import { getAccess, getRefresh } from '../../api/authStorage'
import { useBiometrics } from '../../hooks/useBiometrics'
import { registrarNotificaciones } from '../../hooks/useNotifications'
import { colors } from '../../theme/theme'
import s from './authStyles'
import { AuthBrand, PasswordInput } from './AuthParts'

export default function LoginScreen({ navigation }) {
  const { login, restoreSession } = useAuth()
  const { disponible, habilitado, tipo, autenticar } = useBiometrics()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      setError(getApiErrorMessage(e, 'Correo o contraseña incorrectos.'))
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <AuthBrand title="Hola de nuevo" subtitle="Tu plata clara, hoy y en los próximos meses." />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.field}>
            <Text style={s.label}>Correo electrónico</Text>
            <TextInput
              style={s.input}
              placeholder="tu@correo.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Contraseña</Text>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity style={[s.primary, loading && s.disabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.text} />
              : <Text style={s.primaryText}>Ingresar</Text>}
          </TouchableOpacity>

          {disponible && habilitado && (
            <TouchableOpacity style={s.secondary} onPress={() => intentarBiometria()}>
              <Text style={s.secondaryText}>Entrar con {tipo}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.linkCenter} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={s.linkText}>Olvidé mi contraseña</Text>
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>¿Aún no tienes cuenta? </Text>
          <Text style={s.footerLink} onPress={() => navigation.navigate('Registro')}>Crear cuenta gratis</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
