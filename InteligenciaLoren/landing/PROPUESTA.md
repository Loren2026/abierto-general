# PROPUESTA.md

## Landing pública de InteligenciaLoren.com

**Fecha:** 06/05/2026  
**Proyecto:** InteligenciaLoren.com  
**Área:** Landing pública en dominio raíz  
**Estado:** Pendiente de autorización  
**Ejecución:** No iniciar hasta autorización explícita

---

## 1. Objetivo

Crear una **landing pública en `https://inteligencialoren.com`** que:

- presente el proyecto Inteligencia Loren
- liste las apps disponibles actualmente
- muestre una imagen cuidada, privada y profesional
- enlace al panel en `https://panel.inteligencialoren.com`
- mantenga una estética **oscura, moderna, limpia y responsive**, alineada con el panel actual

La landing debe ser una página pública de presentación, no un área privada ni un sustituto del panel.

---

## 2. Objetivos funcionales

La página debe cumplir estos objetivos funcionales:

1. **Presentación de marca**
   - explicar qué es Inteligencia Loren
   - transmitir orden, utilidad y privacidad

2. **Visibilidad del ecosistema actual**
   - mostrar claramente las dos apps iniciales:
     - Fit Loren
     - GestActas

3. **Acceso al entorno privado**
   - ofrecer botón o enlace claro hacia:
     - `panel.inteligencialoren.com`

4. **Diseño responsive**
   - visualización correcta en móvil, tablet y escritorio

5. **Cohesión visual con el panel**
   - misma familia estética que el panel actual
   - fondo oscuro
   - tipografía limpia
   - tarjetas y bloques sobrios

---

## 3. Contenido propuesto de la landing

## 3.1 Hero principal

Bloque superior con alto impacto visual.

**Contenido recomendado:**
- Título principal: **Inteligencia Loren**
- Subtítulo: plataforma privada de herramientas útiles y apps especializadas
- Texto corto de presentación
- CTA principal: **Entrar al panel**
- CTA secundaria opcional: **Ver aplicaciones**

**Objetivo:**
Explicar en segundos qué es el proyecto y llevar al usuario al panel privado cuando ya sabe a dónde va.

---

## 3.2 Sección “Qué es Inteligencia Loren”

Breve explicación del proyecto.

**Contenido sugerido:**
- ecosistema de herramientas privadas
- apps enfocadas a necesidades reales
- acceso centralizado desde un panel
- evolución por módulos / proyectos

**Objetivo:**
Dar contexto sin sobrecargar técnicamente la página.

---

## 3.3 Sección “Aplicaciones disponibles”

Tarjetas visuales para las apps activas.

### App 1. Fit Loren
**Texto sugerido:**
App orientada al seguimiento, organización y experiencia del ecosistema Fit Loren.

### App 2. GestActas
**Texto sugerido:**
Herramienta para gestión documental y trabajo estructurado con actas y contenido asociado.

**Cada tarjeta debe incluir:**
- nombre
- breve descripción
- estado o badge visual
- diseño coherente con el panel

**Objetivo:**
Hacer tangible el valor actual del proyecto.

---

## 3.4 Sección “Acceso”

Bloque simple que invite a ir al panel.

**Contenido:**
- frase corta del tipo: “Accede al entorno privado desde el panel”
- botón principal hacia:
  - `https://panel.inteligencialoren.com`

**Objetivo:**
Dejar clara la separación entre la página pública y la entrada privada.

---

## 3.5 Footer

**Contenido recomendado:**
- nombre Inteligencia Loren
- texto breve tipo “entorno privado y modular”
- enlace al panel
- posible mención de que el proyecto está en evolución

---

## 4. Diseño visual propuesto

## 4.1 Dirección visual

La landing debe seguir una línea **oscura, elegante, técnica pero humana**.

### Rasgos visuales clave
- fondo oscuro
- contrastes suaves
- acentos luminosos moderados
- tarjetas con bordes suaves
- espaciado amplio
- tipografía muy legible
- sensación premium / privada, no corporativa fría

---

## 4.2 Paleta recomendada

Inspirada en el panel actual:
- fondo principal: azul oscuro / gris muy oscuro
- superficies: gris antracita / azul profundo
- textos: blanco roto / gris claro
- acento principal: azul, cian o violeta suave
- hover y botones: versión más luminosa del color de acento

---

## 4.3 Responsive

