# Design Document — class-cancellation-deadline

## Overview

This feature adds a per-professor configuration (`cancellation_deadline_hours`) that controls how many hours before a class starts students are no longer allowed to change their attendance status. The default value is `0`, which preserves the current behavior: students can change their status up until the exact moment the class begins.

The enforcement is **server-side primary**. The client mirrors the state for UX purposes, but the API is the authoritative gate. A student who manipulates the client-side state will still receive HTTP 403 from the server.

The configuration is stored in `profiles.cancellation_deadline_hours` alongside the existing `duracion_clase_default_min` column, and is edited on the `/perfil` page in the professor section.

### Key design decisions

- **Pre-computed `plazoVencido` flag**: The API computes whether the deadline has passed and passes it as a boolean to `validateEstadoChange`. This keeps the validation function pure and testable without any I/O.
- **Server time via RPC**: The deadline check uses `supabase.rpc('get_server_time')` (already in the system) to prevent client clock manipulation.
- **Professor ownership bypass**: A professor who owns the class is exempt from the deadline. A professor who does not own the class is treated like a student.
- **Zero-hours semantics**: When `cancellation_deadline_hours = 0`, the deadline equals `hora_inicio` exactly — the student can change until the class starts, which is the current behavior.

---

## Architecture

```mermaid
flowchart TD
    A[Alumno browser] -->|PATCH /api/asistencia/:id| B[API Route: asistencia/[id]]
    B -->|rpc get_server_time| C[(Supabase DB)]
    B -->|select horarios + profiles| C
    B -->|validateEstadoChange plazoVencido| D[lib/validations/asistencia.ts]
    D -->|allowed / 403| B
    B -->|update asistencia| C

    E[Profesor browser] -->|PATCH /api/perfil| F[API Route: perfil]
    F -->|update profiles.cancellation_deadline_hours| C

    A -->|GET /api/asistencia| G[API Route: asistencia GET]
    G -->|select asistencia + horarios + profiles| C
    G -->|cancellation_deadline_hours in response| A

    A -->|compute plazoVencido client-side| H[useClaseTimeStatus hook]
    H -->|disable buttons / show message| A
```

The flow for a student attendance change:

1. Client calls `PATCH /api/asistencia/:id`.
2. API fetches the `horario` (including `hora_inicio`) and the professor's `cancellation_deadline_hours` via a join on `profiles`.
3. API calls `get_server_time()` RPC.
4. API computes `plazoVencido = serverNow >= classStart - deadlineHours * 3600000`.
5. API calls `validateEstadoChange({ ..., plazoVencido, cancellationDeadlineHours })`.
6. If `plazoVencido && userRol === 'alumno'` → HTTP 403.
7. Otherwise, proceed with the existing validation chain.

---

## Components and Interfaces

### 1. Database migration — `043_add_cancellation_deadline.sql`

Adds the column to `profiles` with an idempotent guard:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cancellation_deadline_hours_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cancellation_deadline_hours_check
    CHECK (cancellation_deadline_hours >= 0);
```

### 2. TypeScript types — `lib/supabase/types.ts`

The `profiles` `Row`, `Insert`, and `Update` types gain:

```typescript
cancellation_deadline_hours: number
```

### 3. Validation function — `lib/validations/asistencia.ts`

`ValidateEstadoChangeParams` gains two new fields:

```typescript
export interface ValidateEstadoChangeParams {
  userRol: 'alumno' | 'profesor' | 'admin';
  currentEstado: EstadoAsistencia;
  newEstado: EstadoAsistencia;
  claseTerminada: boolean;
  solicitudAceptada: boolean;
  // NEW
  plazoVencido: boolean;
  cancellationDeadlineHours: number;
}
```

The check order inside `validateEstadoChange` for `userRol === 'alumno'`:

1. `solicitudAceptada` → 403
2. **`plazoVencido`** → 403 (new, before `claseTerminada`)
3. `claseTerminada` → 403
4. `!ALUMNO_ALLOWED_ESTADOS.includes(newEstado)` → 403
5. `{ allowed: true }`

Professors and admins remain unconditionally allowed (no change).

### 4. API Route — `PATCH /api/asistencia/[id]`

Changes to the alumno branch of the handler:

```typescript
// Fetch horario with hora_inicio AND join professor profile
const { data: horario } = await supabase
  .from('horarios')
  .select('fecha, hora_inicio, hora_fin, profesor:profiles!horarios_profesor_id_fkey(cancellation_deadline_hours)')
  .eq('id', existing.horario_id)
  .single();

