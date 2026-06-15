import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'
import { formatMoney } from '../../utils/formatters'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, amount) {
  return startOfMonth(new Date(date.getFullYear(), date.getMonth() + amount, 1))
}

function escapeCsvValue(value) {
  if (value == null) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function bytesToString(bytes) {
  let result = ''
  for (let i = 0; i < bytes.length; i += 1) result += String.fromCharCode(bytes[i])
  return result
}

async function compartirArchivo(file, mimeType, dialogTitle) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle })
  } else {
    Alert.alert('Archivo guardado', file.uri)
  }
}

function SummaryCard({ label, value, color, isPercent = false, signed = false }) {
  const num = Number(value)
  let display = isPercent ? `${num}%` : formatMoney(num)
  if (signed && num >= 0) display = `+${display}`
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, { color }]}>{display}</Text>
    </View>
  )
}

function MiniCard({ label, value }) {
  return (
    <View style={s.miniCard}>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={s.miniValue}>{formatMoney(Number(value))}</Text>
    </View>
  )
}

export default function ReportesScreen() {
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const anio = selectedMonth.getFullYear()
  const mes = selectedMonth.getMonth() + 1
  const monthLabel = `${MESES[selectedMonth.getMonth()]} ${anio}`

  const cargar = useCallback(() => {
    setLoading(true)
    setError('')
    api.get(`/finanzas/reporte/?anio=${anio}&mes=${mes}`)
      .then(({ data: response }) => setData(response))
      .catch((err) => {
        setData(null)
        setError(getApiErrorMessage(err, 'No se pudo cargar el reporte.'))
      })
      .finally(() => setLoading(false))
  }, [anio, mes])

  useEffect(() => { cargar() }, [cargar])

  async function descargarCSV() {
    if (!data || exportingCsv) return
    setExportingCsv(true)
    try {
      const filas = [
        ['Categoria', 'Total', 'Limite', '% del limite'],
        ...data.categorias.map((c) => [c.categoria, c.total, c.limite ?? '', c.pct_limite != null ? `${c.pct_limite}%` : '']),
        [],
        ['Resumen', ''],
        ['Total ingresos', data.resumen.total_ingresos],
        ['Ingresos fijos', data.resumen.ingresos_fijos],
        ['Ingresos puntuales', data.resumen.ingresos_puntuales],
        ['Total gastos', data.resumen.total_gastos],
        ['Balance', data.resumen.balance],
        ['Tasa de ahorro', `${data.resumen.tasa_ahorro}%`],
        ['Gastos fijos', data.resumen.gastos_corrientes],
        ['Gastos a cuotas', data.resumen.cuotas],
        ['Gastos puntuales', data.resumen.gastos_puntuales],
      ]
      const csv = filas.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')

      const file = new File(Paths.cache, `reporte_${anio}_${String(mes).padStart(2, '0')}.csv`)
      file.create({ overwrite: true })
      file.write(`﻿${csv}`)
      await compartirArchivo(file, 'text/csv', 'Reporte Aura')
    } catch {
      Alert.alert('Error', 'No se pudo generar el CSV.')
    } finally {
      setExportingCsv(false)
    }
  }

  async function descargarPDF() {
    if (!data || exportingPdf) return
    setExportingPdf(true)
    try {
      const response = await api.get(`/finanzas/reporte/pdf/?anio=${anio}&mes=${mes}`, { responseType: 'arraybuffer' })
      const file = new File(Paths.cache, `reporte_${anio}_${String(mes).padStart(2, '0')}.pdf`)
      file.create({ overwrite: true })
      file.write(new Uint8Array(response.data))
      await compartirArchivo(file, 'application/pdf', 'Reporte Aura')
    } catch (err) {
      let message = 'No se pudo generar el PDF.'
      const respData = err?.response?.data
      if (respData instanceof ArrayBuffer) {
        try {
          const parsed = JSON.parse(bytesToString(new Uint8Array(respData)))
          message = parsed?.error || parsed?.detail || message
        } catch { /* ignore */ }
      } else {
        message = getApiErrorMessage(err, message)
      }
      Alert.alert('Error', message)
    } finally {
      setExportingPdf(false)
    }
  }

  const balanceColor = data ? (data.resumen.balance >= 0 ? '#10B981' : '#F87171') : '#fff'

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 60 }}>
      <Text style={s.title}>Reportes</Text>
      <Text style={s.sub}>Así se movió tu mes</Text>

      <View style={s.monthSwitcher}>
        <TouchableOpacity style={s.monthNavBtn} onPress={() => setSelectedMonth((cur) => addMonths(cur, -1))}>
          <Text style={s.monthNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity style={s.monthNavBtn} onPress={() => setSelectedMonth((cur) => addMonths(cur, 1))}>
          <Text style={s.monthNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {data && (
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionBtn, s.actionBtnPrimary, (exportingCsv || exportingPdf) && s.btnDisabled]}
            onPress={descargarCSV}
            disabled={exportingCsv || exportingPdf}
          >
            {exportingCsv ? <ActivityIndicator color="#fff" /> : <Text style={s.actionBtnText}>📊 Descargar CSV</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, s.actionBtnSecondary, (exportingCsv || exportingPdf) && s.btnDisabled]}
            onPress={descargarPDF}
            disabled={exportingCsv || exportingPdf}
          >
            {exportingPdf ? <ActivityIndicator color="#C487F6" /> : <Text style={s.actionBtnTextSecondary}>📄 Descargar PDF</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color="#C487F6" />
        </View>
      )}

      {!loading && !!error && <Text style={s.errorMsg}>{error}</Text>}

      {!loading && data && (
        <>
          <View style={s.grid2}>
            <SummaryCard label="Ingresos" value={data.resumen.total_ingresos} color="#10B981" />
            <SummaryCard label="Gastos" value={data.resumen.total_gastos} color="#F87171" />
            <SummaryCard label="Balance" value={data.resumen.balance} color={balanceColor} signed />
            <SummaryCard label="Tasa de ahorro" value={data.resumen.tasa_ahorro} color="#C487F6" isPercent />
          </View>

          <View style={s.grid2}>
            <MiniCard label="Ingresos fijos" value={data.resumen.ingresos_fijos} />
            <MiniCard label="Ingresos puntuales" value={data.resumen.ingresos_puntuales} />
            <MiniCard label="Gastos fijos" value={data.resumen.gastos_corrientes} />
            <MiniCard label="Gastos a cuotas" value={data.resumen.cuotas} />
            <MiniCard label="Gastos puntuales" value={data.resumen.gastos_puntuales} />
          </View>

          {data.categorias.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Gastos por categoría</Text>
              {data.categorias.map((cat) => {
                const pct = cat.pct_limite
                const barColor = pct == null ? '#C487F6' : pct >= 100 ? '#F87171' : pct >= 75 ? '#FBBF24' : '#10B981'
                return (
                  <View key={cat.categoria} style={s.catRow}>
                    <View style={s.catHeader}>
                      <Text style={s.catNombre}>{cat.icono} {cat.categoria}</Text>
                      <Text style={s.catMonto}>
                        {formatMoney(Number(cat.total))}
                        {cat.limite != null && <Text style={s.catLimite}> / {formatMoney(Number(cat.limite))}</Text>}
                      </Text>
                    </View>
                    {cat.limite != null && (
                      <View style={s.barBg}>
                        <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )}

          {data.top_gastos.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Gastos puntuales más altos</Text>
              {data.top_gastos.map((gasto, index) => (
                <View key={index} style={s.gastoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.gastoDesc} numberOfLines={1}>{gasto.descripcion}</Text>
                    <Text style={s.gastoMeta}>{gasto.categoria} · {gasto.fecha}</Text>
                  </View>
                  <Text style={s.gastoMonto}>{formatMoney(Number(gasto.monto))}</Text>
                </View>
              ))}
            </View>
          )}

          {data.categorias.length === 0 && data.top_gastos.length === 0 && (
            <Text style={s.empty}>No hubo movimientos en {MESES[selectedMonth.getMonth()].toLowerCase()} {anio}.</Text>
          )}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { paddingVertical: 40, alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 2 },
  sub: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 },
  monthSwitcher: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 10, marginBottom: 12,
  },
  monthNavBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  monthNavArrow: { color: '#C487F6', fontSize: 24, lineHeight: 26 },
  monthLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimary: { backgroundColor: '#8B5CF6' },
  actionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(196,135,246,0.3)' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtnTextSecondary: { color: '#C487F6', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  errorMsg: { color: '#F87171', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  miniCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  miniLabel: { color: 'rgba(255,255,255,0.40)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  miniValue: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16,
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 14 },
  catRow: { marginBottom: 14 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  catNombre: { color: '#fff', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  catMonto: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  catLimite: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  barBg: { height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  gastoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  gastoDesc: { color: '#fff', fontSize: 13, fontWeight: '600' },
  gastoMeta: { color: 'rgba(255,255,255,0.40)', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  gastoMonto: { color: '#F87171', fontWeight: '700', fontSize: 13, marginLeft: 10 },
  empty: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 24 },
})
