import { Router } from 'express'
import { listInvitationLifecycle } from '../../controllers/admin/invitationLifecycleController.js'

const router = Router()

router.get('/invitation-lifecycle', listInvitationLifecycle)

export default router
