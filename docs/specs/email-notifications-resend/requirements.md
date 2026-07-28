# Requirements Document

## Introduction

Esta funcionalidad incorpora el envío de correos electrónicos transaccionales mediante Resend a la aplicación multitenant (Next.js 15 App Router + Supabase). Cada tenant es un despliegue independiente en Vercel con su propio proyecto Supabase y su propio conjunto de variables de entorno, por lo que la funcionalidad debe ser genérica y activarse de forma autónoma por tenant.

El sistema enviará correos como complemento de las notificaciones realtime ya existentes, sin reemplazarlas. El envío es opcional por tenant: si un tenant no tiene configurada su clave de Resend, el sistema continúa operando con normalidad y simplemente no envía correos (degradación silenciosa). Antes de enviar, el sistema verifica que el correo del destinatario sea entregable (descartando los correos de marca generados sobre el dominio del propio tenant). Los profesores y administradores pueden personalizar el contenido (asunto y cuerpo) de los correos asociados a cada tipo de notificación mediante un editor de plantillas con variables dinámicas. Cada envío se registra en base de datos para seguimiento.

Los tipos de notificación cubiertos en esta iteración son:
- Confirmación de asistencia a clase singular (alumno → notifica al profesor/admin).
- Cancelación de asistencia a clase singular (alumno → notifica al profesor/admin).
- Solicitud de cambio de horario tras cancelar asistencia (alumno → notifica al profesor/admin).
- Asignación de programa de clases (profesor/admin → notifica al alumno).

Dado que Resend es un servicio externo con cuotas y costo, el sistema incorpora controles de seguridad que limitan la tasa de envío de correos por usuario originador y por destinatario, evitando el spam y la sobrecarga del proveedor. El proyecto ya dispone de infraestructura de limitación de tasa basada en Upstash Redis (`lib/utils/rateLimit.ts`) con degradación a no-op cuando Redis no está configurado, que esta funcionalidad reutiliza.

Tras la implementación genérica, se realiza la activación específica del tenant `pregunta-estrategica` (que ya dispone de cuenta y clave de Resend), dejando preparada la activación trivial del tenant `cta-graduados`.

## Glossary

- **Servicio_Correo**: Componente del lado del servidor responsable de construir y enviar correos electrónicos a través del proveedor Resend.
- **Resend**: Proveedor externo de envío de correo electrónico transaccional, accedido mediante una clave de API.
- **Clave_API_Resend**: Valor secreto de tipo solo-servidor almacenado en la variable de entorno `RESEND_API_KEY`, leído con `process.env`, nunca expuesto al cliente ni incluido en el código fuente.
- **Configuracion_Tenant**: Configuración estática validada con Zod del tenant activo (`tenantConfig`), que incluye el campo `emailDomain`.
- **Dominio_Marca_Tenant**: Valor del campo `tenantConfig.emailDomain` (por ejemplo, `ctagraduados.cl` o `preguntaestrategica.cl`), correspondiente a correos institucionales sin servicio de correo real implementado.
- **Verificador_Destinatario**: Componente del lado del servidor que determina si un correo de destinatario es elegible para envío.
- **Correo_Destinatario**: Valor del campo `email` del registro `profiles` del usuario que recibiría el correo.
- **Correo_Entregable**: Correo de un destinatario cuyo dominio NO coincide con el Dominio_Marca_Tenant y que tiene un formato de correo válido.
- **Plantilla_Correo**: Conjunto de asunto y cuerpo personalizables asociado a un Tipo_Notificacion y propiedad de un usuario profesor o administrador.
- **Plantilla_Default**: Contenido de asunto y cuerpo por defecto, formal y completo, utilizado cuando un usuario no ha personalizado una Plantilla_Correo.
- **Editor_Plantillas**: Vista de la interfaz de usuario donde un profesor o administrador edita sus Plantillas_Correo.
- **Variable_Dinamica**: Marcador de posición con sintaxis de llaves (por ejemplo, `{hora_inicio}`, `{nombre_alumno}`, `{enlace_clase}`) que el Servicio_Correo sustituye por datos reales al momento del envío.
- **Enlace_Clase**: URL absoluta construida a partir de `NEXT_PUBLIC_APP_URL` que dirige a la clase u horario referenciado por la notificación.
- **Clase_Singular**: Horario individual de clase creado mediante la ruta `POST /api/horarios` por un Usuario_Editor y asociado a un Alumno destinatario.
- **Invitacion**: Registro de la tabla `invitations` que representa la invitación de acceso de un usuario recién creado y que contiene un campo `code`.
- **Enlace_Acceso**: URL absoluta de configuración de acceso construida con el formato `${NEXT_PUBLIC_APP_URL}/setup/${code}`, donde `code` es el campo `code` de la Invitacion, que dirige a la página `/setup/[code]` donde el usuario recién creado establece su contraseña e ingresa a la plataforma.
- **Modo_Vista_Previa**: Estado del Editor_Plantillas en el que el contenido del campo `cuerpo_html` se muestra renderizado como HTML en lugar de como texto editable.
- **Modo_Edicion**: Estado del Editor_Plantillas en el que el contenido del campo `cuerpo_html` se muestra en un campo de texto editable.
- **Registro_Envio**: Fila en la tabla de seguimiento de envíos de correo que documenta cada intento de envío de correo realizado por el Servicio_Correo.
- **Tipo_Notificacion** (también referido como **Tipo_Correo**): Valor del enum `tipo_notificacion` que clasifica una notificación o el correo asociado. Los valores relevantes para esta funcionalidad son `confirmacion`, `cancelacion`, `solicitud_cambio_horario`, `programa_asignado`, `nueva_clase` e `invitacion_acceso`. El valor `nueva_clase` ya existe en el enum `tipo_notificacion`; el valor `invitacion_acceso` se incorpora al enum mediante una Migracion_BD idempotente y la actualización manual de los Tipos_TS.
- **Usuario_Editor**: Usuario con rol `profesor` o `admin`.
- **Alumno**: Usuario con rol `alumno`.
- **Solicitud_Cambio_Horario**: Registro de la tabla `solicitudes_cambio_horario` que representa la propuesta de un Alumno para cambiar el horario de una clase tras cancelar su asistencia, dirigida al profesor propietario del horario.
- **Limitador_Tasa_Correo**: Componente del lado del servidor que restringe la cantidad de envíos de correo permitidos en una ventana de tiempo, reutilizando la infraestructura de Upstash Redis existente (`lib/utils/rateLimit.ts`).
- **Migracion_BD**: Archivo SQL idempotente en `supabase/migrations/` con numeración `NNN_nombre.sql`.
- **Tipos_TS**: Archivo `lib/supabase/types.ts` que define el tipo `Database` y se mantiene manualmente.

