# Requirements Document

## Introduction

Esta funcionalidad permite generar enlaces dinámicos de invitación para que profesores y alumnos se registren por sí mismos, sin que el administrador o el profesor tengan que capturar manualmente los datos del nuevo usuario. El invitado abre el enlace, completa sus propios datos y queda registrado y autenticado de inmediato.

La funcionalidad se integra en una aplicación Next.js multi-tenant que usa Supabase (autenticación, perfiles, RLS), Resend para correos, next-intl para internacionalización y componentes propios en `components/common`. Reutiliza el patrón de la vista `setup/[code]` existente (validación de código vía API + aceptación de Términos y Condiciones) y la estética de la vista de login.

El alcance cubre cuatro áreas: (1) los botones de acceso en las vistas de profesores y alumnos, (2) una vista compartida de gestión de enlaces con listado, filtros y acciones por fila, (3) la vista pública de registro que abre el invitado, y (4) los cambios de base de datos (incluida migración versionada) y la configuración de Google OAuth en Supabase.

## Glossary

- **Sistema**: La aplicación web Next.js multi-tenant en su conjunto.
- **Enlace_Invitacion**: Registro persistente que representa una invitación de registro reutilizable; contiene un código único, el tipo, el creador, el profesor asignado y el estado. Se almacena en la tabla `enlaces_invitacion`.
- **Codigo_Invitacion**: Cadena única y aleatoria, criptográficamente segura, incrustada en la URL del enlace y verificada contra la base de datos.
- **Tipo_Enlace**: Clasificación de un Enlace_Invitacion que indica el rol del usuario a crear; sus valores son `profesor` o `alumno`.
- **Estado_Enlace**: Estado actual de un Enlace_Invitacion; sus valores iniciales son `activo`, `usado` y `deshabilitado`, y el diseño debe permitir agregar estados futuros sin reescribir la lógica de agrupación.
- **Creador**: Perfil (administrador o profesor) que generó el Enlace_Invitacion, referenciado por `created_by`.
- **Profesor_Asignado**: Perfil de profesor (o administrador) al que se asignará automáticamente el alumno que se registre mediante un Enlace_Invitacion de tipo `alumno`.
- **Administrador**: Usuario autenticado cuyo `rol` en `profiles` es `admin`.
- **Profesor_Habilitado**: Usuario autenticado cuyo `rol` es `profesor` y cuyo atributo `puede_crear_alumno` en `profiles` es verdadero.
- **Invitado**: Persona no autenticada que abre un Enlace_Invitacion para registrarse.
- **Vista_Gestion_Enlaces**: Vista compartida nueva donde se crean, listan y administran los Enlace_Invitacion.
- **Vista_Registro**: Vista pública que abre el Invitado al seguir un Enlace_Invitacion, donde completa sus datos y crea su cuenta.
- **Servidor_Registro**: Endpoint de API del lado servidor que valida el Codigo_Invitacion contra la base de datos y crea la cuenta del Invitado.
- **CardActions**: Componente común existente (`components/common/CardActions.tsx`) usado para las acciones por fila.
- **Tabla_Estado**: Tabla colapsable (accordion) que agrupa y muestra los Enlace_Invitacion de un mismo Estado_Enlace.
- **Servicio_Correo**: Servicio de envío de correos basado en Resend (`lib/email/emailService`) ya configurado en el proyecto.
- **Bloque_TyC**: Bloque de aceptación de Términos y Condiciones reutilizado de la vista `setup/[code]`.
- **NEXT_PUBLIC_APP_URL**: Variable de entorno con la URL base de la aplicación, usada para construir la URL completa del enlace.

## Requirements

### Requirement 1: Botón de acceso a enlaces de invitación

**User Story:** Como administrador o profesor habilitado, quiero un botón "Enlace invitación" junto al botón de agregar usuario, para acceder rápidamente a la gestión de enlaces de invitación.

#### Acceptance Criteria

1. WHILE el Administrador visualiza la vista `/admin/profesores`, THE Sistema SHALL mostrar un botón con la etiqueta "Enlace invitación" adyacente al botón "Agregar profesor".
2. WHILE el Administrador visualiza la vista `/admin/alumnos`, THE Sistema SHALL mostrar un botón con la etiqueta "Enlace invitación" adyacente al botón "Agregar alumno".
3. WHILE un Profesor_Habilitado visualiza la vista de alumnos del profesor, THE Sistema SHALL mostrar un botón con la etiqueta "Enlace invitación" adyacente al botón "Agregar alumno".
4. IF el usuario autenticado tiene rol `profesor` y su atributo `puede_crear_alumno` es falso, THEN THE Sistema SHALL no renderizar el botón "Enlace invitación" en la vista de alumnos del profesor.
5. WHEN el Administrador o el Profesor_Habilitado activa el botón "Enlace invitación", THE Sistema SHALL navegar a la Vista_Gestion_Enlaces.
6. THE Sistema SHALL renderizar el botón "Enlace invitación" usando el componente común `Button`.
7. IF un usuario autenticado que no es Administrador ni Profesor_Habilitado solicita la Vista_Gestion_Enlaces mediante una ruta directa, THEN THE Sistema SHALL impedir la presentación de la Vista_Gestion_Enlaces, no mostrar ningún Enlace_Invitacion y, como respuesta observable, redirigir al usuario a la vista principal correspondiente a su rol o mostrar un mensaje de error indicando falta de autorización.