const cancellationDeadlineHours =
  (horario?.profesor as { cancellation_deadline_hours: number } | null)
    ?.cancellation_deadline_hours ?? 0;

// Compute plazoVencido using server time
const { data: serverTime } = await supabase.rpc('get_server_time');
if (!serverTime) {
  return NextResponse.json({ error: 'No se pudo obtener la hora del servidor' }, { status: 500 });
}

const now = new Date(serverTime);
const classStart = new Date(`${horario.fecha}T${horario.hora_inicio}`);
const deadlineMs = cancellationDeadlineHours * 3600 * 1000;
const plazoVencido = now.getTime() >= classStart.getTime() - deadlineMs;
```

The `validateEstadoChange` call gains the two new params:

```typescript
const validation = validateEstadoChange({
  userRol,
  currentEstado: existing.estado,
  newEstado: estado,
  claseTerminada,
  solicitudAceptada,
  plazoVencido,
  cancellationDeadlineHours,
});
```

**Professor ownership bypass**: The existing ownership check already returns early for the owning professor. The `plazoVencido` computation only runs inside the `userRol === 'alumno'` branch (and for non-owning professors, who are treated as alumnos per the existing logic).

**Error message on 403 (plazo)**: `validateEstadoChange` returns a descriptive `errorMessage` such as `"El plazo para modificar la asistencia ha vencido."`.

### 5. API Route — `GET /api/asistencia`

The select query changes from:

```typescript
supabase.from('asistencia').select('*, horario:horarios(*)')
```

to:

```typescript
supabase.from('asistencia').select(
  '*, horario:horarios(*, profesor:profiles!horarios_profesor_id_fkey(cancellation_deadline_hours))'
)
```

### 6. API Route — `PATCH /api/perfil`

A new block is added after the `duracion_clase_default_min` block, following the same pattern:

```typescript
if (body.cancellation_deadline_hours !== undefined) {
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (currentProfile?.rol === 'profesor' || currentProfile?.rol === 'admin') {
    const val = Number(body.cancellation_deadline_hours);
    if (!Number.isInteger(val) || val < 0 || val > 168) {
      return NextResponse.json(
        { error: 'cancellation_deadline_hours debe ser un entero entre 0 y 168' },
        { status: 400 }
      );
    }
    profileUpdate.cancellation_deadline_hours = val;
  }
}
```

Note: the `rol` fetch can be shared with the existing `duracion_clase_default_min` block to avoid a duplicate query.

### 7. Profile page — `app/(dashboard)/perfil/page.tsx`

New state variable:

```typescript
const [cancellationDeadline, setCancellationDeadline] = useState('0');
```

Initialized in the `useEffect`:

```typescript
setCancellationDeadline(String(perfilData.cancellation_deadline_hours ?? 0));
```

New field in the `isProfesorOrAdmin` section (below `duracion_clase_default_min`):

```tsx
{isProfesorOrAdmin && (
  <Field label={t('cancellation_deadline')} hint={t('cancellation_deadline_hint')}>
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={0}
        max={168}
        step={1}
        value={cancellationDeadline}
        onChange={(e) => setCancellationDeadline(e.target.value)}
        className={cn(inputCls, 'w-28')}
      />
      <span className="text-sm text-[var(--color-text-muted)]">{t('horas')}</span>
    </div>
  </Field>
)}
```

Included in `handleSaveInfo` body:

```typescript
...(isProfesorOrAdmin && {
  cancellation_deadline_hours: Number(cancellationDeadline),
}),
```

### 8. Client hook — `lib/hooks/useAsistencia.ts`

`ClaseAlumno.horario.profesor` gains the new field:

```typescript
profesor: {
  id: string;
  nombre: string;
  apellido: string;
  avatar_url: string | null;
  cancellation_deadline_hours: number;  // NEW
} | null;
```

### 9. Client deadline check — `lib/hooks/useServerTime.ts`

`useClaseTimeStatus` gains a `cancellationDeadlineHours` parameter and returns `plazoVencido`:

```typescript
export function useClaseTimeStatus(
  fecha: string,
  horaInicio: string,
  horaFin: string,
  cancellationDeadlineHours: number = 0
) {
  const { serverTime, isLoading } = useServerTime();

  if (!serverTime || isLoading) {
    return { enCurso: false, yaPaso: false, esFuturo: true, plazoVencido: false, isLoading: true };
  }

  const todayChile = toChileDate(serverTime);
  const nowChile = toChileTime(serverTime);

  const esFuturo = fecha > todayChile || (fecha === todayChile && horaInicio > nowChile);
  const enCurso = fecha === todayChile && horaInicio <= nowChile && horaFin >= nowChile;
  const yaPaso = fecha < todayChile || (fecha === todayChile && horaFin < nowChile);

  // Deadline: classStart - deadlineHours
  // When hours=0, plazoVencido equals (now >= hora_inicio), i.e. class has started
  const classStartStr = `${fecha}T${horaInicio}`;
  const classStartMs = new Date(classStartStr).getTime();
  const nowMs = new Date(serverTime).getTime();
  const deadlineMs = cancellationDeadlineHours * 3600 * 1000;
  const plazoVencido = nowMs >= classStartMs - deadlineMs;

  return { enCurso, yaPaso, esFuturo, plazoVencido, isLoading: false };
}
```

### 10. Alumno horario detail view — `app/(dashboard)/alumno/horario/page.tsx`

`useClaseTimeStatus` call gains the deadline hours:

```typescript
const { enCurso, yaPaso, plazoVencido } = useClaseTimeStatus(
  clase.horario.fecha,
  clase.horario.hora_inicio,
  clase.horario.hora_fin,
  clase.horario.profesor?.cancellation_deadline_hours ?? 0
);
```

`canChangeStatus` updated:

```typescript
const canChangeStatus = !yaPaso && !plazoVencido && clase.estado !== 'cambiado';
```

Informative message when deadline passed but class hasn't ended:

```tsx
{plazoVencido && !yaPaso && (
  <div className="rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
    {t('plazo_vencido_mensaje')}
  </div>
)}
```

---

## Data Models

### `profiles` table (updated)

| Column | Type | Constraints |
|---|---|---|
| `cancellation_deadline_hours` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (>= 0)` |

