import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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

const CURRENCIES = ['USD', 'COP', 'EUR', 'CLP', 'PEN', 'MXN', 'ARS']
const PRIVACY_URL = 'https://aura.binnso.com/privacidad'
const TERMS_URL = 'https://aura.binnso.com/terminos'

function CheckRow({ checked, onChange, children }) {
  return (
    <View style={s.checkRow}>
      <TouchableOpacity style={[s.checkbox, checked && s.checkboxActive]} onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        {checked ? <Text style={s.checkmark}>✓</Text> : null}
      </TouchableOpacity>
      <Text style={s.checkCopy}>{children}</Text>
    </View>
  )
}

export default function RegistroScreen({ navigation }) {
  const { register } = useAuth()
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    moneda_preferida: 'USD',
    privacy_notice_acknowledged: false,
    terms_accepted: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }))
    setError('')
  }

  async function submit() {
    if (!form.email.trim() || !form.username.trim()) return setError('Completa tu correo y nombre.')
    if (form.password.length < 8) return setError('La clave debe tener al menos 8 caracteres.')
    if (form.password !== form.confirmPassword) return setError('Las claves no coinciden.')
    if (!form.privacy_notice_acknowledged || !form.terms_accepted) {
      return setError('Debes revisar el Aviso de Privacidad y aceptar los Terminos de Uso.')
    }

    setLoading(true)
    setError('')
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        password: form.password,
        moneda_preferida: form.moneda_preferida,
        privacy_notice_acknowledged: form.privacy_notice_acknowledged,
        terms_accepted: form.terms_accepted,
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos crear tu cuenta.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <View style={s.mark}><Text style={s.markText}>A</Text></View>
          <Text style={s.brandName}>AURA</Text>
          <Text style={s.brandTag}>Tu plata, mas clara.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Crea tu cuenta gratis</Text>
          <Text style={s.subtitle}>Empieza con una vision clara de lo que ganas, gastas y puedes decidir.</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.field}>
            <Text style={s.label}>Correo electronico</Text>
            <TextInput style={s.input} value={form.email} onChangeText={(email) => update({ email })} placeholder="tu@correo.com" placeholderTextColor="rgba(255,255,255,0.28)" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Tu nombre</Text>
            <TextInput style={s.input} value={form.username} onChangeText={(username) => update({ username })} placeholder="Como quieres que te llamemos" placeholderTextColor="rgba(255,255,255,0.28)" autoCapitalize="words" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Clave</Text>
            <TextInput style={s.input} value={form.password} onChangeText={(password) => update({ password })} placeholder="Minimo 8 caracteres" placeholderTextColor="rgba(255,255,255,0.28)" secureTextEntry autoComplete="new-password" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Confirma tu clave</Text>
            <TextInput style={s.input} value={form.confirmPassword} onChangeText={(confirmPassword) => update({ confirmPassword })} placeholder="Repite la clave" placeholderTextColor="rgba(255,255,255,0.28)" secureTextEntry autoComplete="new-password" />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Moneda principal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {CURRENCIES.map((currency) => {
                const active = form.moneda_preferida === currency
                return (
                  <TouchableOpacity key={currency} style={[s.chip, active && s.chipActive]} onPress={() => update({ moneda_preferida: currency })}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{currency}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <CheckRow checked={form.privacy_notice_acknowledged} onChange={(value) => update({ privacy_notice_acknowledged: value })}>
            He leido el <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Aviso de Privacidad</Text> y entiendo como Aura tratara mis datos.
          </CheckRow>
          <CheckRow checked={form.terms_accepted} onChange={(value) => update({ terms_accepted: value })}>
            Acepto los <Text style={s.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Terminos de Uso</Text> y el descargo financiero.
          </CheckRow>

          <View style={s.notice}>
            <Text style={s.noticeText}>Aura es una herramienta informativa y no reemplaza asesoria financiera profesional. Sus resultados dependen de que registres tus datos correctamente.</Text>
          </View>

          <TouchableOpacity style={[s.primary, loading && s.disabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#07131F" /> : <Text style={s.primaryText}>Crear mi cuenta gratis</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>¿Ya tienes cuenta? </Text>
          <Text style={s.footerLink} onPress={() => navigation.navigate('Login')}>Inicia sesion</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}