### Requirement 2: Acceso y navegación de retorno de la vista de gestión

**User Story:** Como administrador, quiero llegar a la misma vista de gestión desde profesores o desde alumnos y poder volver al origen, para mantener un flujo de navegación coherente.

#### Acceptance Criteria

1. WHEN el Administrador accede a la Vista_Gestion_Enlaces desde `/admin/profesores` o desde `/admin/alumnos`, THE Sistema SHALL presentar la misma Vista_Gestion_Enlaces con idéntico contenido, listado y acciones, independientemente de la ruta de origen.
2. WHEN el Administrador activa el control de retorno en la Vista_Gestion_Enlaces y existe una vista de origen registrada, THE Sistema SHALL navegar a la ruta de origen registrada (`/admin/profesores` o `/admin/alumnos`).
3. THE Sistema SHALL usar el componente común `BackButton` para el control de retorno.
4. WHEN un Profesor_Habilitado activa el control de retorno en la Vista_Gestion_Enlaces, THE Sistema SHALL navegar a la vista de alumnos del profesor, independientemente de la vista de origen registrada.
5. IF el Administrador activa el control de retorno en la Vista_Gestion_Enlaces y no existe una vista de origen registrada, THEN THE Sistema SHALL navegar a la vista por defecto `/admin/profesores`.
6. WHEN el Administrador accede a la Vista_Gestion_Enlaces desde `/admin/profesores` o desde `/admin/alumnos`, THE Sistema SHALL registrar la ruta exacta de acceso (`/admin/profesores` o `/admin/alumnos`) como vista de origen.

### Requirement 3: Creación de enlaces de invitación

**User Story:** Como administrador o profesor habilitado, quiero crear enlaces de invitación con un solo botón, para invitar usuarios sin capturar sus datos.

#### Acceptance Criteria

1. WHEN el Administrador activa la creación de un Enlace_Invitacion de Tipo_Enlace `profesor`, THE Servidor_Registro SHALL crear un Enlace_Invitacion con `created_by` igual al identificador del Administrador y Estado_Enlace `activo`.
2. WHEN el Administrador activa la creación de un Enlace_Invitacion de Tipo_Enlace `alumno`, THE Servidor_Registro SHALL crear un Enlace_Invitacion con `created_by` igual al identificador del Administrador, el Profesor_Asignado seleccionado por el Administrador y Estado_Enlace `activo`.
3. WHEN un Profesor_Habilitado activa la creación de un Enlace_Invitacion, THE Servidor_Registro SHALL crear un Enlace_Invitacion de Tipo_Enlace `alumno` con `created_by` igual al identificador del Profesor_Habilitado, el Profesor_Asignado igual al identificador del Profesor_Habilitado y Estado_Enlace `activo`.
4. THE Servidor_Registro SHALL generar para cada Enlace_Invitacion un Codigo_Invitacion único y aleatorio de al menos 128 bits de entropía.
5. THE Servidor_Registro SHALL crear cada Enlace_Invitacion solicitado por un usuario autorizado sin imponer un límite máximo en la cantidad de Enlace_Invitacion existentes asociados a ese usuario.
6. IF un Profesor_Habilitado solicita la creación de un Enlace_Invitacion de Tipo_Enlace `profesor`, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de autorización sin persistir ningún Enlace_Invitacion.
7. THE Servidor_Registro SHALL crear cada Enlace_Invitacion sin fecha de expiración.
8. IF un usuario sin rol `admin` ni condición de Profesor_Habilitado solicita crear un Enlace_Invitacion, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de autorización.
9. IF el Servidor_Registro rechaza una solicitud de creación de Enlace_Invitacion, THEN THE Servidor_Registro SHALL garantizar que no se persista ningún Enlace_Invitacion como resultado de esa solicitud.

### Requirement 4: Asignación de profesor en enlaces de alumno

**User Story:** Como administrador, quiero elegir a qué profesor se asignará el alumno que use el enlace, para distribuir correctamente a los alumnos.

#### Acceptance Criteria

