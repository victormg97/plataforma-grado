import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tenantConfig } from '@/config'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
    
  if (!profile) {
     return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 })
  }

  const rol = profile.rol

  let query = supabase
    .from('user_referral_codes')
    .select(`
      *,
      profiles:user_id (id, nombre, apellido, email, rol, avatar_url),
      referral_usages!user_referral_code_id (count)
    `)
    .eq('tenant', tenantConfig.id)

  if (rol === 'profesor') {
    const { data: misAlumnos } = await supabase
      .from('alumnos_extra')
      .select('alumno_id')
      .eq('profesor_id', user.id)
      
    const alumnosIds = (misAlumnos || []).map(a => a.alumno_id)
    
    // Fallback if no students to prevent returning all
    if (alumnosIds.length === 0) {
      return NextResponse.json([])
    }
    
    query = query.in('user_id', alumnosIds)
  } else if (rol === 'alumno' || rol === 'lector') {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 })
  }
  
  const formattedData = data.map((row: Record<string, unknown>) => ({
    ...row,
    owner: row.profiles,
    referral_count: (row.referral_usages as { count: number }[])?.[0]?.count || 0,
    profiles: undefined,
    referral_usages: undefined
  }))
  
  // Clean up undefined properties
  const cleanData = formattedData.map((item: Record<string, unknown>) => JSON.parse(JSON.stringify(item)))

  return NextResponse.json(cleanData)
}