## Requirements

### Requisito 1: Configuración de la clave de API de Resend por tenant

**Historia de usuario:** Como operador de un tenant, quiero configurar la clave de API de Resend mediante una variable de entorno solo-servidor, para que cada despliegue pueda habilitar el envío de correos de forma independiente y segura.

#### Criterios de aceptación

1. THE Servicio_Correo SHALL leer la Clave_API_Resend exclusivamente desde la variable de entorno `RESEND_API_KEY` mediante `process.env`.
2. THE Servicio_Correo SHALL tratar la Clave_API_Resend como un valor solo-servidor sin prefijo `NEXT_PUBLIC_`.
3. THE archivo `.env.example` SHALL incluir una entrada `RESEND_API_KEY` cuyo valor sea un marcador de posición que no corresponda a ninguna clave de API de Resend válida ni operativa.
4. THE código fuente de la aplicación SHALL obtener la Clave_API_Resend únicamente desde la variable de entorno, sin valores de clave incrustados de forma literal.
5. IF la variable de entorno `RESEND_API_KEY` está ausente, es una cadena vacía o contiene únicamente espacios en blanco, THEN THE Servicio_Correo SHALL omitir el envío de correo sin lanzar una excepción.
6. WHILE la Clave_API_Resend no está configurada, THE sistema de notificaciones realtime SHALL continuar entregando notificaciones a los destinatarios sin alteración.
7. IF la variable de entorno `RESEND_API_KEY` está ausente, es una cadena vacía o contiene únicamente espacios en blanco, THEN THE Servicio_Correo SHALL permitir que la operación que originó la notificación se complete con éxito conservando todos sus cambios sin revertirlos.
8. WHEN el Servicio_Correo omite el envío de correo por ausencia de la Clave_API_Resend, THE Servicio_Correo SHALL registrar un mensaje de advertencia solo-servidor que indique que el envío de correo está deshabilitado.

### Requisito 2: Verificación del correo del destinatario

**Historia de usuario:** Como operador de un tenant, quiero que el sistema verifique el correo del destinatario antes de enviar, para evitar envíos a direcciones de marca del tenant que no tienen servicio de correo real.

