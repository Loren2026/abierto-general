import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/layout/AdminLayout'
import { adminApiFetch } from '../services/adminApi'
import useAuthStore from '../store/useAuthStore'
import './ControlMapPage.css'

const FP = { verde: 100, ambar: 50, gris: 0, rojo: 12 }
const CREDENTIALS_ITERATIONS = 600000
const CREDENTIAL_COLUMNS = [
  ['service', 'Servicio'],
  ['type', 'Tipo'],
  ['username', 'Usuario'],
  ['secret', 'Secreto'],
  ['notes', 'Notas'],
  ['url', 'URL'],
  ['created', 'Creación'],
  ['expires', 'Caducidad'],
  ['label', 'Etiqueta'],
  ['modified', 'Modificado'],
]
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



const EMPTY_CREDENTIAL = {
  service: '',
  type: 'contraseña',
  username: '',
  secret: '',
  notes: '',
  url: '',
  expires: '',
  label: '',
}

function normalizeCredential(row = {}) {
  const now = new Date().toISOString()
  return {
    id: row.id || window.crypto.randomUUID(),
    service: row.service || row.servicio || '',
    type: row.type || row.tipo || 'contraseña',
    username: row.username || row.usuario || '',
    secret: row.secret || row.password || row.value || row.valor || '',
    notes: row.notes || row.notas || '',
    url: row.url || row.enlace || '',
    created: row.created || row.fechaCreacion || now,
    expires: row.expires || row.caducidad || '',
    label: row.label || row.category || row.etiqueta || '',
    modified: row.modified || row.fechaModificacion || now,
  }
}

function normalizeCredentialsPayload(payload) {
  if (Array.isArray(payload?.credentials)) return payload.credentials.map(normalizeCredential)
  if (Array.isArray(payload)) return payload.map(normalizeCredential)
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    const now = new Date().toISOString()
    return [normalizeCredential({
      service: 'Importado formato anterior',
      type: 'texto',
      secret: payload.text,
      notes: 'Migrado automáticamente desde el textarea antiguo.',
      created: now,
      modified: now,
    })]
  }
  return []
}

function isExpired(value) {
  if (!value) return false
  const today = new Date().toISOString().slice(0, 10)
  return value < today
}

function credentialMatches(row, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = Object.values(row).join(' ').toLowerCase()
  return terms.every((term) => haystack.includes(term))
}


function highlight(value = '', terms = []) {
  const text = String(value || '')
  if (!terms.length || !text) return text
  const escapedTerms = terms.filter(Boolean).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escapedTerms.length) return text
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'ig')
  return text.split(regex).map((part, index) => (
    terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : part
  ))
}