1. WHILE el Administrador crea un Enlace_Invitacion de Tipo_Enlace `alumno`, THE Sistema SHALL presentar un selector de Profesor_Asignado poblado con los perfiles del mismo tenant cuyo `rol` es `profesor` o `admin`.
2. THE Sistema SHALL presentar el selector de Profesor_Asignado usando el componente común `AppSelect`.
3. WHERE el Administrador selecciona un perfil con rol `admin` como Profesor_Asignado, THE Servidor_Registro SHALL registrar dicho perfil como Profesor_Asignado del Enlace_Invitacion.
4. WHEN un Invitado se registra mediante un Enlace_Invitacion de Tipo_Enlace `alumno` cuyo Profesor_Asignado pertenece al tenant y mantiene cuenta activa, THE Servidor_Registro SHALL asociar al alumno creado con el Profesor_Asignado del Enlace_Invitacion.
5. WHERE un Enlace_Invitacion de Tipo_Enlace `alumno` no tiene Profesor_Asignado, THE Servidor_Registro SHALL crear al alumno omitiendo la asociación con un profesor.
6. WHEN el Administrador crea un Enlace_Invitacion de Tipo_Enlace `alumno` sin seleccionar un Profesor_Asignado en el selector, THE Servidor_Registro SHALL crear el Enlace_Invitacion sin Profesor_Asignado.
7. IF el Servidor_Registro recibe una solicitud de creación de Enlace_Invitacion de Tipo_Enlace `alumno` cuyo Profesor_Asignado no pertenece al tenant o no tiene rol `profesor` ni `admin`, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de validación y no persistir ningún Enlace_Invitacion como resultado de esa solicitud.
8. IF un Invitado se registra mediante un Enlace_Invitacion de Tipo_Enlace `alumno` cuyo Profesor_Asignado ya no existe o tiene la cuenta desactivada, THEN THE Servidor_Registro SHALL crear al alumno omitiendo la asociación con un profesor.

### Requirement 5: Permisos de visualización y administración de enlaces

**User Story:** Como administrador, quiero ver y administrar todos los enlaces y, como profesor, ver solo los míos, para respetar los límites de cada rol.

#### Acceptance Criteria

1. WHEN el Administrador abre la Vista_Gestion_Enlaces, THE Servidor_Registro SHALL devolver todos los Enlace_Invitacion del tenant del Administrador, incluidos los creados por otros administradores.
2. WHEN un Profesor_Habilitado abre la Vista_Gestion_Enlaces, THE Servidor_Registro SHALL devolver únicamente los Enlace_Invitacion del tenant del Profesor_Habilitado cuyo `created_by` es igual a su identificador.
3. THE Sistema SHALL permitir al Administrador buscar, ordenar, filtrar, crear, editar, deshabilitar, habilitar y eliminar Enlace_Invitacion.
4. THE Sistema SHALL permitir al Profesor_Habilitado ver todos sus propios Enlace_Invitacion y crear únicamente Enlace_Invitacion de Tipo_Enlace `alumno`.
5. IF un Profesor_Habilitado solicita una acción sobre un Enlace_Invitacion cuyo `created_by` no coincide con su identificador, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de autorización, conservar el Enlace_Invitacion sin cambios e indicar el fallo al solicitante.
6. IF un Profesor_Habilitado solicita editar, deshabilitar, habilitar o eliminar cualquier Enlace_Invitacion, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de autorización y conservar el Enlace_Invitacion sin cambios.

### Requirement 6: Listado e información de enlaces

**User Story:** Como administrador, quiero ver el detalle de cada enlace, para saber quién lo creó, cuándo, su estado, su tipo y el profesor asignado.

#### Acceptance Criteria

1. WHILE el Administrador visualiza el listado de Enlace_Invitacion, THE Sistema SHALL mostrar, para cada Enlace_Invitacion, el nombre del Creador, la fecha y hora de creación incluyendo día, mes, año, hora y minuto, el Estado_Enlace y el Tipo_Enlace.
2. WHERE un Enlace_Invitacion tiene Profesor_Asignado, THE Sistema SHALL mostrar el nombre del Profesor_Asignado en la fila correspondiente a ese Enlace_Invitacion.
3. WHERE un Enlace_Invitacion no tiene Profesor_Asignado, THE Sistema SHALL mostrar en la fila correspondiente un indicador que señale la ausencia de Profesor_Asignado.
4. WHEN el Administrador visualiza el listado, THE Sistema SHALL mostrar todos los Enlace_Invitacion del tenant, incluidos los creados por otros administradores.
5. WHILE no existan Enlace_Invitacion para mostrar, THE Sistema SHALL mostrar un mensaje que indique que no hay Enlace_Invitacion en el listado.

### Requirement 7: Agrupación automática por estado en tablas colapsables

**User Story:** Como usuario de la gestión, quiero ver los enlaces agrupados por estado en secciones plegables, para organizar la información sin configuración manual.

#### Acceptance Criteria