#### Criterios de aceptación

1. WHEN el Servicio_Correo prepara un correo para un destinatario, THE Verificador_Destinatario SHALL evaluar el Correo_Destinatario y determinar si es un Correo_Entregable antes de realizar el envío.
2. WHEN el Verificador_Destinatario evalúa el Correo_Destinatario, THE Verificador_Destinatario SHALL extraer el dominio como la porción posterior al último carácter `@` y normalizarlo a minúsculas para la comparación.
3. IF el dominio normalizado del Correo_Destinatario es igual al Dominio_Marca_Tenant o termina en un punto seguido del Dominio_Marca_Tenant, THEN THE Servicio_Correo SHALL omitir el envío de correo a ese destinatario.
4. IF el Correo_Destinatario está ausente, es una cadena vacía, o no contiene exactamente un carácter `@` con una parte local no vacía y un dominio no vacío que incluya al menos un punto separando dos etiquetas no vacías, THEN THE Servicio_Correo SHALL omitir el envío de correo a ese destinatario.
5. WHERE el Correo_Destinatario es un Correo_Entregable, THE Servicio_Correo SHALL proceder con el envío de correo.
6. WHEN el Verificador_Destinatario omite un envío, THE sistema SHALL permitir que la operación que originó la notificación se complete con éxito.

### Requisito 3: Plantillas de correo por defecto completas

**Historia de usuario:** Como destinatario de un correo, quiero recibir un correo formal y completo aunque el remitente no haya personalizado la plantilla, para entender claramente la notificación.

#### Criterios de aceptación

1. THE Servicio_Correo SHALL definir una Plantilla_Default de asunto y cuerpo para cada uno de los Tipos_Notificacion soportados: `confirmacion`, `cancelacion`, `solicitud_cambio_horario` y `programa_asignado`.
2. IF un Usuario_Editor no ha personalizado la Plantilla_Correo de un Tipo_Notificacion, THEN THE Servicio_Correo SHALL usar la Plantilla_Default correspondiente a ese Tipo_Notificacion para construir el correo.
3. THE Plantilla_Default SHALL incluir el nombre del destinatario, una descripción textual del evento que originó la notificación según su Tipo_Notificacion y el nombre del tenant obtenido de la Configuracion_Tenant.
4. THE Plantilla_Default SHALL producir un correo con asunto no vacío de entre 1 y 200 caracteres y con cuerpo en formato HTML no vacío.
5. WHERE el campo `idioma` del registro `profiles` del destinatario contiene un valor soportado (`es` o `en`), THE Servicio_Correo SHALL construir la Plantilla_Default en ese idioma.
6. IF el campo `idioma` del registro `profiles` del destinatario está ausente o contiene un valor no soportado, THEN THE Servicio_Correo SHALL construir la Plantilla_Default en español.
7. THE Servicio_Correo SHALL derivar la dirección de remitente (`from`) de cada correo construido a partir de la Configuracion_Tenant del tenant activo.

### Requisito 4: Envío de correo en cambios de asistencia a clase singular

**Historia de usuario:** Como profesor o administrador, quiero recibir un correo cuando un alumno confirma o cancela su asistencia a una clase singular, para enterarme del cambio incluso fuera de la aplicación.

#### Criterios de aceptación

1. WHEN un Alumno cambia el estado de asistencia de una clase singular a `confirmado` y el cambio se persiste correctamente, THE Servicio_Correo SHALL preparar un correo de tipo `confirmacion` dirigido al profesor propietario del horario.
2. WHEN un Alumno cambia el estado de asistencia de una clase singular a `cancelado` y el cambio se persiste correctamente, THE Servicio_Correo SHALL preparar un correo de tipo `cancelacion` dirigido al profesor propietario del horario.
3. WHEN un Usuario_Editor cambia el estado de asistencia de una clase singular, THE Servicio_Correo SHALL omitir el envío de correo derivado de ese cambio.
4. WHEN un Alumno cambia el estado de asistencia de una clase singular a `confirmado` o `cancelado`, THE Servicio_Correo SHALL ejecutar la preparación y el envío del correo de forma asíncrona respecto a la respuesta de la actualización de asistencia, de modo que dicha respuesta se devuelva sin esperar a que finalice la operación de correo.
5. IF el envío del correo no finaliza con éxito dentro de 10 segundos o el proveedor Resend devuelve una respuesta de error, THEN THE Servicio_Correo SHALL crear un Registro_Envio con resultado de fallo.
6. IF el envío del correo falla, THEN THE sistema SHALL conservar el cambio de estado de asistencia ya aplicado sin revertirlo.
7. WHEN un Alumno cambia el estado de asistencia de una clase singular a `confirmado` o `cancelado`, THE sistema SHALL crear la notificación realtime existente para el profesor propietario del horario con independencia del resultado del envío de correo.

