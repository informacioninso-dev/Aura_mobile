# MEMORY — Memoria de largo plazo de Aura_mobile

> Memoria del proyecto que **viaja con el repo**. Cómo mantenerla: ver [AGENTS.md](AGENTS.md).
> **Repo git PROPIO** y autocontenido — a futuro será un proyecto separado del backend/web, así que esta memoria NO depende de la del repo principal.
> Mantenerla **curada y corta** (se lee cada sesión). Última actualización: **2026-10-13**.

## 1. Qué es
App móvil de Aura (finanzas personales), **Expo / React Native**. Repo `informacioninso-dev/Aura_mobile`, rama `main`. Consume la **API de PRODUCCIÓN**: `https://aura.binnso.com/api/` (`src/api/client.js`) — **no hay backend local propio**; se prueba contra prod.

## 2. ⚠️ Compatibilidades (LO MÁS IMPORTANTE)
Expo y React Native cambian **mucho** entre versiones; romper la matriz de compatibilidad es el error #1 de este proyecto.
- **Hoy: Expo SDK `54`, React Native `0.81.5`.** App version **1.4.0**, package Android **`com.binnso.aura`**.
- **Antes de escribir código, leé los docs de la versión EXACTA** que usa el proyecto: mirá `expo` en `package.json` → p. ej. hoy `https://docs.expo.dev/versions/v54.0.0/`. No asumas APIs de otra versión.
- Para agregar/actualizar paquetes **`expo-*` usá `npx expo install <pkg>`** (NO `npm install` a secas): resuelve la versión que el SDK soporta. Un `expo-*` fuera de rango rompe en runtime.
- `npx expo start` avisa *"expected version"* de paquetes desfasados (vistos desalineados: `expo-local-authentication`, `expo-notifications`, `expo-splash-screen`) → alinearlos con `npx expo install`.
- Para subir de SDK: seguir la **guía de upgrade oficial** de Expo (cambios de API, config plugins), no bumpear versiones a mano.

## 3. Correr / validar
- `npx expo start` (Metro en **8081**). Expo Go: escanear QR o `exp://<IP-LAN>:8081`. Reload: agitar el teléfono.
- **Antes de cada commit: `npm run verificar`** (`scripts/verificar.js`): sintaxis + identificadores sin importar + hooks después de un `return` temprano. Babel solo NO alcanza: esos dos errores pasaban la sintaxis y tiraban la app en runtime.
- **Antes de un build EAS: `npx expo-doctor@latest` (18/18) y `npx expo install --check`.** Expo Go trae sus propios módulos nativos y tapa errores que en el APK tiran la app (ej.: `@expo/vector-icons` necesita `expo-font` instalado directo).
- Para validar imports/paquetes/assets de verdad: `npx expo export --platform android --output-dir <tmp>` (arma el bundle completo sin dispositivo).
- Como pega a PROD, se loguea con **cuenta real** de aura.binnso.com (las de prueba local no sirven acá).

## 4. Build / publicar (EAS)
- `eas.json` perfiles: `development`, `preview` (APK interno), `production` (AAB para Play, `autoIncrement`), `production-apk`. `appVersionSource: remote` (EAS maneja `versionCode`).
- APK para probar: `npx eas-cli build -p android --profile preview`.
- Play Store: `npx eas-cli build -p android --profile production` → `npx eas-cli submit -p android`.
- Credenciales EAS = del usuario (org **binnso**); `eas-cli` no está local (usar `npx`). **Pedir consentimiento antes de lanzar un build** (consume créditos y es acción hacia afuera).

## 5. Convenciones / UX
- 🎯 **Prioridad de producto: la app móvil es la puerta de entrada de clientes y debe poder ser la ÚNICA app que use la gente** (no un acompañante de la web). Su UX/UI tiene que ser la mejor de Aura: sentirse nativa, rápida y cuidada. Toda feature nueva debe pensarse primero para móvil.
- Design tokens en `src/theme/theme.js` → usar `colors.*`, **no hardcodear** colores. `ScreenHeader` único; safe-area vía hook `useTopInset`. Español, **tuteo**.
- Commits **SIN coautoría**. El **remoto es la fuente de verdad** (se trabaja desde varias máquinas).

