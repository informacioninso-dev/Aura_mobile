import { Fragment, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg'

import api from '../../api/client'
import { formatMoney, formatMoneyAxis } from '../../utils/formatters'
import { colors } from '../../theme/theme'

const H = 180
const PL = 46
const PR = 10
const PT = 16
const PB = 28
const MIN_WIDTH = 260
const POINT_SPACING = 48
// Meses visibles a la vez. Mismo tamaño de ventana que usa la web.
const WINDOW_MONTHS = 12

const ING_COLOR = colors.success
const GASTO_COLOR = colors.danger

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i)

// Curva suave (Catmull-Rom -> Bezier), similar al type="monotone" del grafico web.
function smoothLinePath(points) {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`
  }
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }
  return d
}

function smoothAreaPath(points, baseY) {
  if (points.length < 2) return ''
  const top = smoothLinePath(points)
  const last = points[points.length - 1]
  const first = points[0]
  return `${top} L${last[0]},${baseY} L${first[0]},${baseY} Z`
}

export default function ProjectionChart({
  data: externalData,
  loading: externalLoading = false,
  showHeader = true,
  advancedProjectionEnabled = false,
  seriesFocus = 'all',
}) {
  const [internalData, setInternalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewportWidth, setViewportWidth] = useState(MIN_WIDTH)
  const [selectedIdx, setSelectedIdx] = useState(null)
  // null = ventana automatica (centrada en hoy); un numero fija el inicio.
  const [windowStartRaw, setWindowStartRaw] = useState(null)
  const usingExternalData = externalData !== undefined

  useEffect(() => {
    if (usingExternalData) {
      setLoading(false)
      return
    }

    let active = true

    api.get('/finanzas/proyeccion-acumulada/?months=6&past_months=2')
      .then(({ data }) => {
        if (active) setInternalData(data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [usingExternalData])

  const data = usingExternalData ? externalData : internalData
  const isLoading = loading || (usingExternalData && externalLoading && !data?.series?.length)

  if (isLoading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!data?.series?.length) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Aun no hay suficiente informacion para mostrar la proyeccion.</Text>
      </View>
    )
  }

  // Con horizontes largos (hasta 10 años) la serie completa no se puede leer de
  // una: se muestra una ventana de 12 meses y se navega con las flechas, igual
  // que la web. Arranca cerca de "hoy", no al inicio del historial.
  const fullSeries = data.series
  const hayVentana = fullSeries.length > WINDOW_MONTHS
  const maxStart = Math.max(0, fullSeries.length - WINDOW_MONTHS)
  const currentIdxFull = fullSeries.findIndex((point) => point.is_current)
  const defaultStart = Math.max(
    0,
    Math.min(maxStart, (currentIdxFull >= 0 ? currentIdxFull : 0) - Math.floor(WINDOW_MONTHS / 3)),
  )
  const windowStart = Math.max(0, Math.min(maxStart, windowStartRaw ?? defaultStart))
  const series = hayVentana
    ? fullSeries.slice(windowStart, windowStart + WINDOW_MONTHS)
    : fullSeries

  const currentIdx = series.findIndex((point) => point.is_current)
  const lastRealIdx = series.reduce((acc, point, index) => (point.is_real ? index : acc), -1)

  // Total disponible este mes: en Pro arrastra el saldo anterior (bola de nieve), en Free es solo el ingreso del mes.
  const chartSeries = series.map((point) => {
    const opening = Number(point.opening_balance ?? 0)
    const ingMes = Number(point.monthly_ingresos ?? 0)
    const gastoMes = Number(point.monthly_gastos ?? 0)
    return {
      label: point.label,
      ingValue: advancedProjectionEnabled ? opening + ingMes : ingMes,
      gastoMes,
      ingMes,
      saldoMes: opening + ingMes - gastoMes,
      isReal: Boolean(point.is_real),
    }
  })

  // Punto activo (el que se muestra en el detalle): el que tocaste o, por
  // defecto, el mes actual.
  const activeIdx = (selectedIdx != null && selectedIdx < chartSeries.length)
    ? selectedIdx
    : (currentIdx >= 0 ? currentIdx : chartSeries.length - 1)
  const activePoint = chartSeries[activeIdx]

  const realIndices = lastRealIdx >= 0 ? range(0, Math.min(lastRealIdx + 1, chartSeries.length - 1)) : []
  const projIndices = lastRealIdx >= 0
    ? range(lastRealIdx, chartSeries.length - 1)
    : range(0, chartSeries.length - 1)

  // El filtro deja ver una curva sola: con las dos juntas, la de menor magnitud
  // queda aplastada contra el eje y no se aprecia su forma.
  const verIngresos = seriesFocus !== 'expense'
  const verGastos = seriesFocus !== 'income'

  // La escala tambien se ajusta a lo visible; si no, al aislar los gastos el eje
  // seguiria estirado por los ingresos y la curva quedaria igual de plana.
  const allValues = chartSeries.flatMap((point) => [
    ...(verIngresos ? [point.ingValue] : []),
    ...(verGastos ? [point.gastoMes] : []),
  ])
  const maxValue = Math.max(...allValues, 0)
  const minValue = Math.min(...allValues, 0)
  const padding = Math.max((maxValue - minValue) * 0.1, maxValue * 0.05, 50)
  const topValue = maxValue + padding
  const bottomValue = Math.min(minValue, 0)
  const valueRange = topValue - bottomValue || 1

  const chartWidth = Math.max(viewportWidth, PL + PR + (Math.max(chartSeries.length - 1, 1) * POINT_SPACING))
  const canScroll = chartWidth > viewportWidth + 8

  const getX = (index) => PL + (index / Math.max(chartSeries.length - 1, 1)) * (chartWidth - PL - PR)
  const getY = (value) => PT + (1 - ((value - bottomValue) / valueRange)) * (H - PT - PB)
  const baseY = getY(0)

  const buildSeries = (indices, key) => {
    if (indices.length < 2) return null
    const points = indices.map((index) => [getX(index), getY(Number(chartSeries[index][key]) || 0)])
    return {
      line: smoothLinePath(points),
      area: smoothAreaPath(points, baseY),
    }
  }

  const ingReal = verIngresos ? buildSeries(realIndices, 'ingValue') : null
  const ingProj = verIngresos ? buildSeries(projIndices, 'ingValue') : null
  const gastoReal = verGastos ? buildSeries(realIndices, 'gastoMes') : null
  const gastoProj = verGastos ? buildSeries(projIndices, 'gastoMes') : null

  const labelStep = Math.max(1, Math.ceil(chartSeries.length / 6))
  const labelIndices = chartSeries
    .map((_, index) => index)
    .filter((index) => (
      index === 0
      || index === chartSeries.length - 1
      || index === currentIdx
      || index % labelStep === 0
    ))

  const yAxisValues = [topValue, (topValue + bottomValue) / 2, bottomValue]

  const containerStyle = showHeader ? s.root : s.embeddedRoot

  return (
    <View
      style={containerStyle}
      onLayout={(event) => {
        const horizontalPadding = showHeader ? 32 : 0
        const nextWidth = Math.max(MIN_WIDTH, event.nativeEvent.layout.width - horizontalPadding)
        if (nextWidth !== viewportWidth) setViewportWidth(nextWidth)
      }}
    >
      {showHeader ? (
        <View style={s.header}>
          <Text style={s.title}>Proyeccion mensual</Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartScroll}>
        <Svg width={chartWidth} height={H}>
          {yAxisValues.map((value, index) => {
            const y = getY(value)
            return (
              <Fragment key={index}>
                <Line x1={PL} y1={y} x2={chartWidth - PR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <SvgText x={4} y={y + 3} fontSize="8" fill="rgba(255,255,255,0.35)" textAnchor="start">
                  {formatMoneyAxis(value)}
                </SvgText>
              </Fragment>
            )
          })}

          {ingReal ? (
            <>
              <Path d={ingReal.area} fill={ING_COLOR} fillOpacity={0.2} stroke="none" />
              <Path d={ingReal.line} fill="none" stroke={ING_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}

          {ingProj ? (
            <>
              <Path d={ingProj.area} fill={ING_COLOR} fillOpacity={0.08} stroke="none" />
              <Path d={ingProj.line} fill="none" stroke={ING_COLOR} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
            </>
          ) : null}

          {gastoReal ? (
            <>
              <Path d={gastoReal.area} fill={GASTO_COLOR} fillOpacity={0.2} stroke="none" />
              <Path d={gastoReal.line} fill="none" stroke={GASTO_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}

          {gastoProj ? (
            <>
              <Path d={gastoProj.area} fill={GASTO_COLOR} fillOpacity={0.08} stroke="none" />
              <Path d={gastoProj.line} fill="none" stroke={GASTO_COLOR} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
            </>
          ) : null}

          {currentIdx >= 0 ? (
            <>
              <Line
                x1={getX(currentIdx)}
                y1={PT}
                x2={getX(currentIdx)}
                y2={H - PB}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <SvgText
                x={getX(currentIdx)}
                y={PT - 4}
                fontSize="8"
                fill="rgba(255,255,255,0.45)"
                textAnchor="middle"
              >
                Hoy
              </SvgText>
            </>
          ) : null}

          {/* Punto activo (tocado o el mes actual): guia + circulos resaltados */}
          {activeIdx >= 0 ? (
            <>
              <Line
                x1={getX(activeIdx)} y1={PT} x2={getX(activeIdx)} y2={H - PB}
                stroke="rgba(196,135,246,0.55)" strokeWidth="1.5"
              />
              <Circle cx={getX(activeIdx)} cy={getY(activePoint.ingValue)} r="5" fill={ING_COLOR} stroke="#0F1B35" strokeWidth="1.5" />
              <Circle cx={getX(activeIdx)} cy={getY(activePoint.gastoMes)} r="5" fill={GASTO_COLOR} stroke="#0F1B35" strokeWidth="1.5" />
            </>
          ) : null}

          {/* Zonas tactiles: tocar cerca de un mes lo selecciona */}
          {chartSeries.map((_, index) => (
            <Rect
              key={`tap-${index}`}
              x={getX(index) - POINT_SPACING / 2}
              y={PT}
              width={POINT_SPACING}
              height={H - PT - PB}
              fill="transparent"
              onPress={() => setSelectedIdx(index)}
            />
          ))}

          {labelIndices.map((index) => (
            <SvgText
              key={index}
              x={getX(index)}
              y={H - 4}
              fontSize="9"
              fill="rgba(255,255,255,0.35)"
              textAnchor="middle"
            >
              {chartSeries[index].label?.split(' ')[0]?.slice(0, 3) || ''}
            </SvgText>
          ))}
        </Svg>
      </ScrollView>

      <View style={s.legend}>
        {verIngresos ? (
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: ING_COLOR }]} />
            <Text style={s.legendText}>Ingresos</Text>
          </View>
        ) : null}
        {verGastos ? (
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: GASTO_COLOR }]} />
            <Text style={s.legendText}>Gastos</Text>
          </View>
        ) : null}
        <Text style={s.legendHint}>Linea solida: real · punteada: proyectado</Text>
      </View>

      {hayVentana ? (
        <View style={s.rangeNav}>
          <TouchableOpacity
            style={[s.rangeBtn, windowStart <= 0 && s.rangeBtnOff]}
            onPress={() => { setWindowStartRaw(Math.max(0, windowStart - WINDOW_MONTHS)); setSelectedIdx(null) }}
            disabled={windowStart <= 0}
          >
            <Text style={s.rangeBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.rangeLabel}>
            {series[0]?.label} — {series[series.length - 1]?.label}
          </Text>
          <TouchableOpacity
            style={[s.rangeBtn, windowStart >= maxStart && s.rangeBtnOff]}
            onPress={() => { setWindowStartRaw(Math.min(maxStart, windowStart + WINDOW_MONTHS)); setSelectedIdx(null) }}
            disabled={windowStart >= maxStart}
          >
            <Text style={s.rangeBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activePoint ? (
        <View style={s.detail}>
          <Text style={s.detailLabel}>
            {activePoint.label}{activeIdx === currentIdx ? ' · Hoy' : activePoint.isReal ? ' · real' : ' · proyectado'}
          </Text>
          <View style={s.detailRow}>
            <Text style={[s.detailVal, { color: ING_COLOR }]}>{formatMoney(activePoint.ingValue)}</Text>
            <Text style={s.detailK}>{advancedProjectionEnabled ? 'disponible' : 'ingresos'}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={[s.detailVal, { color: GASTO_COLOR }]}>{formatMoney(activePoint.gastoMes)}</Text>
            <Text style={s.detailK}>gastos</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={[s.detailVal, { color: activePoint.saldoMes >= 0 ? colors.primary : colors.danger }]}>{formatMoney(activePoint.saldoMes)}</Text>
            <Text style={s.detailK}>te queda</Text>
          </View>
        </View>
      ) : null}

      <Text style={s.scrollHint}>
        Toca la gráfica para ver cada mes.{canScroll ? ' Desliza para ver más.' : ''}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(196,135,246,0.15)',
  },
  embeddedRoot: {
    gap: 6,
  },
  loader: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  chartScroll: {
    paddingBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  legendHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginLeft: 'auto',
  },
  rangeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  rangeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rangeBtnOff: { opacity: 0.3 },
  rangeBtnText: { color: '#fff', fontSize: 17, lineHeight: 19 },
  rangeLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  detail: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(196,135,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(196,135,246,0.18)',
  },
  detailLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  detailVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  detailK: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  scrollHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 2,
  },
})
