// Verificación estática sin dispositivo: `npm run verificar`.
// Babel solo valida sintaxis; estos dos errores la pasaban y tiraban la app en
// runtime (oct 2026):
//  1. Identificador sin importar (ProjectionChart usaba TouchableOpacity sin
//     importarlo y se caía al aparecer las flechas de la gráfica).
//  2. Hook llamado después de un return temprano (SimuladorScreen llamaba
//     useTopInset después de `if (loading) return`: "Rendered more hooks").
const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const GLOBALS = new Set((
  'console Math Number String Date Promise JSON Array Object Boolean parseFloat parseInt '
  + 'setTimeout clearTimeout setInterval clearInterval require module process Intl isNaN isFinite '
  + 'Error TypeError RegExp undefined NaN Infinity Symbol Set Map fetch __DEV__ global globalThis '
  + 'encodeURIComponent decodeURIComponent URL URLSearchParams FormData Blob exports alert '
  + 'requestAnimationFrame cancelAnimationFrame arguments Uint8Array ArrayBuffer'
).split(' '))

function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return archivos(p)
    return /\.jsx?$/.test(e.name) ? [p] : []
  })
}

const root = path.join(__dirname, '..')
const lista = [path.join(root, 'App.js'), ...archivos(path.join(root, 'src'))]
const problemas = []

for (const f of lista) {
  const rel = path.relative(root, f)
  let ast
  try {
    ast = babel.parseSync(fs.readFileSync(f, 'utf8'), {
      filename: f, presets: ['babel-preset-expo'], babelrc: false, configFile: false,
    })
  } catch (e) {
    problemas.push(`${rel}: sintaxis → ${e.message.split('\n')[0]}`)
    continue
  }

  const faltan = new Set()
  babel.traverse(ast, {
    ReferencedIdentifier(p) {
      const n = p.node.name
      if (p.isJSXIdentifier() && /^[a-z]/.test(n)) return
      if (!p.scope.hasBinding(n, true) && !GLOBALS.has(n)) faltan.add(n)
    },
    Function(p) {
      const name = p.node.id?.name || p.parentPath.node.id?.name || ''
      if (!/^[A-Z]/.test(name) || p.node.body.type !== 'BlockStatement') return
      let despuesDeReturn = false
      for (const st of p.get('body.body')) {
        if (despuesDeReturn) {
          st.traverse({
            Function(q) { q.skip() },
            CallExpression(q) {
              const c = q.node.callee
              const n = c.name || c.property?.name || ''
              if (/^use[A-Z]/.test(n)) {
                problemas.push(`${rel}:${q.node.loc.start.line}: ${name} llama ${n} después de un return temprano`)
              }
            },
          })
        }
        let retorna = false
        if (st.isIfStatement()) {
          st.traverse({ Function(q) { q.skip() }, ReturnStatement() { retorna = true } })
        }
        if (retorna) despuesDeReturn = true
      }
    },
  })
  if (faltan.size) problemas.push(`${rel}: sin declarar → ${[...faltan].join(', ')}`)
}

if (problemas.length) {
  console.log(problemas.join('\n'))
  console.log(`\n✗ ${problemas.length} problema(s) en ${lista.length} archivos`)
  process.exit(1)
}
console.log(`✓ ${lista.length} archivos: sintaxis, imports y orden de hooks OK`)
