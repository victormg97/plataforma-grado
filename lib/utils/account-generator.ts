import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

export async function generateAppEmail(nombre: string, apellido: string): Promise<string> {
  const supabase = await createClient();
  
  // Clean names (remove accents, spaces, lowercase)
  const cleanNombre = nombre.toLowerCase().trim().replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanApellido = apellido.toLowerCase().trim().replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const domain = tenantConfig.emailDomain;
  const baseEmail = `${cleanNombre}.${cleanApellido}@${domain}`;
  let candidateEmail = baseEmail;
  let counter = 1;

  while(true) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', candidateEmail)
      .maybeSingle();
      
    if (!data) {
      return candidateEmail;
    }
    
    counter++;
    candidateEmail = `${cleanNombre}.${cleanApellido}${counter}@${domain}`;
  }
}

export function generateSecurePassword(_role: 'admin' | 'profesor' | 'alumno'): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const randomByte = () => {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  };

  // Pick one guaranteed char from each required class
  const pick = (chars: string) => chars[randomByte() % chars.length];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];

  // Fill remaining 12 chars
  const rest: string[] = [];
  for (let i = 0; i < 12; i++) {
    rest.push(pick(all));
  }

  // Shuffle all 16 chars using Fisher-Yates with crypto random
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomByte() % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function generateDefaultPassword(role: 'admin' | 'profesor' | 'alumno'): string {
  // Add 4 random digits so each account gets a unique default password
  const buf = new Uint8Array(2);
  crypto.getRandomValues(buf);
  const randomSuffix = ((buf[0] << 8) | buf[1]).toString().padStart(4, '0').slice(0, 4);
  const prefix = role.charAt(0).toUpperCase() + role.slice(1);
  const currentYear = new Date().getFullYear();
  return `${prefix}.${currentYear}-${randomSuffix}!`;
}
