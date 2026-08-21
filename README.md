# PlantCare Calendar

PlantCare Calendar es una PWA mobile-first para seguimiento de cultivos horticolas legalmente permitidos. El MVP incluye arquitectura Next.js App Router, TypeScript, Tailwind CSS, contrato de Supabase, esquema SQL, i18n preparado, pantallas principales con datos demo e interfaz lista para conectar una API meteorologica.

## Incluye

- Registro e inicio de sesion preparado para Supabase Auth.
- Guardado por usuario con Supabase Auth y snapshot `user_app_snapshots` cuando las variables de entorno estan configuradas.
- Espacios de cultivo, plantas asociadas y macetas numeradas como unidades independientes.
- Campos para variedad o semilla, fecha de inicio, modalidad, region aproximada, maceta, sustrato e iluminacion.
- Selector de semillas con categorias horticultoras y categorias cannabicas legales para registro y consulta.
- Motor de calculos por semilla, maceta, luz y espacio, con estimaciones orientativas de riego, agua y sustrato cuando hay datos suficientes.
- Plan manual legal con banco/catalogo, genetica, tipo declarado, dias informados por el usuario, espacio, tamano de indoor, luz, litros de maceta y fechas definidas por el usuario.
- Tareas manuales y recurrentes con vista de hoy.
- Calendario mensual.
- Bitacora de observaciones y fotografias.
- Linea de tiempo local por planta que unifica inicio, tareas, eventos del calendario, fotos y observaciones.
- Interfaz de clima preparada para proveedor externo.
- Consentimiento de privacidad y uso legal.
- Base para exportacion y eliminacion completa de datos del usuario.

La app evita recomendaciones destinadas a maximizar sustancias controladas o evadir controles legales.
Para cultivos regulados, la app mantiene la clasificacion legal como metadato y solo debe usarse donde sea legal. Esa clasificacion no desactiva por si sola el motor de calculos: las estimaciones dependen de datos suficientes registrados por el usuario, catalogos, mediciones o valores identificados como estimados.
La demo no debe guardar numeros de registro, domicilios exactos ni datos medicos.

## Regla de negocio: datos, calculos y cultivos regulados

En `lib/seed-catalog.ts`, una semilla se clasifica como regulada cuando `regulated: true` o cuando su `category` es `"cannabis"` o `"regulated"`. Esto aplica a cannabis y a cualquier cultivo que requiera autorizacion legal especifica.

`regulated` es una clasificacion legal, no un interruptor tecnico. La app desacopla:

- clasificacion legal;
- capacidad de calculo;
- origen de cada dato.

La calculadora se activa cuando hay datos suficientes. Si falta informacion, `calculateHorticulturePlan` devuelve `automaticEnabled: false` junto con `missingInputs`, para que la UI indique exactamente que dato falta. Las estimaciones quedan marcadas como estimaciones y no deben presentarse como mediciones reales.

Cada valor debe poder distinguir su origen:

- `user`: cargado o elegido por el usuario;
- `catalog`: proveniente de un catalogo o referencia estatica;
- `measurement`: medicion real manual, de dispositivo o sensor;
- `calculated`: valor estimado por el sistema;
- `suggestion`: sugerencia generada a partir de datos existentes;
- `missing`: dato faltante que impide estimar con confianza.

El catalogo `lib/genetics-catalog.ts` puede incluir referencias tabulares importadas desde Excel, conservando todas las columnas originales en `raw_fields`. Esos campos son de referencia y no autocompletan campos del formulario. El usuario decide que copiar, pegar o registrar.

La app no debe inventar valores cuando faltan datos. En ese caso debe listar los datos faltantes y mantener la accion como pendiente o manual.

### Casos de prueba manuales

1. Semilla regulada sin datos suficientes: elegir una opcion de cannabis o `Carga manual legal - Variedad regulada` y dejar vacios maceta, luz o ventana de ciclo. Resultado esperado: la calculadora no bloquea por `regulated`, pero `automaticEnabled` queda en `false` y muestra `missingInputs`.
2. Semilla regulada con datos suficientes: elegir una opcion regulada y completar datos tecnicos requeridos por el usuario. Resultado esperado: la calculadora puede mostrar estimaciones, marcadas como `calculated`, sin cambiar la clasificacion legal.
3. Semilla horticola: elegir `Tomate - Roma`, modificar maceta, luz e indoor/espacio. Resultado esperado: la calculadora actualiza sustrato, revision de humedad, agua orientativa, luz, espacio y ventana estimada.
4. Flujo de referencia: seleccionar una genetica del catalogo. Resultado esperado: los datos publicados se ven como referencia y no autocompletan el formulario.

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
6. Las tablas `plant_measurements` y `plant_insights` preparan la base para historico de mediciones, sensores e insights futuros.
7. En proyectos Supabase nuevos, revisar que las tablas necesarias esten expuestas a la Data API cuando se vayan a consumir desde el cliente; conservar siempre RLS habilitado.
8. Reemplazar gradualmente el snapshot por tablas normalizadas si se necesita operacion multiusuario avanzada.

## Fase 1: timeline local

La base de historial unificado vive en `lib/timeline.ts` y se muestra con `components/plant-timeline.tsx`.
Por ahora combina datos locales/demo y `localStorage`; no modifica tablas ni migraciones de Supabase.

## Base para mediciones e IA

La arquitectura nueva agrega `lib/plant-intelligence.ts` y los tipos `PlantMeasurement`, `PlantAnalysisContext` y `PlantInsight`.

El objetivo es permitir el flujo futuro:

```text
Sensores / ESP32 / Raspberry Pi
-> Supabase
-> PlantCare
-> historico
-> analisis / IA
-> alertas
```

Todavia no se agregan APIs pagas, secretos ni llamadas a IA. La app solo prepara el contexto para que una capa futura pueda analizar datos reales de planta, genetica, etapa, clima, timeline, observaciones y fotografias.

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
