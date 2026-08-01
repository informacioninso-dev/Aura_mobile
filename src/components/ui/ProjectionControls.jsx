import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'

import { colors } from '../../theme/theme'

// Mismas opciones que la web, para que la proyeccion se pueda reconfigurar igual
// en los dos lados. Los valores viajan tal cual a la API.
export const MODE_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'automatica', label: 'Inteligente' },
  { value: 'conservadora', label: 'Conservadora' },
]

export const HISTORY_OPTIONS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
]

export const HORIZON_OPTIONS = [
  { value: 12, label: '1 año' },
  { value: 24, label: '2 años' },
  { value: 60, label: '5 años' },
  { value: 120, label: '10 años' },
]

export const SERIES_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
]

// Texto que explica de donde salen los numeros segun el modo. Es la misma
// redaccion de la web para que un usuario que use ambas no lea cosas distintas.
export function getProjectionHelp(mode, historyMonths, observations) {
  if (mode === 'simple') {
    return 'Simple proyecta tus fijos, variables y diferidos con los montos estimados que registraste. No proyecta gastos puntuales al futuro.'
  }

  const base = observations > 0
    ? `Usa ${observations} registros reales de variables en ${historyMonths} ${historyMonths === 1 ? 'mes' : 'meses'}, dentro de una ventana de hasta 18 meses. El ultimo año tiene peso doble.`
    : 'Aun no hay montos reales de variables; mientras los registras, usa tus estimados.'

  if (mode === 'conservadora') {
    return `${base} Conservadora tambien distribuye entre 12 meses los gastos puntuales que marcaste para incluir.`
  }
  return `${base} Inteligente no proyecta gastos puntuales historicos.`
}

function ChipRow({ label, options, value, onChange, disabled }) {
  return (
    <View style={s.group}>
      <Text style={s.groupLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <TouchableOpacity
              key={String(option.value)}
              style={[s.chip, active && s.chipActive, disabled && s.chipDisabled]}
              onPress={() => !disabled && onChange(option.value)}
              disabled={disabled}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default function ProjectionControls({
  mode,
  onModeChange,
  modeSaving = false,
  modeLocked = false,
  pastMonths,
  onPastMonthsChange,
  futureMonths,
  onFutureMonthsChange,
  maxFutureMonths = 120,
  seriesFocus,
  onSeriesFocusChange,
  onRecalcular,
  recalculando = false,
  onExpandir,
  helpText,
}) {
  // El horizonte no puede pasar del tope del plan: sin esto se ofrecerian 10
  // años a alguien que solo tiene derecho a 1 y la API los recortaria en silencio.
  const horizonOptions = HORIZON_OPTIONS.filter((option) => option.value <= maxFutureMonths)

  return (
    <View style={s.root}>
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <ChipRow
            label={modeLocked ? 'Modo · Pro' : 'Modo'}
            options={MODE_OPTIONS}
            value={mode}
            onChange={onModeChange}
            disabled={modeLocked || modeSaving}
          />
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={s.iconBtn} onPress={onRecalcular} disabled={recalculando}>
            {recalculando
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={s.iconText}>↻</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onExpandir}>
            <Text style={s.iconText}>⤢</Text>
          </TouchableOpacity>
        </View>
      </View>

      {modeLocked ? (
        <Text style={s.lockedNote}>
          Cambiar el modo de proyeccion esta disponible en el plan Pro.
        </Text>
      ) : null}

      <View style={s.doubleRow}>
        <View style={{ flex: 1 }}>
          <ChipRow
            label="Historia"
            options={HISTORY_OPTIONS}
            value={pastMonths}
            onChange={onPastMonthsChange}
          />
        </View>
      </View>
      <ChipRow
        label="Horizonte"
        options={horizonOptions}
        value={futureMonths}
        onChange={onFutureMonthsChange}
      />
      <ChipRow
        label="Curvas"
        options={SERIES_OPTIONS}
        value={seriesFocus}
        onChange={onSeriesFocusChange}
      />

      {helpText ? <Text style={s.help}>{helpText}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actions: { flexDirection: 'row', gap: 6, paddingTop: 18 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { color: colors.primary, fontSize: 15 },
  group: { gap: 5 },
  groupLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  doubleRow: { flexDirection: 'row', gap: 10 },
  chipRow: { gap: 6, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: 'rgba(196,135,246,0.18)', borderColor: colors.primary },
  chipDisabled: { opacity: 0.45 },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  lockedNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  help: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
})