La página debe adaptarse correctamente a:
- móvil
- tablet
- escritorio

### En móvil
- hero compacto
- tarjetas en columna
- botones amplios
- tipografía clara

### En escritorio
- hero con más aire
- tarjetas alineadas en grid
- mejor jerarquía visual

---

## 5. Tecnología recomendada

## Recomendación principal

**React + Vite**

### Motivos
- ya encaja con el stack confirmado del proyecto
- coherencia técnica con el resto de InteligenciaLoren
- fácil mantenimiento futuro
- permite evolucionar la landing sin rehacerla
- sencilla de desplegar en el mismo VPS
- facilita compartir estilos/componentes con el panel si más adelante interesa

---

## Alternativa descartada

**HTML estático puro**

Podría hacerse, pero no es la opción recomendada porque:
- rompe coherencia con el resto del stack
- dificulta evolución futura
- complica reutilización de componentes

**Conclusión:** usar React + Vite salvo que se busque una mini-landing extremadamente mínima.

---

## 6. Ubicación y despliegue

## Dominio público
- `https://inteligencialoren.com`

## Panel privado
- `https://panel.inteligencialoren.com`

## Infraestructura recomendada
- mismo VPS actual
- Traefik como router
- landing pública servida como frontend independiente
- panel privado mantenido aparte

### Estructura recomendada
- landing pública en raíz del dominio
- panel en subdominio `panel.`
- backend privado del panel separado de la landing

**Objetivo:**
Mantener clara la separación público / privado.

---

## 7. Estructura técnica recomendada dentro del repo

Ubicación propuesta dentro de `abierto-general`:

```text
InteligenciaLoren/
  landing/
    PROPUESTA.md
    app/                  (o src/ si se implementa con Vite)
    public/
    package.json
```

### Recomendación
Cuando se autorice el desarrollo:
- crear landing como frontend independiente dentro de `InteligenciaLoren/landing/`
- desplegarla como servicio propio
- mantener el panel como servicio distinto

---

## 8. Observaciones de mejora

Estas son mis observaciones para que la landing quede mejor desde el principio:

### 8.1 No sobrecargarla de texto
La landing debe ser clara y elegante. Mejor pocas secciones bien escritas que una página larga con demasiado contenido.

### 8.2 Enfatizar la privacidad
El valor diferencial del proyecto no es “ser una web más”, sino ser un entorno privado, ordenado y útil.

### 8.3 Evitar mezclar lógica de panel con landing
La landing debe ser una vitrina pública, no una extensión del panel ni una interfaz híbrida.

### 8.4 Prepararla para crecer
Aunque ahora solo muestre Fit Loren y GestActas, conviene diseñarla con una estructura escalable para nuevas apps.

### 8.5 Mantener coherencia visual real con el panel
No basta con “usar fondo oscuro”. Conviene tomar como referencia real:
- ritmo de espaciado
- tamaño de títulos
- botones
- tarjetas
- tono cromático del panel

### 8.6 Añadir una microanimación sutil
Opcional, pero recomendable:
- aparición suave de bloques
- hover elegante en tarjetas
- transición suave en botones

Sin excesos. Debe sentirse moderno, no recargado.

---

## 9. Alcance de esta propuesta

Esta propuesta cubre:
- enfoque funcional
- estructura de contenidos
- propuesta visual
- tecnología recomendada
- ubicación de despliegue
- observaciones de mejora

**No incluye todavía desarrollo ni despliegue.**

---

## 10. Condición para iniciar desarrollo

La landing **no debe desarrollarse aún** hasta que:

1. el backend seguro del panel esté desplegado correctamente en producción
2. la seguridad del panel haya sido verificada en producción
3. quede establecida la base de acceso privado

Esto mantiene el orden correcto del proyecto:
- primero infraestructura privada y seguridad
- después capa pública de presentación

---

## 11. Resumen ejecutivo final

La landing pública de `inteligencialoren.com` debe ser una página **oscura, responsive, elegante y alineada con la estética del panel**, con tres misiones claras:

1. presentar el proyecto Inteligencia Loren
2. mostrar las apps disponibles (Fit Loren y GestActas)
3. dirigir al usuario al panel privado en `panel.inteligencialoren.com`

La tecnología recomendada es **React + Vite**, desplegada en el mismo VPS, pero separada funcionalmente del panel.

La propuesta queda lista en documento formal y **pendiente de autorización para ejecución futura**.