### Requisito 5: Envío de correo al asignar un programa de clases

**Historia de usuario:** Como administrador o profesor, quiero que el alumno reciba un correo cuando le asigno un programa de clases, para que conozca su nuevo plan por correo además de la notificación en la aplicación.

#### Criterios de aceptación

1. WHEN un Usuario_Editor asigna un programa de clases a un Alumno, THE Servicio_Correo SHALL preparar un correo de tipo `programa_asignado` dirigido a ese Alumno.
2. WHERE el Usuario_Editor que realiza la asignación tiene una Plantilla_Correo personalizada del tipo `programa_asignado`, THE Servicio_Correo SHALL construir el correo con esa Plantilla_Correo.
3. IF el Usuario_Editor que realiza la asignación no tiene una Plantilla_Correo personalizada del tipo `programa_asignado`, THEN THE Servicio_Correo SHALL construir el correo con la Plantilla_Default de ese tipo.
4. IF el envío del correo falla, THEN THE Servicio_Correo SHALL registrar el resultado de fallo en el Registro_Envio y permitir que la asignación del programa se complete con éxito.
5. THE Servicio_Correo SHALL crear la notificación realtime existente de asignación de programa independientemente del resultado del envío de correo.
6. WHEN se asigna un programa a varios Alumnos en una misma operación, THE Servicio_Correo SHALL evaluar y preparar el envío de correo de forma independiente para cada Alumno destinatario, de modo que la omisión o el fallo del correo de un Alumno no impida el procesamiento de los Alumnos restantes.

### Requisito 6: Acceso al editor de plantillas desde el perfil

**Historia de usuario:** Como profesor o administrador, quiero acceder al editor de plantillas desde mi página de perfil cuando el envío de correo está disponible, para personalizar mis correos.

#### Criterios de aceptación

1. WHERE el Usuario_Editor tiene rol `profesor` o `admin`, THE página de perfil SHALL mostrar la sección de configuración de clases existente.
2. WHILE la Clave_API_Resend está configurada para el tenant, THE página de perfil SHALL mostrar al Usuario_Editor un control que abre el Editor_Plantillas.
3. IF la Clave_API_Resend no está configurada para el tenant, THEN THE página de perfil SHALL ocultar el control de acceso al Editor_Plantillas.
4. WHERE el usuario tiene rol `alumno`, THE página de perfil SHALL ocultar el control de acceso al Editor_Plantillas.
5. WHEN un Alumno solicita acceder al Editor_Plantillas, THE sistema SHALL denegar el acceso.

### Requisito 7: Edición de plantillas de correo

**Historia de usuario:** Como profesor o administrador, quiero editar el asunto y el cuerpo de los correos por tipo de notificación, para controlar el mensaje que reciben mis alumnos y otros usuarios.

#### Criterios de aceptación

1. THE Editor_Plantillas SHALL permitir al Usuario_Editor editar el asunto y el cuerpo de la Plantilla_Correo de cada Tipo_Notificacion que el Usuario_Editor puede personalizar.
2. WHEN un Usuario_Editor guarda una Plantilla_Correo, THE sistema SHALL persistir esa Plantilla_Correo asociada al identificador del Usuario_Editor y al Tipo_Notificacion.
3. THE sistema SHALL aplicar la Plantilla_Correo guardada por un Usuario_Editor únicamente a los correos que se originan en notificaciones de ese mismo Usuario_Editor.
4. WHERE el rol del usuario es `alumno`, THE sistema SHALL impedir la creación o modificación de la Plantilla_Correo del tipo `confirmacion` y del tipo `cancelacion`.
5. WHEN un Usuario_Editor restablece una Plantilla_Correo, THE sistema SHALL volver a aplicar la Plantilla_Default correspondiente a ese Tipo_Notificacion.
6. IF un Usuario_Editor guarda una Plantilla_Correo con asunto vacío o cuerpo vacío, THEN THE Editor_Plantillas SHALL rechazar el guardado y mostrar un mensaje de validación.

### Requisito 8: Variables dinámicas en las plantillas

**Historia de usuario:** Como profesor, quiero insertar variables dinámicas en mis plantillas de forma intuitiva, para personalizar cada correo con los datos reales de la clase y el destinatario.

