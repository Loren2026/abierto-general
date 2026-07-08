import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/layout/AdminLayout'
import { adminApiFetch } from '../services/adminApi'
import useAuthStore from '../store/useAuthStore'
import './ControlMapPage.css'

const FP = { verde: 100, ambar: 50, gris: 0, rojo: 12 }
const CREDENTIALS_ITERATIONS = 600000
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()


function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function deriveCredentialsKey(pin, salt, iterations = CREDENTIALS_ITERATIONS) {
  const keyMaterial = await window.crypto.subtle.importKey('raw', textEncoder.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptCredentialsPayload(pin, credentials) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveCredentialsKey(pin, salt)
  const plaintext = textEncoder.encode(JSON.stringify(credentials))
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: CREDENTIALS_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
    },
    updatedAt: new Date().toISOString(),
  }
}

async function decryptCredentialsPayload(pin, blob) {
  const salt = base64ToBytes(blob.kdf.salt)
  const iv = base64ToBytes(blob.cipher.iv)
  const ciphertext = base64ToBytes(blob.cipher.ciphertext)
  const key = await deriveCredentialsKey(pin, salt, blob.kdf.iterations)
  const plaintext = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return JSON.parse(textDecoder.decode(plaintext))
}

function colorFor(value) {
  const p = Math.max(0, Math.min(100, value))
  const stops = [
    [0, [211, 63, 63]],
    [25, [224, 139, 46]],
    [50, [232, 194, 51]],
    [75, [124, 179, 66]],
    [100, [47, 170, 85]],
  ]
  let a = stops[0]
  let b = stops[stops.length - 1]

  for (let index = 0; index < stops.length - 1; index += 1) {
    if (p >= stops[index][0] && p <= stops[index + 1][0]) {
      a = stops[index]
      b = stops[index + 1]
      break
    }
  }

  const t = (p - a[0]) / (b[0] - a[0] || 1)
  const c = a[1].map((v, index) => Math.round(v + (b[1][index] - v) * t))
  const d = c.map((v) => Math.round(v * 0.62))

  return {
    fill: `rgb(${c[0]},${c[1]},${c[2]})`,
    deep: `rgb(${d[0]},${d[1]},${d[2]})`,
  }
}

function pctItems(items = []) {
  if (!items.length) return 0
  const total = items.reduce((sum, item) => sum + (FP[item.estado] ?? 0), 0)
  return Math.round(total / items.length)
}

function hasBloques(node) {
  return Array.isArray(node?.bloques) && node.bloques.length > 0
}

function pct(node) {
  if (!node) return 0
  if (node.personas) return 100
  if (hasBloques(node)) {
    const allItems = node.bloques
      .filter((bloque) => bloque.tipo !== 'usuarios')
      .flatMap((bloque) => bloque.items || [])
    return pctItems(allItems)
  }
  if (node.children) {
    const values = node.children.filter((child) => !child.personas).map(pct)
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
  }
  if (node.items) return pctItems(node.items)
  return 0
}

function nodeAt(root, path) {
  let node = root
  for (const id of path) {
    node = (node.children || []).find((child) => child.id === id) || (node.bloques || []).find((bloque) => bloque.nombre === id)
  }
  return node
}

