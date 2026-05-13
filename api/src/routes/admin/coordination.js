import { Router } from 'express'
import {
  createThread,
  createThreadApproval,
  createThreadConsultation,
  createThreadMessage,
  getApproval,
  getThread,
  listThreadApprovals,
  listThreadConsultations,
  listThreadMessages,
  listThreads,
  respondApproval,
  respondConsultation,
} from '../../controllers/admin/coordinationController.js'

const router = Router()

router.get('/coordination/threads', listThreads)
router.post('/coordination/threads', createThread)
router.get('/coordination/threads/:threadId', getThread)
router.get('/coordination/threads/:threadId/messages', listThreadMessages)
router.post('/coordination/threads/:threadId/messages', createThreadMessage)
router.get('/coordination/threads/:threadId/consultations', listThreadConsultations)
router.post('/coordination/threads/:threadId/consultations', createThreadConsultation)
router.post('/coordination/consultations/:consultationId/respond', respondConsultation)
router.get('/coordination/threads/:threadId/approvals', listThreadApprovals)
router.post('/coordination/threads/:threadId/approvals', createThreadApproval)
router.get('/coordination/approvals/:approvalId', getApproval)
router.post('/coordination/approvals/:approvalId/respond', respondApproval)

export default router
