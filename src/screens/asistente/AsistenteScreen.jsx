import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Animated, Easing,
} from 'react-native'
import { Audio } from 'expo-av'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'

const TIPO_LABELS = { ingreso_fijo: 'Ingreso fijo', ingreso_puntual: 'Ingreso puntual', gasto_fijo: 'Gasto fijo', gasto_variable: 'Gasto variable', gasto_puntual: 'Gasto puntual' }
// Los gastos variables viven en el mismo endpoint que los fijos; los distingue tipo_monto.
const ENDPOINT_MAP = { ingreso_fijo: '/finanzas/ingresos/', ingreso_puntual: '/finanzas/ingresos-puntuales/', gasto_fijo: '/finanzas/gastos-corrientes/', gasto_variable: '/finanzas/gastos-corrientes/', gasto_puntual: '/finanzas/gastos-no-corrientes/' }
const TIPOS_RECURRENTES = ['ingreso_fijo', 'gasto_fijo', 'gasto_variable']
const TIPOS_INGRESO = ['ingreso_fijo', 'ingreso_puntual']
const TIPOS_GASTO = ['gasto_fijo', 'gasto_variable', 'gasto_puntual']
const FREQ_LABELS = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }
const CATEGORIAS = ['vivienda','alimentacion','transporte','salud','educacion','entretenimiento','ropa','servicios','tecnologia','deudas','ahorro','otro']

function buildPayload(parsed) {
  const esRecurrente = TIPOS_RECURRENTES.includes(parsed.tipo)
  const esIngreso = TIPOS_INGRESO.includes(parsed.tipo)
  if (esRecurrente) return { descripcion: parsed.descripcion, monto: parseFloat(parsed.monto), frecuencia: parsed.frecuencia || 'mensual', fecha_inicio: parsed.fecha || new Date().toISOString().slice(0, 10), activo: true, ...(!esIngreso && { categoria: parsed.categoria || 'otro' }), ...(parsed.tipo === 'gasto_variable' && { tipo_monto: 'variable' }) }
  return { descripcion: parsed.descripcion, monto: parseFloat(parsed.monto), fecha: parsed.fecha || new Date().toISOString().slice(0, 10), ...(!esIngreso && { categoria: parsed.categoria || 'otro' }) }
}

