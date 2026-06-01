import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider } from './src/context/AuthContext'
import AppNavigator from './src/navigation/AppNavigator'

SplashScreen.preventAutoHideAsync()

export default function App() {
  useEffect(() => {
    // Oculta el splash después de que el navigator esté listo
    const timer = setTimeout(() => SplashScreen.hideAsync(), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </AuthProvider>
  )
}
