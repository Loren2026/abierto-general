function formatDate(value) {
  if (!value) return 'Sin actividad'

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

const statusLabels = {
  open: 'Abierta',
  pending_review: 'Pendiente de revisar',
  blocked: 'Bloqueada',
  closed: 'Cerrada',
  archived: 'Archivada',
}

const priorityLabels = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

const originLabels = {
  internal: 'Workspace',
  telegram: 'Telegram',
  web: 'Web',
}

export default function ThreadList({
  threads,
  selectedThreadId,
  isLoading,
  error,
  filters,
  onFilterChange,
  onSelectThread,
}) {
  return (
    <div className="coordination-panel coordination-panel--list">
      <div className="panel-header-row">
        <div>
          <h2>Conversaciones</h2>
          <p className="coordination-panel-copy">Tus temas abiertos dentro del workspace.</p>
        </div>
      </div>

      <div className="coordination-filters">
        <label>
          <span>Buscar</span>
          <input
            type="text"
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Proyecto, tema o idea"
          />
        </label>
        <label>
          <span>Estado</span>
          <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="">Todos</option>
            <option value="open">Abierta</option>
            <option value="pending_review">Pendiente de revisar</option>
            <option value="blocked">Bloqueada</option>
            <option value="closed">Cerrada</option>
            <option value="archived">Archivada</option>
          </select>
        </label>
        <label>
          <span>Prioridad</span>
          <select value={filters.priority} onChange={(event) => onFilterChange('priority', event.target.value)}>
            <option value="">Todas</option>
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </label>
      </div>

      {error ? <div className="error-message">{error}</div> : null}

      <div className="thread-list">
        {isLoading ? <div className="admin-notice">Cargando conversaciones...</div> : null}

        {!isLoading && !threads.length ? (
          <div className="admin-notice">Todavía no hay conversaciones con esos filtros.</div>
        ) : null}

        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`thread-card ${selectedThreadId === thread.id ? 'thread-card--active' : ''}`}
            onClick={() => onSelectThread(thread.id)}
          >
            <div className="thread-card__header">
              <h3>{thread.title}</h3>
              <span className={`project-status project-status--${thread.status}`}>{statusLabels[thread.status] || thread.status}</span>
            </div>
            <div className="thread-card__meta-row">
              <span className="panel-header-pill">{priorityLabels[thread.priority] || thread.priority}</span>
              <span className="coordination-muted">{originLabels[thread.origin] || thread.origin}</span>
            </div>
            <p className="thread-card__summary">{thread.summary || 'Sin resumen todavía.'}</p>
            <div className="thread-card__footer">
              <span>{thread.createdByLabel}</span>
              <span>{formatDate(thread.lastMessageAt || thread.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
