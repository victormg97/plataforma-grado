# Implementation Plan: class-cancellation-deadline

## Overview

Add a per-professor `cancellation_deadline_hours` configuration that controls how many hours before a class starts students can no longer change their attendance status. The implementation follows a strict dependency order: DB migration first, then TypeScript types, then the pure validation layer (with PBT), then API routes, then the profile UI, then the client hook, and finally the alumno detail view.

## Tasks

- [x] 1. DB migration — add `cancellation_deadline_hours` to `profiles`
  - [x] 1.1 Create migration file `supabase/migrations/043_add_cancellation_deadline.sql`
    - Add `cancellation_deadline_hours INTEGER NOT NULL DEFAULT 0` with `IF NOT EXISTS` guard
    - Drop and re-add `profiles_cancellation_deadline_hours_check` constraint (`>= 0`) so it is idempotent
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. TypeScript types — extend `profiles` Row/Insert/Update
  - [x] 2.1 Add `cancellation_deadline_hours: number` to the `profiles` `Row`, `Insert`, and `Update` types in `lib/supabase/types.ts`
    - Follow the same pattern as the existing `duracion_clase_default_min` field
    - _Requirements: 1.4_

- [x] 3. Validation function — extend `validateEstadoChange` with deadline logic
  - [x] 3.1 Extend `ValidateEstadoChangeParams` and `validateEstadoChange` in `lib/validations/asistencia.ts`
    - Add `plazoVencido: boolean` and `cancellationDeadlineHours: number` to `ValidateEstadoChangeParams`
    - Insert the `plazoVencido` check for `userRol === 'alumno'` between the `solicitudAceptada` check and the `claseTerminada` check
    - Return `{ allowed: false, errorMessage: 'El plazo para modificar la asistencia ha vencido.', httpStatus: 403 }` when `plazoVencido` is true
    - Professors and admins remain unconditionally allowed — no change to their branch
    - _Requirements: 4.2, 4.3, 4.5_

  - [ ]* 3.2 Write property test — Property 1: plazo vencido blocks alumno unconditionally
    - File: `lib/validations/__tests__/asistencia.test.ts`
    - Tag: `Feature: class-cancellation-deadline, Property 1: plazo vencido blocks alumno unconditionally`
    - Use `fc.property` over all `currentEstado`, `newEstado`, `claseTerminada`, `solicitudAceptada` combinations with `plazoVencido: true` and `userRol: 'alumno'`
    - Assert `result.allowed === false` and `result.httpStatus === 403`
    - **Property 1: Plazo vencido blocks alumno unconditionally**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 3.3 Write property test — Property 2: profesor and admin bypass plazo restriction
    - File: `lib/validations/__tests__/asistencia.test.ts`
    - Tag: `Feature: class-cancellation-deadline, Property 2: profesor and admin bypass plazo restriction`
    - Use `fc.property` over `userRol ∈ {profesor, admin}`, all estado combinations, all boolean flags, and `hours ∈ [0, 168]`
    - Assert `result` deep-equals `{ allowed: true }`
    - **Property 2: Profesor and admin bypass plazo restriction**
    - **Validates: Requirements 4.4**

  - [ ]* 3.4 Write property test — Property 3: plazo vencido false preserves existing validation behavior
    - File: `lib/validations/__tests__/asistencia.test.ts`
    - Tag: `Feature: class-cancellation-deadline, Property 3: plazo vencido false preserves existing behavior`
    - Export a `validateEstadoChangeLegacy` snapshot (or inline the old logic) and compare its output against `validateEstadoChange` called with `plazoVencido: false`
    - Assert both return identical results for all alumno inputs
    - **Property 3: Plazo vencido false preserves existing validation behavior**
    - **Validates: Requirements 4.3, 4.5**

- [x] 4. Checkpoint — validation layer
  - Ensure all tests in `lib/validations/__tests__/` pass. Ask the user if questions arise.

- [x] 5. API Route — `PATCH /api/asistencia/[id]`
  - [x] 5.1 Extend the alumno branch of `app/api/asistencia/[id]/route.ts` with deadline enforcement
    - Join `profiles!horarios_profesor_id_fkey(cancellation_deadline_hours)` in the `horarios` select
    - Call `supabase.rpc('get_server_time')` and return HTTP 500 if it fails or returns null
    - Compute `plazoVencido = now.getTime() >= classStart.getTime() - cancellationDeadlineHours * 3600000`
    - Pass `plazoVencido` and `cancellationDeadlineHours` to `validateEstadoChange`
    - The existing professor-ownership early-return already bypasses this block — no change needed there
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

- [x] 6. API Route — `GET /api/asistencia`
  - [x] 6.1 Extend the select query in `app/api/asistencia/route.ts` to include `cancellation_deadline_hours`
    - Change the horarios select to: `*, horario:horarios(*, profesor:profiles!horarios_profesor_id_fkey(cancellation_deadline_hours))`
    - _Requirements: 7.1_

