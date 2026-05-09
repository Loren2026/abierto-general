import { Router } from 'express'
import { requestDownload } from '../../controllers/public/downloadsController.js'

const router = Router()

router.post('/projects/:slug/request-download', requestDownload)

export default router