1. THE Sistema SHALL agrupar los Enlace_Invitacion en una Tabla_Estado distinta por cada Estado_Enlace presente en los datos, presentando las Tabla_Estado en un orden determinista según el orden de aparición de cada Estado_Enlace en los datos recibidos.
2. THE Sistema SHALL derivar el conjunto de Estado_Enlace mostrados a partir de los datos recibidos, sin una lista de estados fija en el código.
3. WHEN aparece en los datos un Estado_Enlace no contemplado previamente, THE Sistema SHALL renderizar una Tabla_Estado para ese estado sin requerir cambios de código.
4. THE Sistema SHALL renderizar cada Tabla_Estado como un contenedor colapsable usando el componente común `Collapsible`, en estado contraído de forma predeterminada al renderizarse por primera vez.
5. WHEN el usuario activa el encabezado de una Tabla_Estado, THE Sistema SHALL alternar su estado: si está contraída la expande para mostrar los Enlace_Invitacion agrupados en ella, y si está expandida la contrae para ocultarlos.
6. WHILE un Estado_Enlace no tenga Enlace_Invitacion asociados, THE Sistema SHALL omitir la Tabla_Estado de ese estado.
7. WHEN una actualización del listado deja a una Tabla_Estado ya renderizada sin Enlace_Invitacion asociados, THE Sistema SHALL ocultar esa Tabla_Estado en la misma actualización del listado, sin requerir recarga manual de la página.
8. THE Sistema SHALL mostrar en el encabezado de cada Tabla_Estado el nombre del Estado_Enlace agrupado y la cantidad de Enlace_Invitacion contenidos en ella.

### Requirement 8: Acciones por fila sobre los enlaces

**User Story:** Como administrador, quiero eliminar, deshabilitar, editar y compartir cada enlace desde la fila, para gestionarlos con rapidez.

#### Acceptance Criteria

1. THE Sistema SHALL presentar las acciones por fila usando el componente común `CardActions`, mostrando las acciones eliminar, editar, compartir y la acción de alternar estado, donde "deshabilitar" se muestra cuando el Enlace_Invitacion tiene Estado_Enlace `activo` y "habilitar" cuando tiene Estado_Enlace `deshabilitado`.
2. WHEN el Administrador confirma la eliminación de un Enlace_Invitacion, THE Servidor_Registro SHALL marcar el Enlace_Invitacion como eliminado de modo que su Codigo_Invitacion deje de ser válido para registro.
3. WHEN el Administrador deshabilita un Enlace_Invitacion con Estado_Enlace `activo`, THE Servidor_Registro SHALL cambiar su Estado_Enlace a `deshabilitado`.
4. WHEN el Administrador habilita un Enlace_Invitacion con Estado_Enlace `deshabilitado`, THE Servidor_Registro SHALL cambiar su Estado_Enlace a `activo`.
5. IF el Administrador intenta habilitar un Enlace_Invitacion con Estado_Enlace `usado`, THEN THE Servidor_Registro SHALL rechazar la operación, conservar el Estado_Enlace `usado` y mostrar un mensaje de error indicando que un enlace usado no puede reactivarse.
6. WHEN el Administrador edita un Enlace_Invitacion de Tipo_Enlace `alumno` con Estado_Enlace `activo` y modifica el campo de Profesor_Asignado, THE Servidor_Registro SHALL actualizar el Profesor_Asignado al valor seleccionado.
7. IF el Administrador guarda la edición de un Enlace_Invitacion sin modificar el campo de Profesor_Asignado, THEN THE Servidor_Registro SHALL conservar el Profesor_Asignado actual sin cambios.
8. WHEN el Administrador activa la acción de eliminar de un Enlace_Invitacion, THE Sistema SHALL presentar la confirmación de eliminación usando el componente común `ConfirmDeleteModal` antes de marcar el Enlace_Invitacion como eliminado.
9. IF el Administrador cancela la confirmación en el `ConfirmDeleteModal`, THEN THE Sistema SHALL conservar el Enlace_Invitacion sin cambios y no marcarlo como eliminado.
10. IF una operación de eliminar, editar, deshabilitar o habilitar un Enlace_Invitacion falla en el Servidor_Registro, THEN THE Sistema SHALL conservar el Estado_Enlace y el Profesor_Asignado previos del Enlace_Invitacion y mostrar un mensaje de error al Administrador.

### Requirement 9: Compartir enlace al portapapeles

**User Story:** Como creador de enlaces, quiero copiar el enlace al portapapeles con un clic y ver una confirmación, para compartirlo fácilmente.

#### Acceptance Criteria

1. WHEN el usuario activa la acción de compartir de un Enlace_Invitacion, THE Sistema SHALL copiar al portapapeles la URL completa del enlace, formada por el valor base de `NEXT_PUBLIC_APP_URL`, la ruta de la Vista_Registro y el Codigo_Invitacion, unidos con una única barra de separación y sin barras duplicadas.
2. WHEN la copia al portapapeles se completa con éxito, THE Sistema SHALL mostrar un popover de confirmación de "copiado" adyacente al control de compartir activado.
3. WHEN transcurren 2000 milisegundos desde la última vez que se muestra el popover de confirmación sin una nueva activación de la acción de compartir, THE Sistema SHALL ocultar el popover de confirmación automáticamente.
4. WHEN el usuario activa de nuevo la acción de compartir mientras el popover de confirmación está visible, THE Sistema SHALL reiniciar el temporizador de 2000 milisegundos antes de ocultar el popover.
5. IF la copia al portapapeles falla o el portapapeles no está disponible, THEN THE Sistema SHALL mostrar una indicación de error de que el enlace no se copió, omitir el popover de confirmación de éxito y conservar intacto el contenido previo del portapapeles.