#### Criterios de aceptación

1. THE Editor_Plantillas SHALL mostrar la lista de Variables_Dinamicas disponibles para el Tipo_Notificacion que se está editando, con una descripción de cada variable.
2. WHEN un Usuario_Editor selecciona una Variable_Dinamica disponible, THE Editor_Plantillas SHALL insertar el marcador de posición correspondiente en el campo de texto activo.
3. WHEN el Servicio_Correo construye un correo, THE Servicio_Correo SHALL sustituir cada Variable_Dinamica de la plantilla por su valor real correspondiente al evento.
4. THE conjunto de Variables_Dinamicas SHALL incluir al menos el nombre del destinatario, el nombre del alumno asociado, el título de la clase, la fecha de la clase, `{hora_inicio}`, `{hora_fin}` y `{enlace_clase}`.
5. IF una Variable_Dinamica de la plantilla no tiene valor disponible para el evento, THEN THE Servicio_Correo SHALL sustituir esa Variable_Dinamica por una cadena vacía.

### Requisito 9: Enlaces directos a la clase en los correos

**Historia de usuario:** Como profesor, quiero decidir si el correo incluye un enlace directo a la clase, para que el destinatario pueda abrir la clase desde el correo cuando lo considere útil.

#### Criterios de aceptación

1. THE Servicio_Correo SHALL construir el Enlace_Clase usando el valor de la variable de entorno `NEXT_PUBLIC_APP_URL` como base de la URL.
2. WHERE la plantilla incluye la Variable_Dinamica `{enlace_clase}`, THE Servicio_Correo SHALL sustituir esa variable por el Enlace_Clase de la clase referenciada.
3. WHERE la plantilla no incluye la Variable_Dinamica `{enlace_clase}`, THE Servicio_Correo SHALL enviar el correo sin enlace a la clase.
4. IF el evento de notificación no referencia una clase con identificador, THEN THE Servicio_Correo SHALL sustituir la Variable_Dinamica `{enlace_clase}` por una cadena vacía.

### Requisito 10: Registro y seguimiento de correos enviados

**Historia de usuario:** Como administrador, quiero un registro propio en base de datos de cada correo enviado, para hacer seguimiento de cuántos correos se enviaron, por quién, cuándo y para qué clase.

#### Criterios de aceptación

1. WHEN el Servicio_Correo intenta enviar un correo, THE sistema SHALL crear un Registro_Envio.
2. THE Registro_Envio SHALL incluir el identificador del usuario que originó el envío, el identificador del destinatario, el Tipo_Notificacion, el resultado del envío, la marca de tiempo del intento y, cuando exista, el identificador de la clase asociada.
3. WHEN el Servicio_Correo omite un envío por verificación del destinatario o por ausencia de la Clave_API_Resend, THE sistema SHALL crear un Registro_Envio que indique el resultado de omisión y su motivo.
4. THE sistema SHALL permitir consultar el conteo de Registros_Envio asociados a una clase.
5. THE creación de un Registro_Envio SHALL estar protegida de modo que un Alumno no pueda leer Registros_Envio de otros usuarios.

### Requisito 11: Cambios de base de datos y tipos

**Historia de usuario:** Como desarrollador del proyecto, quiero que los cambios de base de datos sigan la convención del proyecto, para mantener la coherencia y evitar romper la aplicación.

#### Criterios de aceptación

1. WHERE la funcionalidad requiere cambios de esquema, THE proyecto SHALL incluir una Migracion_BD en `supabase/migrations/` con numeración `NNN_nombre.sql` siguiente a la migración existente más alta.
2. THE Migracion_BD SHALL ser idempotente, de modo que su reejecución no produzca errores ni efectos duplicados.
3. WHEN se modifica el esquema de base de datos, THE archivo `Tipos_TS` SHALL actualizarse manualmente para reflejar el nuevo esquema.
4. THE proyecto SHALL evitar el uso de la generación automática de tipos para `Tipos_TS`.

### Requisito 12: Preparación multitenant

**Historia de usuario:** Como operador de cualquier tenant, quiero que la funcionalidad sea genérica para todos los tenants, para activarla únicamente proveyendo la variable de entorno correspondiente.

#### Criterios de aceptación

