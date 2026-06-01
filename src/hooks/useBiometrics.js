import { useEffect, useState } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BIOMETRICS_KEY = 'aura_biometrics_enabled'

export function useBiometrics() {
  const [disponible, setDisponible] = useState(false)
  const [habilitado, setHabilitado] = useState(false)
  const [tipo, setTipo] = useState(null)

  useEffect(() => {
    async function verificar() {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrollado = await LocalAuthentication.isEnrolledAsync()
      const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync()
      const guardado = await AsyncStorage.getItem(BIOMETRICS_KEY)

      setDisponible(compatible && enrollado)
      setHabilitado(guardado === 'true')

      if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setTipo('Face ID')
      else if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setTipo('Huella')
      else setTipo('Biometría')
    }
    verificar()
  }, [])

  async function toggleHabilitado() {
    const nuevo = !habilitado
    await AsyncStorage.setItem(BIOMETRICS_KEY, String(nuevo))
    setHabilitado(nuevo)
    return nuevo
  }

  async function autenticar() {
    if (!disponible || !habilitado) return true
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirmá tu identidad para entrar a Aura',
      fallbackLabel: 'Usar contraseña',
      cancelLabel: 'Cancelar',
    })
    return result.success
  }

  return { disponible, habilitado, tipo, toggleHabilitado, autenticar }
}