### Requirement 10: Filtros del listado

**User Story:** Como administrador, quiero filtrar los enlaces por creador y por tipo, para encontrar los enlaces que busco.

#### Acceptance Criteria

1. THE Sistema SHALL ofrecer un filtro por Creador y un filtro por Tipo_Enlace en la Vista_Gestion_Enlaces.
2. THE Sistema SHALL poblar las opciones de cada filtro dinámicamente a partir de los valores presentes en los Enlace_Invitacion visibles para el usuario según sus permisos.
3. IF un filtro tiene menos de dos valores distintos disponibles en los datos visibles, THEN THE Sistema SHALL deshabilitar ese filtro de modo que su control no permita seleccionar ningún valor.
4. WHEN el usuario selecciona un valor en un único filtro activo, THE Sistema SHALL mostrar, en un máximo de 1 segundo, únicamente los Enlace_Invitacion visibles que coinciden con el valor seleccionado.
5. WHERE no existen Enlace_Invitacion de un Tipo_Enlace determinado entre los datos visibles, THE Sistema SHALL omitir ese valor de las opciones del filtro por Tipo_Enlace.
6. WHILE hay un valor seleccionado en el filtro por Creador y un valor seleccionado en el filtro por Tipo_Enlace, THE Sistema SHALL mostrar únicamente los Enlace_Invitacion visibles que coinciden con ambos valores de forma simultánea.
7. WHEN el usuario quita la selección de uno de los dos filtros activos, THE Sistema SHALL mostrar los Enlace_Invitacion visibles que coinciden con el filtro que permanece seleccionado.
8. WHEN el usuario quita todas las selecciones de los filtros, THE Sistema SHALL mostrar todos los Enlace_Invitacion visibles para el usuario.
9. WHILE la combinación de filtros seleccionados no coincide con ningún Enlace_Invitacion visible, THE Sistema SHALL mostrar un mensaje que indique que no hay Enlace_Invitacion que coincidan con los filtros.

### Requirement 11: Navegación al usuario creado desde un enlace usado

**User Story:** Como administrador, quiero ir desde un enlace usado al usuario que se registró con él, para ver su perfil o sus clases.

#### Acceptance Criteria

1. WHILE un Enlace_Invitacion tiene Estado_Enlace `usado` y el perfil del usuario creado con ese Enlace_Invitacion existe, THE Sistema SHALL mostrar el nombre del usuario creado en la fila correspondiente a ese Enlace_Invitacion.
2. WHILE un Enlace_Invitacion tiene Estado_Enlace `usado` y el perfil del usuario creado con ese Enlace_Invitacion ya no existe, THE Sistema SHALL mostrar en la fila correspondiente un indicador que señale que el usuario creado ya no está disponible.
3. WHERE el Enlace_Invitacion usado es de Tipo_Enlace `alumno` y la cuenta del alumno creado está activa, THE Sistema SHALL ofrecer al Administrador un control para navegar al perfil del alumno creado.
4. WHERE el Enlace_Invitacion usado es de Tipo_Enlace `profesor` y la cuenta del profesor creado está activa, THE Sistema SHALL ofrecer al Administrador un control para navegar a la vista de clases del profesor creado.
5. WHEN el Administrador activa el control de navegación al usuario creado de un Enlace_Invitacion de Tipo_Enlace `alumno`, THE Sistema SHALL navegar a la vista de perfil del alumno creado.
6. WHEN el Administrador activa el control de navegación al usuario creado de un Enlace_Invitacion de Tipo_Enlace `profesor`, THE Sistema SHALL navegar a la vista de clases del profesor creado.
7. IF la cuenta del usuario creado con el Enlace_Invitacion ha sido desactivada o eliminada, THEN THE Sistema SHALL ocultar el control de navegación al usuario creado.

### Requirement 12: Estructura y estética de la vista de registro

**User Story:** Como invitado, quiero una vista de registro clara y coherente con la marca del tenant, para completar mi registro con confianza.

#### Acceptance Criteria

1. WHEN el Invitado abre un Enlace_Invitacion con Estado_Enlace `activo`, THE Sistema SHALL presentar la Vista_Registro.
2. WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL mostrar el logo del tenant en la esquina superior izquierda de la Vista_Registro usando el componente común `AppLogo`.
3. WHERE el tenant tiene configurado el contenido de WhoWeAre, WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL mostrar el componente común `WhoWeAre` en la Vista_Registro.
4. WHERE el tenant no tiene configurado el contenido de WhoWeAre, WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL omitir el componente `WhoWeAre` de la Vista_Registro.
5. WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL mostrar el control de cambio entre modo claro y modo oscuro en la Vista_Registro.
6. WHEN el Invitado activa el control de cambio entre modo claro y modo oscuro en la Vista_Registro, THE Sistema SHALL alternar la presentación de la Vista_Registro al otro modo y aplicar el modo seleccionado a la totalidad de la Vista_Registro.
7. WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL presentar el formulario de registro dentro de un card cuyo ancho máximo sea estrictamente mayor que el ancho máximo del card de la vista de login.

