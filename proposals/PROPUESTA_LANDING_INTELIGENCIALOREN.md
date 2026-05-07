# PROPUESTA_LANDING_INTELIGENCIALOREN.md

**Fecha:** 05/05/2026  
**Proyecto:** InteligenciaLoren.com  
**Estado:** Propuesta formal aprobada en concepto  
**Nota importante:** La landing **no se desarrolla todavía**. Queda preparada como propuesta formal y **su ejecución se pospone hasta que el backend esté desplegado en producción**.

---

## 1. Objetivo

Definir la propuesta formal para la **landing pública de `inteligencialoren.com`**, que servirá como puerta de entrada a la plataforma privada de Inteligencia Loren.

La landing debe cumplir cinco objetivos principales:

1. Presentar claramente qué es Inteligencia Loren
2. Explicar qué tipo de aplicaciones existen dentro de la plataforma
3. Mostrar que el acceso es privado y controlado
4. Integrar el sistema de códigos de invitación de forma clara
5. Conducir al usuario a una de dos acciones: **solicitar acceso** o **usar un código**

---

## 2. Estructura recomendada de la página

### 2.1 Hero principal

Primera sección visible al entrar.

**Debe incluir:**
- Nombre principal: **Inteligencia Loren**
- Subtítulo: plataforma privada de herramientas útiles y apps seleccionadas
- Mensaje corto y claro
- CTA principal: **Solicitar acceso**
- CTA secundaria: **Ya tengo código**

**Objetivo:**
Transmitir de inmediato que la plataforma existe, que tiene utilidad real y que el acceso es controlado.

---

### 2.2 Sección “Qué es Inteligencia Loren”

Explicación breve de la plataforma.

**Contenido recomendado:**
- Espacio privado para familia, amigos o personas autorizadas
- Conjunto de aplicaciones útiles seleccionadas por Loren
- Acceso controlado mediante invitación
- Entorno no público y no abierto libremente

**Objetivo:**
Evitar ambigüedad. El visitante debe entender rápido que no es una web pública generalista, sino una plataforma privada y curada.

---

### 2.3 Sección “Apps disponibles”

Tarjetas o bloques visuales para mostrar las aplicaciones activas o previstas.

**Apps previstas en el ecosistema actual:**
- **Fit Loren**
- **GestActas**
- futuras apps privadas que puedan añadirse más adelante

**Cada tarjeta puede incluir:**
- Nombre
- Descripción breve
- Estado: disponible / próxima / privada

**Objetivo:**
Mostrar valor real de la plataforma y hacer tangible el ecosistema de apps.

---

### 2.4 Sección “Cómo funciona el acceso”

Explicación sencilla del sistema de acceso privado.

**Flujo explicado al usuario:**
1. Loren genera un código de invitación
2. El usuario recibe ese código
3. El código se valida y se vincula a un dispositivo
4. Loren puede revocar el acceso en cualquier momento

**Objetivo:**
Dar confianza y claridad sin entrar en detalles técnicos excesivos.

---

### 2.5 Sección “Acceso privado / invitaciones”

Bloque funcional principal de la landing.

**Debe presentar dos caminos:**
- **Tengo un código**
- **Quiero solicitar acceso**

**Objetivo:**
Convertir la landing en una puerta de entrada útil, no solo informativa.

---

### 2.6 Sección “Privacidad y control”

Bloque orientado a reforzar confianza.

**Mensajes clave recomendados:**
- acceso solo por invitación
- vinculación a dispositivo
- control centralizado por Loren
- posibilidad de revocación inmediata
- entorno privado y no abierto al público general

**Objetivo:**
Reforzar la identidad privada y controlada de la plataforma.

---

### 2.7 Footer

**Contenido recomendado:**
- marca o nombre Inteligencia Loren
- recordatorio de que es una plataforma privada
- enlace a acceso / login / solicitud
- contacto opcional si se decide incluirlo

---

## 3. Qué debe mostrar la parte pública

### 3.1 Sí debe mostrar

La parte pública debe incluir únicamente información útil y segura para visitantes externos.

**Debe mostrar:**
- qué es Inteligencia Loren
- qué tipo de apps contiene
- que el acceso es privado
- cómo funciona el sistema de invitación
- botón para solicitar acceso
- botón para usar un código
- una imagen o tono de marca coherente con privacidad, orden y utilidad

---

### 3.2 No debe mostrar

La parte pública no debe exponer información interna o sensible.

**No debe mostrar:**
- panel de administración
- datos de usuarios
- códigos reales de invitación
- estructura interna de seguridad
- arquitectura técnica sensible
- registros de actividad o contenidos privados

