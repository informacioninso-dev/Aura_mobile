import AsyncStorage from '@react-native-async-storage/async-storage'

const ACCESS_KEY = 'aura_access'
const REFRESH_KEY = 'aura_refresh'

export async function getAccess() { return AsyncStorage.getItem(ACCESS_KEY) }
export async function getRefresh() { return AsyncStorage.getItem(REFRESH_KEY) }
export async function setTokens(access, refresh) {
  await AsyncStorage.multiSet([[ACCESS_KEY, access], [REFRESH_KEY, refresh]])
}
export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY])
}
