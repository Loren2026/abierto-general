# Propuesta técnica de desarrollo, Bloque 4, Fit Loren

## Objetivo
Desarrollar la biblioteca completa de ejercicios de Fit Loren para que el usuario pueda localizar, filtrar, consultar y entender cada ejercicio de forma rápida, visual y útil, manteniendo una arquitectura Flutter coherente con los Bloques 1, 2 y 3.

## Enfoque técnico del Bloque 4
Este bloque convertirá la sección `Ejercicios` en una biblioteca real de consulta, no solo en una lista estática. La implementación deberá permitir búsqueda rápida, filtros combinables, navegación a ficha detallada y una base de datos de ejercicios preparada para crecer más adelante.

Por coherencia con los bloques anteriores, este bloque mantendrá:
- Flutter como base única del proyecto
- persistencia local con `Hive`
- gestión de estado con `Provider` y `ChangeNotifier`
- estructura modular de archivos
- tema visual oscuro con acento naranja

## Alcance del Bloque 4

### 1. Buscador por nombre
La biblioteca incluirá un campo de búsqueda para localizar ejercicios por nombre.

#### Requisitos funcionales
- búsqueda en tiempo real mientras el usuario escribe
- búsqueda por coincidencia parcial
- búsqueda aproximada tipo fuzzy search
- búsqueda con algoritmo de similitud para tolerar errores de escritura

#### Objetivo funcional
Permitir encontrar ejercicios rápidamente aunque el usuario no escriba el nombre exacto.

### 2. Filtros por músculo
La biblioteca permitirá filtrar ejercicios por grupo muscular.

#### Requisitos funcionales
- filtro por músculo principal
- posibilidad de incluir músculos secundarios
- selección múltiple de músculos
- lógica OR entre músculos seleccionados

#### Objetivo funcional
Dar al usuario una forma práctica de localizar ejercicios según la zona corporal que quiera trabajar.

### 3. Filtros por tipo de equipo
Se implementarán filtros por el equipo necesario para realizar el ejercicio.

#### Opciones mínimas
- cuerpo libre (`bodyweight`)
- pesas manuales (`dumbbells`)
- barras (`barbell`)
- máquinas (`machines`)
- bandas elásticas (`resistance bands`)
- otros

#### Requisitos funcionales
- selección múltiple de equipos
- lógica OR entre equipos seleccionados

#### Objetivo funcional
Facilitar la búsqueda de ejercicios adaptados al material disponible del usuario.

### 4. Filtros por dificultad
La biblioteca incluirá filtro por nivel de dificultad.

#### Niveles
- principiante
- intermedio
- avanzado

#### Objetivo funcional
Permitir al usuario consultar ejercicios adecuados a su nivel actual.

### 5. Listado de ejercicios
Se desarrollará una vista de listado para mostrar los ejercicios disponibles.

#### Información visible por ítem
- imagen del ejercicio
- nombre del ejercicio
- músculo principal
- nivel de dificultad con indicación visual
- botón de favorito

#### Badges visuales de dificultad
Se implementarán badges visuales con colores consistentes:
- principiante: verde (`lightGreen`)
- intermedio: naranja (`orange` o `deepOrange`)
- avanzado: rojo (`red` o `redAccent`)

#### Navegación de resultados
La propuesta contempla una de estas dos estrategias:
- scroll infinito
- paginación

### Recomendación técnica
Para este bloque, se recomienda empezar con paginación o carga por lotes simples, porque es más fácil de controlar y suficiente para una primera biblioteca local. Si más adelante el volumen de ejercicios crece mucho, podrá evolucionarse a scroll infinito.

#### Objetivo funcional
Mantener la lista ágil, ordenada y escalable sin saturar la interfaz.

### 6. Ficha completa de ejercicio
Al pulsar un ejercicio, se abrirá su ficha completa.

#### Información de la ficha
- nombre del ejercicio
- músculos principales
- músculos secundarios
- descripción técnica detallada
- nivel de dificultad
- alternativas para el mismo músculo
- imágenes o vídeos del ejercicio, si aplica
- pasos para ejecutarlo correctamente
- errores comunes a evitar
- indicador de si el ejercicio es compuesto
- tags adicionales si existen

#### Objetivo funcional
Ofrecer una ficha realmente útil, no solo descriptiva, para ayudar al usuario a ejecutar bien cada ejercicio.

### 7. Sistema de favoritos
Se incorporará un sistema de favoritos de ejercicios dentro de la biblioteca.

#### Funcionalidades mínimas
- modelo `UserFavorites`
- botón de favorito en cada ejercicio
- posibilidad de marcar y desmarcar ejercicios rápidamente
- gestión de favoritos desde la propia biblioteca

#### Objetivo funcional
Permitir al usuario guardar ejercicios de referencia para volver a ellos con rapidez.

### 8. Carga diferida de imágenes
Se implementará una estrategia de carga diferida de imágenes para mejorar rendimiento y experiencia.

#### Requisitos funcionales
- placeholder de carga
- carga bajo demanda
- manejo de errores de carga

