import { Router } from 'express'
import {
  deleteControlMapCredentials,
  getControlMapCredentials,
  getControlMapState,
  putControlMapCredentials,
} from '../../controllers/admin/controlMapController.js'

const router = Router()

router.get('/mapa-control/estado', getControlMapState)
router.get('/mapa-control/credentials', getControlMapCredentials)
router.put('/mapa-control/credentials', putControlMapCredentials)
router.delete('/mapa-control/credentials', deleteControlMapCredentials)

export default router
