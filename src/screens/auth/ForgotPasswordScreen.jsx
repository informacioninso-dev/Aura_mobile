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
import { colors } from '../../theme/theme'
import s from './authStyles'
import { AuthBrand } from './AuthParts'

export default function ForgotPasswordScreen({ navigation }) {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit() {
    if (!email.trim()) return setError('Escribe el correo de tu cuenta.')
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await forgotPassword(email.trim().toLowerCase())
      setSuccess(response?.detail || 'Si el correo está registrado, te enviaremos instrucciones.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos procesar la solicitud.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <AuthBrand title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una contraseña nueva." />
          {error ? <Text style={s.error}>{error}</Text> : null}
          {success ? <Text style={s.success}>{success}</Text> : null}
          <View style={s.field}>
            <Text style={s.label}>Correo electrónico</Text>
            <TextInput style={s.input} value={email} onChangeText={(value) => { setEmail(value); setError(''); setSuccess('') }} placeholder="tu@correo.com" placeholderTextColor={colors.placeholder} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={submit} />
          </View>
          <TouchableOpacity style={[s.primary, loading && s.disabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.text} /> : <Text style={s.primaryText}>Enviar instrucciones</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerLink} onPress={() => navigation.navigate('Login')}>← Volver a ingresar</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}