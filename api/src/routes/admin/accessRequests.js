import { Router } from 'express'
import {
  approveAccessRequest,
  generateAccessFromRequest,
  getAccessRequest,
  listAccessRequests,
  markAccessRequestCodeSent,
  rejectAccessRequest,
  revokeAccessRequestAccess,
  updateAccessRequest,
} from '../../controllers/admin/accessRequestsController.js'

const router = Router()

router.get('/access-requests', listAccessRequests)
router.get('/access-requests/:requestId', getAccessRequest)
router.patch('/access-requests/:requestId', updateAccessRequest)
router.post('/access-requests/:requestId/approve', approveAccessRequest)
router.post('/access-requests/:requestId/reject', rejectAccessRequest)
router.post('/access-requests/:requestId/generate-access', generateAccessFromRequest)
router.post('/access-requests/:requestId/mark-sent', markAccessRequestCodeSent)
router.post('/access-requests/:requestId/revoke-access', revokeAccessRequestAccess)

export default router