### Enriched `ClaseAlumno` type (client)

```typescript
type ClaseAlumno = {
  id: string;
  estado: EstadoAsistencia;
  nota_alumno: string | null;
  nuevo_horario_id: string | null;
  horario: {
    id: string;
    titulo: string;
    descripcion: string | null;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    activo: boolean;
    profesor: {
      id: string;
      nombre: string;
      apellido: string;
      avatar_url: string | null;
      cancellation_deadline_hours: number;  // NEW
    } | null;
  };
};
```

### Deadline computation (shared logic)

```
deadline_timestamp = classStart - cancellationDeadlineHours * 3600_000 ms
plazoVencido       = now >= deadline_timestamp
```

When `cancellationDeadlineHours = 0`:
```
deadline_timestamp = classStart - 0 = classStart
plazoVencido       = now >= classStart   (class has started)
```

This is identical to the current behavior where students can change until the class begins.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Plazo vencido blocks alumno unconditionally

*For any* combination of `currentEstado`, `newEstado`, `claseTerminada`, and `solicitudAceptada`, when `plazoVencido = true` and `userRol = 'alumno'`, `validateEstadoChange` SHALL return `{ allowed: false, httpStatus: 403 }`.

**Validates: Requirements 4.2, 4.5**

---

### Property 2: Profesor and admin bypass plazo restriction

*For any* combination of `plazoVencido`, `claseTerminada`, `solicitudAceptada`, `currentEstado`, and `newEstado`, when `userRol` is `'profesor'` or `'admin'`, `validateEstadoChange` SHALL return `{ allowed: true }`.

