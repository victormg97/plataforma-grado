import { tenantConfig } from '@/config';

/**
 * Resultado de la verificación de un correo de destinatario (Requisito 2).
 *
 * - `{ entregable: true }`: el correo tiene formato válido y no pertenece al
 *   dominio de marca del tenant, por lo que el envío puede proceder.
 * - `{ entregable: false; motivo: 'formato_invalido' }`: el correo está ausente
 *   o no cumple el formato exigido (Requisito 2.4).
 * - `{ entregable: false; motivo: 'dominio_marca' }`: el dominio del correo
 *   coincide con el Dominio_Marca_Tenant o es un subdominio suyo (Requisito 2.3).
 */
export type VerificacionDestinatario =
  | { entregable: true }
  | { entregable: false; motivo: 'formato_invalido' | 'dominio_marca' };

/**
 * Determina si un Correo_Destinatario es entregable (Requisito 2.1–2.5).
 *
 * Reglas de formato (Requisito 2.4): el correo debe contener exactamente un
 * carácter `@`, con una parte local no vacía y un dominio no vacío que incluya
 * al menos un punto separando dos etiquetas no vacías.
 *
 * Regla de dominio de marca (Requisito 2.2, 2.3, 12.3): el dominio se toma como
 * la porción posterior al `@`, se normaliza a minúsculas y se compara contra
 * `tenantConfig.emailDomain`; si es igual o termina en `.` + dominio de marca
 * (subdominio), el correo no es entregable.
 *
 * @param email Correo del destinatario (`profiles.email`), posiblemente nulo.
 * @returns La verificación del destinatario.
 */
export function verificarDestinatario(
  email: string | null | undefined,
): VerificacionDestinatario {
  // Requisito 2.4: ausente, nulo o cadena vacía → formato inválido.
  if (!email) {
    return { entregable: false, motivo: 'formato_invalido' };
  }

  // Requisito 2.4: debe haber exactamente un '@'.
  const partes = email.split('@');
  if (partes.length !== 2) {
    return { entregable: false, motivo: 'formato_invalido' };
  }

  const [local, dominioRaw] = partes;

  // Requisito 2.4: parte local y dominio no vacíos.
  if (local.length === 0 || dominioRaw.length === 0) {
    return { entregable: false, motivo: 'formato_invalido' };
  }

  // Requisito 2.4: el dominio debe tener al menos un punto separando dos
  // etiquetas no vacías.
  const etiquetas = dominioRaw.split('.');
  if (etiquetas.length < 2 || etiquetas.some((etiqueta) => etiqueta.length === 0)) {
    return { entregable: false, motivo: 'formato_invalido' };
  }

  // Requisito 2.2, 2.3, 12.3: normalizar dominio y comparar con el de marca.
  const dominio = dominioRaw.toLowerCase();
  const marca = tenantConfig.emailDomain.toLowerCase();
  if (dominio === marca || dominio.endsWith(`.${marca}`)) {
    return { entregable: false, motivo: 'dominio_marca' };
  }

  // Requisito 2.5: correo entregable.
  return { entregable: true };
}