1. THE Servicio_Correo SHALL determinar la disponibilidad del envío de correo a partir de la variable de entorno y de la Configuracion_Tenant del tenant activo, sin depender de identificadores de tenant codificados de forma literal en la lógica de envío.
2. WHERE un tenant define la variable `RESEND_API_KEY`, THE Servicio_Correo SHALL habilitar el envío de correo para ese tenant sin cambios adicionales en el código.
3. THE Verificador_Destinatario SHALL obtener el Dominio_Marca_Tenant desde `tenantConfig.emailDomain` del tenant activo.

### Requisito 13: Internacionalización de la interfaz

**Historia de usuario:** Como usuario de la aplicación, quiero que la interfaz del editor de plantillas esté traducida, para usarla en mi idioma preferido.

#### Criterios de aceptación

1. THE interfaz del Editor_Plantillas SHALL obtener todos sus textos visibles desde los archivos de mensajes `messages/es.json` y `messages/en.json`.
2. WHEN se añade una clave de texto de interfaz para esta funcionalidad, THE proyecto SHALL añadir esa clave tanto en `messages/es.json` como en `messages/en.json`.
3. THE interfaz de esta funcionalidad SHALL evitar textos visibles codificados de forma literal en los componentes.

### Requisito 14: Activación específica de tenants

**Historia de usuario:** Como operador, quiero activar el envío de correo para `pregunta-estrategica` y dejar preparada la activación de `cta-graduados`, para empezar a enviar correos en el tenant que ya dispone de Resend.

#### Criterios de aceptación

1. THE archivo de variables de entorno del tenant `pregunta-estrategica` SHALL incluir la variable `RESEND_API_KEY` con la clave de la cuenta de Resend asociada a `preguntaestrategica@gmail.com`.
2. WHILE la variable `RESEND_API_KEY` del tenant `pregunta-estrategica` está configurada, THE Servicio_Correo SHALL enviar correos a los destinatarios con Correo_Entregable de ese tenant.
3. WHERE el tenant `cta-graduados` aún no define la variable `RESEND_API_KEY`, THE Servicio_Correo SHALL omitir el envío de correo para ese tenant.
4. WHEN el operador del tenant `cta-graduados` añade la variable `RESEND_API_KEY`, THE Servicio_Correo SHALL habilitar el envío de correo para ese tenant sin cambios adicionales en el código.

### Requisito 15: Envío de correo en solicitud de cambio de horario

**Historia de usuario:** Como profesor o administrador, quiero recibir un correo cuando un alumno solicita un cambio de horario tras cancelar su asistencia, para poder revisar y responder la propuesta incluso fuera de la aplicación.

#### Criterios de aceptación

1. WHEN un Alumno crea una Solicitud_Cambio_Horario y la solicitud se persiste correctamente, THE Servicio_Correo SHALL preparar un correo de tipo `solicitud_cambio_horario` dirigido al profesor propietario del horario original.
2. THE Servicio_Correo SHALL ejecutar la preparación y el envío del correo de forma asíncrona respecto a la respuesta de creación de la Solicitud_Cambio_Horario, de modo que dicha respuesta se devuelva sin esperar a que finalice la operación de correo.
3. WHERE el profesor propietario del horario original tiene una Plantilla_Correo personalizada del tipo `solicitud_cambio_horario`, THE Servicio_Correo SHALL construir el correo con esa Plantilla_Correo.
4. IF el profesor propietario del horario original no tiene una Plantilla_Correo personalizada del tipo `solicitud_cambio_horario`, THEN THE Servicio_Correo SHALL construir el correo con la Plantilla_Default de ese tipo.
5. THE conjunto de Variables_Dinamicas del tipo `solicitud_cambio_horario` SHALL incluir, además de las variables comunes, la fecha propuesta, la hora de inicio propuesta, la hora de fin propuesta y la nota del alumno.
6. IF el envío del correo falla, THEN THE Servicio_Correo SHALL crear un Registro_Envio con resultado de fallo y conservar la Solicitud_Cambio_Horario ya creada sin revertirla.
7. THE sistema SHALL crear la notificación realtime existente de tipo `solicitud_cambio_horario` para el profesor con independencia del resultado del envío de correo.
8. WHERE el rol del usuario es `alumno`, THE sistema SHALL impedir la creación o modificación de la Plantilla_Correo del tipo `solicitud_cambio_horario`.

### Requisito 16: Control de tasa y prevención de abuso de envío de correos

**Historia de usuario:** Como operador de un tenant, quiero que el envío de correos esté limitado en tasa y protegido contra abuso, para evitar el spam a los usuarios y la sobrecarga o el agotamiento de la cuota del servicio Resend.

#### Criterios de aceptación

