import { createClient } from '@/lib/supabase/server';

export async function generateAppEmail(nombre: string, apellido: string): Promise<string> {
  const supabase = await createClient();
  
  // Clean names (remove accents, spaces, lowercase)
  const cleanNombre = nombre.toLowerCase().trim().replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanApellido = apellido.toLowerCase().trim().replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const baseEmail = `${cleanNombre}.${cleanApellido}@ctagraduados.cl`;
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
    candidateEmail = `${cleanNombre}.${cleanApellido}${counter}@ctagraduados.cl`;
  }
}

export function generateSecurePassword(role: 'admin' | 'profesor' | 'alumno'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pass = '';
  // Force 1 uppercase, 1 lowercase, 1 number, 1 special to pass GoTrue
  pass += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  pass += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  pass += '0123456789'[Math.floor(Math.random() * 10)];
  pass += '!@#$%^&*'[(Math.floor(Math.random() * 8))];
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export function generateDefaultPassword(role: 'admin' | 'profesor' | 'alumno'): string {
  const currentYear = new Date().getFullYear();
  const prefix = role.charAt(0).toUpperCase() + role.slice(1);
  return `${prefix}.${currentYear}!`;
}