#### Objetivo funcional
Evitar bloqueos visuales y mejorar la fluidez del listado y de la ficha de ejercicio.

## Modelo de datos propuesto
Este bloque requiere una base de datos de ejercicios bien estructurada.

### Modelos recomendados
- `Exercise`
- `ExerciseMedia`
- `ExerciseExecutionStep`
- `ExerciseAlternative`
- `ExerciseFilters`
- `ExerciseSearchResult`
- `UserFavorites`

### Responsabilidad de cada modelo
#### `Exercise`
Representará el ejercicio principal con:
- identificador
- nombre
- músculo principal
- lista de músculos secundarios
- tipo de equipo
- nivel de dificultad
- descripción técnica
- lista de pasos de ejecución
- lista de errores comunes
- lista de alternativas
- media asociada
- `videoUrl?`
- `isCompound?`
- `tags?`

#### `ExerciseMedia`
Representará recursos visuales:
- imagen principal
- imágenes adicionales si existen
- vídeo o referencia de vídeo si aplica

#### `ExerciseExecutionStep`
Representará cada paso de ejecución:
- orden
- texto del paso

#### `ExerciseAlternative`
Representará ejercicios alternativos relacionados:
- id del ejercicio alternativo
- nombre visible
- relación con mismo músculo o patrón similar

#### `ExerciseFilters`
Representará el estado actual de búsqueda y filtrado:
- texto de búsqueda
- músculos seleccionados
- inclusión de músculos secundarios o no
- equipos seleccionados
- dificultades seleccionadas

#### `ExerciseSearchResult`
Servirá para devolver resultados procesados de búsqueda y paginación:
- lista de ejercicios filtrados
- total de resultados
- página o lote actual
- indicador de más resultados disponibles

#### `UserFavorites`
Representará la colección de favoritos del usuario:
- lista de ids de ejercicios favoritos
- operaciones de añadir y quitar favoritos

## Enums recomendados
Se recomienda tipar toda la biblioteca con enums claros.

### Enums mínimos
- `MuscleGroup`
- `EquipmentType`
- `ExerciseDifficulty`
- `MediaType`
- `ExerciseListLoadState`

## Persistencia local con Hive
Este bloque seguirá la misma línea técnica de persistencia local con `Hive`.

### Datos a guardar
- catálogo local de ejercicios
- favoritos del usuario
- metadatos de búsqueda si interesa conservar estado entre sesiones
- filtros usados recientemente, si se decide mejorar UX

### TypeAdapters requeridos
Se implementarán `TypeAdapters` para todos los modelos persistidos del Bloque 4 con `typeId` específicos.

### Objetivo de persistencia
Permitir que la biblioteca cargue rápido, funcione sin dependencia externa y quede preparada para ampliarse con más ejercicios en el futuro.

## Estrategia de búsqueda
La búsqueda debe ser rápida, tolerante y útil.

### Requisitos técnicos
- normalización de texto
- búsqueda no sensible a mayúsculas o minúsculas
- coincidencia parcial por nombre
- fuzzy search básica para errores leves de escritura
- cálculo de similitud para encontrar coincidencias aunque haya fallos tipográficos

### Recomendación técnica
Para este bloque, conviene implementar un fuzzy search local con una lógica de similitud sencilla pero real, por ejemplo combinando:
- normalización de strings
- coincidencia por contains
- puntuación simple por similitud
- umbral mínimo para aceptar resultados aproximados

No hace falta un motor complejo en esta fase si la biblioteca inicial será local y de tamaño controlado.

## Estructura de filtros
Los filtros deben poder combinarse entre sí sin confundir al usuario.

### Comportamiento esperado
- búsqueda y filtros activos al mismo tiempo
- chips o botones visuales para filtros seleccionados
- opción clara para limpiar filtros
- actualización del listado sin necesidad de pantallas separadas
- selección múltiple en músculos y equipos
- lógica OR entre músculos seleccionados
- lógica OR entre equipos seleccionados

### Lógica de filtrado recomendada
1. aplicar texto de búsqueda
2. aplicar músculos seleccionados con lógica OR
3. aplicar equipo con lógica OR
4. aplicar dificultad
5. paginar o limitar resultados visibles

## Servicio de datos recomendado
Se recomienda crear una capa específica para la biblioteca.

### Servicio recomendado
- `ExerciseLibraryService`

### Responsabilidades
- cargar catálogo local de ejercicios
- aplicar búsqueda
- aplicar filtros
- resolver paginación o lotes
- obtener ficha completa de un ejercicio
- obtener alternativas del mismo músculo
- gestionar favoritos
- resolver carga de media de forma eficiente

## Gestión de estado con Provider
Se mantendrá el patrón ya usado en bloques anteriores.

### Provider recomendado
- `ExerciseLibraryProvider`
- opcionalmente `ExerciseDetailProvider` si se quiere separar la ficha del listado
- opcionalmente `FavoritesProvider` si se quiere desacoplar la capa de favoritos

