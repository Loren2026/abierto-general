import { Router } from 'express'
import {
  createProject,
  getProject,
  listProjects,
  publishProject,
  unpublishProject,
  updateProject,
} from '../../controllers/admin/projectsController.js'
import { listProjectAccesses, createProjectAccess } from '../../controllers/admin/accessesController.js'
import { listProjectDownloadLogs, listProjectRevocationLogs } from '../../controllers/admin/logsController.js'

const router = Router()

router.get('/projects', listProjects)
router.post('/projects', createProject)
router.get('/projects/:projectId', getProject)
router.put('/projects/:projectId', updateProject)
router.post('/projects/:projectId/publish', publishProject)
router.post('/projects/:projectId/unpublish', unpublishProject)
router.get('/projects/:projectId/accesses', listProjectAccesses)
router.post('/projects/:projectId/accesses', createProjectAccess)
router.get('/projects/:projectId/download-logs', listProjectDownloadLogs)
router.get('/projects/:projectId/revocation-logs', listProjectRevocationLogs)

export default router