## 6. Estado y pendientes
- **Hecho**: pulido UX (tokens, `ScreenHeader`, safe-area). Navegador de mes + chip `vN` en Gastos fijos.
- **Dashboard (oct 2026)**: héroe "Te queda este mes" = balance REAL del mes (no el proyectado, decisión de producto). Cuenta nueva (sin ingresos ni gastos) → solo lista de 3 pasos (ahorro inicial = ingreso puntual "Ahorros iniciales", ingreso, gasto). Abre al instante con caché (`useOfflineCache`, por usuario; se borra al cerrar sesión) y recarga al volver a la pestaña (`useFocusEffect`). Atajo "🐭 Cuentas con personas" solo si hay saldos pendientes.
- **Proyección + Simulador = una pantalla** (`screens/proyeccion/ProyeccionScreen.jsx`; root stack `Proyeccion` y Más → `Simulador` con `simular: true`). Gráfica `BalanceChart`: saldo de cierre, se arrastra el dedo (PanResponder; desactiva el scroll del padre mientras tanto). Simulador local y en vivo (`utils/simulacion.js`, fórmulas = `back/apps/simulador/services.py`): Pago único / Préstamo / Gasto mensual + "Agregar a mis gastos" (mismos endpoints que la web).
- Íconos: `import Ionicons from '@expo/vector-icons/Ionicons'` (no desde el índice: empaqueta las fuentes de TODOS los sets).
- **Pendiente — paridad FUNCIONAL con la web** (inventario 2026-10-13 cruzando endpoints web vs móvil): (1) versionado de gastos fijos; (2) convertir tipos: fijo↔variable, fijo→puntual, ingreso fijo↔puntual, puntuales→variable + sugerencia "parece variable"; (3) catálogo de sugerencias al crear (`/finanzas/catalogo/`); (4) "crear mes de variables" en lote; (5) simulador: guardar escenarios y tasas por banco (`/simulador/simulaciones/`, `/simulador/bancos/`); (6) asistente multi-movimiento (hoy solo objeto plano); (7) suscripción cancelar/reactivar (ojo política de Google Play). Fuente de marca Plus Jakarta Sans también pendiente. Ya existen en móvil (no son brecha): categorías con límites (dentro de Presupuesto), respaldo exportar/importar, montos reales de variables (RubroModal).

- **Copy (Ecuador)**: mismas reglas que la web — tuteo (nunca voseo), "registrar" (no "cargar"), "contraseña" (no "clave"), plan "Gratis" (no "Free"), errores "No pudimos … Intenta de nuevo.", sin "correctamente", "gastos a cuotas" (no "diferidos") en textos visibles. El asistente se llama **"Dile a Aura"**. Al cambiar un texto en la web, replicarlo aquí (y viceversa).

## 7. Novedades (changelog — agregar arriba)
- **2026-10-13** — Dependencias alineadas a SDK 54 (`expo install --fix`; antes notifications/splash/local-auth eran de un SDK viejo), + `expo-font`, − `expo-modules-core`, dedupe de `expo-constants`: expo-doctor 18/18. Plan **Gratis: 1 mes proyectado** (lo impone el backend; el móvil muestra `months` de la respuesta). Perfil muestra la versión de `app.json`.
- **2026-10-13** — Entregas 2 y 3 de la auditoría: auth unificado con el logo real, pestañas Ionicons, Dashboard nuevo (héroe, cuenta nueva, caché), Proyección interactiva + simulador en vivo con "Agregar a mis gastos". **Prioridad del usuario: paridad FUNCIONAL total con la web** (mucha gente solo usará el móvil).
- **2026-10-13** — Auditoría UX "Primer minuto en Aura" (https://claude.ai/artifact/MuYCK3WfygDfvANwDgnjSD), aprobada por el usuario. Entrega 1: fix de 2 caídas (ProjectionChart sin importar `TouchableOpacity` → crash en Pro al pasar de 12 meses; Simulador con hook después de return). Ícono, ícono adaptativo y splash con el logo real (sobre blanco: la barra azul marino del logo no se ve sobre el fondo oscuro). Fuera del Dashboard: "Cerrar sesión" (sin confirmar) y la insignia de plan. `npm run verificar`.
- **2026-10-13** — Copy alineado con la web: ortografía, asistente "Dile a Aura" (+ accessibilityLabel en el botón central), estados vacíos por pestaña, textos de proyección sin jerga ("Meses atrás/adelante", "Con tu historial"). Pendiente: `Aura v1.0` hardcodeado en Perfil (la app es 1.4.0).
- **2026-10** — Navegador de mes + chip de versión en Gastos fijos. Outlook de proyección en el Dashboard.
