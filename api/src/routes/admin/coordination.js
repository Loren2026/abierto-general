import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  createThread,
  createThreadApproval,
  createThreadAttachment,
  createThreadConsultation,
  createThreadMessage,
  deleteMessage,
  getApproval,
  getGatewayBridgeStatus,
  getThread,
  listThreadApprovals,
  listThreadAttachments,
  listThreadConsultations,
  listThreadMessages,
  listThreads,
  respondApproval,
  respondConsultation,
  sendThreadMessageToTurin,
} from '../../controllers/admin/coordinationController.js'

const router = Router()

const turinBridgeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: {
    error: 'Demasiados mensajes a Turín. Espera un momento antes de continuar.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

router.get('/coordination/gateway/status', getGatewayBridgeStatus)
router.get('/coordination/threads', listThreads)
router.post('/coordination/threads', createThread)
router.get('/coordination/threads/:threadId', getThread)
router.get('/coordination/threads/:threadId/messages', listThreadMessages)
router.post('/coordination/threads/:threadId/messages', createThreadMessage)
router.post('/coordination/threads/:threadId/messages/send-to-turin', turinBridgeLimiter, sendThreadMessageToTurin)
router.delete('/coordination/messages/:messageId', deleteMessage)
router.get('/coordination/threads/:threadId/consultations', listThreadConsultations)
router.post('/coordination/threads/:threadId/consultations', createThreadConsultation)
router.post('/coordination/consultations/:consultationId/respond', respondConsultation)
router.get('/coordination/threads/:threadId/approvals', listThreadApprovals)
router.post('/coordination/threads/:threadId/approvals', createThreadApproval)
router.get('/coordination/approvals/:approvalId', getApproval)
router.post('/coordination/approvals/:approvalId/respond', respondApproval)
router.get('/coordination/threads/:threadId/attachments', listThreadAttachments)
router.post('/coordination/threads/:threadId/attachments', createThreadAttachment)

export default router
