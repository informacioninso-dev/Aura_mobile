import { useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'

import { formatMoney, formatMoneyAxis } from '../../utils/formatters'
import { colors } from '../../theme/theme'

const H = 200
const PT = 14
const PB = 22
const PL = 4
const PR = 4

/**
 * Saldo de cierre mes a mes, para tocar y arrastrar: el dedo elige el mes y
 * arriba se lee cuánto tendrías, cuánto entra y cuánto sale. Si hay una
 * simulación activa, se dibuja encima como segunda línea.
 *
 * points: [{ key, label, short, balance, simBalance?, ingresos, gastos, simGastos?, isReal, isCurrent }]
 * onScrubChange(bool): avisa al ScrollView padre para que no robe el gesto.
 */
export default function BalanceChart({ points, selected, onSelect, onScrubChange, hasSim = false }) {
  const [width, setWidth] = useState(0)
  const n = points.length
  const plotW = Math.max(1, width - PL - PR)

  const { min, max } = useMemo(() => {
    const vals = points.flatMap((p) => (hasSim && p.simBalance != null ? [p.balance, p.simBalance] : [p.balance]))
    const lo = Math.min(...vals, 0)
    const hi = Math.max(...vals, 0)
    const pad = Math.max((hi - lo) * 0.08, 1)
    return { min: lo - (lo < 0 ? pad : 0), max: hi + pad }
  }, [points, hasSim])

  const x = (i) => PL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v) => PT + (1 - (v - min) / (max - min || 1)) * (H - PT - PB)
  const zeroY = y(0)

  const idxFromX = (px) => {
    if (n <= 1) return 0
    const i = Math.round(((px - PL) / plotW) * (n - 1))
    return Math.max(0, Math.min(n - 1, i))
  }

  // El responder se crea una vez; lee siempre los valores actuales por ref.
  const live = useRef({})
  live.current = { idxFromX, onSelect, onScrubChange }
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      live.current.onScrubChange?.(true)
      live.current.onSelect(live.current.idxFromX(e.nativeEvent.locationX))
    },
    onPanResponderMove: (e) => {
      live.current.onSelect(live.current.idxFromX(e.nativeEvent.locationX))
    },
    onPanResponderRelease: () => live.current.onScrubChange?.(false),
    onPanResponderTerminate: () => live.current.onScrubChange?.(false),
  })).current

  const pathFor = (key, from, to) => {
    const seg = []
    for (let i = from; i <= to; i++) {
      const v = points[i]?.[key]
      if (v == null) continue
      seg.push(`${seg.length ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    }
    return seg.join(' ')
  }

  const lastReal = points.reduce((acc, p, i) => (p.isReal ? i : acc), -1)
  const currentIdx = points.findIndex((p) => p.isCurrent)
  const realPath = lastReal >= 1 ? pathFor('balance', 0, lastReal) : ''
  const projPath = pathFor('balance', Math.max(0, lastReal), n - 1)
  const simPath = hasSim ? pathFor('simBalance', 0, n - 1) : ''
  const area = n > 1 ? `${pathFor('balance', 0, n - 1)} L${x(n - 1)},${H - PB} L${x(0)},${H - PB} Z` : ''

  const sel = points[selected] || points[n - 1]
  const selIdx = points[selected] ? selected : n - 1
  const simWorse = hasSim && sel?.simBalance != null && sel.simBalance < sel.balance
  const simColor = hasSim && points.some((p) => p.simBalance != null && p.simBalance < 0) ? colors.danger : colors.success

  // Pocas etiquetas: inicio, hoy y fin (más una en medio si hay espacio).
  const labelIdx = [...new Set([0, currentIdx, Math.round((n - 1) / 2), n - 1].filter((i) => i >= 0 && i < n))]

  return (
    <View>
      {sel ? (
        <View style={s.tooltip}>
          <View style={s.tooltipHead}>
            <TouchableOpacity onPress={() => onSelect(Math.max(0, selIdx - 1))} hitSlop={10} accessibilityLabel="Mes anterior">
              <Ionicons name="chevron-back" size={18} color={selIdx > 0 ? colors.primary : colors.textFaint} />
            </TouchableOpacity>
            <Text style={s.tooltipMonth}>
              {sel.label}
              <Text style={s.tooltipTag}>{sel.isCurrent ? '  · hoy' : sel.isReal ? '  · real' : '  · proyectado'}</Text>
            </Text>
            <TouchableOpacity onPress={() => onSelect(Math.min(n - 1, selIdx + 1))} hitSlop={10} accessibilityLabel="Mes siguiente">
              <Ionicons name="chevron-forward" size={18} color={selIdx < n - 1 ? colors.primary : colors.textFaint} />
            </TouchableOpacity>
          </View>
          <View style={s.tooltipRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tooltipK}>{hasSim ? 'Sin el cambio' : 'Tendrías'}</Text>
              <Text style={[s.tooltipV, { color: sel.balance >= 0 ? colors.text : colors.danger }]}>{formatMoney(sel.balance)}</Text>
            </View>
            {hasSim && sel.simBalance != null ? (
              <View style={{ flex: 1 }}>
                <Text style={s.tooltipK}>Con el cambio</Text>
                <Text style={[s.tooltipV, { color: sel.simBalance >= 0 ? (simWorse ? colors.warning : colors.success) : colors.danger }]}>
                  {formatMoney(sel.simBalance)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={s.tooltipFlow}>
            Entra <Text style={{ color: colors.success, fontWeight: '700' }}>{formatMoney(sel.ingresos)}</Text>
            {'  ·  '}Sale <Text style={{ color: colors.danger, fontWeight: '700' }}>{formatMoney(hasSim && sel.simGastos != null ? sel.simGastos : sel.gastos)}</Text>
          </Text>
        </View>
      ) : null}

      <View
        style={{ height: H }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessible
        accessibilityLabel="Gráfica de tu saldo mes a mes. Desliza para ver cada mes."
      >
        {width > 0 && n > 0 ? (
          <Svg width={width} height={H}>
            <Defs>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.28" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Zona bajo cero: estar en rojo se ve de un vistazo */}
            {min < 0 ? <Rect x={0} y={zeroY} width={width} height={Math.max(0, H - PB - zeroY)} fill={colors.danger} fillOpacity={0.07} /> : null}
            <Line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke={min < 0 ? colors.danger : 'rgba(255,255,255,0.12)'} strokeOpacity={min < 0 ? 0.5 : 1} strokeDasharray="4 4" />
            <SvgText x={PL + 2} y={PT + 2} fontSize="9" fill={colors.textFaint}>{formatMoneyAxis(max)}</SvgText>
            {min < 0 ? <SvgText x={PL + 2} y={zeroY - 4} fontSize="9" fill={colors.textFaint}>$0</SvgText> : null}

            {area ? <Path d={area} fill="url(#area)" /> : null}
            {realPath ? <Path d={realPath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {projPath ? <Path d={projPath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" opacity={hasSim ? 0.55 : 1} /> : null}
            {simPath ? <Path d={simPath} stroke={simColor} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}

            {currentIdx >= 0 ? (
              <>
                <Line x1={x(currentIdx)} x2={x(currentIdx)} y1={PT} y2={H - PB} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
              </>
            ) : null}

            {sel ? (
              <>
                <Line x1={x(selIdx)} x2={x(selIdx)} y1={PT - 6} y2={H - PB} stroke={colors.primary} strokeOpacity={0.6} strokeWidth={1.5} />
                <Circle cx={x(selIdx)} cy={y(sel.balance)} r={5.5} fill={colors.primary} stroke={colors.bg} strokeWidth={2} />
                {hasSim && sel.simBalance != null ? (
                  <Circle cx={x(selIdx)} cy={y(sel.simBalance)} r={5.5} fill={simColor} stroke={colors.bg} strokeWidth={2} />
                ) : null}
              </>
            ) : null}

            {labelIdx.map((i) => (
              <SvgText
                key={i}
                x={Math.min(Math.max(x(i), 16), width - 16)}
                y={H - 6}
                fontSize="10"
                fill={i === currentIdx ? colors.text : colors.textFaint}
                fontWeight={i === currentIdx ? '700' : '400'}
                textAnchor="middle"
              >
                {i === currentIdx ? 'Hoy' : points[i].short}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.legendLine, { backgroundColor: colors.primary }]} /><Text style={s.legendText}>Tu saldo</Text></View>
        {hasSim ? <View style={s.legendItem}><View style={[s.legendLine, { backgroundColor: simColor }]} /><Text style={s.legendText}>Con el cambio</Text></View> : null}
        <Text style={s.legendHint}>Desliza el dedo sobre la gráfica</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tooltip: {
    backgroundColor: 'rgba(196,135,246,0.08)', borderWidth: 1, borderColor: 'rgba(196,135,246,0.2)',
    borderRadius: 14, padding: 12, marginBottom: 10, gap: 6,
  },
  tooltipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tooltipMonth: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center', flex: 1 },
  tooltipTag: { color: colors.textMuted, fontWeight: '500', fontSize: 12 },
  tooltipRow: { flexDirection: 'row', gap: 12 },
  tooltipK: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  tooltipV: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tooltipFlow: { color: colors.textMuted, fontSize: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 12 },
  legendHint: { color: colors.textFaint, fontSize: 11, marginLeft: 'auto' },
})
