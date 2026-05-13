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
          <h2>Hilos</h2>
          <p className="coordination-panel-copy">Listado operativo del canal interno.</p>
        </div>
      </div>

      <div className="coordination-filters">
        <label>
          <span>Buscar</span>
          <input
            type="text"
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Título o resumen"
          />
        </label>
        <label>
          <span>Estado</span>
          <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="">Todos</option>
            <option value="open">Open</option>
            <option value="pending_review">Pending review</option>
            <option value="blocked">Blocked</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span>Prioridad</span>
          <select value={filters.priority} onChange={(event) => onFilterChange('priority', event.target.value)}>
            <option value="">Todas</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      {error ? <div className="error-message">{error}</div> : null}

      <div className="thread-list">
        {isLoading ? <div className="admin-notice">Cargando hilos...</div> : null}

        {!isLoading && !threads.length ? (
          <div className="admin-notice">No hay hilos todavía con los filtros actuales.</div>
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
              <span className={`project-status project-status--${thread.status}`}>{thread.status}</span>
            </div>
            <div className="thread-card__meta-row">
              <span className="panel-header-pill">{thread.priority}</span>
              <span className="coordination-muted">{thread.origin}</span>
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