1. WHEN el Servicio_Correo va a enviar un correo, THE Limitador_Tasa_Correo SHALL evaluar si el envío excede el límite de tasa configurado antes de invocar a Resend.
2. IF el número de correos originados por un mismo usuario originador alcanza el límite definido dentro de la ventana de tiempo configurada, THEN THE Servicio_Correo SHALL omitir los envíos adicionales de ese usuario durante el resto de la ventana.
3. IF el número de correos dirigidos a un mismo Correo_Destinatario alcanza el límite definido dentro de la ventana de tiempo configurada, THEN THE Servicio_Correo SHALL omitir los envíos adicionales a ese destinatario durante el resto de la ventana.
4. WHEN el Limitador_Tasa_Correo omite un envío por exceder el límite de tasa, THE sistema SHALL crear un Registro_Envio que indique el resultado de omisión por límite de tasa y permitir que la operación que originó la notificación se complete con éxito.
5. WHILE las variables de entorno `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` no están configuradas, THE Limitador_Tasa_Correo SHALL permitir los envíos sin bloquear, de forma consistente con el comportamiento de degradación a no-op de la infraestructura de limitación de tasa existente.
6. THE Limitador_Tasa_Correo SHALL aislar los conteos de límite de tasa por identificador de modo que el consumo de un usuario originador o destinatario no afecte el límite de otro.
7. THE endpoint que origina cada envío de correo SHALL exigir un usuario autenticado y verificar su rol antes de preparar el correo, de modo que un Alumno no pueda originar correos de tipos que no le corresponden.
8. THE Servicio_Correo SHALL evitar el envío de más de un correo por el mismo evento de notificación, de modo que un único cambio de estado, solicitud o asignación no genere envíos duplicados al mismo destinatario.

### Requisito 17: Vista previa del cuerpo de la plantilla en el editor

**Historia de usuario:** Como profesor o administrador, quiero alternar entre editar el HTML del cuerpo y ver una vista previa renderizada, para comprobar cómo se verá el correo antes de guardar la plantilla.

#### Criterios de aceptación

1. THE Editor_Plantillas SHALL mostrar un control de alternancia que permita al Usuario_Editor cambiar entre el Modo_Edicion y el Modo_Vista_Previa del campo `cuerpo_html`.
2. WHEN el Editor_Plantillas se abre para una Plantilla_Correo, THE Editor_Plantillas SHALL iniciar en el Modo_Edicion.
3. WHILE el Editor_Plantillas está en el Modo_Vista_Previa, THE Editor_Plantillas SHALL renderizar como HTML el contenido actual del campo `cuerpo_html`.
4. WHEN el Usuario_Editor alterna entre el Modo_Edicion y el Modo_Vista_Previa, THE Editor_Plantillas SHALL conservar el contenido editado del campo `cuerpo_html` sin descartar los cambios no guardados.
5. THE Editor_Plantillas SHALL obtener los textos visibles del control de alternancia desde los archivos de mensajes `messages/es.json` y `messages/en.json` en el namespace `plantillasCorreo`.

### Requisito 18: Envío de correo al crear una clase singular

**Historia de usuario:** Como profesor o administrador, quiero que el alumno reciba un correo cuando le creo una clase singular, para que conozca su nueva clase por correo además de la notificación en la aplicación.

#### Criterios de aceptación

