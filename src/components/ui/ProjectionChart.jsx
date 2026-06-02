import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg'

import api from '../../api/client'
import { formatMoney } from '../../utils/formatters'

const H = 176
const PL = 10
const PR = 10
const PT = 12
const PB = 32
const MIN_WIDTH = 260
const POINT_SPACING = 48

export default function ProjectionChart({
  data: externalData,
  loading: externalLoading = false,
  showHeader = true,
}) {
  const [internalData, setInternalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewportWidth, setViewportWidth] = useState(MIN_WIDTH)
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
        <ActivityIndicator color="#C487F6" />
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

  const series = data.series
  const values = series.map((point) => Number(point.closing_balance) || 0)
  const currentIdx = series.findIndex((point) => point.is_current)
  const lastRealIdx = series.reduce((acc, point, index) => (point.is_real ? index : acc), -1)
  const projectedSeries = series.filter((point) => !point.is_real)
  const lastProj = projectedSeries.length ? projectedSeries[projectedSeries.length - 1] : null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const baseRange = max - min
  const padding = baseRange === 0 ? Math.max(Math.abs(max) * 0.1, 100) : baseRange * 0.12
  const minValue = min - padding
  const maxValue = max + padding
  const range = maxValue - minValue || 1
  const chartWidth = Math.max(viewportWidth, PL + PR + (Math.max(series.length - 1, 1) * POINT_SPACING))
  const canScroll = chartWidth > viewportWidth + 8

  const getX = (index) => PL + (index / Math.max(series.length - 1, 1)) * (chartWidth - PL - PR)
  const getY = (value) => PT + (1 - ((value - minValue) / range)) * (H - PT - PB)

  const realPoints = lastRealIdx >= 0
    ? series
      .slice(0, lastRealIdx + 2)
      .map((point, index) => `${getX(index)},${getY(Number(point.closing_balance) || 0)}`)
      .join(' ')
    : ''

  const projectionStartIndex = lastRealIdx >= 0 ? lastRealIdx : 0
  const projPoints = series
    .slice(projectionStartIndex)
    .map((point, index) => `${getX(projectionStartIndex + index)},${getY(Number(point.closing_balance) || 0)}`)
    .join(' ')

  const labelStep = Math.max(1, Math.ceil(series.length / 6))
  const labelIndices = series
    .map((_, index) => index)
    .filter((index) => (
      index === 0
      || index === series.length - 1
      || index === currentIdx
      || index % labelStep === 0
    ))

  const allPositive = values.every((value) => value >= 0)
  const color = allPositive ? '#10B981' : '#F87171'
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
          <Text style={s.title}>Proyeccion de saldo</Text>
          {lastProj ? (
            <Text style={[s.final, { color: Number(lastProj.closing_balance) >= 0 ? '#10B981' : '#F87171' }]}>
              {formatMoney(lastProj.closing_balance)}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartScroll}>
        <Svg width={chartWidth} height={H}>
          {minValue < 0 && maxValue > 0 ? (
            <Line
              x1={PL}
              y1={getY(0)}
              x2={chartWidth - PR}
              y2={getY(0)}
              stroke="rgba(248,113,113,0.28)"
              strokeWidth="1"
              strokeDasharray="4,3"
            />
          ) : null}

          {projPoints.split(' ').filter(Boolean).length >= 2 ? (
            <Polyline
              points={projPoints}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.6"
            />
          ) : null}

          {realPoints.split(' ').filter(Boolean).length >= 2 ? (
            <Polyline
              points={realPoints}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
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
                y={PT - 2}
                fontSize="8"
                fill="rgba(255,255,255,0.45)"
                textAnchor="middle"
              >
                Hoy
              </SvgText>
            </>
          ) : null}

          {labelIndices.map((index) => (
            <SvgText
              key={index}
              x={getX(index)}
              y={H - 4}
              fontSize="9"
              fill="rgba(255,255,255,0.35)"
              textAnchor="middle"
            >
              {series[index].label?.split(' ')[0]?.slice(0, 3) || ''}
            </SvgText>
          ))}

          {currentIdx >= 0 ? (
            <Circle
              cx={getX(currentIdx)}
              cy={getY(values[currentIdx])}
              r="4"
              fill={color}
            />
          ) : null}
        </Svg>
      </ScrollView>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: color }]} />
          <Text style={s.legendText}>Real</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: color, opacity: 0.5 }]} />
          <Text style={s.legendText}>Proyectado</Text>
        </View>
        {currentIdx >= 0 ? (
          <Text style={s.hoy}>Hoy: {formatMoney(values[currentIdx])}</Text>
        ) : null}
      </View>

      {canScroll ? (
        <Text style={s.scrollHint}>Desliza la grafica para ver mas meses.</Text>
      ) : null}
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
    color: 'rgba(255,255,255,0.4)',
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  final: {
    fontWeight: '700',
    fontSize: 14,
  },
  chartScroll: {
    paddingBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
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
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  hoy: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginLeft: 'auto',
  },
  scrollHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 2,
  },
})
