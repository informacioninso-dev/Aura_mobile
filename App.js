import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import AppNavigator from './src/navigation/AppNavigator'

SplashScreen.preventAutoHideAsync().catch(() => {})

function AppContent() {
  const { loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loading])

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
