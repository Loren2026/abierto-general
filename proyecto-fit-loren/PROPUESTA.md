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

### 1. Resumen del día
La pantalla de Inicio mostrará un bloque superior con el estado actual del día.

#### Información a mostrar
- si el usuario ha entrenado hoy o no
- resumen breve de la actividad del día
- mensaje contextual según estado del día

#### Objetivo funcional
Dar al usuario una lectura inmediata de su situación actual nada más abrir la app.

### 2. Próximo entrenamiento
Se incluirá una tarjeta específica con el próximo entrenamiento programado.

#### Información prevista
- nombre o tipo de entrenamiento
- duración estimada
- fecha o día previsto
- estado de disponibilidad

#### Objetivo funcional
Permitir al usuario saber rápidamente qué le toca después, sin tener que navegar a otras secciones.

### 3. Acceso rápido a rutina activa
La pantalla de Inicio tendrá un acceso directo destacado para iniciar la rutina activa del día.

#### Comportamiento esperado
- botón principal visible
- acceso rápido al entrenamiento activo
- preparado para enlazar con el flujo de entrenamiento en bloques posteriores

#### Objetivo funcional
Reducir fricción y convertir la pantalla de Inicio en punto de arranque real del uso diario.

### 4. Días de racha seguidos
Se mostrará un contador de días consecutivos entrenando.

#### Información prevista
- número actual de días de racha
- componente visual motivacional
- mensaje de refuerzo asociado a la constancia

#### Objetivo funcional
Aumentar motivación y sensación de progreso continuo.

### 5. Calendario semanal de entrenamientos
Se implementará una vista semanal compacta dentro de Inicio.

#### Información a representar
- semana actual
- días con entrenamientos programados
- estado de cada día:
  - completado
  - pendiente
  - omitido

#### Objetivo funcional
Dar una visión rápida y útil de la semana sin convertir la pantalla de Inicio en un calendario complejo.

## Modelo de datos propuesto
Para este bloque conviene introducir modelos específicos de planificación y estado diario.

### Modelos recomendados
- `DailyActivitySummary`
- `WorkoutPlan`
- `WeeklyTrainingDay`
- `WeeklyTrainingOverview`
- `StreakStatus`

### Responsabilidad de cada modelo
#### `DailyActivitySummary`
Representará:
- fecha
- si hubo entrenamiento completado o no
- texto resumen del día
- estado diario

#### `WorkoutPlan`
Representará:
- identificador
- nombre del entrenamiento
- tipo
- duración estimada
- fecha programada
- si es la rutina activa

#### `WeeklyTrainingDay`
Representará:
- fecha
- entrenamiento asignado o no
- estado del día

#### `WeeklyTrainingOverview`
Representará:
- rango de semana actual
- lista de días de la semana

#### `StreakStatus`
Representará:
- racha actual
- mejor racha futura si se desea ampliar
- mensaje motivacional calculado

### Enums recomendados
- `DayTrainingStatus` con valores como:
  - `completed`
  - `pending`
  - `skipped`
  - `rest`
- `WorkoutType` si se quiere tipar desde ya el tipo de entrenamiento

## Persistencia local con Hive
Este bloque seguirá usando `Hive` como base de persistencia local.

### Datos a guardar
- resumen de actividad del día
- planificación semanal actual
- próximo entrenamiento
- rutina activa
- estado de racha

### Objetivo de persistencia
Permitir que la pantalla de Inicio pueda abrirse rápidamente con datos locales, incluso antes de que existan integraciones más complejas o sincronización futura.

## Servicio de almacenamiento y consulta
Se recomienda ampliar la capa de servicios existente con un servicio específico para Inicio.

### Servicio recomendado
- `HomeDataService`

### Responsabilidades del servicio
- leer datos necesarios para la pantalla Inicio
- calcular el estado diario
- obtener el próximo entrenamiento
- calcular la racha actual
- construir la vista semanal de entrenamientos
- servir datos listos para la capa visual

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
- exponer resumen del día
- exponer próximo entrenamiento
- exponer rutina activa
- exponer estado de racha
- exponer estado del calendario semanal
- notificar cambios a la interfaz cuando haya actualizaciones

## UX/UI de la pantalla Inicio
La pantalla debe ser visualmente limpia, rápida de entender y útil en pocos segundos.

### Orden visual recomendado
1. saludo o encabezado breve
2. resumen del día
3. tarjeta de próximo entrenamiento
4. botón de rutina activa
5. bloque de racha
6. calendario semanal

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

## Componentes UI recomendados
Para mantener orden y reutilización, conviene dividir Inicio en widgets específicos.

### Widgets sugeridos
- `daily_summary_card.dart`
- `next_workout_card.dart`
- `active_routine_button.dart`
- `streak_card.dart`
- `weekly_calendar_card.dart`
- `week_day_status_chip.dart`

## Estructura de archivos propuesta
Por coherencia con la estructura actual, se propone añadir como mínimo:

- `lib/models/daily_activity_summary.dart`
- `lib/models/workout_plan.dart`
- `lib/models/weekly_training_day.dart`
- `lib/models/weekly_training_overview.dart`
- `lib/models/streak_status.dart`
- `lib/models/home_enums.dart`
- `lib/services/home_data_service.dart`
- `lib/services/home_provider.dart`
- `lib/widgets/home/daily_summary_card.dart`
- `lib/widgets/home/next_workout_card.dart`
- `lib/widgets/home/active_routine_button.dart`
- `lib/widgets/home/streak_card.dart`
- `lib/widgets/home/weekly_calendar_card.dart`
- `lib/widgets/home/week_day_status_chip.dart`
- actualización de `lib/screens/home_screen.dart`

## Navegación e integración con bloques anteriores
La pantalla de Inicio deberá respetar la lógica ya creada en el Bloque 2:
- si el onboarding no está completado, el usuario no debe llegar aquí como flujo inicial
- una vez completado el onboarding, Inicio se convierte en la primera pantalla funcional real
- el acceso rápido a rutina activa quedará preparado para enlazar con futuras pantallas de entrenamiento

## Resultado esperado
Al finalizar este bloque, Fit Loren debería quedar con:
- pantalla de Inicio completa y funcional
- resumen del día visible
- próximo entrenamiento mostrado claramente
- acceso directo a la rutina activa
- contador de racha visible y motivacional
- calendario semanal compacto con estados de cada día
- datos persistidos localmente con Hive
- lógica de Inicio gestionada con `Provider`
- arquitectura lista para ampliar con rutinas reales y seguimiento posterior

## Observación importante
Esta propuesta solo define el trabajo técnico del Bloque 3.
No se ejecutará ningún desarrollo ni se realizarán cambios en el proyecto hasta recibir autorización expresa de Lorenzo.