function CredentialsModal({ session, onClose }) {
  const [mode, setMode] = useState('loading')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [hintText, setHintText] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [blob, setBlob] = useState(null)
  const [credentials, setCredentials] = useState([])
  const [draft, setDraft] = useState(EMPTY_CREDENTIAL)
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [columnFilters, setColumnFilters] = useState({})
  const [showSecrets, setShowSecrets] = useState(false)
  const [visibleSecrets, setVisibleSecrets] = useState({})
  const [showDraftSecret, setShowDraftSecret] = useState(false)
  const [editingRowId, setEditingRowId] = useState(null)
  const [editingRowDraft, setEditingRowDraft] = useState(null)
  const [showCredentialForm, setShowCredentialForm] = useState(false)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isEditingHint, setIsEditingHint] = useState(false)
  const [hintDraft, setHintDraft] = useState('')
  const [activeSuggestField, setActiveSuggestField] = useState(null)

  useEffect(() => {
    let isMounted = true
    async function loadBlob() {
      try {
        const data = await adminApiFetch(session, '/api/admin/mapa-control/credentials')
        if (!isMounted) return
        if (data?.empty || !data?.cipher?.ciphertext) setMode('setup')
        else {
          setBlob(data)
          setHintText(data.hint || '')
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const filteredCredentials = useMemo(
    () => credentials.filter((row) => credentialMatches(row, debouncedQuery) && CREDENTIAL_COLUMNS.every(([key]) => {
      const selected = columnFilters[key]
      if (!selected) return true
      const value = key === 'created' || key === 'modified' ? row[key]?.slice(0, 10) : row[key]
      return String(value || '') === selected
    })),
    [credentials, debouncedQuery, columnFilters],
  )

  const searchTerms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean)


  async function persistCredentials(nextCredentials, pinToUse = pin) {
    const encryptedBlob = {
      ...(await encryptCredentialsPayload(pinToUse, { credentials: nextCredentials })),
      hint: hintText.trim(),
    }
    await adminApiFetch(session, '/api/admin/mapa-control/credentials', {
      method: 'PUT',
      body: JSON.stringify(encryptedBlob),
    })
    setBlob(encryptedBlob)
    return encryptedBlob
  }

  async function saveInitialCredentials() {
    setError('')
    if (newPin.length < 8) return setError('El PIN debe tener al menos 8 caracteres.')
    if (newPin !== confirmPin) return setError('Los PIN no coinciden.')
    setIsBusy(true)
    try {
      const now = new Date().toISOString()
      const firstRow = normalizeCredential({ ...draft, created: now, modified: now })
      const nextCredentials = firstRow.service || firstRow.username || firstRow.secret || firstRow.notes || firstRow.url ? [firstRow] : []
      await persistCredentials(nextCredentials, newPin)
      setCredentials(nextCredentials)
      setPin(newPin)
      setNewPin('')
      setConfirmPin('')
      setDraft(EMPTY_CREDENTIAL)
      setMode('view')
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
      const payload = await decryptCredentialsPayload(pin, blob)
      setCredentials(normalizeCredentialsPayload(payload))
      setShowHint(false)
      setShowSecrets(false)
      setVisibleSecrets({})
      setShowCredentialForm(false)
      setMode('view')
    } catch {
      setShowHint(false)
      setError('Contraseña incorrecta. No se ha revelado ninguna credencial.')
    } finally {
      setIsBusy(false)
    }
  }

  async function saveRow() {
    setError('')
    if (!pin) return setError('Sesión sin PIN en memoria. Cierra y desbloquea de nuevo.')
    const now = new Date().toISOString()
    const row = normalizeCredential({ ...draft, modified: now, created: draft.created || now })
    const nextCredentials = editingId
      ? credentials.map((item) => (item.id === editingId ? { ...row, id: editingId, created: item.created || row.created } : item))
      : [...credentials, row]
    setIsBusy(true)
    try {
      await persistCredentials(nextCredentials)
      setCredentials(nextCredentials)
      setDraft(EMPTY_CREDENTIAL)
      setEditingId(null)
      setShowCredentialForm(false)
      setShowSecrets(false)
      setVisibleSecrets({})
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la fila cifrada')
    } finally {
      setIsBusy(false)
    }
  }

  function editRow(row) {
    setDraft(row)
    setEditingId(row.id)
    setShowCredentialForm(true)
    setShowSecrets(false)
  }

  async function deleteRow(id) {
    if (!window.confirm('¿Eliminar esta credencial?')) return
    const nextCredentials = credentials.filter((row) => row.id !== id)
    setIsBusy(true)
    try {
      await persistCredentials(nextCredentials)
      setCredentials(nextCredentials)
      if (editingId === id) {
        setEditingId(null)
        setDraft(EMPTY_CREDENTIAL)
        setShowCredentialForm(false)
      }
      setShowSecrets(false)
      setVisibleSecrets({})
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo borrar la fila')
    } finally {
      setIsBusy(false)
    }
  }


  async function exportCredentials() {
    setError('')
    if (!pin) return setError('Sesión sin PIN en memoria. Cierra y desbloquea de nuevo.')
    setIsBusy(true)
    try {
      const exportBlob = await encryptCredentialsPayload(pin, { credentials })
      const fileBlob = new Blob([JSON.stringify({ ...exportBlob, hint: hintText.trim() }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(fileBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `credenciales-mapa-${new Date().toISOString().slice(0, 10)}.enc.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(exportError.message || 'No se pudo exportar el blob cifrado')
    } finally {
      setIsBusy(false)
    }
  }

  async function importCredentials(event) {
    setError('')
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const importPin = window.prompt('Introduce el PIN del fichero exportado.')
    if (!importPin) return
    setIsBusy(true)
    try {
      const importedBlob = JSON.parse(await file.text())
      const payload = await decryptCredentialsPayload(importPin, importedBlob)
      const importedCredentials = normalizeCredentialsPayload(payload)
      if (!Array.isArray(importedCredentials)) throw new Error('Formato de credenciales no válido')
      await adminApiFetch(session, '/api/admin/mapa-control/credentials', {
        method: 'PUT',
        body: JSON.stringify(importedBlob),
      })
      setPin(importPin)
      setBlob(importedBlob)
      setHintText(importedBlob.hint || '')
      setCredentials(importedCredentials)
      setColumnFilters({})
      setQuery('')
      setDebouncedQuery('')
      setShowCredentialForm(false)
      setVisibleSecrets({})
      setIsEditingHint(false)
    } catch (importError) {
      setError(importError.message || 'No se pudo importar. PIN incorrecto o fichero inválido.')
    } finally {
      setIsBusy(false)
    }
  }


  async function saveHintOnly() {
    setError('')
    if (!blob) return setError('No hay blob de credenciales cargado.')
    const updatedBlob = { ...blob, hint: hintDraft.trim() }
    setIsBusy(true)
    try {
      await adminApiFetch(session, '/api/admin/mapa-control/credentials', {
        method: 'PUT',
        body: JSON.stringify(updatedBlob),
      })
      setBlob(updatedBlob)
      setHintText(updatedBlob.hint || '')
      setIsEditingHint(false)
    } catch (hintError) {
      setError(hintError.message || 'No se pudo guardar la pista')
    } finally {
      setIsBusy(false)
    }
  }

  async function resetCredentials() {
    setError('')
    const typedPin = window.prompt('Introduce el PIN para confirmar el reset de credenciales.')
    if (!typedPin) return
    try {
      await decryptCredentialsPayload(typedPin, blob)
    } catch {
      setError('Contraseña incorrecta. Reset cancelado.')
      return
    }
    const confirmation = window.prompt('Escribe ELIMINAR TODO para confirmar. Se eliminarán TODAS las credenciales y no será recuperable sin backup.')
    if (confirmation !== 'ELIMINAR TODO') return
    setIsBusy(true)
    try {
      await adminApiFetch(session, '/api/admin/mapa-control/credentials', { method: 'DELETE' })
      setBlob(null)
      setCredentials([])
      setPin('')
      setDraft(EMPTY_CREDENTIAL)
      setMode('setup')
    } catch (resetError) {
      setError(resetError.message || 'No se pudo resetear el almacén')
    } finally {
      setIsBusy(false)
    }
  }

  function closeAndWipe() {
    setPin('')
    setNewPin('')
    setConfirmPin('')
    setHintText('')
    setCredentials([])
    setDraft(EMPTY_CREDENTIAL)
    setEditingId(null)
    setShowHint(false)
    setShowSecrets(false)
    setVisibleSecrets({})
    setShowCredentialForm(false)
    onClose()
  }

  const fieldOptions = useMemo(() => {
    const keys = ['service', 'type', 'username', 'url', 'expires', 'label', 'notes']
    return Object.fromEntries(keys.map((key) => [key, [...new Set(credentials.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))]))
  }, [credentials])

  const columnOptions = useMemo(() => Object.fromEntries(CREDENTIAL_COLUMNS.map(([key]) => [
    key,
    [...new Set(credentials.map((row) => {
      const value = key === 'created' || key === 'modified' ? row[key]?.slice(0, 10) : row[key]
      return value || ''
    }).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
  ])), [credentials])

  function updateDraftField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function suggestionField(label, field, inputProps = {}) {
    const options = (fieldOptions[field] || []).filter((value) => value.toLowerCase().includes(String(draft[field] || '').toLowerCase()))
    return (
      <label className="control-map-suggest-field">{label}
        <input
          value={draft[field] || ''}
          onFocus={() => setActiveSuggestField(field)}
          onBlur={() => window.setTimeout(() => setActiveSuggestField((current) => (current === field ? null : current)), 140)}
          onChange={(event) => updateDraftField(field, event.target.value)}
          {...inputProps}
        />
        {activeSuggestField === field && options.length ? (
          <div className="control-map-suggestions">
            {options.map((value) => (
              <button type="button" key={value} onMouseDown={(event) => { event.preventDefault(); updateDraftField(field, value); setActiveSuggestField(null) }}>{value}</button>
            ))}
          </div>
        ) : null}
      </label>
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  const form = (
    <div className="control-map-credential-editor">
      {suggestionField('Servicio/Pertenece a', 'service')}
      {suggestionField('Tipo', 'type', { placeholder: 'contraseña/token/API key/PIN...' })}
      {suggestionField('Usuario/Correo', 'username')}
      <label>Contraseña/Valor secreto<button type="button" className="control-map-secret-toggle" onClick={() => setShowDraftSecret((current) => !current)}>{showDraftSecret ? '••••••••' : (draft.secret || '••••••••')}</button><input type={showDraftSecret ? 'text' : 'password'} value={draft.secret} onChange={(event) => setDraft({ ...draft, secret: event.target.value })} autoComplete="new-password" /></label>
      {suggestionField('URL/Enlace', 'url')}
      {suggestionField('Caducidad / Rotación', 'expires', { type: 'date' })}
      {suggestionField('Etiqueta/categoría', 'label')}
      <label>Creación<input type="date" value={draft.created?.slice(0, 10) || ''} onChange={(event) => setDraft({ ...draft, created: event.target.value })} /></label>
      <label className="control-map-credential-editor-wide control-map-suggest-field">Notas<textarea value={draft.notes} onFocus={() => setActiveSuggestField('notes')} onBlur={() => window.setTimeout(() => setActiveSuggestField((current) => (current === 'notes' ? null : current)), 140)} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} />
        {activeSuggestField === 'notes' && fieldOptions.notes?.length ? <div className="control-map-suggestions">{fieldOptions.notes.map((value) => <button type="button" key={value} onMouseDown={(event) => { event.preventDefault(); updateDraftField('notes', value); setActiveSuggestField(null) }}>{value}</button>)}</div> : null}
      </label>
    </div>
  )

  return (
    <div className={`control-map-modal-backdrop ${mode === 'view' ? 'control-map-modal-backdrop-full' : ''}`} role="presentation">
      <div className={`control-map-modal ${mode === 'view' ? 'control-map-modal-full' : ''}`} role="dialog" aria-modal="true" aria-label="Credenciales cifradas">
        <div className="control-map-modal-head control-map-modal-head-grid">
          {mode === 'view' ? <button type="button" className="control-map-compact-button" onClick={() => { setShowCredentialForm((current) => !current); if (!showCredentialForm) setDraft((current) => ({ ...EMPTY_CREDENTIAL, ...current, expires: current.expires || '' })) }}>{showCredentialForm ? 'Ocultar alta' : 'Añadir credencial'}</button> : <span />}
          {mode === 'view' ? <label className="control-map-compact-button control-map-import-button">Importar<input type="file" accept="application/json,.json" onChange={importCredentials} /></label> : <span />}
          <button type="button" className="control-map-compact-button" onClick={closeAndWipe}>Cerrar</button>
          {mode === 'view' ? <button type="button" className="control-map-compact-button" onClick={exportCredentials}>Exportar</button> : <span />}
        </div>
        {isEditingHint ? (
          <div className="control-map-hint-editor">
            <label>Pista (opcional) — NO pongas aquí datos sensibles.<textarea value={hintDraft} onChange={(event) => setHintDraft(event.target.value)} rows={3} /></label>
            <div className="control-map-credential-actions"><button type="button" disabled={isBusy} onClick={saveHintOnly}>Guardar pista</button><button type="button" onClick={() => setIsEditingHint(false)}>Cancelar</button></div>
          </div>
        ) : null}
        {error ? <div className="control-map-error">{error}</div> : null}
        {mode === 'loading' ? <div className="control-map-status">Cargando blob cifrado...</div> : null}
        {mode === 'setup' ? (
          <div className="control-map-form">
            <label>Nuevo PIN<input type="password" value={newPin} onChange={(event) => setNewPin(event.target.value)} autoComplete="new-password" /></label>
            <label>Repetir PIN<input type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} autoComplete="new-password" /></label>
            <label>Pista (opcional) — se muestra si olvidas el PIN. NO pongas aquí datos sensibles.<textarea value={hintText} onChange={(event) => setHintText(event.target.value)} rows={3} /></label>
            {form}
            <button type="button" disabled={isBusy} onClick={saveInitialCredentials}>{isBusy ? 'Cifrando...' : 'Cifrar y guardar'}</button>
          </div>
        ) : null}
        {mode === 'unlock' ? (
          <div className="control-map-form">
            <div className="control-map-unlock-row"><label>PIN<input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') unlockCredentials() }} /></label>{hintText ? <button type="button" className="control-map-secondary-button" onClick={() => setShowHint((current) => !current)}>{showHint ? 'Ocultar pista' : 'Pista'}</button> : null}</div>
            <button type="button" disabled={isBusy || !pin} onClick={unlockCredentials}>{isBusy ? 'Descifrando...' : 'Desbloquear'}</button>
            {showHint && hintText ? <div className="control-map-hint">Pista: {hintText}</div> : null}
          </div>
        ) : null}
        {mode === 'view' ? (
          <div className="control-map-credentials-fullscreen">
            <div className="control-map-credentials-toolbar">
              <button type="button" className="control-map-compact-button control-map-wide-button" onClick={() => { setHintDraft(hintText); setIsEditingHint((current) => !current) }}>Editar pista</button>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en todos los campos..." />
              {debouncedQuery ? <span className="control-map-search-count">{filteredCredentials.length} coincidencia{filteredCredentials.length === 1 ? '' : 's'}</span> : null}
            </div>
            {showCredentialForm ? form : null}
            {showCredentialForm ? <div className="control-map-credential-actions">
              <button type="button" disabled={isBusy} onClick={saveRow}>{editingId ? 'Guardar edición' : 'Añadir fila'}</button>
              {editingId ? <button type="button" onClick={() => { setEditingId(null); setDraft(EMPTY_CREDENTIAL); setShowCredentialForm(false) }}>Cancelar edición</button> : null}
            </div> : null}
            <div className="control-map-credentials-table-wrap">
              <table className="control-map-credentials-table">
                <thead><tr>{CREDENTIAL_COLUMNS.map(([key, label]) => (
                  <th key={key}>{label}<select value={columnFilters[key] || ''} onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}><option value="">— Todos —</option>{(columnOptions[key] || []).map((value) => <option key={value} value={value}>{value}</option>)}</select></th>
                ))}<th>Acciones</th></tr></thead>
                <tbody>
                  {filteredCredentials.map((row) => (
                    <tr key={row.id} className={isExpired(row.expires) ? 'control-map-expired-row' : ''}>
                      <td>{highlight(row.service, searchTerms)}</td><td>{highlight(row.type, searchTerms)}</td><td>{highlight(row.username, searchTerms)}</td><td><button type="button" className="control-map-secret-toggle" onClick={() => toggleRowSecret(row.id)}>{visibleSecrets[row.id] ? <span className="control-map-secret-text">{row.secret}</span> : '••••••••'}</button></td><td>{highlight(row.notes, searchTerms)}</td><td>{row.url ? <a href={row.url} target="_blank" rel="noreferrer">Abrir</a> : ''}</td><td>{row.created?.slice(0, 10)}</td><td>{highlight(row.expires, searchTerms)}</td><td>{highlight(row.label, searchTerms)}</td><td>{row.modified?.slice(0, 10)}</td>
                      <td>{editingRowId === row.id ? <button type="button" onClick={() => saveRowEdit(row.id)}>Grabar</button> : <button type="button" onClick={() => toggleRowEdit(row.id)}>Editar</button>}<button type="button" onClick={() => deleteRow(row.id)}>Borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ControlMapView({ root, path, setPath, fecha, onOpenCredentials }) {
  const currentNode = path.length ? nodeAt(root, path) : root
  const currentNodeHasBloques = hasBloques(currentNode)
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

  function toggleDraftSecret() {
    setShowDraftSecret((current) => !current)
  }

  function toggleRowSecret(id) {
    setVisibleSecrets((current) => ({ ...current, [id]: !current[id] }))
  }

  function toggleRowEdit(id) {
    if (editingRowId === id) {
      setEditingRowId(null)
      setEditingRowDraft(null)
    } else {
      const row = credentials.find((c) => c.id === id)
      if (row) {
        setEditingRowId(id)
        setEditingRowDraft({ ...row })
      }
    }
  }

  function saveRowEdit(id) {
    const index = credentials.findIndex((c) => c.id === id)
    if (index !== -1 && editingRowDraft) {
      const updated = normalizeCredential(editingRowDraft)
      setCredentials((current) => {
        const newCredentials = [...current]
        newCredentials[index] = updated
        return newCredentials
      })
      setEditingRowId(null)
      setEditingRowDraft(null)
    }
  }

  function cancelRowEdit() {
    setEditingRowId(null)
    setEditingRowDraft(null)
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
                    <button className="control-map-credentials-button" type="button" onClick={onOpenCredentials}>
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
  const [credentialsOpen, setCredentialsOpen] = useState(false)

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
          <ControlMapView root={state.ecosistema} path={path} setPath={setPath} fecha={state.meta?.fecha} onOpenCredentials={() => setCredentialsOpen(true)} />
        ) : null}
        {credentialsOpen ? <CredentialsModal session={session} onClose={() => setCredentialsOpen(false)} /> : null}
      </div>
    </AdminLayout>
  )
}
