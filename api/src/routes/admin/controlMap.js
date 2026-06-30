import { Router } from 'express'
import { getControlMapState } from '../../controllers/admin/controlMapController.js'

const router = Router()

router.get('/mapa-control/estado', getControlMapState)

export default router