export default function AsistenteScreen() {
  const [texto, setTexto] = useState('')
  const [grabando, setGrabando] = useState(false)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [edits, setEdits] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const recordingRef = useRef(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (grabando) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.ease, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [grabando])

  useEffect(() => () => {
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {})
      recordingRef.current = null
    }
  }, [])

  const campo = (key) => edits[key] !== undefined ? edits[key] : parsed?.[key]
  const setEditar = (key, val) => setEdits((e) => ({ ...e, [key]: val }))

  function resetear() {
    setTexto('')
    setParsed(null)
    setEdits({})
    setError('')
    setExito(false)
    setGrabando(false)
    setTranscribiendo(false)
    setCargando(false)
    setGuardando(false)
  }

  async function iniciarGrabacion() {
    setError('')
    try {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        setError(canAskAgain
          ? 'Permiso de micrófono denegado. Intentá de nuevo.'
          : 'Habilitá el micrófono en Configuración → Expo Go → Micrófono.')
        return
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })

      const rec = new Audio.Recording()
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await rec.startAsync()
      recordingRef.current = rec
      setGrabando(true)
    } catch (e) { setError('No se pudo iniciar la grabación.') }
  }

  async function detenerGrabacion() {
    if (!recordingRef.current) return
    setGrabando(false)
    setTranscribiendo(true)
    try {
      await recordingRef.current.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      const uri = recordingRef.current.getURI()
      recordingRef.current = null

      const formData = new FormData()
      formData.append('audio', { uri, type: 'audio/m4a', name: 'audio.m4a' })

      const { data } = await api.post('/finanzas/asistente/transcribir/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.texto) setTexto(data.texto)
      else setError('No se pudo transcribir el audio.')
    } catch (e) { setError(getApiErrorMessage(e, 'Error al transcribir.')) }
    finally { setTranscribiendo(false) }
  }

  async function parsear() {
    if (!texto.trim()) return
    setCargando(true); setError('')
    try {
      const { data } = await api.post('/finanzas/asistente/parsear/', { texto })
      setParsed(data); setEdits({})
    } catch (e) { setError(getApiErrorMessage(e, 'No pude entender. Intentá ser más específico.')) }
    finally { setCargando(false) }
  }

  async function confirmar() {
    setGuardando(true); setError('')
    const merged = { ...parsed, ...edits, monto: parseFloat(campo('monto')) || parsed.monto }
    try {
      await api.post(ENDPOINT_MAP[merged.tipo], buildPayload(merged))
      setExito(true)
      setTimeout(resetear, 1600)
    } catch (e) {
      setError(getApiErrorMessage(e, 'No se pudo guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  const esGasto = TIPOS_GASTO.includes(parsed?.tipo)
  const esFijo = TIPOS_RECURRENTES.includes(parsed?.tipo)

  if (exito) return (
    <View style={[s.root, s.center]}>
      <Text style={{ fontSize: 56 }}>✅</Text>
      <Text style={s.exitoText}>¡Registrado!</Text>
    </View>
  )

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>✨ Aura AI</Text>
      <Text style={s.sub}>Hablá o escribí lo que pasó</Text>

      {!parsed ? (
        <>
          {/* Botón de micrófono */}
          <View style={s.micSection}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[s.micBtn, grabando && s.micBtnActive]}
                onPress={grabando ? detenerGrabacion : iniciarGrabacion}
                disabled={transcribiendo}
              >
                {transcribiendo
                  ? <ActivityIndicator color="#fff" size="large" />
                  : <Text style={s.micIcon}>{grabando ? '⏹' : '🎤'}</Text>
                }
              </TouchableOpacity>
            </Animated.View>
            <Text style={s.micLabel}>
              {transcribiendo ? 'Transcribiendo...' : grabando ? 'Tocá para detener' : 'Tocá para hablar'}
            </Text>
          </View>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>o escribí</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Input de texto */}
          <TextInput
            style={s.input}
            placeholder='Ej: "gasté $50 en almuerzo hoy"'
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={texto}
            onChangeText={setTexto}
            multiline
            numberOfLines={3}
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, !texto.trim() && s.btnDisabled]}
            onPress={parsear}
            disabled={!texto.trim() || cargando}
          >
            {cargando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Analizar</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={s.confirmLabel}>Revisá y editá si hace falta:</Text>
          <View style={[s.card, { borderColor: esGasto ? 'rgba(248,113,113,0.3)' : 'rgba(16,185,129,0.3)' }]}>
            <Text style={[s.tipo, { color: esGasto ? '#F87171' : '#10B981' }]}>{TIPO_LABELS[parsed.tipo]}</Text>

            <Text style={s.fieldLabel}>Descripción</Text>
            <TextInput style={s.fieldInput} value={campo('descripcion') || ''} onChangeText={(v) => setEditar('descripcion', v)} placeholderTextColor="rgba(255,255,255,0.3)" />

            <Text style={s.fieldLabel}>Monto</Text>
            <TextInput style={s.fieldInput} value={String(campo('monto') || '')} onChangeText={(v) => setEditar('monto', v)} keyboardType="numeric" />

            {esGasto && (
              <>
                <Text style={s.fieldLabel}>Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {CATEGORIAS.map((c) => (
                      <TouchableOpacity key={c} onPress={() => setEditar('categoria', c)} style={[s.chip, campo('categoria') === c && s.chipActive]}>
                        <Text style={[s.chipText, campo('categoria') === c && s.chipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {esFijo && (
              <>
                <Text style={s.fieldLabel}>Frecuencia</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {Object.entries(FREQ_LABELS).map(([v, l]) => (
                      <TouchableOpacity key={v} onPress={() => setEditar('frecuencia', v)} style={[s.chip, campo('frecuencia') === v && s.chipActive]}>
                        <Text style={[s.chipText, campo('frecuencia') === v && s.chipTextActive]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={s.row}>
            <TouchableOpacity style={s.btnSecondary} onPress={resetear}>
              <Text style={s.btnSecondaryText}>Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnFlex]} onPress={confirmar} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirmar</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { color: '#C487F6', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 28 },
  micSection: { alignItems: 'center', marginBottom: 24, gap: 12 },
  micBtn: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(139,92,246,0.2)', borderWidth: 2, borderColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: 'rgba(248,113,113,0.2)', borderColor: '#F87171' },
  micIcon: { fontSize: 36 },
  micLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, marginBottom: 12, minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnFlex: { flex: 2 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 15, alignItems: 'center', marginRight: 10 },
  btnSecondaryText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  confirmLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 12 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16, gap: 4 },
  tipo: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  fieldLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 4 },
  fieldInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  error: { color: '#F87171', fontSize: 13, marginBottom: 10 },
  row: { flexDirection: 'row' },
  exitoText: { color: '#10B981', fontSize: 20, fontWeight: '700', marginTop: 12 },
})
