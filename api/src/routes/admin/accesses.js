import { Router } from 'express'
import {
  getProjectAccess,
  regenerateProjectPassword,
  revokeProjectAccess,
} from '../../controllers/admin/accessesController.js'
import {
  getActiveAccessDevice,
  reassignAccessDevice,
} from '../../controllers/admin/devicesController.js'

const router = Router()

router.get('/accesses/:accessId', getProjectAccess)
router.post('/accesses/:accessId/regenerate-password', regenerateProjectPassword)
router.post('/accesses/:accessId/revoke', revokeProjectAccess)
router.get('/accesses/:accessId/device', getActiveAccessDevice)
router.post('/accesses/:accessId/reassign-device', reassignAccessDevice)

export default router
