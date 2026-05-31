import { Router } from 'express'
import {
  createWorkspaceDocumentSignedUrl,
  listWorkspaceDocuments,
} from '../../services/storage/workspaceDocumentsService.js'

const router = Router()

router.get('/documents', async (req, res) => {
  try {
    const documents = await listWorkspaceDocuments()
    return res.json({ success: true, documents })
  } catch (error) {
    console.error('Error listando documentos del workspace:', error)
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'No se pudo cargar el material del workspace.',
    })
  }
})

router.post('/signed-url', async (req, res) => {
  try {
    const signedUrl = await createWorkspaceDocumentSignedUrl(req.body?.path)
    return res.json({ success: true, signedUrl })
  } catch (error) {
    console.error('Error creando URL firmada del workspace:', error)
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'No se pudo abrir el documento.',
    })
  }
})

export default router
