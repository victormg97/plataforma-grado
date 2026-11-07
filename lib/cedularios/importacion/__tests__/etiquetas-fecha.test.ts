import { describe, expect, it } from 'vitest';
import { etiquetaAlInicio } from '../etiquetas';

describe('etiquetaAlInicio', () => {
  it('does not read a header date as item number', () => {
    expect(etiquetaAlInicio('23 DE DICIEMBRE DE 2025')).toBeNull();
    expect(etiquetaAlInicio('1 El proceso')).not.toBeNull();
  });
});
