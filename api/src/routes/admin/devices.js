import { Router } from 'express'
import { revokeDevice } from '../../controllers/admin/devicesController.js'

const router = Router()

router.post('/devices/:deviceId/revoke', revokeDevice)

export default router