### Requirement 13: Registro mediante Google

**User Story:** Como invitado, quiero registrarme con mi cuenta de Google, para evitar crear una contraseña.

#### Acceptance Criteria

1. WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL mostrar en el primer bloque de la Vista_Registro un botón de registro con Google etiquetado de forma visible con el texto "Registrarse con Google".
2. WHEN el Invitado activa el botón de registro con Google, THE Sistema SHALL iniciar el flujo de autenticación con Google de Supabase.
3. WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL mostrar una línea divisoria entre el bloque de registro con Google y el bloque de registro manual.
4. WHEN el flujo de autenticación con Google retorna a la aplicación, THE Servidor_Registro SHALL validar, antes de completar el registro, que el Codigo_Invitacion existe en la base de datos y tiene Estado_Enlace `activo`.
5. IF la autenticación con Google se completa pero el Codigo_Invitacion no existe en la base de datos o su Estado_Enlace no es `activo`, THEN THE Servidor_Registro SHALL bloquear el registro sin crear ninguna cuenta ni modificar el Enlace_Invitacion, y THE Sistema SHALL mostrar un mensaje de error indicando que el enlace de invitación no es válido.
6. IF el flujo de autenticación con Google falla o el Invitado lo cancela antes de completarlo, THEN THE Sistema SHALL retornar a la Vista_Registro sin crear ninguna cuenta y mostrar un mensaje de error indicando que la autenticación con Google no se completó.
7. THE Sistema SHALL documentar el procedimiento de configuración de Google OAuth en Supabase, incluyendo los pasos para habilitar el proveedor de Google y registrar el Client ID y el Client Secret del proveedor.

### Requirement 14: Campos obligatorios del registro manual según el tipo

**User Story:** Como invitado, quiero saber qué datos son obligatorios según mi tipo de registro, para completar el formulario sin errores.

#### Acceptance Criteria

1. WHERE el Enlace_Invitacion es de Tipo_Enlace `profesor`, THE Sistema SHALL mostrar los campos del registro de profesor, marcar con asterisco los campos obligatorios definidos para el registro de profesor y no marcar con asterisco los campos opcionales.
2. WHERE el Enlace_Invitacion es de Tipo_Enlace `alumno`, THE Sistema SHALL mostrar los campos del registro de alumno, marcar con asterisco los campos obligatorios definidos para el registro de alumno y no marcar con asterisco los campos opcionales.
3. WHILE al menos un campo obligatorio está vacío, considerando vacío un campo que no contiene caracteres o que solo contiene espacios en blanco, THE Sistema SHALL mantener deshabilitado el botón "Crear cuenta".
4. WHEN todos los campos obligatorios correspondientes al Tipo_Enlace están completos y el resto de validaciones del formulario se cumplen, THE Sistema SHALL habilitar el botón "Crear cuenta".
5. IF el Invitado intenta enviar el formulario con al menos un campo obligatorio vacío, THEN THE Sistema SHALL impedir el envío del formulario, conservar los valores ya ingresados y mostrar, en un máximo de 1 segundo, un mensaje en línea de color rojo en cada campo obligatorio sin completar.
6. WHEN el Invitado completa un campo obligatorio que mostraba un mensaje de error en línea, THE Sistema SHALL retirar ese mensaje de error en línea en un máximo de 1 segundo.
7. WHEN el Servidor_Registro recibe una solicitud de registro, THE Servidor_Registro SHALL validar la presencia de todos los campos obligatorios correspondientes al Tipo_Enlace antes de crear la cuenta.
8. IF el Servidor_Registro recibe una solicitud de registro con al menos un campo obligatorio ausente o vacío, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de validación, no crear ninguna cuenta e indicar el fallo al solicitante.

### Requirement 15: Gestión de contraseña en el registro manual

**User Story:** Como invitado, quiero una entrada de contraseña clara con verificación de coincidencia y opción de mostrarla, para definir mi contraseña con seguridad.

#### Acceptance Criteria

1. IF la contraseña ingresada tiene menos de 6 caracteres o más de 128 caracteres, THEN THE Sistema SHALL mostrar un mensaje de error en un máximo de 1 segundo y mantener deshabilitado el botón "Crear cuenta".
2. WHILE el campo de contraseña y el campo de repetir contraseña contienen valores distintos, THE Sistema SHALL mostrar un aviso de no coincidencia en un máximo de 1 segundo y mantener deshabilitado el botón "Crear cuenta".
3. WHILE el Sistema presenta el campo de contraseña, THE Sistema SHALL presentar el valor del campo de contraseña oculto de forma predeterminada y mostrar un control de tipo ojo para alternar entre mostrar y ocultar su valor.
4. WHILE el Sistema presenta el campo de repetir contraseña, THE Sistema SHALL presentar el valor del campo de repetir contraseña oculto de forma predeterminada y mostrar un control de tipo ojo para alternar entre mostrar y ocultar su valor.
5. WHEN el Invitado activa el control de tipo ojo de un campo de contraseña, THE Sistema SHALL alternar la visibilidad del valor de ese campo entre mostrado y oculto.
6. IF el Servidor_Registro recibe una solicitud de registro manual con una contraseña de menos de 6 caracteres o más de 128 caracteres, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de validación, no crear ninguna cuenta e indicar el fallo al solicitante.