function ChevronIcon() {
  return (
    <svg className="control-map-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ProgressBar({ value, color, label = '\u00a0', flush = false }) {
  return (
    <div className={`control-map-bar-row ${flush ? 'control-map-bar-row-flush' : ''}`}>
      <div className="control-map-bar-head">
        <span>{label}</span>
        <span className="control-map-pct" style={{ color: color.deep }}>{value}%</span>
      </div>
      <div className="control-map-bar">
        <div className="control-map-bar-fill" style={{ '--control-map-c': color.fill, width: `${value}%` }} />
      </div>
    </div>
  )
}

function NodeCard({ node, onOpen }) {
  if (node.personas) {
    return (
      <button className="control-map-node" type="button" style={{ '--control-map-c': 'var(--control-map-accent)' }} onClick={onOpen}>
        <div className="control-map-node-top">
          <span className="control-map-dot" style={{ '--control-map-c': 'var(--control-map-accent)' }} />
          <span className="control-map-node-name">{node.name}</span>
          <ChevronIcon />
        </div>
        <div className="control-map-node-sub">{node.sub}</div>
      </button>
    )
  }

  const value = pct(node)
  const color = colorFor(value)

  return (
    <button className="control-map-node" type="button" style={{ '--control-map-c': color.fill }} onClick={onOpen}>
      <div className="control-map-node-top">
        <span className="control-map-dot" style={{ '--control-map-c': color.fill }} />
        <span className="control-map-node-name">{node.name}</span>
        <ChevronIcon />
      </div>
      {node.sub ? <div className="control-map-node-sub">{node.sub}</div> : null}
      <ProgressBar value={value} color={color} />
    </button>
  )
}

function BlockCard({ bloque, onOpen }) {
  const value = pctItems(bloque.items || [])
  const color = colorFor(value)

  return (
    <button className="control-map-node" type="button" style={{ '--control-map-c': color.fill }} onClick={onOpen}>
      <div className="control-map-node-top">
        <span className="control-map-dot" style={{ '--control-map-c': color.fill }} />
        <span className="control-map-node-name">{bloque.nombre}</span>
        <span className="control-map-count">{(bloque.items || []).length}</span>
        <ChevronIcon />
      </div>
      <ProgressBar value={value} color={color} />
    </button>
  )
}

function Hero({ node }) {
  const value = node.items ? pctItems(node.items) : pct(node)
  const color = colorFor(value)
  const title = node.name || node.nombre

  return (
    <div className="control-map-detail-hero" style={{ '--control-map-c': color.fill }}>
      <div className="control-map-dh-top">
        <span className="control-map-dot" style={{ '--control-map-c': color.fill }} />
        <span className="control-map-dh-name">{title}</span>
      </div>
      {node.sub ? <div className="control-map-dh-sub">{node.sub}</div> : null}
      <ProgressBar value={value} color={color} label={node.items ? `${node.items.length} puntos` : 'índice completo'} flush />
    </div>
  )
}


function CredentialsModal({ session, onClose }) {
  const [mode, setMode] = useState('loading')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [credentialsText, setCredentialsText] = useState('')
  const [decryptedText, setDecryptedText] = useState('')
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadBlob() {
      try {
        const data = await adminApiFetch(session, '/api/admin/mapa-control/credentials')
        if (!isMounted) return
        if (data?.empty || !data?.cipher?.ciphertext) {
          setMode('setup')
        } else {
          setBlob(data)
          setMode('unlock')
        }
      } catch (loadError) {
        if (!isMounted) return
        if (loadError.message?.includes('No hay credenciales')) setMode('setup')
        else setError(loadError.message || 'No se pudo cargar el blob cifrado')
      }
    }
    loadBlob()
    return () => { isMounted = false }
  }, [session])

  async function saveEncryptedCredentials() {
    setError('')
    if (newPin.length < 8) {
      setError('El PIN debe tener al menos 8 caracteres.')
      return
    }
    if (newPin !== confirmPin) {
      setError('Los PIN no coinciden.')
      return
    }
    if (!credentialsText.trim()) {
      setError('Introduce las credenciales antes de guardar.')
      return
    }

    setIsBusy(true)
    try {
      const encryptedBlob = await encryptCredentialsPayload(newPin, { text: credentialsText })
      await adminApiFetch(session, '/api/admin/mapa-control/credentials', {
        method: 'PUT',
        body: JSON.stringify(encryptedBlob),
      })
      setBlob(encryptedBlob)
      setCredentialsText('')
      setNewPin('')
      setConfirmPin('')
      setMode('unlock')
    } catch (saveError) {
      setError(saveError.message || 'No se pudieron cifrar/guardar las credenciales')
    } finally {
      setIsBusy(false)
    }
  }

  async function unlockCredentials() {
    setError('')
    setIsBusy(true)
    try {
      const credentials = await decryptCredentialsPayload(pin, blob)
      setDecryptedText(credentials.text || '')
      setPin('')
      setMode('view')
    } catch {
      setError('PIN incorrecto. No se ha revelado ninguna credencial.')
    } finally {
      setIsBusy(false)
    }
  }

  function closeAndWipe() {
    setPin('')
    setNewPin('')
    setConfirmPin('')
    setCredentialsText('')
    setDecryptedText('')
    onClose()
  }

  return (
    <div className="control-map-modal-backdrop" role="presentation">
      <div className="control-map-modal" role="dialog" aria-modal="true" aria-label="Credenciales cifradas">
        <div className="control-map-modal-head">
          <h2>Credenciales</h2>
          <button type="button" onClick={closeAndWipe}>Cerrar</button>
        </div>
        <p className="control-map-warning">Si olvidas el PIN, las credenciales no se pueden recuperar.</p>
        {error ? <div className="control-map-error">{error}</div> : null}
        {mode === 'loading' ? <div className="control-map-status">Cargando blob cifrado...</div> : null}
        {mode === 'setup' ? (
          <div className="control-map-form">
            <label>Nuevo PIN<input type="password" value={newPin} onChange={(event) => setNewPin(event.target.value)} autoComplete="new-password" /></label>
            <label>Repetir PIN<input type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} autoComplete="new-password" /></label>
            <label>Credenciales<textarea value={credentialsText} onChange={(event) => setCredentialsText(event.target.value)} rows={8} /></label>
            <button type="button" disabled={isBusy} onClick={saveEncryptedCredentials}>{isBusy ? 'Cifrando...' : 'Cifrar y guardar'}</button>
          </div>
        ) : null}
        {mode === 'unlock' ? (
          <div className="control-map-form">
            <label>PIN<input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') unlockCredentials() }} /></label>
            <button type="button" disabled={isBusy || !pin} onClick={unlockCredentials}>{isBusy ? 'Descifrando...' : 'Desbloquear'}</button>
          </div>
        ) : null}
        {mode === 'view' ? <pre className="control-map-credentials-view">{decryptedText}</pre> : null}
      </div>
    </div>
  )
}