**Conclusión:**
La landing debe inspirar confianza, explicar el acceso y mostrar valor, pero sin filtrar detalles internos.

---

## 4. Integración del sistema de códigos de invitación

## 4.1 Flujo A: “Tengo un código”

Este flujo debe permitir al usuario validar su invitación.

**Interfaz propuesta:**
- campo para introducir código
- botón de validación
- respuesta clara si el código es válido, inválido o revocado

**Comportamiento esperado:**
- si el código es válido → continuar al registro/login
- si el código es inválido → mostrar error claro
- si el código fue revocado → mostrar acceso revocado
- si el código es válido pero el dispositivo no corresponde → manejar según reglas de vinculación

---

## 4.2 Flujo B: “Solicitar acceso”

Este flujo debe permitir a una persona pedir acceso a Loren.

**Formulario recomendado:**
- nombre
- email
- mensaje opcional

**Destino:**
- guardar solicitud en backend / Supabase
- revisión posterior desde el panel de Loren

---

## 4.3 Integración backend recomendada

La landing debe integrarse con el backend de InteligenciaLoren, no operar de forma aislada.

**Endpoints futuros previstos:**
- `POST /api/invitations/validate`
- `POST /api/access-requests`

**Ventaja:**
Esto permite que la landing pública y el panel privado compartan lógica y datos, manteniendo una sola fuente de verdad.

---

## 5. Tecnología recomendada

## 5.1 Recomendación principal: React + Vite

La recomendación principal para la landing es:

- **Frontend:** React + Vite

**Motivos:**
- encaja con el stack confirmado del proyecto
- facilita mantenimiento futuro
- simplifica reutilización de componentes
- permite integrar formularios, validación y lógica ligera
- encaja bien con despliegue en el VPS actual
- facilita evolución posterior si la landing crece

---

## 5.2 Alternativa descartada: HTML estático puro

Una landing estática solo tendría sentido si fuera completamente informativa.

Como en este caso habrá previsiblemente:
- formulario de solicitud
- validación de códigos
- integración con backend
- posibles estados dinámicos

**HTML estático no es la mejor opción.**

---

## 5.3 Stack recomendado para la landing

**Frontend:**
- React
- Vite
- CSS simple o Tailwind (según coherencia con resto del ecosistema)

**Backend compartido:**
- Node.js + Express

**Datos y autenticación:**
- Supabase

---

## 6. Dónde se despliega

## 6.1 Recomendación principal

Desplegar la landing en el **mismo VPS**.

---

## 6.2 Estructura de dominios recomendada

**Propuesta:**
- `https://inteligencialoren.com` → landing pública
- `https://panel.inteligencialoren.com` → panel privado
- backend detrás de Traefik, con rutas según se defina para panel y landing

---

## 6.3 Ventajas de esta estructura

- separación clara entre público y privado
- no requiere otra infraestructura
- facilita mantenimiento
- Traefik ya encaja con esta arquitectura
- mantiene el panel aislado del acceso público principal

---

## 7. Recomendación funcional final

La landing debe ser:
- pública
- simple
- privada en tono
- clara en el acceso
- útil desde el primer día

**Acciones principales visibles:**
1. **Solicitar acceso**
2. **Ya tengo código**

---

## 8. Condición de ejecución

Esta propuesta queda **aprobada en concepto**, pero **no debe ejecutarse aún**.

### Regla definida
La landing **no se desarrolla** hasta que el backend seguro del panel esté desplegado correctamente en producción.

Esto implica que antes de ejecutar esta propuesta deben completarse estos hitos:
- despliegue del backend seguro en producción
- configuración real de `.env`
- validación de claves de Supabase
- enrutado `/api` detrás de Traefik
- verificación real de los 5 puntos de seguridad en el panel online

---

## 9. Estado actual de la propuesta

**Documento:** listo  
**Aprobación conceptual:** sí  
**Ejecución:** pendiente  
**Bloqueada por:** despliegue previo del backend seguro en producción

---

## 10. Resumen ejecutivo

La landing pública de `inteligencialoren.com` debe ser la entrada oficial a la plataforma privada de Inteligencia Loren. Debe explicar qué es, mostrar las apps disponibles, dejar claro que el acceso es privado y ofrecer dos caminos: solicitar acceso o validar un código.

La tecnología recomendada es **React + Vite**, desplegada en el **mismo VPS**, con separación clara entre la landing pública (`inteligencialoren.com`) y el panel privado (`panel.inteligencialoren.com`).

La propuesta queda formalmente preparada, pero su ejecución se pospone hasta completar primero el despliegue del backend seguro en producción.
