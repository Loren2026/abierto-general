import { createRouter } from './router.js';
import { setState, getState } from './store.js';
import { getDb } from '../db/database.js';
import { mountLegacyUi } from './legacy-ui.js';
import { bindComunidadesUi } from '../modules/comunidades/comunidades.ui.js';
import { bindPropietariosUi } from '../modules/propietarios/propietarios.ui.js';
import { createComunidadesRepository } from '../modules/comunidades/comunidades.repository.js';
import { createComunidadesService } from '../modules/comunidades/comunidades.service.js';
import { createPropietariosRepository } from '../modules/propietarios/propietarios.repository.js';
import { createPropietariosService } from '../modules/propietarios/propietarios.service.js';
import { createJuntasRepository } from '../modules/juntas/juntas.repository.js';
import { createJuntasService } from '../modules/juntas/juntas.service.js';
import { bindJuntasUi } from '../modules/juntas/juntas.ui.js';
import { createGrabacionesRepository } from '../modules/grabaciones/grabaciones.repository.js';
import { createGrabacionesService } from '../modules/grabaciones/grabaciones.service.js';
import { bindGrabacionesUi } from '../modules/grabaciones/grabaciones.ui.js';
import { createTranscripcionesRepository } from '../modules/transcripciones/transcripciones.repository.js';
import { createWhisperService } from '../modules/transcripciones/whisper.service.js';
import { createWebSpeechService } from '../modules/transcripciones/webspeech.service.js';
import { createTranscripcionesService } from '../modules/transcripciones/transcripciones.service.js';
import { bindTranscripcionesUi } from '../modules/transcripciones/transcripciones.ui.js';

export async function initializeApp() {
  const db = await getDb();
  const comunidadesRepository = createComunidadesRepository(db);
  const propietariosRepository = createPropietariosRepository(db);
  const juntasRepository = createJuntasRepository(db);
  const grabacionesRepository = createGrabacionesRepository(db);
  const transcripcionesRepository = createTranscripcionesRepository(db);

  const comunidadesService = createComunidadesService(comunidadesRepository);
  const propietariosService = createPropietariosService(propietariosRepository);
  const juntasService = createJuntasService({
    repository: juntasRepository,
    comunidadesService,
    propietariosService,
  });
  const grabacionesService = createGrabacionesService(grabacionesRepository);
  const whisperService = createWhisperService();
  const webSpeechService = createWebSpeechService();
  const transcripcionesService = createTranscripcionesService({
    repository: transcripcionesRepository,
    whisperService,
    webSpeechService,
    grabacionesService,
  });

  const legacyUi = mountLegacyUi({
    grabacionesService,
    getSelectedJuntaId: () => getState().selectedJuntaId,
  });
  const router = createRouter(legacyUi);

  await comunidadesService.bootstrap();
  await propietariosService.bootstrap();
  await juntasService.bootstrap();

  bindComunidadesUi({ db, router });
  bindPropietariosUi({ db, router });
  await bindJuntasUi({ router, juntasService, comunidadesService, legacyUi });
  const grabacionesUi = bindGrabacionesUi({ router, legacyUi, grabacionesService, juntasService });
  const transcripcionesUi = bindTranscripcionesUi({ router, grabacionesService, juntasService, transcripcionesService });

  setState({
    isBootstrapped: true,
    currentScreen: 'dashboard',
  });

  await grabacionesUi.refresh();
  await transcripcionesUi.refresh();

  return { db, router, comunidadesService, propietariosService, juntasService, grabacionesService, transcripcionesService };
}
