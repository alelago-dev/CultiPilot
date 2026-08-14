# PlantCare Calendar

PlantCare Calendar es una PWA mobile-first para seguimiento de cultivos horticolas legalmente permitidos. El MVP incluye arquitectura Next.js App Router, TypeScript, Tailwind CSS, contrato de Supabase, esquema SQL, i18n preparado, pantallas principales con datos demo e interfaz lista para conectar una API meteorologica.

## Incluye

- Registro e inicio de sesion preparado para Supabase Auth.
- Guardado por usuario con Supabase Auth y snapshot `user_app_snapshots` cuando las variables de entorno estan configuradas.
- Espacios de cultivo, plantas asociadas y macetas numeradas como unidades independientes.
- Campos para variedad o semilla, fecha de inicio, modalidad, region aproximada, maceta, sustrato e iluminacion.
- Selector de semillas con categorias horticultoras y categorias cannabicas legales para registro manual.
- Calculadora horticola no regulada por semilla, maceta, luz y espacio, con estimaciones orientativas de riego, agua y sustrato.
- Plan manual legal con banco/catalogo, genetica, tipo declarado, dias informados por el usuario, espacio, tamano de indoor, luz, litros de maceta y fechas definidas por el usuario.
- Tareas manuales y recurrentes con vista de hoy.
- Calendario mensual.
- Bitacora de observaciones y fotografias.
- Linea de tiempo local por planta que unifica inicio, tareas, eventos del calendario, fotos y observaciones.
- Interfaz de clima preparada para proveedor externo.
- Consentimiento de privacidad y uso legal.
- Base para exportacion y eliminacion completa de datos del usuario.

La app evita recomendaciones destinadas a maximizar sustancias controladas o evadir controles legales.
Para cultivos regulados, la app permite carga manual de datos solo donde sea legal, sin recomendador automatico de semilla, clima, cosecha ni rendimiento.
La demo no debe guardar numeros de registro, domicilios exactos ni datos medicos.

## Regla de negocio: cultivos regulados

En `lib/seed-catalog.ts`, una semilla se clasifica como regulada cuando `regulated: true` o cuando su `category` es `"cannabis"` o `"regulated"`. Esto aplica a cannabis y a cualquier cultivo que requiera autorizacion legal especifica.

Para semillas reguladas:

- no se calculan automaticamente riego, agua, sustrato, luz, indoor, flora, cosecha, secado ni rendimiento;
- no se cargan tiempos reales desde bancos externos ni catalogos scrapeados;
- solo se permite carga manual declarada por el usuario, agenda, recordatorios, bitacora y registro legal.

El catalogo `lib/genetics-catalog.ts` puede incluir referencias tabulares importadas desde Excel, conservando todas las
columnas originales en `raw_fields`. Esos campos son solo lectura para consulta y copia manual; no alimentan calculos,
autofill ni planes automaticos para cultivos regulados.

Para semillas horticultoras no reguladas (`regulated: false`, `category: "horticultural"`), la calculadora puede mostrar valores orientativos de sustrato, agua, luz, espacio y ventana de cosecha.

### Casos de prueba manuales

1. Semilla regulada: elegir una opcion de cannabis o `Carga manual legal - Variedad regulada`. Resultado esperado: no aparece en la calculadora horticola automatica; si se llama `calculateHorticulturePlan` con ese ID, `automaticEnabled` debe ser `false` y todos los valores tecnicos quedan como carga manual del usuario.
2. Semilla no regulada: elegir `Tomate - Roma`, modificar maceta, luz e indoor/espacio. Resultado esperado: la calculadora actualiza sustrato, revision de humedad, agua orientativa, luz, espacio y ventana estimada.
3. Flujo manual regulado: completar banco/catalogo, genetica, tipo declarado, dias publicados y fechas. Resultado esperado: esos campos son entradas de usuario; no se autocompletan con datos reales de bancos externos.

## Instalacion

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000/es`.

## Variables de entorno

Para desarrollo local, copiar `.env.example` a `.env.local` y completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WEATHER_PROVIDER=
NEXT_PUBLIC_WEATHER_API_KEY=
```

Para el sitio publicado en GitHub Pages, las credenciales de Supabase se leen
de `.env.production`, que esta versionado en el repo. Las dos variables
`NEXT_PUBLIC_SUPABASE_*` son publicas por diseno (Next.js las incrusta en el
bundle del navegador), y lo que protege los datos son las reglas de Row Level
Security de `supabase/schema.sql`. La clave `service_role` nunca debe ir ahi.

## Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en el SQL editor.
3. Configurar el bucket privado `plant-photos` si no se creo automaticamente.
4. Completar las variables de entorno.
5. La pantalla Privacidad permite conectar una cuenta por magic link y guardar/cargar el snapshot de la app por usuario.
6. Reemplazar gradualmente el snapshot por tablas normalizadas si se necesita operacion multiusuario avanzada.

## Fase 1: timeline local

La base de historial unificado vive en `lib/timeline.ts` y se muestra con `components/plant-timeline.tsx`.
Por ahora combina datos locales/demo y `localStorage`; no modifica tablas ni migraciones de Supabase.

## Scripts

```bash
npm run lint
npm run typecheck
npm run build
```

## Estructura

```text
app/                  rutas App Router e interfaz
components/           componentes de pantalla
lib/                  tipos, datos demo, i18n, clima y Supabase
public/               manifest PWA y service worker basico
supabase/schema.sql   esquema PostgreSQL, RLS y storage
```