1. WHEN un Usuario_Editor crea una Clase_Singular mediante `POST /api/horarios` y el horario se persiste correctamente, THE Servicio_Correo SHALL preparar un correo de tipo `nueva_clase` dirigido al Alumno asociado a esa Clase_Singular.
2. WHERE el Usuario_Editor que crea la Clase_Singular tiene una Plantilla_Correo personalizada del tipo `nueva_clase`, THE Servicio_Correo SHALL construir el correo con esa Plantilla_Correo.
3. IF el Usuario_Editor que crea la Clase_Singular no tiene una Plantilla_Correo personalizada del tipo `nueva_clase`, THEN THE Servicio_Correo SHALL construir el correo con la Plantilla_Default de ese tipo.
4. THE Servicio_Correo SHALL definir una Plantilla_Default del tipo `nueva_clase` en español y en inglés, con asunto no vacío de entre 1 y 200 caracteres y cuerpo en formato HTML no vacío.
5. WHEN el Servicio_Correo prepara un correo de tipo `nueva_clase`, THE Verificador_Destinatario SHALL evaluar el Correo_Destinatario del Alumno y el Servicio_Correo SHALL omitir el envío cuando el correo no es un Correo_Entregable.
6. THE Servicio_Correo SHALL ejecutar la preparación y el envío del correo de tipo `nueva_clase` de forma asíncrona respecto a la respuesta de creación del horario, de modo que dicha respuesta se devuelva sin esperar a que finalice la operación de correo.
7. IF el envío del correo de tipo `nueva_clase` falla, THEN THE Servicio_Correo SHALL crear un Registro_Envio con resultado de fallo y conservar la Clase_Singular ya creada sin revertirla.
8. WHEN el Servicio_Correo va a enviar un correo de tipo `nueva_clase`, THE Limitador_Tasa_Correo SHALL evaluar el envío conforme al Requisito 16 antes de invocar a Resend.
9. THE conjunto de Variables_Dinamicas del tipo `nueva_clase` SHALL incluir `{titulo_clase}`, `{fecha}`, `{hora_inicio}`, `{hora_fin}`, `{enlace_clase}`, `{nombre_destinatario}` y `{nombre_alumno}`.
10. THE Editor_Plantillas SHALL permitir al Usuario_Editor con rol `profesor` o `admin` editar la Plantilla_Correo del tipo `nueva_clase`.
11. THE Editor_Plantillas SHALL incluir el tipo `nueva_clase` en la lista de Variables_Dinamicas disponibles y el sistema SHALL incluir los correos de tipo `nueva_clase` en el conteo y registro de Registros_Envio.

### Requisito 19: Correo de invitación de acceso al crear un usuario

**Historia de usuario:** Como administrador o profesor que puede crear usuarios, quiero que el usuario recién creado reciba un correo con el enlace para configurar su acceso, para que pueda establecer su contraseña e ingresar a la plataforma.

#### Criterios de aceptación

1. WHEN un Usuario_Editor crea un nuevo usuario con rol `alumno` o `profesor` mediante las rutas `app/api/admin/alumnos`, `app/api/admin/profesores` o `app/api/profesor/alumnos` y el usuario se persiste correctamente con un Correo_Entregable, THE Servicio_Correo SHALL preparar un correo de tipo `invitacion_acceso` dirigido al usuario recién creado.
2. WHEN el Servicio_Correo prepara un correo de tipo `invitacion_acceso`, THE Verificador_Destinatario SHALL evaluar el Correo_Destinatario del usuario recién creado conforme al Requisito 2, y THE Servicio_Correo SHALL omitir el envío cuando el correo coincide con el Dominio_Marca_Tenant o no es un Correo_Entregable.
3. WHEN el Servicio_Correo construye un correo de tipo `invitacion_acceso`, THE Servicio_Correo SHALL construir el Enlace_Acceso con el formato `${NEXT_PUBLIC_APP_URL}/setup/${code}` usando el campo `code` de la Invitacion del usuario recién creado.
4. THE conjunto de Variables_Dinamicas del tipo `invitacion_acceso` SHALL incluir `{enlace_acceso}`, `{email_acceso}` y `{nombre_destinatario}`.
5. THE Servicio_Correo SHALL definir una Plantilla_Default del tipo `invitacion_acceso` en español y en inglés, formal y completa, con asunto no vacío de entre 1 y 200 caracteres y cuerpo en formato HTML no vacío.
6. THE Plantilla_Default del tipo `invitacion_acceso` SHALL incluir la Variable_Dinamica `{enlace_acceso}` en su cuerpo.
7. THE Servicio_Correo SHALL ejecutar la preparación y el envío del correo de tipo `invitacion_acceso` de forma asíncrona respecto a la respuesta de creación del usuario, de modo que dicha respuesta se devuelva sin esperar a que finalice la operación de correo.
8. IF el envío del correo de tipo `invitacion_acceso` falla, THEN THE Servicio_Correo SHALL crear un Registro_Envio con resultado de fallo y permitir que la creación del usuario se complete con éxito sin revertirla.
9. THE proyecto SHALL incorporar el valor `invitacion_acceso` al enum `tipo_notificacion` mediante una Migracion_BD idempotente y actualizar manualmente los Tipos_TS, conforme al Requisito 11.
10. THE Editor_Plantillas SHALL permitir al Usuario_Editor con rol `profesor` o `admin` editar la Plantilla_Correo del tipo `invitacion_acceso`.
11. WHEN el Servicio_Correo intenta enviar un correo de tipo `invitacion_acceso`, THE sistema SHALL crear un Registro_Envio conforme al Requisito 10.
