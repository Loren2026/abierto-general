import { Router } from 'express'
import { requestDownload, downloadByToken } from '../../controllers/public/downloadsController.js'

const router = Router()

router.post('/projects/:slug/request-download', requestDownload)
router.get('/downloads/:token', downloadByToken)

export default router