function ControlMapView({ root, path, setPath, fecha, session }) {
  const currentNode = path.length ? nodeAt(root, path) : root
  const currentNodeHasBloques = hasBloques(currentNode)
  const [credentialsOpen, setCredentialsOpen] = useState(false)

  const chain = useMemo(() => {
    const items = [{ name: 'Ecosistema', path: [] }]
    let current = root
    const accumulated = []

    for (const id of path) {
      current = (current.children || []).find((child) => child.id === id) || (current.bloques || []).find((bloque) => bloque.nombre === id)
      accumulated.push(id)
      items.push({ name: current?.name || current?.nombre || id, path: [...accumulated] })
    }

    return items
  }, [path, root])

  function openNode(id) {
    setPath((current) => [...current, id])
  }

  function goBack() {
    setPath((current) => current.slice(0, -1))
  }

  function goTo(targetPath) {
    setPath(targetPath)
  }

  return (
    <div className="control-map-wrap">
      <header className="control-map-header">
        <div className="control-map-kicker">Inteligencia Loren</div>
        <div className="control-map-title-row"><h1>Mapa de Control</h1></div>
        <div className="control-map-crumbs">
          {chain.map((crumb, index) => (
            <span key={`${crumb.name}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <button
                type="button"
                className={`control-map-crumb ${index === chain.length - 1 ? 'control-map-here' : ''}`}
                onClick={index === chain.length - 1 ? undefined : () => goTo(crumb.path)}
              >
                {crumb.name}
              </button>
              {index < chain.length - 1 ? <span className="control-map-crumb-sep">›</span> : null}
            </span>
          ))}
        </div>
        <button className={`control-map-back ${path.length > 0 ? 'control-map-show' : ''}`} type="button" onClick={goBack}>
          <BackIcon />
          Volver
        </button>
      </header>

      <main className="control-map-view">
        {currentNode.personas ? (
          <>
            <div className="control-map-note">El equipo fijo del ecosistema y la función de cada uno.</div>
            {currentNode.personas.map((persona) => (
              <div className="control-map-person" key={persona.nombre}>
                <div className="control-map-person-head">
                  <div>
                    <div className="control-map-p-name">{persona.nombre}</div>
                    <div className="control-map-p-role">{persona.rol}</div>
                  </div>
                  {persona.nombre === 'Loren' ? (
                    <button className="control-map-credentials-button" type="button" onClick={() => setCredentialsOpen(true)}>
                      Credenciales
                    </button>
                  ) : null}
                </div>
                <div className="control-map-p-fn">{persona.fn}</div>
              </div>
            ))}
          </>
        ) : null}

        {currentNode.items ? (
          <>
            <Hero node={currentNode} />
            <div className="control-map-level-label">{currentNode.tipo === 'usuarios' ? 'Quién usa esta herramienta' : 'Puntos'}</div>
            {currentNode.items.map((item, index) => {
              const color = colorFor(FP[item.estado] ?? 0)
              return (
                <div className="control-map-leafitem" style={{ '--control-map-c': color.fill }} key={`${item.t}-${index}`}>
                  <div className="control-map-li-top">
                    <span className="control-map-li-dot" style={{ '--control-map-c': color.fill }} />
                    <span className="control-map-li-text">{item.t}</span>
                  </div>
                </div>
              )
            })}
          </>
        ) : null}

        {currentNodeHasBloques ? (
          <>
            <Hero node={currentNode} />
            <div className="control-map-level-label">Índice · toca un bloque para entrar</div>
            {currentNode.bloques.map((bloque) => (
              <BlockCard bloque={bloque} key={bloque.nombre} onOpen={() => openNode(bloque.nombre)} />
            ))}
          </>
        ) : null}

        {!currentNode.personas && !currentNode.items && !currentNodeHasBloques ? (
          <>
            {path.length === 0 ? (
              <div className="control-map-note">
                Un vistazo a todo el ecosistema. Toca cualquier bloque para <b>entrar</b> hasta donde te interese.
              </div>
            ) : null}
            <div className="control-map-level-label">{currentNode.label || currentNode.sub || 'Contenido'}</div>
            {(currentNode.children || []).map((child) => (
              <NodeCard node={child} key={child.id} onOpen={() => openNode(child.id)} />
            ))}
          </>
        ) : null}
      </main>

      {credentialsOpen ? <CredentialsModal session={session} onClose={() => setCredentialsOpen(false)} /> : null}

      <footer className="control-map-footer">
        <div className="control-map-legend">
          <span className="control-map-scale"><span>0%</span><span className="control-map-grad" /><span>100%</span></span>
        </div>
        Mapa de Control · todos los proyectos · {fecha || 'sin fecha'}
      </footer>
    </div>
  )
}

export default function ControlMapPage() {
  const { session, logout } = useAuthStore()
  const [state, setState] = useState(null)
  const [path, setPath] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const previousManifest = document.querySelector('link[rel="manifest"]')
    const previousThemeColor = document.querySelector('meta[name="theme-color"]')
    const previousAppleIcon = document.querySelector('link[rel="apple-touch-icon"]')
    const previousManifestHref = previousManifest?.getAttribute('href')
    const previousThemeColorContent = previousThemeColor?.getAttribute('content')
    const previousAppleIconHref = previousAppleIcon?.getAttribute('href')

    const manifest = previousManifest || document.createElement('link')
    manifest.setAttribute('rel', 'manifest')
    manifest.setAttribute('href', '/mapa-control/manifest.webmanifest')
    if (!previousManifest) document.head.appendChild(manifest)

    const themeColor = previousThemeColor || document.createElement('meta')
    themeColor.setAttribute('name', 'theme-color')
    themeColor.setAttribute('content', '#d8d2c6')
    if (!previousThemeColor) document.head.appendChild(themeColor)

    const appleIcon = previousAppleIcon || document.createElement('link')
    appleIcon.setAttribute('rel', 'apple-touch-icon')
    appleIcon.setAttribute('href', '/mapa-control/icon-192.png')
    if (!previousAppleIcon) document.head.appendChild(appleIcon)

    return () => {
      if (previousManifest) {
        previousManifest.setAttribute('href', previousManifestHref)
      } else {
        manifest.remove()
      }

      if (previousThemeColor) {
        previousThemeColor.setAttribute('content', previousThemeColorContent)
      } else {
        themeColor.remove()
      }

      if (previousAppleIcon) {
        previousAppleIcon.setAttribute('href', previousAppleIconHref)
      } else {
        appleIcon.remove()
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadState() {
      setIsLoading(true)
      setError('')

      try {
        const data = await adminApiFetch(session, '/api/admin/mapa-control/estado')
        if (isMounted) {
          setState(data)
          setPath([])
        }
      } catch (loadError) {
        if (isMounted) setError(loadError.message || 'No se pudo cargar el mapa de control')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadState()

    return () => {
      isMounted = false
    }
  }, [session])

  return (
    <AdminLayout title="Mapa de Control" onLogout={logout}>
      <div className="control-map-page">
        {isLoading ? (
          <div className="control-map-wrap"><div className="control-map-status">Cargando mapa de control...</div></div>
        ) : null}
        {!isLoading && error ? (
          <div className="control-map-wrap"><div className="control-map-status">{error}</div></div>
        ) : null}
        {!isLoading && !error && state?.ecosistema ? (
          <ControlMapView root={state.ecosistema} path={path} setPath={setPath} fecha={state.meta?.fecha} session={session} />
        ) : null}
      </div>
    </AdminLayout>
  )
}
