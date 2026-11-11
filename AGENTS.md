# ProyectoDSI — Backend del sistema de presupuestos de construcción

Proyecto de la clase "Diseño de Sistemas en Internet" (UNI). Sistema web para crear y automatizar presupuestos de construcción en Nicaragua (moneda: córdobas, C$). Monorepo: el backend vive en `Backend/` (con B mayúscula); el frontend lo hace otra parte del equipo.

## Problema que resuelve
Hoy el presupuestista rehace a mano, por cada actividad (ej. "Excavación manual"), una memoria de costos unitarios (APU) con 3 grupos: Equipo y Transporte, Mano de Obra y Materiales. Con ~150 actividades tarda ~3 días. El sistema guarda los precios una sola vez y calcula todo solo: si cambia el precio del cemento, se recalculan las actividades que lo usan.

## Stack
NestJS + TypeScript, Prisma 5 (NO usar v6/v7), PostgreSQL en Render (base compartida por todo el equipo), class-validator, Swagger en `/api/docs`, JWT (passport), bcryptjs, exceljs. Prefijo global de la API: `/api`.
Patrón: MVC adaptado a API REST (Modelo = schema Prisma + DTOs + servicios; Vista = respuesta JSON; Controlador = `*.controller.ts`).

## Estructura de cada módulo
`Backend/src/<modulo>/`: `<modulo>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`. Prisma en `Backend/prisma/schema.prisma`.

## Lógica de dominio (no violar)
1. `recursos` (tipo: material | mano_obra | equipo | transporte) es el ÚNICO lugar donde se escribe un precio.
2. `apu_detalle` es la receta de una actividad: cantidad de cada recurso por 1 unidad de actividad. Costo unitario = Σ(cantidad × precio actual), agrupado por tipo, guardado en `apu_costo_cache`.
3. Al cambiar el precio de un recurso: en una transacción, insertar en `historial_precios` (NUNCA se sobrescribe el historial), actualizar el precio vigente y recalcular el APU de todas las actividades que lo usan.
4. Cada línea de presupuesto guarda el costo unitario CONGELADO (total y por categoría), copiado de `apu_costo_cache` al agregarla. Nunca se recalcula sola.
5. Los porcentajes se aplican en CASCADA (como en el diseño):
   - indirectos = costos directos × pctIndirectos
   - utilidad   = (costos directos + indirectos) × pctUtilidad
   - impuestos  = (costos directos + indirectos + utilidad) × pctImpuestos
   - total      = costos directos + indirectos + utilidad + impuestos
   Ejemplo: con directos 18,450,000.00 y 15/10/15 → total 26,840,137.50.
   Defaults 15/10/15, editables por presupuesto; vienen de `configuracion`. Este cálculo debe vivir en una FUNCIÓN PURA, con pruebas unitarias (no disperso en controladores/servicios).
6. Dinero con Decimal; redondeo a 2 decimales; nada de acumular floats.

## Estado actual (VERIFICAR leyendo el código; puede estar desactualizado)
- En `main`: PrismaModule/PrismaService, health, auth (JWT) y users (CRUD). Integrado por PR #5.
- En la rama `feat/Agregar-endpoints-api` (de los compañeros, aún sin PR a main): según sus commits, endpoints de proyectos, actividades (`activities`), apus e historial de precios (`historial-precios`). Probablemente son CRUD básicos.
- Los compañeros usan nombres de módulo en INGLÉS (users, activities, apus...). Sigue la convención que ya exista en el código; no renombres ni dupliques módulos.
- Lo más probable que falte (confirmar): lógica de cálculo del APU, recálculo en cascada al cambiar un precio, presupuestos con costo congelado, reportes a Excel, dashboard.
- Los ids en el schema son String uuid: usa ParseUUIDPipe / @IsUUID, no ParseIntPipe.

## Fuera de alcance (lo hace otro compañero)
Web scraping de SINSA (Playwright) y la importación de catálogos desde Excel (XLSX). El backend solo debe poder recibir precios por su API. No construyas eso a menos que se pida explícitamente.

## Reglas de trabajo
- Estoy en Windows con PowerShell: no uses `curl` ni comandos de bash; para probar la API usa Invoke-RestMethod, Node o Swagger.
- NO uses comandos de git que modifiquen algo (add, commit, push, checkout, merge, reset). Solo status, diff y log. Los commits los hago yo.
- Las ramas de mis compañeros son solo de lectura. Mi rama de trabajo: `feat/backend-presupuestos` (u otra que yo indique).
- La base de datos de Render es COMPARTIDA: nunca ejecutes `prisma migrate reset`, `prisma db push --force-reset` ni nada que borre datos. Antes de cualquier migración, dime qué va a cambiar y espera mi confirmación.
- Nunca leas, muestres ni escribas el contenido de `Backend/.env`. No pongas credenciales en archivos que se suban.
- Trabaja SOLO lo que te pida; al terminar, detente con un reporte. Antes del reporte: `npm run build` sin errores.
- Reporte en español sencillo: (1) archivos creados/modificados y para qué sirve cada uno, (2) explicación del código importante como a un estudiante, (3) cómo probarlo en Swagger, (4) mensaje de commit sugerido, (5) decisiones y problemas.
- Mensajes de commit en español, convencionales: `feat(modulo): ...`, `chore: ...`, `docs: ...`. Un módulo por commit.
- Errores de la API en español (404, 409, 400).
- Antes de crear algo nuevo, revisa si ya existe en `Backend/src` o en `schema.prisma`.
