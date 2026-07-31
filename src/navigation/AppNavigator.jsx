import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, Text, View, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'

import LoginScreen from '../screens/auth/LoginScreen'
import RegistroScreen from '../screens/auth/RegistroScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen'
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import IngresosScreen from '../screens/ingresos/IngresosScreen'
import GastosScreen from '../screens/gastos/GastosScreen'
import DeferidosScreen from '../screens/diferidos/DeferidosScreen'
import AsistenteScreen from '../screens/asistente/AsistenteScreen'
import PresupuestoScreen from '../screens/presupuesto/PresupuestoScreen'
import SaludFinancieraScreen from '../screens/salud/SaludFinancieraScreen'
import CobrosScreen from '../screens/cobros/CobrosScreen'
import SimuladorScreen from '../screens/simulador/SimuladorScreen'
import PerfilScreen from '../screens/perfil/PerfilScreen'
import ImportarScreen from '../screens/importar/ImportarScreen'
import ReportesScreen from '../screens/reportes/ReportesScreen'
import PlanesScreen from '../screens/planes/PlanesScreen'
import PagoScreen from '../screens/planes/PagoScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const MasStack = createNativeStackNavigator()

// El correo de recuperacion trae uid y token en la URL. Con el scheme "aura"
// declarado en app.json, aura://reset-password?uid=..&token=.. abre la pantalla
// con los datos ya cargados; si el correo se abre en el navegador en vez de la
// app, la pantalla permite pegarlos a mano.
const linking = {
  prefixes: ['aura://'],
  config: {
    screens: {
      Login: 'login',
      Registro: 'registro',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
    },
  },
}

// Los textos legales viven solo en la web: duplicarlos en la app garantiza que
// tarde o temprano queden desincronizados, y en textos legales eso importa.
const PRIVACY_URL = 'https://aura.binnso.com/privacidad'
const TERMS_URL = 'https://aura.binnso.com/terminos'

function MasMenu({ navigation }) {
  const items = [
    { icon: '🛡️', label: 'Salud financiera', screen: 'SaludFinanciera' },
    { icon: '💳', label: 'Cuentas con personas', screen: 'Cobros' },
    { icon: '🎯', label: 'Presupuesto', screen: 'Presupuesto' },
    { icon: '🔮', label: 'Simulador', screen: 'Simulador' },
    { icon: '🧩', label: 'Diferidos', screen: 'Diferidos' },
    { icon: '📥', label: 'Importar movimientos', screen: 'Importar' },
    { icon: '📄', label: 'Reportes', screen: 'Reportes' },
    { icon: '⭐', label: 'Planes', screen: 'Planes' },
    { icon: '👤', label: 'Mi perfil', screen: 'Perfil' },
    { icon: '🔐', label: 'Aviso de Privacidad', url: PRIVACY_URL },
    { icon: '📜', label: 'Términos de Uso', url: TERMS_URL },
  ]
  return (
    <ScrollView style={ms.root} contentContainerStyle={ms.content}>
      <Text style={ms.title}>Más</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.screen || item.url}
          style={ms.item}
          onPress={() => (item.url ? Linking.openURL(item.url) : navigation.navigate(item.screen))}
        >
          <Text style={ms.icon}>{item.icon}</Text>
          <Text style={ms.label}>{item.label}</Text>
          <Text style={ms.arrow}>{item.url ? '↗' : '›'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingTop: 60, gap: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  icon: { fontSize: 22 },
  label: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500' },
  arrow: { color: 'rgba(255,255,255,0.3)', fontSize: 20 },
})

function MasNavigator() {
  return (
    <MasStack.Navigator screenOptions={{ headerShown: false }}>
      <MasStack.Screen name="MasMenu" component={MasMenu} />
      <MasStack.Screen name="SaludFinanciera" component={SaludFinancieraScreen} />
      <MasStack.Screen name="Cobros" component={CobrosScreen} />
      <MasStack.Screen name="Presupuesto" component={PresupuestoScreen} />
      <MasStack.Screen name="Simulador" component={SimuladorScreen} />
      <MasStack.Screen name="Diferidos" component={DeferidosScreen} />
      <MasStack.Screen name="Importar" component={ImportarScreen} />
      <MasStack.Screen name="Reportes" component={ReportesScreen} />
      <MasStack.Screen name="Planes" component={PlanesScreen} />
      <MasStack.Screen name="Pago" component={PagoScreen} />
      <MasStack.Screen name="Perfil" component={PerfilScreen} />
    </MasStack.Navigator>
  )
}

function AuraTabButton({ onPress, accessibilityState }) {
  const focused = accessibilityState?.selected
  return (
    <TouchableOpacity onPress={onPress} style={fab.wrap} activeOpacity={0.85}>
      <View style={[fab.btn, focused && fab.btnActive]}>
        <Text style={fab.icon}>✦</Text>
      </View>
    </TouchableOpacity>
  )
}

const fab = StyleSheet.create({
  wrap: { top: -20, justifyContent: 'center', alignItems: 'center', width: 70 },
  btn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#C487F6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 10,
  },
  btnActive: { backgroundColor: '#C487F6' },
  icon: { fontSize: 22, color: '#fff' },
})

function TabIcon({ name, focused }) {
  const icons = { Dashboard: '📊', Ingresos: '💰', Gastos: '💸', Más: '☰' }
  return <Text style={{ fontSize: focused ? 20 : 17 }}>{icons[name]}</Text>
}

function MainTabs() {
  const insets = useSafeAreaInsets()
  const baseHeight = Platform.OS === 'ios' ? 84 : 60
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: 'rgba(196,135,246,0.15)',
          height: baseHeight + insets.bottom,
        },
        tabBarActiveTintColor: '#C487F6',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Mi dinero' }} />
      <Tab.Screen name="Ingresos" component={IngresosScreen} options={{ tabBarLabel: 'Lo que ganas' }} />
      <Tab.Screen name="Aura" component={AsistenteScreen}
        options={{
          tabBarLabel: 'Aura AI',
          tabBarButton: (props) => <AuraTabButton {...props} />,
        }}
      />
      <Tab.Screen name="Gastos" component={GastosScreen} options={{ tabBarLabel: 'Lo que gastas' }} />
      <Tab.Screen name="Más" component={MasNavigator} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View style={loadingStyles.root}>
        <ActivityIndicator color="#C487F6" size="large" />
        <Text style={loadingStyles.title}>Aura</Text>
        <Text style={loadingStyles.subtitle}>Cargando tu sesión...</Text>
      </View>
    )
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user
          ? <Stack.Screen name="Main" component={MainTabs} />
          : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Registro" component={RegistroScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            </>
          )
        }
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const loadingStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#C487F6',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
})