### Requirement 16: Aceptación de Términos y Condiciones

**User Story:** Como invitado, quiero aceptar los Términos y Condiciones igual que en el resto de la aplicación, para completar mi registro de forma conforme.

#### Acceptance Criteria

1. WHILE el Sistema presenta la Vista_Registro, THE Sistema SHALL presentar el Bloque_TyC reutilizando el mismo componente de aceptación de Términos y Condiciones de la vista `setup/[code]`, con su control de aceptación y su enlace al contenido de los Términos y Condiciones.
2. WHILE el Invitado no ha marcado el control de aceptación del Bloque_TyC, THE Sistema SHALL mantener deshabilitado el botón "Crear cuenta".
3. WHEN el Invitado activa el enlace de Términos y Condiciones, THE Sistema SHALL mostrar el contenido de los Términos y Condiciones del tenant en un modal superpuesto sobre la Vista_Registro, sin abandonar la Vista_Registro.
4. IF el Invitado activa el enlace de Términos y Condiciones y el tenant no tiene contenido de Términos y Condiciones configurado, THEN THE Sistema SHALL mostrar un mensaje de error y conservar la Vista_Registro.
5. IF el Servidor_Registro recibe una solicitud de registro sin la confirmación de aceptación de los Términos y Condiciones, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error de validación, no crear ninguna cuenta e indicar el fallo al solicitante.

### Requirement 17: Creación de cuenta y consumo del enlace

**User Story:** Como invitado, quiero que al crear mi cuenta el enlace quede inutilizado y yo quede autenticado, para acceder de inmediato y evitar reutilizaciones.

#### Acceptance Criteria

1. WHEN el Servidor_Registro completa la creación de una cuenta mediante un Enlace_Invitacion, THE Servidor_Registro SHALL cambiar el Estado_Enlace del Enlace_Invitacion a `usado` de forma atómica dentro de la misma transacción que crea la cuenta.
2. WHEN el Servidor_Registro completa la creación de la cuenta, THE Servidor_Registro SHALL asociar el identificador del usuario creado al Enlace_Invitacion usado dentro de la misma transacción que crea la cuenta y lo marca como `usado`.
3. WHEN el Servidor_Registro completa la creación de la cuenta, THE Sistema SHALL establecer una sesión autenticada para el usuario creado como parte de la misma operación de registro, sin requerir que el usuario inicie sesión manualmente después.
4. WHEN el Servidor_Registro confirma la creación de la cuenta y el consumo del Enlace_Invitacion, THE Servicio_Correo SHALL enviar un correo de bienvenida al usuario creado.
5. THE Servidor_Registro SHALL validar el Codigo_Invitacion contra la base de datos antes de crear la cuenta, tanto en el registro con Google como en el registro manual.
6. IF el Servidor_Registro recibe una solicitud de registro con un Codigo_Invitacion cuyo Estado_Enlace no es `activo`, THEN THE Servidor_Registro SHALL rechazar la solicitud con un código de error, no crear ninguna cuenta, conservar el Estado_Enlace y la asociación de usuario del Enlace_Invitacion sin cambios e indicar el fallo al solicitante.
7. IF la creación de la cuenta, el cambio de Estado_Enlace a `usado` o la asociación del usuario al Enlace_Invitacion falla durante el registro, THEN THE Servidor_Registro SHALL revertir esas operaciones de modo que no persista ninguna cuenta nueva, el Estado_Enlace permanezca `activo` y el Enlace_Invitacion quede sin usuario asociado, e indicar el fallo al solicitante con un código de error.
8. IF el envío del correo de bienvenida falla o el Servicio_Correo no está disponible, THEN THE Servidor_Registro SHALL conservar la cuenta creada, el Estado_Enlace `usado`, la asociación del usuario al Enlace_Invitacion y la sesión autenticada sin revertir ninguna de esas operaciones, y completar el registro de forma satisfactoria.
9. WHILE dos o más solicitudes de registro intentan usar simultáneamente el mismo Enlace_Invitacion con Estado_Enlace `activo`, THE Servidor_Registro SHALL completar el registro de a lo sumo una solicitud y rechazar las demás con un código de error indicando que el Enlace_Invitacion ya fue usado.

### Requirement 18: Acceso a un enlace ya usado, deshabilitado o eliminado

**User Story:** Como invitado, quiero un mensaje claro cuando el enlace ya no es válido, para saber que debo iniciar sesión en su lugar.

#### Acceptance Criteria

