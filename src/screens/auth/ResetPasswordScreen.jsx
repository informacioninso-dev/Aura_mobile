import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { getApiErrorMessage } from '../../api/errors'
import { useAuth } from '../../context/AuthContext'
import s from './authStyles'

export default function ResetPasswordScreen({ navigation, route }) {
  const { resetPassword } = useAuth()

  // uid y token llegan por deep link (aura://reset-password?uid=..&token=..).
  // Si el correo se abrio en el navegador y no en la app, se pueden pegar a mano.
  const paramUid = route?.params?.uid || ''
  const paramToken = route?.params?.token || ''
  const desdeEnlace = Boolean(paramUid && paramToken)

  const [uid, setUid] = useState(paramUid)
  const [token, setToken] = useState(paramToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit() {
    if (!uid.trim() || !token.trim()) {
      return setError('Falta el codigo del enlace que te enviamos por correo.')
    }
    if (password.length < 8) return setError('La clave debe tener al menos 8 caracteres.')
    if (password !== confirmPassword) return setError('Las claves no coinciden.')

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const data = await resetPassword({
        uid: uid.trim(),
        token: token.trim(),
        newPassword: password,
      })
      setSuccess(data?.detail || 'Listo. Inicia sesion con tu nueva clave.')
      setPassword('')
      setConfirmPassword('')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cambiar la contraseña.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <View style={s.mark}><Text style={s.markText}>A</Text></View>
          <Text style={s.brandName}>AURA</Text>
          <Text style={s.brandTag}>Define tu nueva contraseña.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Nueva contraseña</Text>
          <Text style={s.subtitle}>
            {desdeEnlace
              ? 'Escribe la clave con la que vas a entrar de ahora en adelante.'
              : 'Pega el codigo que aparece en el enlace del correo y elige tu nueva clave.'}
          </Text>

          {error ? <Text style={s.error}>{error}</Text> : null}
          {success ? <Text style={s.success}>{success}</Text> : null}

          {!desdeEnlace && (
            <>
              <View style={s.field}>
                <Text style={s.label}>Codigo (uid)</Text>
                <TextInput
                  style={s.input}
                  value={uid}
                  onChangeText={(value) => { setUid(value); setError('') }}
                  placeholder="Del enlace del correo"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Token</Text>
                <TextInput
                  style={s.input}
                  value={token}
                  onChangeText={(value) => { setToken(value); setError('') }}
                  placeholder="Del enlace del correo"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </>
          )}

          <View style={s.field}>
            <Text style={s.label}>Nueva contraseña</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={(value) => { setPassword(value); setError('') }}
              placeholder="Minimo 8 caracteres"
              placeholderTextColor="rgba(255,255,255,0.28)"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Repite la contraseña</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={(value) => { setConfirmPassword(value); setError('') }}
              placeholder="Vuelve a escribirla"
              placeholderTextColor="rgba(255,255,255,0.28)"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
          </View>

          {success ? (
            <TouchableOpacity style={s.primary} onPress={() => navigation.navigate('Login')}>
              <Text style={s.primaryText}>Iniciar sesion</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.primary, loading && s.disabled]} onPress={submit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#07131F" />
                : <Text style={s.primaryText}>Cambiar contraseña</Text>}
            </TouchableOpacity>
          )}
        </View>

        <View style={s.footer}>
          <Text style={s.footerLink} onPress={() => navigation.navigate('Login')}>
            Volver a iniciar sesion
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
