import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useAuth } from '../context/AuthContext'

import LoginScreen from '../screens/auth/LoginScreen'
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import IngresosScreen from '../screens/ingresos/IngresosScreen'
import GastosScreen from '../screens/gastos/GastosScreen'
import DeferidosScreen from '../screens/diferidos/DeferidosScreen'
import AsistenteScreen from '../screens/asistente/AsistenteScreen'
import PresupuestoScreen from '../screens/presupuesto/PresupuestoScreen'
import CobrosScreen from '../screens/cobros/CobrosScreen'
import SimuladorScreen from '../screens/simulador/SimuladorScreen'
import PerfilScreen from '../screens/perfil/PerfilScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const MasStack = createNativeStackNavigator()

function MasMenu({ navigation }) {
  const items = [
    { icon: '💳', label: 'Cobros y deudas', screen: 'Cobros' },
    { icon: '🎯', label: 'Presupuesto', screen: 'Presupuesto' },
    { icon: '🔮', label: 'Simulador', screen: 'Simulador' },
    { icon: '🧩', label: 'Diferidos', screen: 'Diferidos' },
    { icon: '👤', label: 'Mi perfil', screen: 'Perfil' },
  ]
  return (
    <ScrollView style={ms.root} contentContainerStyle={ms.content}>
      <Text style={ms.title}>Más</Text>
      {items.map((item) => (
        <TouchableOpacity key={item.screen} style={ms.item} onPress={() => navigation.navigate(item.screen)}>
          <Text style={ms.icon}>{item.icon}</Text>
          <Text style={ms.label}>{item.label}</Text>
          <Text style={ms.arrow}>›</Text>
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
      <MasStack.Screen name="Cobros" component={CobrosScreen} />
      <MasStack.Screen name="Presupuesto" component={PresupuestoScreen} />
      <MasStack.Screen name="Simulador" component={SimuladorScreen} />
      <MasStack.Screen name="Diferidos" component={DeferidosScreen} />
      <MasStack.Screen name="Perfil" component={PerfilScreen} />
    </MasStack.Navigator>
  )
}

function TabIcon({ name, focused }) {
  const icons = { Dashboard: '📊', Ingresos: '💰', Gastos: '💸', Aura: '✨', Más: '☰' }
  return <Text style={{ fontSize: focused ? 20 : 17 }}>{icons[name]}</Text>
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: 'rgba(196,135,246,0.15)' },
        tabBarActiveTintColor: '#C487F6',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Ingresos" component={IngresosScreen} />
      <Tab.Screen name="Gastos" component={GastosScreen} />
      <Tab.Screen name="Aura" component={AsistenteScreen} options={{ tabBarLabel: 'Aura AI' }} />
      <Tab.Screen name="Más" component={MasNavigator} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user
          ? <Stack.Screen name="Main" component={MainTabs} />
          : <Stack.Screen name="Login" component={LoginScreen} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  )
}
