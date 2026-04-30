# Propuesta técnica de desarrollo, Bloque 2, Fit Loren

## Objetivo
Desarrollar el onboarding completo de Fit Loren con una base técnica sólida en Flutter, de forma que el usuario pueda configurar su perfil inicial mediante un flujo guiado, con persistencia local robusta, navegación centralizada y una arquitectura preparada para crecer en siguientes bloques.

## Enfoque técnico del Bloque 2
Este bloque no se plantea solo como una secuencia de pantallas, sino como la base estructural del perfil inicial del usuario dentro de la app. Por ello, además del flujo visual, se definirá el modelo de datos, la persistencia local, la gestión de estado y la organización de archivos necesarias para que el onboarding sea mantenible y escalable.

## Alcance del Bloque 2

### 1. Tarea inicial de limpieza obligatoria
Antes de crear cualquier archivo Flutter nuevo dentro del repositorio `abierto-fit-loren`, deberá ejecutarse una limpieza inicial del material anterior no válido para esta fase.

#### Archivos a eliminar del repo `abierto-fit-loren`
- `index.html`
- `entrenamiento.html`
- `ficha-ejercicio.html`
- `manifest.json`
- `service-worker.js`
- `vercel.json`

#### Condición de ejecución
Esta limpieza deberá realizarse obligatoriamente antes de crear nuevos archivos Flutter del Bloque 2, para evitar mezclar restos de la versión web anterior con la nueva estructura móvil de la app.

### 2. Pantalla de bienvenida
Se desarrollará una pantalla inicial de onboarding con:
- Logo de Fit Loren
- Botón `Comenzar`

Esta pantalla actuará como punto de entrada al flujo de configuración inicial.

## 3. Modelo de datos `UserProfile`
Se definirá un modelo central `UserProfile` que contendrá todos los datos recopilados en el onboarding.

### Campos del modelo
#### Datos obligatorios
- nombre o apodo
- sexo
- fecha de nacimiento
- altura
- peso
- objetivo físico principal
- nivel de experiencia
- días disponibles por semana
- duración media de sesión
- entorno de entrenamiento

#### Datos opcionales
- lesiones o limitaciones físicas
- material disponible en casa

### Enums requeridos
Se crearán enums para evitar strings dispersos y mejorar el tipado del proyecto:
- `Sex`
- `FitnessGoal`
- `ExperienceLevel`
- `TrainingEnvironment`

Esto facilitará validaciones, mantenimiento, persistencia y futura evolución del perfil.

## 4. Persistencia local con Hive
La decisión técnica para este bloque será usar `Hive` como sistema de persistencia local.

### Motivos de la elección
- Ligero y rápido
- Adecuado para Flutter móvil
- Más escalable que guardar todo en preferencias simples
- Conveniente para almacenar el perfil completo del usuario de forma estructurada

### Uso previsto de Hive
Se definirá almacenamiento local para:
- datos completos de `UserProfile`
- estado de finalización del onboarding
- futura reutilización de datos desde otras secciones de la app, como `Perfil`

### Servicio de persistencia
Se implementará un servicio dedicado:
- `lib/services/local_storage_service.dart`

Este servicio será responsable de:
- inicializar Hive
- guardar `UserProfile`
- leer `UserProfile`
- guardar el flag de onboarding completado
- consultar si el onboarding debe mostrarse o no al iniciar la app

## 5. Gestión de estado con Provider
La gestión del flujo del onboarding se realizará con `Provider` y `ChangeNotifier`.

### Decisión técnica
- Se usará `ChangeNotifier` para representar el estado del onboarding
- Se usará `Provider` para exponer ese estado a las pantallas y widgets del flujo
- No se usará `setState` como mecanismo principal de control del onboarding

### Ventajas
- mejor separación entre UI y lógica
- flujo más limpio y mantenible
- facilidad para validar pasos, guardar datos parciales y controlar navegación
- base adecuada para futuras ampliaciones

## 6. Flujo guiado paso a paso con agrupación lógica
No se usará un diseño de un único campo por pantalla, porque penaliza la experiencia de uso. En su lugar, los datos se agruparán en pasos lógicos.

