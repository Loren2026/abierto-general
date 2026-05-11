import { Router } from 'express'
import {
  getPublicProject,
  listPublicProjects,
} from '../../controllers/public/projectsController.js'
import { validateProjectCode } from '../../controllers/public/invitationsController.js'

const router = Router()

router.get('/projects', listPublicProjects)
router.post('/projects/:slug/validate-code', validateProjectCode)
router.get('/projects/:slug', getPublicProject)

export default router
