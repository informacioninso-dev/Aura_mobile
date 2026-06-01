import { useState } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'

const FREQ_OPTIONS = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

const CATEGORIAS = [
  'vivienda', 'alimentacion', 'transporte', 'salud', 'educacion',
  'entretenimiento', 'ropa', 'servicios', 'tecnologia', 'deudas', 'ahorro', 'otro',
]

export default function FormModal({ visible, onClose, onSave, title, fields, initialValues = {}, loading }) {
  const [values, setValues] = useState(initialValues)
  const [showDate, setShowDate] = useState(false)

  const set = (key, val) => setValues((v) => ({ ...v, [key]: val }))

  function handleSave() {
    onSave(values)
  }

  function reset(newInitial = {}) {
    setValues(newInitial)
  }

  // Exponer reset al padre via ref no es simple, así que reiniciamos cuando cambia initialValues
  useState(() => { setValues(initialValues) }, [JSON.stringify(initialValues)])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {fields.map((field) => {
              if (field.type === 'text' || field.type === 'number') {
                return (
                  <View key={field.key} style={s.field}>
                    <Text style={s.label}>{field.label}</Text>
                    <TextInput
                      style={s.input}
                      value={String(values[field.key] ?? '')}
                      onChangeText={(v) => set(field.key, field.type === 'number' ? v : v)}
                      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
                      placeholder={field.placeholder || ''}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                )
              }

              if (field.type === 'date') {
                const dateVal = values[field.key] ? new Date(values[field.key] + 'T12:00:00') : new Date()
                return (
                  <View key={field.key} style={s.field}>
                    <Text style={s.label}>{field.label}</Text>
                    <TouchableOpacity style={s.input} onPress={() => setShowDate(field.key)}>
                      <Text style={{ color: values[field.key] ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                        {values[field.key] || 'Seleccionar fecha'}
                      </Text>
                    </TouchableOpacity>
                    {showDate === field.key && (
                      <DateTimePicker
                        value={dateVal}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, date) => {
                          setShowDate(false)
                          if (date) set(field.key, date.toISOString().slice(0, 10))
                        }}
                      />
                    )}
                  </View>
                )
              }

              if (field.type === 'chips') {
                const options = field.key === 'frecuencia' ? FREQ_OPTIONS : CATEGORIAS.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
                return (
                  <View key={field.key} style={s.field}>
                    <Text style={s.label}>{field.label}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.chips}>
                        {options.map((opt) => {
                          const active = values[field.key] === opt.value
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[s.chip, active && s.chipActive]}
                              onPress={() => set(field.key, opt.value)}
                            >
                              <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )
              }

              return null
            })}
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={s.btnCancel} onPress={onClose}>
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSave} onPress={handleSave} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnSaveText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0F1B35', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancel: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnCancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  btnSave: { flex: 2, backgroundColor: '#8B5CF6', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
