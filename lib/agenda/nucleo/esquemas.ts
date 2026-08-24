/**
 * Slice `nucleo` — fragmentos Zod base de la agenda (Requisitos 1.1, 3.5, 5.3, 8.2,
 * 10.3, 10.12, 10.15, 17.1, 17.2).
 *
 * Los límites del Requisito 1.1 se declaran **una sola vez** en todo el proyecto:
 * los slices de capacidad componen estos fragmentos dentro de sus `z.object`, y el
 * mismo objeto se usa en el route handler (`safeParse`) y en el formulario
 * (`zodResolver`), de modo que la validación del cliente y la del servidor no pueden
 * divergir.
 *
 * Convención de errores: cada regla fija como mensaje del issue el
 * `CodigoErrorAgenda` que le corresponde, para que `desdeZod` lo lea directamente y
 * el código viva junto a la regla que lo produce. El mensaje nunca llega al usuario:
 * el cliente resuelve la clave i18n derivada del código (Requisito 15.5).
 */
import { z } from 'zod';

import { Constants } from '@/lib/supabase/types';
import type { AgendaVisibilidad, CategoriaAgenda } from '@/lib/supabase/types';

/** Requisitos 1.1, 3.5: de 1 a 120 caracteres tras recortar espacios. */
export const tituloAgenda = z
  .string()
  .transform((valor) => valor.trim())
  .refine((valor) => valor.length >= 1 && valor.length <= 120, {
    error: 'titulo_invalido',
  });

/**
 * `YYYY-MM-DD`. Un Evento_Agenda vive en una única fecha (Requisito 10.11), así que
 * no hay un fragmento de rango de fechas.
 *
 * El código `rango_invalido` es el que el Requisito 1.6 asigna a los fallos de fecha
 * y de rango horario; no existe un código propio de «fecha con formato inválido».
 */
export const fechaAgenda = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'rango_invalido' });

/**
 * `HH:MM` de `00:00` a `23:59`. Estricto a propósito: el formato de dos dígitos es
 * lo que permite a los slices de capacidad comparar `hora_fin > hora_inicio` como
 * texto sin sorpresas. El `HH:MM:SS` que devuelve Postgres se normaliza en el mapeo,
 * no aquí: este fragmento valida la **entrada** de la API_Agenda.
 *
 * `horas_requeridas` es el código de los fallos de hora del Requisito 5.7; el
 * `rango_invalido` de `hora_fin <= hora_inicio` lo aporta el `refine` del objeto que
 * compone las dos horas, porque un fragmento aislado no puede verlas juntas.
 */
export const horaAgenda = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'horas_requeridas' });

/**
 * Los ocho valores de `agenda_categoria`, con `otro` como Categoria_Por_Defecto
 * (Requisito 10.3).
 *
 * La lista sale de `Constants.public.Enums`, no de un array escrito a mano: un valor
 * nuevo en la base de datos llega al esquema al actualizar los Tipos_TS, y la
 * comprobación de tipos del final del archivo falla si las dos mitades de
 * `types.ts` (la unión y la constante) dejan de coincidir.
 */
export const categoriaAgenda = z
  .enum(Constants.public.Enums.agenda_categoria, { error: 'categoria_invalida' })
  .default('otro');

/**
 * `privada` | `publica`, con `privada` por defecto (Requisito 8.2): omitir el campo
 * nunca puede publicar una Entrada_Personal sin que el Autor lo pida.
 *
 * No hay un `CodigoErrorAgenda` de visibilidad inválida —el valor solo puede fallar
 * si el cliente envía algo fuera del enum—, así que este fragmento no fija código y
 * `desdeZod` cae en el `porDefecto` del llamante.
 */
export const visibilidadAgenda = z
  .enum(Constants.public.Enums.agenda_visibilidad)
  .default('privada');

/**
 * Requisitos 1.1, 3.9, 10.12: hasta 200 caracteres. La cadena vacía se normaliza a
 * `null` en lugar de persistirse como `''`, para que el detalle del evento pueda
 * omitir el campo con una sola comprobación (Requisito 12.5).
 */
export const lugarAgenda = z
  .string()
  .max(200, { error: 'lugar_excede' })
  .transform((valor) => (valor.trim() === '' ? null : valor))
  .nullish();

/**
 * Requisitos 1.1, 5.3, 10.15: **sin límite máximo de longitud y sin truncar**.
 *
 * La ausencia de `.max()` es deliberada y es un requisito explícito del usuario: la
 * descripción se escribe con el editor de texto enriquecido, así que unos pocos
 * párrafos con formato ya superan cualquier tope «razonable». No añadas `.max()`,
 * `maxLength` en el formulario ni un contador de caracteres.
 */
export const descripcionAgenda = z.string().nullish();

/**
 * Requisitos 5.3, 10.15: **sin límite máximo de longitud y sin truncar**, por el
 * mismo motivo que `descripcionAgenda`. La nota es privada del Autor (Requisito
 * 8.10) y no se recorta jamás.
 */
export const notaAgenda = z.string().nullish();

/* ------------------------------------------------------------------------- *
 * Comprobaciones de tipos: los enums del esquema y los de la base de datos
 * son el mismo conjunto. Si alguien añade un valor a `Database['public']
 * ['Enums']` y olvida `Constants`, o al revés, la compilación falla aquí en
 * lugar de dejar pasar un valor que la base de datos rechazaría.
 * ------------------------------------------------------------------------- */

type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Verificar<T extends true> = T;

type _CategoriasCompletas = Verificar<
  Igual<z.output<typeof categoriaAgenda>, CategoriaAgenda>
>;

type _VisibilidadesCompletas = Verificar<
  Igual<z.output<typeof visibilidadAgenda>, AgendaVisibilidad>
>;