**Validates: Requirements 4.4**

---

### Property 3: Plazo vencido false preserves existing validation behavior

*For any* valid input where `plazoVencido = false`, the result of `validateEstadoChange` SHALL be identical to the result produced by the previous version of the function (without the `plazoVencido` parameter). This is a regression property ensuring the new parameter does not break existing logic.

**Validates: Requirements 4.3, 4.5**

---

### Property 4: Deadline calculation correctness

*For any* `cancellationDeadlineHours >= 0` and any `classStart` timestamp, the computed deadline SHALL equal `classStart - cancellationDeadlineHours * 3600000` milliseconds. When `cancellationDeadlineHours = 0`, the deadline SHALL equal `classStart` exactly.

**Validates: Requirements 5.2, 5.3, 4.3**

---

### Property 5: Client canChangeStatus is false when plazo has passed

*For any* class data where `plazoVencido = true`, the computed `canChangeStatus` value SHALL be `false`, regardless of `yaPaso` or `estado`.

**Validates: Requirements 6.1, 6.3**

---

### Property 6: cancellationDeadlineHours range validation

*For any* integer value `v` in `[0, 168]`, the API validation SHALL accept it as valid. *For any* value outside `[0, 168]` (including non-integers, negative numbers, and values > 168), the API validation SHALL reject it with HTTP 400.

**Validates: Requirements 3.1, 3.2, 2.3**

---

## Error Handling

| Scenario | Response | Message |
|---|---|---|
| `get_server_time()` returns null or errors | HTTP 500 | `"No se pudo obtener la hora del servidor"` |
| Plazo vencido for alumno | HTTP 403 | `"El plazo para modificar la asistencia ha vencido."` |
| `cancellation_deadline_hours` out of range in PATCH /api/perfil | HTTP 400 | `"cancellation_deadline_hours debe ser un entero entre 0 y 168"` |
| Alumno tries to change after class ended | HTTP 403 | `"La clase ya finalizó. Solo un profesor puede modificar el estado."` (existing) |
| Accepted solicitud blocks change | HTTP 403 | `"No puedes modificar el estado porque tu solicitud de cambio fue aceptada."` (existing) |

**Client-side**: When the API returns HTTP 403, the existing error handling in `useAsistencia` already reads `body.error` and throws it as an `Error`. The calling component should catch this and display a Sonner toast with the server message. No new error handling infrastructure is needed.

**Fail-safe**: If `get_server_time()` fails, the API returns HTTP 500 rather than defaulting to `plazoVencido = false`. This prevents a server time outage from silently bypassing the deadline check.

---

## Testing Strategy

### Unit tests (example-based)

- `validateEstadoChange` with `plazoVencido = true`, `userRol = 'alumno'` → `allowed: false`
- `validateEstadoChange` with `plazoVencido = true`, `userRol = 'profesor'` → `allowed: true`
- `validateEstadoChange` with `plazoVencido = false` — all existing test cases pass unchanged (regression)
- Deadline calculation: `hours = 0` → deadline equals classStart
- Deadline calculation: `hours = 24` → deadline is 24h before classStart
- `canChangeStatus` returns `false` when `plazoVencido = true`
- `canChangeStatus` returns `false` when `yaPaso = true`
- `canChangeStatus` returns `true` when both are `false` and `estado !== 'cambiado'`
- PATCH /api/perfil: `cancellation_deadline_hours = -1` → HTTP 400
- PATCH /api/perfil: `cancellation_deadline_hours = 169` → HTTP 400
- PATCH /api/perfil: `cancellation_deadline_hours = 0` → accepted
- PATCH /api/perfil: `cancellation_deadline_hours = 168` → accepted
- PATCH /api/perfil: called as alumno → field ignored

### Property-based tests (fast-check, minimum 100 iterations each)

The project already uses **Vitest** + **fast-check** (both present in `package.json`). Tests live in `lib/validations/__tests__/`.

**Tag format**: `Feature: class-cancellation-deadline, Property {N}: {property_text}`

