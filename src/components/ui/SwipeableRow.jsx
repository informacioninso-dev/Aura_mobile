import { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'

export default function SwipeableRow({ children, onEdit, onDelete }) {
  const swipeRef = useRef(null)

  function renderRightActions(progress) {
    const trans = progress.interpolate({ inputRange: [0, 1], outputRange: [128, 0] })
    return (
      <Animated.View style={[s.actions, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity style={s.editBtn} onPress={() => { swipeRef.current?.close(); onEdit?.() }}>
          <Text style={s.actionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={() => { swipeRef.current?.close(); onDelete?.() }}>
          <Text style={s.actionText}>Borrar</Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
      {children}
    </Swipeable>
  )
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', width: 128 },
  editBtn: { flex: 1, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginRight: 4 },
  deleteBtn: { flex: 1, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