### Responsabilidades de `ExerciseLibraryProvider`
- cargar ejercicios
- gestionar texto de búsqueda
- gestionar filtros activos
- exponer resultados filtrados
- controlar estados de carga, vacío y error
- gestionar paginación o carga incremental
- coordinar estado de favoritos en el listado

### Responsabilidades de `ExerciseDetailProvider` si se usa
- cargar detalle completo de un ejercicio
- resolver alternativas
- gestionar media asociada
- reflejar estado de favorito en la ficha

## UX/UI de la biblioteca
La biblioteca debe ser muy cómoda de usar desde móvil.

### Principios UX
- búsqueda visible desde arriba
- filtros accesibles sin ocupar demasiado espacio
- resultados legibles y rápidos de recorrer
- ficha clara, técnica y visual
- buena experiencia tanto con pocos como con muchos resultados

### Elementos UI recomendados para el listado
- campo de búsqueda superior
- fila o panel de filtros
- contador de resultados
- tarjetas o filas de ejercicios
- badge visual de dificultad por color
- botón de favorito por ejercicio
- indicador de carga de más resultados
- estado vacío cuando no haya coincidencias
- estado de error consistente con Bloque 3
- placeholder visual mientras se cargan imágenes

### Elementos UI recomendados para la ficha
- cabecera con imagen y nombre
- bloque de músculos principales y secundarios
- badge visual de dificultad
- bloque de descripción técnica
- pasos de ejecución en formato claro
- bloque de errores comunes
- bloque de alternativas
- media visual si existe
- estado de carga o error para imagen y vídeo si fallan

## Estructura de archivos propuesta
Por coherencia con la estructura actual, se propone añadir como mínimo:

- `lib/models/exercise.dart`
- `lib/models/exercise_media.dart`
- `lib/models/exercise_execution_step.dart`
- `lib/models/exercise_alternative.dart`
- `lib/models/exercise_filters.dart`
- `lib/models/exercise_search_result.dart`
- `lib/models/exercise_enums.dart`
- `lib/models/user_favorites.dart`
- `lib/services/exercise_library_service.dart`
- `lib/services/exercise_library_provider.dart`
- `lib/services/exercise_detail_provider.dart`
- `lib/services/favorites_service.dart`
- `lib/widgets/exercises/exercise_search_bar.dart`
- `lib/widgets/exercises/filter_section.dart`
- `lib/widgets/exercises/filter_chip_group.dart`
- `lib/widgets/exercises/exercise_list_item.dart`
- `lib/widgets/exercises/exercise_difficulty_badge.dart`
- `lib/widgets/exercises/exercise_favorite_button.dart`
- `lib/widgets/exercises/exercise_image_view.dart`
- `lib/widgets/exercises/exercise_empty_state.dart`
- `lib/widgets/exercises/exercise_error_state.dart`
- `lib/widgets/exercises/exercise_detail_header.dart`
- `lib/widgets/exercises/exercise_step_list.dart`
- `lib/widgets/exercises/exercise_common_errors_card.dart`
- `lib/widgets/exercises/exercise_alternatives_section.dart`
- actualización de `lib/screens/exercises_screen.dart`
- nueva pantalla de detalle, por ejemplo `lib/screens/exercise_detail_screen.dart`

## Navegación e integración con bloques anteriores
La biblioteca debe integrarse con lo ya construido:
- mantener el tema visual de los Bloques 1, 2 y 3
- reutilizar el patrón de estados visuales vacío y error ya establecido
- permitir que futuros bloques enlacen ejercicios desde entrenamientos, rutinas e Inicio
- quedar preparada para que las alternativas de ejercicio puedan usarse después en rutinas personalizadas
- permitir que los favoritos puedan aprovecharse después en rutinas, sugerencias o accesos rápidos

## Decisiones técnicas recomendadas
- usar `Hive` como catálogo local inicial
- usar `Provider` para listado y detalle
- implementar paginación simple por lotes en vez de scroll infinito complejo en esta fase
- aplicar fuzzy search con puntuación de similitud
- mantener lógica OR en filtros múltiples de músculos y equipos
- diseñar fichas de ejercicio con estructura muy clara para consulta en móvil
- usar carga diferida de imágenes con placeholder y control de error

## Mejoras descartadas por ahora
No se incorporarán en este bloque, por ahora:
- búsqueda por popularidad
- historial de búsquedas

## Resultado esperado
Al finalizar este bloque, Fit Loren debería quedar con:
- biblioteca de ejercicios funcional
- buscador por nombre en tiempo real
- búsqueda aproximada con similitud
- filtros por músculo, equipo y dificultad
- lógica OR en filtros múltiples de músculos y equipos
- listado visual de ejercicios
- badges visuales de dificultad por color
- sistema de favoritos
- carga diferida de imágenes
- sistema de carga incremental o paginación
- ficha completa por ejercicio
- alternativas para el mismo músculo
- arquitectura preparada para crecer con más ejercicios y futuras rutinas

## Observación importante
Esta propuesta solo define el trabajo técnico del Bloque 4.
No se ejecutará ningún desarrollo ni se realizarán cambios en el proyecto hasta recibir autorización expresa de Lorenzo.