1. WHEN el Invitado abre un Enlace_Invitacion cuyo Estado_Enlace no es `activo` o que ha sido marcado como eliminado, THE Sistema SHALL mostrar, en un máximo de 1 segundo, la ventana de error existente para enlaces no válidos y no presentar la Vista_Registro.
2. WHILE se muestra la ventana de error para enlaces no válidos, THE Sistema SHALL ofrecer como única opción navegar a la vista de login, ocultando cualquier otra opción de navegación.
3. WHEN el Invitado abre un Enlace_Invitacion cuyo Codigo_Invitacion no existe en la base de datos, THE Sistema SHALL mostrar, en un máximo de 1 segundo, la ventana de error existente para enlaces no válidos y no presentar la Vista_Registro.
4. WHEN el Invitado activa la opción de navegar a la vista de login desde la ventana de error para enlaces no válidos, THE Sistema SHALL navegar a la vista de login.

### Requirement 19: Seguridad de RLS para registro sin sesión

**User Story:** Como responsable del sistema, quiero que el registro desde un enlace funcione sin sesión activa pero de forma segura, para evitar errores de RLS y accesos indebidos.

#### Acceptance Criteria

1. THE Sistema SHALL habilitar Row Level Security en la tabla `enlaces_invitacion`.
2. WHEN el Invitado abre un Enlace_Invitacion sin sesión activa, THE Servidor_Registro SHALL verificar que el Codigo_Invitacion existe en la base de datos y obtener el Estado_Enlace del Enlace_Invitacion asociado a ese único Codigo_Invitacion, sin exponer ningún otro Enlace_Invitacion en la respuesta.
3. WHEN el Invitado se registra sin sesión activa mediante un Codigo_Invitacion válido, THE Servidor_Registro SHALL crear el perfil del usuario mediante una operación ejecutada exclusivamente del lado servidor, con privilegios controlados que no se exponen al cliente, completando la creación sin requerir que el Invitado tenga una sesión autenticada previa.
4. WHILE un Administrador con sesión activa consulta `enlaces_invitacion`, THE Sistema SHALL permitir mediante políticas RLS la lectura únicamente de los Enlace_Invitacion pertenecientes al mismo tenant del Administrador, incluidos los creados por otros usuarios de ese tenant.
5. IF una solicitud sin sesión activa intenta leer Enlace_Invitacion distintos del registro asociado a un único Codigo_Invitacion específico, THEN THE Sistema SHALL denegar la operación mediante políticas RLS, no devolver ningún Enlace_Invitacion y responder con un rechazo de autorización.
6. IF una solicitud sin sesión activa intenta leer el conjunto completo de `enlaces_invitacion`, THEN THE Sistema SHALL denegar la operación mediante políticas RLS y no devolver ningún Enlace_Invitacion, aunque la solicitud invoque la identidad de un Administrador sin sesión.
7. WHILE un Profesor_Habilitado con sesión activa consulta `enlaces_invitacion`, THE Sistema SHALL permitir mediante políticas RLS la lectura únicamente de los Enlace_Invitacion del mismo tenant del Profesor_Habilitado cuyo `created_by` es igual a su identificador.
8. IF un usuario autenticado intenta leer un Enlace_Invitacion perteneciente a un tenant distinto del suyo, THEN THE Sistema SHALL denegar la operación mediante políticas RLS y no devolver ese Enlace_Invitacion.

### Requirement 20: Cambios de base de datos y entregables

**User Story:** Como desarrollador, quiero un archivo de migración versionado y tipos actualizados manualmente, para replicar los cambios en otras bases de datos de tenants sin romper la aplicación.

#### Acceptance Criteria

1. THE Sistema SHALL incluir un archivo de migración SQL versionado, identificado con el siguiente número consecutivo posterior a la migración 065 y sin colisionar con un número de migración existente, que cree la tabla `enlaces_invitacion`, sus índices y sus políticas RLS.
2. THE archivo de migración SHALL ser idempotente, de modo que al aplicarse dos o más veces consecutivas sobre la misma base de datos produzca el mismo esquema final, sin generar errores y sin crear objetos duplicados.
3. THE Sistema SHALL actualizar manualmente el archivo `lib/supabase/types.ts` de modo que las definiciones de tipo de `enlaces_invitacion` sean consistentes con las columnas y los tipos de datos creados por el archivo de migración.
4. WHERE existe en `components/common` un componente que provee la funcionalidad requerida, THE Sistema SHALL implementar esa funcionalidad reutilizando dicho componente común.
5. IF no existe en `components/common` un componente que provee la funcionalidad requerida, THEN THE Sistema SHALL implementar esa funcionalidad con componentes nativos.
6. WHEN la implementación se marca como finalizada, THE Sistema SHALL completar la compilación del build de producción sin errores.
7. WHEN la implementación se marca como finalizada, THE Sistema SHALL completar la verificación de tipos con `tsc` sin errores de tipos.
8. WHEN la implementación se marca como finalizada, THE Sistema SHALL completar la ejecución del lint sin errores de lint.
