# GestActas — Propuesta actual

## Paso en curso
Implementar el primer flujo funcional de datos para comunidades y propietarios, sustituyendo el contenido estático por lectura/escritura real en IndexedDB.

## Qué propongo hacer
He revisado la estructura actual de GestActas y la base ya está preparada para arrancar: existe bootstrap, router, store, esquema de IndexedDB y módulos separados para comunidades y propietarios. Sin embargo, los módulos de comunidades y propietarios siguen como placeholders y la UI de `index.html` todavía muestra datos fijos.

Propongo que el siguiente paso de desarrollo sea convertir ese bloque en un primer vertical slice funcional, concretamente:
1. Implementar los repositorios de comunidades y propietarios para listar, crear y consultar datos en IndexedDB.
2. Añadir servicios mínimos para inicializar datos de ejemplo controlados o gestionar altas básicas.
3. Conectar la UI de comunidades para renderizar el listado real y preparar el alta de una comunidad con sus propietarios.
4. Dejar enlazada la navegación comunidad -> detalle con datos persistidos, sin tocar todavía juntas, grabación ni generación de actas.

Con este paso tendríamos una base real sobre la que seguir construyendo, evitando avanzar sobre pantallas puramente estáticas.

## Archivos afectados
- gestactas/src/modules/comunidades/comunidades.repository.js
- gestactas/src/modules/comunidades/comunidades.service.js
- gestactas/src/modules/comunidades/comunidades.ui.js
- gestactas/src/modules/propietarios/propietarios.repository.js
- gestactas/src/modules/propietarios/propietarios.service.js
- gestactas/src/modules/propietarios/propietarios.ui.js
- gestactas/index.html
- gestactas/src/core/bootstrap.js

## Esperando autorización
SÍ
