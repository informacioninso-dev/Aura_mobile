import { useState } from 'react'
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { colors } from '../../theme/theme'
import s from './authStyles'

const LOGO = require('../../../assets/logo-mark.png')

// Marca de las pantallas de acceso: el mismo logo de la web y del ícono de la
// app. Va sobre una placa clara porque la barra azul marino de la "A" no se ve
// sobre el fondo oscuro.
export function AuthBrand({ title, subtitle }) {
  return (
    <View style={b.wrap}>
      <View style={b.plate}>
        <Image source={LOGO} style={b.logo} resizeMode="contain" accessibilityLabel="Aura" />
      </View>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {subtitle ? <Text style={[s.subtitle, b.subtitle]}>{subtitle}</Text> : null}
    </View>
  )
}

// Campo de contraseña con "Mostrar": reemplaza al de "Confirma tu contraseña",
// que obligaba a escribirla dos veces sin poder verla.
export function PasswordInput({ value, onChangeText, placeholder, autoComplete, onSubmitEditing }) {
  const [visible, setVisible] = useState(false)
  return (
    <View style={s.passWrap}>
      <TextInput
        style={s.passInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === 'new-password' ? 'newPassword' : 'password'}
        onSubmitEditing={onSubmitEditing}
      />
      <TouchableOpacity
        style={s.passToggle}
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Text style={s.passToggleText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const b = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, marginBottom: 10 },
  plate: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: colors.logoPlate,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  logo: { width: 48, height: 42 },
  subtitle: { marginTop: -4 },
})