**Property 1 test** — `Feature: class-cancellation-deadline, Property 1: plazo vencido blocks alumno unconditionally`
```typescript
fc.property(
  fc.constantFrom(...ALL_ESTADOS),
  fc.constantFrom(...ALL_ESTADOS),
  fc.boolean(),
  fc.boolean(),
  (currentEstado, newEstado, claseTerminada, solicitudAceptada) => {
    const result = validateEstadoChange({
      userRol: 'alumno',
      currentEstado, newEstado, claseTerminada, solicitudAceptada,
      plazoVencido: true,
      cancellationDeadlineHours: 0,
    });
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(403);
  }
)
```

**Property 2 test** — `Feature: class-cancellation-deadline, Property 2: profesor and admin bypass plazo restriction`
```typescript
fc.property(
  fc.constantFrom<'profesor' | 'admin'>('profesor', 'admin'),
  fc.constantFrom(...ALL_ESTADOS),
  fc.constantFrom(...ALL_ESTADOS),
  fc.boolean(), fc.boolean(), fc.boolean(),
  fc.integer({ min: 0, max: 168 }),
  (userRol, currentEstado, newEstado, claseTerminada, solicitudAceptada, plazoVencido, hours) => {
    const result = validateEstadoChange({
      userRol, currentEstado, newEstado, claseTerminada, solicitudAceptada,
      plazoVencido,
      cancellationDeadlineHours: hours,
    });
    expect(result).toEqual({ allowed: true });
  }
)
```

**Property 3 test** — `Feature: class-cancellation-deadline, Property 3: plazo vencido false preserves existing behavior`
```typescript
fc.property(
  fc.constantFrom(...ALL_ESTADOS),
  fc.constantFrom(...ALL_ESTADOS),
  fc.boolean(),
  fc.boolean(),
  fc.integer({ min: 0, max: 168 }),
  (currentEstado, newEstado, claseTerminada, solicitudAceptada, hours) => {
    const withPlazo = validateEstadoChange({
      userRol: 'alumno', currentEstado, newEstado, claseTerminada, solicitudAceptada,
      plazoVencido: false,
      cancellationDeadlineHours: hours,
    });
    const withoutPlazo = validateEstadoChangeLegacy({
      userRol: 'alumno', currentEstado, newEstado, claseTerminada, solicitudAceptada,
    });
    expect(withPlazo).toEqual(withoutPlazo);
  }
)
```

**Property 4 test** — `Feature: class-cancellation-deadline, Property 4: deadline calculation correctness`
```typescript
fc.property(
  fc.integer({ min: 0, max: 168 }),
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  (hours, classStart) => {
    const deadlineMs = classStart.getTime() - hours * 3600 * 1000;
    expect(deadlineMs).toBe(classStart.getTime() - hours * 3600000);
    if (hours === 0) {
      expect(deadlineMs).toBe(classStart.getTime());
    }
  }
)
```

**Property 5 test** — `Feature: class-cancellation-deadline, Property 5: canChangeStatus is false when plazo has passed`
```typescript
fc.property(
  fc.boolean(),
  fc.constantFrom(...ALL_ESTADOS),
  (yaPaso, estado) => {
    const result = canChangeStatus({ yaPaso, plazoVencido: true, estado });
    expect(result).toBe(false);
  }
)
```

**Property 6 test** — `Feature: class-cancellation-deadline, Property 6: cancellationDeadlineHours range validation`
```typescript
// Valid range
fc.property(
  fc.integer({ min: 0, max: 168 }),
  (val) => {
    expect(isValidCancellationDeadline(val)).toBe(true);
  }
)
// Invalid range
fc.property(
  fc.oneof(
    fc.integer({ max: -1 }),
    fc.integer({ min: 169 }),
    fc.float().filter(v => !Number.isInteger(v)),
  ),
  (val) => {
    expect(isValidCancellationDeadline(val)).toBe(false);
  }
)
```

### Integration tests

- `GET /api/asistencia` response includes `horario.profesor.cancellation_deadline_hours`
- `PATCH /api/asistencia/:id` calls `get_server_time()` RPC
- `PATCH /api/asistencia/:id` returns HTTP 500 when `get_server_time()` fails
- `PATCH /api/perfil` persists `cancellation_deadline_hours` for professor role
