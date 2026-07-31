import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { formatMoney, formatDate } from '../../utils/formatters'
import { useTopInset } from '../../hooks/useTopInset'
import ScreenHeader from '../../components/ui/ScreenHeader'

const TEMPLATE_CSV = `fecha,descripcion,monto,tipo,categoria
2025-12-01,Sueldo diciembre,1500000,ingreso,
2025-12-05,Supermercado,-85000,gasto,alimentacion
2025-12-10,Arriendo,-600000,gasto,vivienda
2025-12-15,Freelance,200000,ingreso,
2025-12-20,Farmacia,-32000,gasto,salud`

function FilaItem({ fila, selected, onToggle }) {
  const esIngreso = fila.tipo === 'ingreso'
  const color = esIngreso ? '#10B981' : '#F87171'
  return (
    <TouchableOpacity style={[s.filaRow, !selected && s.filaRowOff]} onPress={onToggle} activeOpacity={0.7}>
      <View style={[s.checkbox, selected && s.checkboxOn]}>
        {selected && <Text style={s.checkboxMark}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.filaDesc} numberOfLines={1}>{fila.descripcion}</Text>
        <Text style={s.filaMeta}>
          {formatDate(fila.fecha)}{fila.categoria ? ` · ${fila.categoria}` : ''}
        </Text>
      </View>
      <Text style={[s.filaMonto, { color }]}>
        {esIngreso ? '+' : '-'}{formatMoney(Math.abs(Number(fila.monto)))}
      </Text>
    </TouchableOpacity>
  )
}

