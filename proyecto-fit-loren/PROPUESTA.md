# Propuesta técnica de desarrollo, Bloque 3, Fit Loren

## Objetivo
Desarrollar la pantalla de Inicio completa de Fit Loren como panel principal de estado del usuario, mostrando de forma clara su situación diaria, el próximo entrenamiento, la rutina activa, la racha de constancia y la planificación semanal, todo ello sobre una base técnica coherente con los Bloques 1 y 2.

## Enfoque técnico del Bloque 3
Este bloque debe consolidar la pantalla de `Inicio` como centro operativo de la app. No se plantea solo como una pantalla visual, sino como una capa de consulta y presentación de datos ya preparados para evolucionar más adelante hacia planes, rutinas, histórico y seguimiento de progreso.

Por coherencia con la arquitectura ya planteada, este bloque mantendrá:
- Flutter como base única del proyecto
- persistencia local con `Hive`
- gestión de estado con `Provider` y `ChangeNotifier`
- estructura modular de archivos
- tema visual oscuro con acento naranja

## Alcance del Bloque 3

### 1. Saludo personalizado por hora
La pantalla de Inicio mostrará un saludo dinámico usando el nombre del usuario guardado en su perfil.

#### Comportamiento esperado
Se implementará una función que devuelva el saludo según la hora del día:
- `Buenos días`, antes de las 12:00
- `Buenas tardes`, entre las 12:00 y las 18:00
- `Buenas noches`, después de las 18:00

El saludo deberá usar el nombre o apodo del usuario del perfil para personalizar la experiencia.

#### Objetivo funcional
Hacer que la pantalla de Inicio se sienta viva, cercana y contextual desde el primer vistazo.

### 2. Resumen del día
La pantalla de Inicio mostrará un bloque superior con el estado actual del día.

#### Información a mostrar
- si el usuario ha entrenado hoy o no
- resumen breve de la actividad del día
- mensaje contextual según estado del día

#### Objetivo funcional
Dar al usuario una lectura inmediata de su situación actual nada más abrir la app.

### 3. Próximo entrenamiento
Se incluirá una tarjeta específica con el próximo entrenamiento programado.

#### Información prevista
- nombre o tipo de entrenamiento
- duración estimada
- fecha o día previsto
- estado de disponibilidad

#### Objetivo funcional
Permitir al usuario saber rápidamente qué le toca después, sin tener que navegar a otras secciones.

### 4. Acceso rápido a rutina activa
La pantalla de Inicio tendrá un acceso directo destacado para iniciar la rutina activa del día.

#### Comportamiento esperado
- botón principal visible
- acceso rápido al entrenamiento activo
- preparado para enlazar con el flujo de entrenamiento en bloques posteriores

#### Objetivo funcional
Reducir fricción y convertir la pantalla de Inicio en punto de arranque real del uso diario.

### 5. Días de racha seguidos
Se mostrará un contador de días consecutivos entrenando.

#### Información prevista
- número actual de días de racha
- componente visual motivacional
- mensaje de refuerzo asociado a la constancia

#### Objetivo funcional
Aumentar motivación y sensación de progreso continuo.

### 6. Calendario semanal de entrenamientos
Se implementará una vista semanal compacta dentro de Inicio.

#### Información a representar
- semana actual
- días con entrenamientos programados
- estado de cada día:
  - completado
  - pendiente
  - omitido
  - descanso

#### Objetivo funcional
Dar una visión rápida y útil de la semana sin convertir la pantalla de Inicio en un calendario complejo.

### 7. Estado vacío para primer uso
Se diseñará un estado vacío específico para cuando todavía no existan entrenamientos programados.

#### Elementos del estado vacío
- icono representativo
- mensaje motivacional
- botón para comenzar o configurar el siguiente paso

#### Objetivo funcional
Mejorar la experiencia de primer uso y evitar una pantalla vacía o fría cuando aún no hay datos suficientes.

### 8. Manejo de errores unificado
Se definirá un patrón consistente para errores en toda la pantalla de Inicio.

#### Elementos del widget de error
- icono de error
- mensaje principal
- detalle opcional
- botón `Reintentar`

#### Objetivo funcional
Mantener coherencia visual y funcional cuando falle una carga o un cálculo de datos.

### 9. Mensajes motivacionales personalizados durante el entrenamiento
Aunque el flujo completo de entrenamiento pertenezca a bloques posteriores, este bloque dejará definida la base técnica de mensajes motivacionales personalizados.

#### Momentos contemplados
- antes de empezar el entrenamiento
- entre series
- durante el descanso
- al completar el entrenamiento

#### Características del sistema
- listas de mensajes por contexto
- selección aleatoria para evitar repetición constante
- uso del nombre del usuario en todos los mensajes
- mensajes de hidratación durante descansos cuando corresponda

