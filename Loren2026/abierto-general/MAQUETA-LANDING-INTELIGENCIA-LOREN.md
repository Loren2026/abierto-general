# Maqueta textual, landing pública de inteligencialoren.com

**Estado:** propuesta textual lista para aprobación  
**Importante:** no ejecutar diseño, desarrollo ni envío de emails todavía. Esperar autorización explícita de Loren.

---

## 1. Hero principal

### Título
**Inteligencia Loren**

### Subtítulo
Tecnología útil, privada y seleccionada con criterio.

### Texto
Una plataforma donde Loren organiza proyectos, accesos y recursos digitales de forma simple, segura y controlada.

### Botones
- **Acceder con código**
- **Solicitar Invitación** *(botón naranja)*

### Comportamiento del botón naranja
Al pulsar **Solicitar Invitación**, se abre un formulario modal o sección desplegable para recoger los datos del usuario interesado.

---

## 2. Qué es Inteligencia Loren

### Título
**Un acceso cuidado, no una plataforma abierta sin filtro**

### Texto
Inteligencia Loren reúne herramientas, proyectos y contenidos digitales que Loren publica, habilita y comparte de forma controlada. Cada acceso se concede de manera individual, con seguimiento y validación.

---

## 3. Cómo funciona

### Título
**Así funciona el acceso**

### Paso 1
**Recibes tu invitación o tu código**  
Loren habilita el acceso de forma individual para cada usuario.

### Paso 2
**Accedes al proyecto autorizado**  
Solo ves el contenido que realmente tienes permitido usar.

### Paso 3
**Activas tu acceso**  
El sistema valida el acceso y lo vincula correctamente.

### Paso 4
**Descargas o utilizas tu contenido**  
Todo de forma sencilla, privada y organizada.

---

## 4. Qué puedes encontrar aquí

### Título
**Proyectos y recursos seleccionados**

### Texto
Aquí no se publica todo. Cada proyecto se revisa, se prepara y se activa cuando Loren decide que está listo para compartirse.

### Tarjetas o bloques sugeridos
- Herramientas privadas
- Recursos exclusivos
- Apps seleccionadas
- Accesos personalizados

---

## 5. Acceso controlado

### Título
**Cada acceso está gestionado de forma individual**

### Texto
El acceso a Inteligencia Loren no es abierto. Cada usuario recibe autorización específica según el proyecto, el momento y el uso previsto. Esto permite mantener orden, privacidad y una mejor experiencia.

---

## 6. Sección de invitación

### Título
**¿No tienes acceso todavía?**

### Texto
Si quieres recibir una invitación, puedes enviar tu solicitud y Loren revisará tus datos antes de habilitar cualquier acceso.

### Botones
- **Acceder con código**
- **Solicitar Invitación** *(botón naranja)*

---

## 7. Formulario al pulsar “Solicitar Invitación”

### Comportamiento
Al pulsar el botón naranja, se abre un formulario visible en modal o bloque expandido.

### Título del formulario
**Solicitar Invitación**

### Texto introductorio
Déjanos tus datos y Loren revisará tu solicitud antes de conceder acceso.

### Campos del formulario
- **Nombre completo**
- **Correo electrónico**
- **Teléfono o WhatsApp** *(opcional, si Loren quiere contacto rápido)*
- **Proyecto o motivo de interés**
- **Mensaje adicional**
- **Aceptación de privacidad**

### Botón del formulario
- **Enviar solicitud**

### Comportamiento funcional previsto
Al enviar el formulario:
1. se validan los campos obligatorios,
2. se registra la solicitud,
3. se envía un **email a Loren** con los datos recibidos,
4. se muestra un mensaje de confirmación al usuario.

### Mensaje de éxito
**Solicitud enviada correctamente. Loren revisará tu petición y, si procede, te enviará una invitación.**

### Nota importante de implementación
El envío de email a Loren queda definido como requisito funcional, pero **no debe ejecutarse ni desarrollarse todavía sin autorización explícita**.

---

## 8. Footer mínimo

### Contenido sugerido
- Inteligencia Loren
- Acceso privado y gestionado
- Enlace a privacidad
- Enlace a acceso/login

---

## 9. Recomendación de tono visual

### Estilo
- limpio
- elegante
- moderno
- sin saturación
- con sensación de orden y confianza

### Recomendación de color para CTA
- botón principal: verde o color principal del sistema
- botón **Solicitar Invitación**: **naranja**, claramente visible pero equilibrado

---

## 10. Recomendación técnica

### Estructura sugerida
- `/` → landing pública
- `/login` o `/acceso` → acceso con código
- formulario de invitación integrado en la landing
- backend preparado para:
  - recibir solicitud
  - validarla
  - enviar email a Loren

### Integración con el sistema de invitaciones
La landing debe encajar con el flujo real ya definido:
- usuario con código → entra al acceso correspondiente
- usuario sin código → solicita invitación
- Loren decide manualmente si concede acceso

---

## 11. Cierre recomendado para aprobación

Esta maqueta define:
- estructura completa de secciones,
- copy base listo para revisar,
- integración conceptual con códigos e invitaciones,
- formulario con envío de email a Loren como requisito funcional,
- y la regla de **esperar autorización antes de ejecutar nada**.