export default function ImportarScreen() {
  const [fase, setFase] = useState('upload')
  const [archivo, setArchivo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [seleccion, setSeleccion] = useState([])
  const [resultado, setResultado] = useState(null)

  async function descargarPlantilla() {
    try {
      const file = new File(Paths.cache, 'plantilla_aura.csv')
      file.create({ overwrite: true })
      file.write(TEMPLATE_CSV)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Plantilla Aura' })
      } else {
        Alert.alert('Plantilla guardada', file.uri)
      }
    } catch {
      Alert.alert('Error', 'No se pudo generar la plantilla.')
    }
  }

  async function seleccionarArchivo() {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
    if (res.canceled) return
    const asset = res.assets[0]
    const ext = asset.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx'].includes(ext)) {
      setError('Solo se aceptan archivos .csv o .xlsx')
      return
    }
    setError('')
    setArchivo(asset)
  }

  async function subirArchivo() {
    if (!archivo) return
    setCargando(true)
    setError('')
    try {
      const ext = archivo.name.split('.').pop()?.toLowerCase()
      const mimeType = archivo.mimeType
        || (ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const formData = new FormData()
      formData.append('archivo', { uri: archivo.uri, name: archivo.name, type: mimeType })

      const { data } = await api.post('/finanzas/importar/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setPreview(data)
      setSeleccion(data.filas_ok.map((_, index) => index))
      setFase('preview')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al procesar el archivo'))
    } finally {
      setCargando(false)
    }
  }

  function toggleFila(index) {
    setSeleccion((prev) => (
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    ))
  }

  function toggleTodo() {
    if (!preview) return
    setSeleccion((prev) => (
      prev.length === preview.filas_ok.length ? [] : preview.filas_ok.map((_, i) => i)
    ))
  }

  async function confirmar() {
    setCargando(true)
    setError('')
    try {
      const filas = seleccion.map((index) => preview.filas_ok[index])
      const { data } = await api.post('/finanzas/importar/confirmar/', { filas })
      setResultado(data)
      setFase('confirmado')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al importar'))
    } finally {
      setCargando(false)
    }
  }

  function reiniciar() {
    setFase('upload')
    setArchivo(null)
    setPreview(null)
    setSeleccion([])
    setResultado(null)
    setError('')
  }

  const topPad = useTopInset()

  if (fase === 'confirmado' && resultado) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.successIcon}>✅</Text>
        <Text style={s.successTitle}>Todo importado</Text>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: '#10B981' }]}>{resultado.ingresos_creados}</Text>
            <Text style={s.statLabel}>ingresos puntuales</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: '#F87171' }]}>{resultado.gastos_creados}</Text>
            <Text style={s.statLabel}>gastos puntuales</Text>
          </View>
        </View>
        <Text style={s.successHint}>
          Los movimientos del archivo se guardan como puntuales en su fecha original.
          Así no se vuelven recurrentes ni alteran tus meses futuros.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={reiniciar}>
          <Text style={s.primaryBtnText}>Importar otro archivo</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (fase === 'preview' && preview) {
    const todoSeleccionado = seleccion.length === preview.filas_ok.length && preview.filas_ok.length > 0

    return (
      <View style={[s.root, { paddingTop: topPad }]}>
        <FlatList
          data={preview.filas_ok}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 140 }}
          ListHeaderComponent={(
            <View style={{ marginBottom: 12 }}>
              <Text style={s.title}>Revisar importación</Text>
              <Text style={s.sub}>
                {preview.total} filas detectadas, {preview.filas_ok.length} válidas, {preview.filas_error.length} con error.
                Límite: {preview.max_filas_permitidas} filas.
              </Text>

              {!!preview.mapa_columnas && (
                <View style={s.chipsWrap}>
                  {Object.entries(preview.mapa_columnas).map(([campo, columna]) => (
                    <View key={campo} style={s.chip}>
                      <Text style={s.chipText}><Text style={{ color: '#C487F6' }}>{campo}</Text> ← {columna}</Text>
                    </View>
                  ))}
                </View>
              )}

              {preview.filas_ok.length > 0 && (
                <View style={s.filasHeader}>
                  <Text style={s.filasHeaderText}>Filas válidas ({preview.filas_ok.length})</Text>
                  <TouchableOpacity onPress={toggleTodo}>
                    <Text style={s.linkText}>{todoSeleccionado ? 'Deseleccionar todo' : 'Seleccionar todo'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          renderItem={({ item, index }) => (
            <FilaItem fila={item} selected={seleccion.includes(index)} onToggle={() => toggleFila(index)} />
          )}
          ListEmptyComponent={<Text style={s.empty}>No hay filas válidas para importar.</Text>}
          ListFooterComponent={preview.filas_error.length > 0 ? (
            <View style={s.errorCard}>
              <Text style={s.errorTitle}>Filas con error ({preview.filas_error.length}) - no se importarán</Text>
              {preview.filas_error.slice(0, 5).map((filaError, index) => (
                <Text key={index} style={s.errorLine}>Fila {filaError.fila}: {filaError.error}</Text>
              ))}
              {preview.filas_error.length > 5 && (
                <Text style={s.errorMore}>...y {preview.filas_error.length - 5} más</Text>
              )}
            </View>
          ) : null}
        />

        {!!error && <Text style={s.errorMsg}>{error}</Text>}

        <View style={s.footerBar}>
          <TouchableOpacity style={s.secondaryBtn} onPress={reiniciar}>
            <Text style={s.secondaryBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.primaryBtn, { flex: 1 }, (cargando || seleccion.length === 0) && s.btnDisabled]}
            onPress={confirmar}
            disabled={cargando || seleccion.length === 0}
          >
            {cargando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>Importar {seleccion.length} filas</Text>}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Importar movimientos" subtitle="Sube tu estado de cuenta o tu planilla de movimientos en Excel o CSV." />

      <TouchableOpacity style={s.card} onPress={descargarPlantilla}>
        <Text style={s.cardIcon}>📄</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Descargar plantilla CSV</Text>
          <Text style={s.cardHint}>Usa este formato como referencia</Text>
        </View>
        <Text style={s.cardArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.card} onPress={seleccionarArchivo}>
        <Text style={s.cardIcon}>📁</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{archivo ? archivo.name : 'Seleccionar archivo'}</Text>
          <Text style={s.cardHint}>{archivo ? 'Listo para subir' : 'Formatos .csv o .xlsx'}</Text>
        </View>
        <Text style={s.cardArrow}>›</Text>
      </TouchableOpacity>

      {!!error && <Text style={s.errorMsg}>{error}</Text>}

      <TouchableOpacity
        style={[s.primaryBtn, (!archivo || cargando) && s.btnDisabled]}
        onPress={subirArchivo}
        disabled={!archivo || cargando}
      >
        {cargando
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.primaryBtnText}>Subir y previsualizar</Text>}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 16 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 2 },
  sub: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 10,
  },
  cardIcon: { fontSize: 22 },
  cardTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cardHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  cardArrow: { color: 'rgba(196,135,246,0.6)', fontSize: 22 },
  primaryBtn: {
    backgroundColor: '#8B5CF6', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  errorMsg: { color: '#F87171', fontSize: 13, marginBottom: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  filasHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, marginBottom: 4,
  },
  filasHeaderText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  linkText: { color: '#C487F6', fontSize: 12, fontWeight: '600' },
  filaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  filaRowOff: { opacity: 0.4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filaDesc: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filaMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  filaMonto: { fontWeight: '700', fontSize: 13 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 24 },
  errorCard: {
    backgroundColor: 'rgba(248,113,113,0.05)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.15)', marginTop: 12,
  },
  errorTitle: { color: '#F87171', fontWeight: '700', fontSize: 13, marginBottom: 6 },
  errorLine: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 },
  errorMore: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  footerBar: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    flexDirection: 'row', gap: 10,
  },
  successIcon: { fontSize: 48 },
  successTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 32, marginVertical: 8 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },
  successHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
})