- [x] 7. API Route — `PATCH /api/perfil`
  - [x] 7.1 Add `cancellation_deadline_hours` handling block to `app/api/perfil/route.ts`
    - Follow the same pattern as the existing `duracion_clase_default_min` block
    - Validate that the value is an integer in `[0, 168]`; return HTTP 400 with a descriptive message if not
    - Persist to `profiles.cancellation_deadline_hours` for `profesor` and `admin` roles
    - Ignore the field silently when the authenticated user has role `alumno`
    - Share the `rol` fetch with the existing `duracion_clase_default_min` block to avoid a duplicate query
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 7.2 Write property test — Property 6: cancellationDeadlineHours range validation
    - File: `lib/validations/__tests__/asistencia.test.ts` (or a new `perfil.test.ts` if a pure helper is extracted)
    - Tag: `Feature: class-cancellation-deadline, Property 6: cancellationDeadlineHours range validation`
    - Extract a pure `isValidCancellationDeadline(val: number): boolean` helper from the API route validation logic
    - Valid range: `fc.integer({ min: 0, max: 168 })` → assert `true`
    - Invalid range: `fc.oneof(fc.integer({ max: -1 }), fc.integer({ min: 169 }), fc.float().filter(v => !Number.isInteger(v)))` → assert `false`
    - **Property 6: cancellationDeadlineHours range validation**
    - **Validates: Requirements 3.1, 3.2, 2.3**

- [x] 8. Checkpoint — API routes
  - Ensure all tests pass and the three API routes compile without TypeScript errors. Ask the user if questions arise.

- [x] 9. Profile page — add `cancellation_deadline_hours` field
  - [x] 9.1 Add the deadline input field to `app/(dashboard)/perfil/page.tsx`
    - Add `const [cancellationDeadline, setCancellationDeadline] = useState('0')`
    - Initialize from `perfilData.cancellation_deadline_hours ?? 0` inside the existing `useEffect`
    - Render a `<Field>` with a number input (`min=0`, `max=168`, `step=1`) inside the `isProfesorOrAdmin` section, below the `duracion_clase_default_min` field
    - Include `cancellation_deadline_hours: Number(cancellationDeadline)` in the `handleSaveInfo` body when `isProfesorOrAdmin`
    - Hide the field entirely when the user is an alumno
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 10. Client hook — extend `useAsistencia` and `useClaseTimeStatus`
  - [x] 10.1 Add `cancellation_deadline_hours` to the `ClaseAlumno.horario.profesor` type in `lib/hooks/useAsistencia.ts`
    - Add `cancellation_deadline_hours: number` to the `profesor` nested type
    - _Requirements: 7.2, 7.3_

  - [x] 10.2 Extend `useClaseTimeStatus` in `lib/hooks/useServerTime.ts` to accept and compute `plazoVencido`
    - Add `cancellationDeadlineHours: number = 0` parameter
    - Compute `plazoVencido = nowMs >= classStartMs - cancellationDeadlineHours * 3600000`
    - Return `plazoVencido` alongside the existing `enCurso`, `yaPaso`, `esFuturo`, `isLoading` values
    - When `cancellationDeadlineHours = 0`, `plazoVencido` equals `now >= hora_inicio` (preserves current behavior)
    - _Requirements: 6.1, 6.3_

  - [ ]* 10.3 Write property test — Property 4: deadline calculation correctness
    - File: `lib/validations/__tests__/canChangeStatus.test.ts` (or a new `deadline.test.ts`)
    - Tag: `Feature: class-cancellation-deadline, Property 4: deadline calculation correctness`
    - Use `fc.property(fc.integer({ min: 0, max: 168 }), fc.date(...))` to assert `deadlineMs === classStart.getTime() - hours * 3600000`
    - Assert that when `hours === 0`, `deadlineMs === classStart.getTime()`
    - **Property 4: Deadline calculation correctness**
    - **Validates: Requirements 5.2, 5.3, 4.3**

  - [ ]* 10.4 Write property test — Property 5: canChangeStatus is false when plazo has passed
    - File: `lib/validations/__tests__/canChangeStatus.test.ts`
    - Tag: `Feature: class-cancellation-deadline, Property 5: canChangeStatus is false when plazo has passed`
    - Extract or reference the `canChangeStatus` logic and use `fc.property(fc.boolean(), fc.constantFrom(...ALL_ESTADOS))` with `plazoVencido: true`
    - Assert result is always `false`
    - **Property 5: canChangeStatus is false when plazo has passed**
    - **Validates: Requirements 6.1, 6.3**

- [x] 11. Alumno horario detail view — wire deadline into UI
  - [x] 11.1 Update `app/(dashboard)/alumno/horario/page.tsx` to use `plazoVencido`
    - Pass `clase.horario.profesor?.cancellation_deadline_hours ?? 0` to `useClaseTimeStatus`
    - Destructure `plazoVencido` from the hook result
    - Update `canChangeStatus` to `!yaPaso && !plazoVencido && clase.estado !== 'cambiado'`
    - Render the amber informational banner when `plazoVencido && !yaPaso`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 12. Final checkpoint — full feature
  - Ensure all tests pass (`npx vitest --run`). Verify TypeScript compiles without errors (`npx tsc --noEmit`). Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the validation layer and API layer before touching the UI
- Property tests use **fast-check** (already in `package.json`) and live in `lib/validations/__tests__/`
- The migration file must be `043_add_cancellation_deadline.sql` (next in sequence after `042`)
- The `get_server_time()` RPC is already present in the system — no new DB function needed
- The professor-ownership bypass in `PATCH /api/asistencia/[id]` is already implemented via an early return; the new `plazoVencido` computation only runs inside the alumno branch

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 5, "tasks": ["7.2", "9.1"] },
    { "id": 6, "tasks": ["10.1", "10.2"] },
    { "id": 7, "tasks": ["10.3", "10.4"] },
    { "id": 8, "tasks": ["11.1"] }
  ]
}
```
