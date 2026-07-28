# Requirements Document

## Introduction

Esta feature agrega una configuración por profesor llamada **límite de cancelación de clase** (`cancellation_deadline_hours`). Cada profesor puede definir cuántas horas antes del inicio de una clase es el último momento en que sus alumnos pueden cambiar el estado de asistencia (confirmar o cancelar). El valor por defecto es `0`, que preserva el comportamiento actual: el alumno puede cambiar hasta el momento exacto en que comienza la clase.

La validación es **exclusivamente del lado del servidor** (API Route). Aunque el cliente muestre botones habilitados por error, la request debe ser rechazada si el plazo ya venció. El cliente también debe reflejar el estado correcto para una buena UX, pero no es la línea de defensa principal.

La configuración vive en `profiles.cancellation_deadline_hours` (columna nueva en la tabla `profiles`), junto a `duracion_clase_default_min` que ya existe. Se expone y edita en la página `/perfil` del profesor, en la misma sección donde ya aparece la duración de clase por defecto.

---

## Glossary

- **Sistema**: La aplicación CTA Graduados (Next.js + Supabase).
- **Profesor**: Usuario con rol `profesor` o `admin` en la tabla `profiles`.
- **Alumno**: Usuario con rol `alumno` en la tabla `profiles`.
- **Clase**: Registro en la tabla `horarios` con `fecha`, `hora_inicio` y `hora_fin`.
- **Asistencia**: Registro en la tabla `asistencia` que vincula un alumno con una clase y tiene un `estado` (`pendiente`, `confirmado`, `cancelado`, `cambiado`).
- **Límite_Cancelación** (`cancellation_deadline_hours`): Número entero de horas (≥ 0) configurado por el profesor. Indica cuántas horas antes del inicio de la clase es el último momento en que el alumno puede cambiar el estado de su asistencia.
- **Plazo_Vencido**: Condición que se cumple cuando `now() >= hora_inicio_clase - cancellation_deadline_hours`.
- **API_Asistencia**: La API Route `PATCH /api/asistencia/[id]` que procesa cambios de estado de asistencia.
- **API_Perfil**: La API Route `PATCH /api/perfil` que procesa actualizaciones del perfil del usuario.
- **Validador_Asistencia**: La función pura `validateEstadoChange` en `lib/validations/asistencia.ts`.
- **Perfil_Page**: La página `/perfil` del dashboard donde el usuario edita su información.

---

## Requirements

### Requirement 1: Columna de configuración en la base de datos

**User Story:** Como desarrollador, quiero que la tabla `profiles` tenga una columna `cancellation_deadline_hours`, para que cada profesor pueda tener su propio límite de cancelación persistido en la base de datos.

#### Acceptance Criteria

1. THE Sistema SHALL agregar la columna `cancellation_deadline_hours INTEGER NOT NULL DEFAULT 0` a la tabla `public.profiles` mediante una migración SQL con guarda `IF NOT EXISTS`.
2. THE Sistema SHALL aplicar una restricción `CHECK (cancellation_deadline_hours >= 0)` sobre la columna `cancellation_deadline_hours`, incluso si la columna ya existía sin dicha restricción.
3. WHEN la columna ya existe en la base de datos con el valor por defecto correcto pero sin la restricción `NOT NULL` o `CHECK`, THE Sistema SHALL aplicar las restricciones faltantes para que el requisito se considere completo.
4. THE Sistema SHALL actualizar manualmente los tipos TypeScript en `lib/supabase/types.ts` para incluir `cancellation_deadline_hours: number` en los tipos `Row`, `Insert` y `Update` de la tabla `profiles`.

---

### Requirement 2: Edición del límite en la página de perfil del profesor

**User Story:** Como profesor, quiero poder configurar cuántas horas antes de una clase es el límite para que mis alumnos puedan cambiar su estado de asistencia, para que el sistema aplique automáticamente esa restricción.

#### Acceptance Criteria

1. WHEN el usuario autenticado tiene rol `profesor` o `admin` y accede a `/perfil`, THE Perfil_Page SHALL mostrar un campo numérico para editar `cancellation_deadline_hours`, ubicado en la misma sección que `duracion_clase_default_min`.
2. THE Perfil_Page SHALL inicializar el campo con el valor actual de `cancellation_deadline_hours` del perfil cargado desde la API.
3. WHEN el profesor ingresa un valor en el campo `cancellation_deadline_hours`, THE Perfil_Page SHALL aceptar únicamente enteros entre 0 y 168 (inclusive).
4. WHEN el profesor guarda el formulario de información personal, THE Perfil_Page SHALL incluir `cancellation_deadline_hours` en el body del `PATCH /api/perfil`.
5. WHEN el usuario autenticado tiene rol `alumno`, THE Perfil_Page SHALL omitir el campo `cancellation_deadline_hours`.

---

### Requirement 3: Persistencia del límite vía API de perfil

**User Story:** Como profesor, quiero que el valor de `cancellation_deadline_hours` que ingreso en mi perfil se guarde correctamente en la base de datos, para que el sistema lo use al validar cambios de asistencia.

#### Acceptance Criteria

