import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Switch } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { useBiometrics } from '../../hooks/useBiometrics'
import { useTopInset } from '../../hooks/useTopInset'

export default function PerfilScreen({ navigation }) {
  const { user, logout } = useAuth()
  const { disponible, habilitado, tipo, toggleHabilitado } = useBiometrics()
  const [seccion, setSeccion] = useState(null)
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function cambiarPassword() {
    if (newPass !== newPass2) { setMsg('Las contraseñas no coinciden.'); return }
    if (newPass.length < 8) { setMsg('Mínimo 8 caracteres.'); return }
    setLoading(true); setMsg('')
    try {
      await api.post('/usuarios/password/change/', { old_password: oldPass, new_password: newPass })
      setMsg('✅ Contraseña actualizada.')
      setOldPass(''); setNewPass(''); setNewPass2('')
      setSeccion(null)
    } catch (e) { setMsg(getApiErrorMessage(e, 'Error al cambiar contraseña.')) }
    finally { setLoading(false) }
  }

  const plan = user?.plan?.name || 'Gratuito'
  const planColor = plan.toLowerCase().includes('pro') ? '#C487F6' : 'rgba(255,255,255,0.4)'
  const topPad = useTopInset()

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: topPad }]}>
      <Text style={s.title}>Mi perfil</Text>

      {/* Avatar */}
      <View style={s.avatar}>
        <Text style={s.avatarText}>{(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}</Text>
      </View>
      <Text style={s.nombre}>{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Usuario'}</Text>
      <Text style={s.email}>{user?.email}</Text>
      <View style={s.planBadge}>
        <Text style={[s.planText, { color: planColor }]}>Plan {plan}</Text>
      </View>

      {/* Secciones */}
      <View style={s.secciones}>
        <MenuItem icon="🔑" label="Cambiar contraseña" onPress={() => setSeccion(seccion === 'pass' ? null : 'pass')} active={seccion === 'pass'} />

        {disponible && (
          <View style={[s.menuItem, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={s.menuIcon}>{tipo === 'Face ID' ? '😊' : '🔒'}</Text>
              <Text style={s.menuLabel}>{tipo || 'Biometría'}</Text>
            </View>
            <Switch
              value={habilitado}
              onValueChange={toggleHabilitado}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(139,92,246,0.5)' }}
              thumbColor={habilitado ? '#8B5CF6' : 'rgba(255,255,255,0.4)'}
            />
          </View>
        )}

        {seccion === 'pass' && (
          <View style={s.subForm}>
            <TextInput style={s.input} placeholder="Contraseña actual" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={oldPass} onChangeText={setOldPass} />
            <TextInput style={s.input} placeholder="Nueva contraseña" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={newPass} onChangeText={setNewPass} />
            <TextInput style={s.input} placeholder="Confirmar nueva" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={newPass2} onChangeText={setNewPass2} />
            {msg ? <Text style={[s.msg, { color: msg.startsWith('✅') ? '#10B981' : '#F87171' }]}>{msg}</Text> : null}
            <TouchableOpacity style={s.btn} onPress={cambiarPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        )}

        <MenuItem icon="⭐" label="Ver planes" onPress={() => navigation.navigate('Planes')} />
        <MenuItem icon="📊" label="Modo de proyección" onPress={() => Alert.alert('Proyección', `Modo actual: ${user?.projection_mode || 'automática'}`)} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('Cerrar sesión', '¿Salir de Aura?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: logout }])}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={s.version}>Aura v1.0 · aura.binnso.com</Text>
    </ScrollView>
  )
}

function MenuItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity style={[s.menuItem, active && s.menuItemActive]} onPress={onPress}>
      <Text style={s.menuIcon}>{icon}</Text>
      <Text style={s.menuLabel}>{label}</Text>
      <Text style={s.menuArrow}>{active ? '▲' : '›'}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24, alignSelf: 'flex-start' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  nombre: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  email: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 10 },
  planBadge: { backgroundColor: 'rgba(196,135,246,0.12)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 5, marginBottom: 28 },
  planText: { fontSize: 13, fontWeight: '700' },
  secciones: { width: '100%', gap: 2, marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, gap: 12 },
  menuItemActive: { backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, color: '#fff', fontSize: 15 },
  menuArrow: { color: 'rgba(255,255,255,0.3)', fontSize: 16 },
  subForm: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, gap: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14 },
  msg: { fontSize: 13 },
  btn: { backgroundColor: '#8B5CF6', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  logoutBtn: { backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 20 },
  logoutText: { color: '#F87171', fontWeight: '700', fontSize: 15 },
  version: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
})