#### Objetivo funcional
Preparar una experiencia más humana, motivadora y personalizada para las sesiones de entrenamiento futuras.

## Modelo de datos propuesto
Para este bloque conviene introducir modelos específicos de planificación, estado diario y presentación de Inicio.

### Modelos recomendados
- `TrainingDay`
- `WorkoutPlan`
- `WeeklyTrainingOverview`
- `StreakStatus`
- `MotivationalMessageSet`

### Fusión de modelos aprobada
Se fusionarán los conceptos de `WeeklyTrainingDay` y `DailyActivitySummary` en un único modelo `TrainingDay`.

#### `TrainingDay` representará
- fecha
- si existe entrenamiento programado
- entrenamiento asociado si aplica
- estado del día
- resumen breve del día
- si el entrenamiento fue completado o no
- información suficiente para alimentar tanto el resumen diario como el calendario semanal

#### `WorkoutPlan` representará
- identificador
- nombre del entrenamiento
- tipo
- duración estimada
- fecha programada
- si es la rutina activa

#### `WeeklyTrainingOverview` representará
- rango de semana actual
- lista de `TrainingDay`

#### `StreakStatus` representará
- racha actual
- posible mejor racha futura si se amplía más adelante
- mensaje motivacional calculado

#### `MotivationalMessageSet` representará
- listas de mensajes para antes de entrenar
- listas de mensajes entre series
- listas de mensajes durante descansos
- listas de mensajes al completar entrenamiento

### Enums recomendados
- `DayTrainingStatus` con valores como:
  - `completed`
  - `pending`
  - `skipped`
  - `rest`
- `WorkoutType`
- `HomeLoadState` para gestionar estados visuales de carga, vacío, listo y error

## Persistencia local con Hive
Este bloque seguirá usando `Hive` como base de persistencia local.

### TypeAdapters obligatorios
Se implementarán `TypeAdapters` para todos los modelos del Bloque 3 con `typeId` específicos.

### Modelos a adaptar
- `TrainingDay`
- `WorkoutPlan`
- `WeeklyTrainingOverview`
- `StreakStatus`
- cualquier enum persistido del Bloque 3

### Ventajas
- mejor rendimiento de lectura y escritura
- persistencia más tipada
- menos transformación manual de datos
- base más robusta para crecimiento posterior

### Datos a guardar
- resumen y estado del día actual
- planificación semanal actual
- próximo entrenamiento
- rutina activa
- estado de racha
- datos de apoyo para mensajes motivacionales si se necesitan más adelante

### Objetivo de persistencia
Permitir que la pantalla de Inicio pueda abrirse rápidamente con datos locales, incluso antes de que existan integraciones más complejas o sincronización futura.

## Servicio de almacenamiento y consulta
Se recomienda ampliar la capa de servicios existente con un servicio específico para Inicio.

### Servicio recomendado
- `HomeDataService`

### Responsabilidades del servicio
- leer datos necesarios para la pantalla Inicio
- calcular el saludo personalizado según hora y nombre del usuario
- calcular el estado diario
- obtener el próximo entrenamiento
- calcular la racha actual
- construir la vista semanal de entrenamientos
- decidir cuándo mostrar estado vacío
- devolver errores estructurados para el widget unificado de error
- servir datos listos para la capa visual

### Estrategia de caché aprobada
`HomeDataService` incorporará una estrategia de caché con duración de 5 minutos.

#### Objetivo de la caché
- reducir cargas repetidas de datos
- evitar recomputaciones innecesarias al volver a Inicio varias veces en pocos minutos
- mantener buena sensación de fluidez

#### Criterio de uso
- si los datos en caché siguen dentro de la ventana de 5 minutos, reutilizarlos
- si la caché ha caducado, recalcular o recargar desde persistencia
- permitir invalidación manual cuando haya cambios relevantes, por ejemplo al completar un entrenamiento

Esto evita meter lógica de negocio dentro de los widgets.

## Gestión de estado con Provider
Se mantendrá el mismo criterio técnico del Bloque 2.

### Decisión técnica
- usar `ChangeNotifier`
- exponer el estado de Inicio mediante `Provider`
- evitar lógica principal repartida con `setState`

### Provider recomendado
- `HomeProvider`

### Responsabilidades de `HomeProvider`
- cargar datos locales al abrir Inicio
- exponer el saludo personalizado
- exponer resumen del día
- exponer próximo entrenamiento
- exponer rutina activa
- exponer estado de racha
- exponer estado del calendario semanal
- exponer estado vacío si no hay entrenamientos
- exponer estado de error unificado si falla algo
- invalidar caché cuando sea necesario
- notificar cambios a la interfaz cuando haya actualizaciones