1. WHEN `PATCH /api/perfil` es llamado con `cancellation_deadline_hours` en el body y el usuario autenticado tiene rol `profesor` o `admin`, THE API_Perfil SHALL validar que el valor sea un entero entre 0 y 168 (inclusive). Esta validación aplica únicamente cuando el endpoint es invocado, no en ningún otro contexto.
2. IF `cancellation_deadline_hours` no es un entero o está fuera del rango [0, 168], THEN THE API_Perfil SHALL retornar HTTP 400 con un mensaje de error descriptivo.
3. WHEN la validación es exitosa, THE API_Perfil SHALL persistir `cancellation_deadline_hours` en la columna correspondiente de `profiles` para el usuario autenticado.
4. WHEN el usuario autenticado tiene rol `alumno`, THE API_Perfil SHALL ignorar el campo `cancellation_deadline_hours` aunque venga en el body de la request.

---

### Requirement 4: Validación del plazo en el servidor al cambiar estado de asistencia

**User Story:** Como administrador del sistema, quiero que el servidor rechace cualquier cambio de estado de asistencia de un alumno cuando el plazo configurado por el profesor ya venció, para garantizar que la restricción se cumpla independientemente del estado del cliente.

#### Acceptance Criteria

1. WHEN `PATCH /api/asistencia/[id]` recibe una request de un alumno para cambiar el estado de asistencia, THE API_Asistencia SHALL obtener el valor de `cancellation_deadline_hours` del profesor dueño de la clase.
2. WHEN el alumno intenta cambiar el estado y `now() >= hora_inicio_clase - cancellation_deadline_hours horas`, THE API_Asistencia SHALL rechazar la request con HTTP 403 y un mensaje de error indicando que el plazo para modificar la asistencia ha vencido.
3. WHEN `cancellation_deadline_hours` del profesor es `0`, THE API_Asistencia SHALL aplicar la regla existente: el alumno puede cambiar el estado hasta el momento exacto en que comienza la clase (comportamiento actual preservado).
4. WHEN el usuario autenticado tiene rol `profesor` o `admin` y es el profesor dueño de la clase (`horarios.profesor_id = user.id`), THE API_Asistencia SHALL ignorar la restricción de `cancellation_deadline_hours` y permitir el cambio de estado sin restricción de tiempo. WHEN el usuario tiene rol `profesor` pero no es el dueño de la clase, THE API_Asistencia SHALL aplicar las mismas restricciones que a un alumno.
5. THE Validador_Asistencia SHALL recibir `cancellationDeadlineHours: number` como parámetro adicional en `ValidateEstadoChangeParams` y aplicar la lógica de Plazo_Vencido antes de verificar si la clase terminó.

---

### Requirement 5: Cálculo correcto del plazo usando hora del servidor

**User Story:** Como desarrollador, quiero que el cálculo del plazo vencido use la hora del servidor (no la del cliente), para evitar manipulaciones desde el navegador.

#### Acceptance Criteria

1. WHEN THE API_Asistencia evalúa si el Plazo_Vencido aplica para un alumno, THE API_Asistencia SHALL obtener la hora actual usando la función RPC `get_server_time()` de Supabase (ya existente en el sistema).
2. WHEN `cancellation_deadline_hours > 0`, THE API_Asistencia SHALL calcular el límite como `new Date(horario.fecha + 'T' + horario.hora_inicio)` menos `cancellation_deadline_hours * 3600 * 1000` milisegundos.
3. WHEN `cancellation_deadline_hours = 0`, THE API_Asistencia SHALL usar `hora_inicio` como límite, de modo que el alumno puede cambiar hasta el momento exacto en que comienza la clase.
4. IF `get_server_time()` falla o retorna null, THEN THE API_Asistencia SHALL retornar HTTP 500 para evitar bypass por error.

---

### Requirement 6: Feedback visual en el cliente

**User Story:** Como alumno, quiero ver claramente cuándo ya no puedo cambiar el estado de mi clase, para no intentar acciones que el servidor rechazará.

#### Acceptance Criteria

1. WHEN el cliente carga los datos de una clase y `cancellation_deadline_hours > 0` y el Plazo_Vencido aplica (es decir, `now() >= hora_inicio_clase - cancellation_deadline_hours horas`), THE Sistema SHALL deshabilitar los botones de confirmar/cancelar asistencia para el alumno.
2. WHEN los botones están deshabilitados por Plazo_Vencido, THE Sistema SHALL mostrar un mensaje informativo indicando que el plazo para modificar la asistencia ha vencido.
3. WHEN `cancellation_deadline_hours = 0`, THE Sistema SHALL aplicar la lógica especial de plazo cero: los botones permanecen habilitados hasta el momento exacto en que la clase comienza, y se deshabilitan únicamente cuando la clase ya inició. WHEN `cancellation_deadline_hours = 0` y la clase aún no ha comenzado, THE Sistema SHALL mantener los botones habilitados.
4. WHEN la API retorna HTTP 403 con error de plazo vencido, THE Sistema SHALL mostrar un toast de error con el mensaje recibido del servidor.

---

### Requirement 7: Exposición del límite en las respuestas de la API de horarios

**User Story:** Como desarrollador, quiero que las respuestas de la API que devuelven datos de clases incluyan `cancellation_deadline_hours` del profesor, para que el cliente pueda calcular el estado de los botones sin una llamada adicional.

#### Acceptance Criteria

1. WHEN `GET /api/asistencia` retorna registros de asistencia con datos del horario, THE API_Asistencia SHALL incluir `cancellation_deadline_hours` del profesor en el objeto `horario` anidado.
2. WHEN las queries de horarios en el cliente incluyen datos del profesor, THE Sistema SHALL seleccionar `cancellation_deadline_hours` del perfil del profesor junto con los demás campos del horario.
3. THE Sistema SHALL actualizar los tipos TypeScript relevantes en el cliente para reflejar la presencia de `cancellation_deadline_hours` en los objetos de horario enriquecidos.
