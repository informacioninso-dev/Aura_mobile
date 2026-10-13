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
import { colors } from '../../theme/theme'
import s from './authStyles'
import { AuthBrand, PasswordInput } from './AuthParts'

const CURRENCIES = ['USD', 'COP', 'EUR', 'CLP', 'PEN', 'MXN', 'ARS']
const CURRENCY_NAMES = { USD: 'dólar', COP: 'peso colombiano', EUR: 'euro', CLP: 'peso chileno', PEN: 'sol', MXN: 'peso mexicano', ARS: 'peso argentino' }
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
    moneda_preferida: 'USD',
    privacy_notice_acknowledged: false,
    terms_accepted: false,
  })
  const [loading, setLoading] = useState(false)
  // Casi todo el público usa dólar: la lista de monedas solo se abre si la piden.
  const [showCurrencies, setShowCurrencies] = useState(false)
  const [error, setError] = useState('')

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }))
    setError('')
  }

  async function submit() {
    if (!form.email.trim() || !form.username.trim()) return setError('Completa tu correo y nombre.')
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (!form.privacy_notice_acknowledged || !form.terms_accepted) {
      return setError('Para seguir, acepta el Aviso de Privacidad y los Términos de Uso.')
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
      setError(getApiErrorMessage(requestError, 'No pudimos crear tu cuenta. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <AuthBrand title="Crea tu cuenta gratis" subtitle="Mira cuánto te queda este mes y cómo vas a terminar el año." />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.field}>
            <Text style={s.label}>Correo electrónico</Text>
            <TextInput style={s.input} value={form.email} onChangeText={(email) => update({ email })} placeholder="tu@correo.com" placeholderTextColor={colors.placeholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Tu nombre</Text>
            <TextInput style={s.input} value={form.username} onChangeText={(username) => update({ username })} placeholder="¿Cómo quieres que te llamemos?" placeholderTextColor={colors.placeholder} autoCapitalize="words" autoComplete="name" textContentType="givenName" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Contraseña</Text>
            <PasswordInput value={form.password} onChangeText={(password) => update({ password })} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </View>

          <View style={s.inlineRow}>
            <Text style={s.inlineLabel}>
              Moneda: <Text style={s.inlineStrong}>{form.moneda_preferida} ({CURRENCY_NAMES[form.moneda_preferida]})</Text>
            </Text>
            <Text style={s.inlineLink} onPress={() => setShowCurrencies((v) => !v)}>{showCurrencies ? 'Listo' : 'Cambiar'}</Text>
          </View>
          {showCurrencies ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {CURRENCIES.map((currency) => {
                const active = form.moneda_preferida === currency
                return (
                  <TouchableOpacity key={currency} style={[s.chip, active && s.chipActive]} onPress={() => { update({ moneda_preferida: currency }); setShowCurrencies(false) }}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{currency}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : null}

          {/* Dos casillas separadas a proposito: el consentimiento sobre datos
              personales tiene que ser especifico, no ir mezclado con los terminos. */}
          <CheckRow checked={form.privacy_notice_acknowledged} onChange={(value) => update({ privacy_notice_acknowledged: value })}>
            He leído el <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Aviso de Privacidad</Text> y entiendo cómo Aura tratará mis datos.
          </CheckRow>
          <CheckRow checked={form.terms_accepted} onChange={(value) => update({ terms_accepted: value })}>
            Acepto los <Text style={s.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Términos de Uso</Text> y el descargo financiero.
          </CheckRow>

          <TouchableOpacity style={[s.primary, loading && s.disabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.text} /> : <Text style={s.primaryText}>Crear mi cuenta</Text>}
          </TouchableOpacity>
          <Text style={s.fineprint}>Aura es una herramienta informativa y no reemplaza asesoría financiera profesional.</Text>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>¿Ya tienes cuenta? </Text>
          <Text style={s.footerLink} onPress={() => navigation.navigate('Login')}>Inicia sesión</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
