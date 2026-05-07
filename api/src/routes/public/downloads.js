import { Router } from 'express'
import { requestProtectedDownload } from '../../controllers/public/downloadsController.js'

const router = Router()

router.post('/projects/:slug/request-download', requestProtectedDownload)

export default router
