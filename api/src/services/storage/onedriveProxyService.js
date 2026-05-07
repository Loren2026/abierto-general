export async function streamOneDriveFile({ project, res }) {
  // Placeholder para integración con Microsoft Graph API.
  // Fase siguiente: obtener access token, resolver file content endpoint
  // y hacer streaming proxy sin exponer la URL real al cliente.
  return res.status(501).json({
    error: 'OneDrive proxy streaming pendiente de implementación',
    projectId: project?.id ?? null,
  })
}