## UX/UI de la pantalla Inicio
La pantalla debe ser visualmente limpia, rápida de entender y útil en pocos segundos.

### Orden visual recomendado
1. saludo personalizado
2. resumen del día
3. tarjeta de próximo entrenamiento
4. botón de rutina activa
5. bloque de racha
6. calendario semanal
7. estado vacío o error cuando corresponda

### Criterios de diseño
- jerarquía visual clara
- tarjetas compactas y legibles
- uso moderado del color naranja para destacar acciones y estados clave
- fondo `#1a1a1a`
- texto blanco
- estados secundarios en tonos suaves

### Consideraciones UX
- no saturar Inicio con exceso de texto
- mostrar mensajes cortos y accionables
- permitir entender el día actual de un vistazo
- hacer muy visible el acceso a entrenar
- representar la racha sin caer en elementos infantiles o excesivos
- hacer el calendario semanal simple, no un calendario mensual complejo
- dar una buena experiencia tanto si hay datos como si todavía no los hay
- mostrar errores de forma clara, sin tecnicismos innecesarios al usuario

## Componentes UI recomendados
Para mantener orden y reutilización, conviene dividir Inicio en widgets específicos.

### Widgets sugeridos
- `greeting_header.dart`
- `daily_summary_card.dart`
- `next_workout_card.dart`
- `active_routine_button.dart`
- `streak_card.dart`
- `weekly_calendar_card.dart`
- `week_day_status_chip.dart`
- `empty_home_state.dart`
- `home_error_state.dart`

## Sistema de mensajes motivacionales
Se recomienda centralizar esta lógica para facilitar mantenimiento y variedad.

### Servicio o helper recomendado
- `motivational_message_service.dart`

### Responsabilidades
- almacenar listas de mensajes por contexto
- interpolar el nombre del usuario
- seleccionar mensajes aleatorios
- evitar repeticiones inmediatas cuando sea posible

### Contextos de mensajes
- pre entrenamiento
- entre series
- descanso
- fin de entrenamiento

## Estructura de archivos propuesta
Por coherencia con la estructura actual, se propone añadir como mínimo:

- `lib/models/training_day.dart`
- `lib/models/workout_plan.dart`
- `lib/models/weekly_training_overview.dart`
- `lib/models/streak_status.dart`
- `lib/models/motivational_message_set.dart`
- `lib/models/home_enums.dart`
- `lib/services/home_data_service.dart`
- `lib/services/home_provider.dart`
- `lib/services/motivational_message_service.dart`
- `lib/widgets/home/greeting_header.dart`
- `lib/widgets/home/daily_summary_card.dart`
- `lib/widgets/home/next_workout_card.dart`
- `lib/widgets/home/active_routine_button.dart`
- `lib/widgets/home/streak_card.dart`
- `lib/widgets/home/weekly_calendar_card.dart`
- `lib/widgets/home/week_day_status_chip.dart`
- `lib/widgets/home/empty_home_state.dart`
- `lib/widgets/home/home_error_state.dart`
- actualización de `lib/screens/home_screen.dart`

## Mejoras descartadas en esta fase
Se deja constancia de que, por ahora, no se incorporarán en este bloque:
- `StateNotifier`
- lazy loading del calendario
- estrategia de pruebas específica

## Navegación e integración con bloques anteriores
La pantalla de Inicio deberá respetar la lógica ya creada en el Bloque 2:
- si el onboarding no está completado, el usuario no debe llegar aquí como flujo inicial
- una vez completado el onboarding, Inicio se convierte en la primera pantalla funcional real
- el acceso rápido a rutina activa quedará preparado para enlazar con futuras pantallas de entrenamiento
- el nombre del usuario para saludo y mensajes motivacionales se obtendrá del perfil creado en el onboarding

## Resultado esperado
Al finalizar este bloque, Fit Loren debería quedar con:
- pantalla de Inicio completa y funcional
- saludo personalizado por hora usando el nombre del usuario
- resumen del día visible
- próximo entrenamiento mostrado claramente
- acceso directo a la rutina activa
- contador de racha visible y motivacional
- calendario semanal compacto con estados de cada día
- estado vacío cuidado para primer uso
- manejo de errores unificado
- datos persistidos localmente con Hive usando `TypeAdapters`
- caché de 5 minutos en `HomeDataService`
- lógica de Inicio gestionada con `Provider`
- base técnica preparada para mensajes motivacionales personalizados durante entrenamientos futuros
- arquitectura lista para ampliar con rutinas reales y seguimiento posterior

## Observación importante
Esta propuesta solo define el trabajo técnico del Bloque 3.
No se ejecutará ningún desarrollo ni se realizarán cambios en el proyecto hasta recibir autorización expresa de Lorenzo.
