export default function ThreadComposer({ selectedThread }) {
  return (
    <section className="workspace-chat-input-placeholder">
      <div>
        <strong>Escritura desactivada en F1</strong>
        <p>
          {selectedThread
            ? `Preparado para conectar ${selectedThread.title} con Turín en F2.`
            : 'Chat libre/general preparado para F2.'}
        </p>
      </div>
      <button type="button" disabled>
        Enviar en F2
      </button>
    </section>
  )
}