### Propuesta de agrupación de pasos
1. Bienvenida
   - logo
   - botón `Comenzar`

2. Identidad básica
   - nombre o apodo
   - sexo

3. Datos físicos
   - fecha de nacimiento
   - altura
   - peso

4. Objetivo y nivel
   - objetivo físico principal
   - nivel de experiencia

5. Disponibilidad
   - días disponibles por semana
   - duración media de sesión

6. Entorno de entrenamiento
   - gimnasio
   - casa
   - mixto

7. Datos opcionales
   - lesiones o limitaciones físicas
   - material disponible en casa
   - posibilidad de saltar este paso

8. Resumen final
   - revisión de todos los datos introducidos
   - confirmación final antes de guardar

## 7. UX/UI mejorada del onboarding
El onboarding mantendrá el tema base de Fit Loren:
- Fondo: `#1a1a1a`
- Acento: `#E8732A`
- Texto: blanco

Además, se incorporarán las siguientes mejoras de experiencia de usuario:

### Elementos UX/UI requeridos
- barra de progreso visible durante todo el flujo
- progreso real basado en pasos, no en pantallas arbitrarias
- navegación clara entre pasos
- validación de campos obligatorios antes de avanzar
- posibilidad de saltar únicamente los campos opcionales
- teclado numérico para altura y peso
- selector de fecha para la fecha de nacimiento
- tarjetas, selectores o controles cerrados para opciones como objetivo, nivel, sexo y entorno
- pantalla de resumen final antes de guardar

### Mejora funcional importante
Se dejará preparado el modelo y la persistencia para que estos datos puedan editarse más adelante desde la sección `Perfil`, aunque esa edición no forme parte de este bloque.

## 8. Navegación centralizada
La lógica que decide si se muestra el onboarding o la pantalla principal no debe quedar repartida entre pantallas.

### Decisión técnica
Se implementará un punto de arranque centralizado que:
- consulte si el onboarding ya fue completado
- redirija al onboarding si es la primera apertura
- redirija a `Inicio` si el usuario ya completó la configuración inicial

### Comportamiento esperado
- al completar el onboarding se guardará el estado de finalización
- al terminar, el usuario será enviado claramente a la pantalla `Inicio`
- el onboarding no volverá a mostrarse automáticamente en siguientes aperturas

## 9. Estructura de archivos propuesta
Para este bloque se propone la siguiente estructura mínima:

- `lib/models/user_profile.dart`
- `lib/models/enums.dart`
- `lib/services/local_storage_service.dart`
- `lib/screens/onboarding/welcome_screen.dart`
- `lib/screens/onboarding/onboarding_shell.dart`
- `lib/screens/onboarding/summary_screen.dart`
- `lib/widgets/onboarding/progress_header.dart`
- `lib/widgets/onboarding/option_card.dart`
- `lib/widgets/onboarding/step_scaffold.dart`

Si durante el desarrollo hiciera falta dividir pasos concretos en archivos adicionales dentro de `lib/screens/onboarding/`, se mantendrá esta misma organización modular.

## 10. Resultado esperado
Al finalizar este bloque, Fit Loren quedará con:
- pantalla de bienvenida operativa
- flujo completo de onboarding estructurado por pasos lógicos
- modelo `UserProfile` definido
- enums tipados para opciones cerradas
- persistencia local con Hive
- servicio `LocalStorageService` para lectura y escritura local
- gestión de estado con `Provider` y `ChangeNotifier`
- barra de progreso real durante todo el flujo
- validación de datos obligatorios
- campos opcionales saltables
- selector de fecha y entradas numéricas donde corresponda
- pantalla de resumen final antes de guardar
- redirección a `Inicio` al completar el proceso
- bloqueo automático del onboarding tras la primera configuración completada
- base preparada para futura edición del perfil desde `Perfil`

## Observación importante
Esta propuesta solo define el trabajo técnico del Bloque 2.
No se ejecutará ningún desarrollo ni se realizarán cambios en el proyecto hasta recibir autorización expresa de Lorenzo.
