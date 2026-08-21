# PlantCare Calendar

PlantCare Calendar es una PWA mobile-first para seguimiento y gestion de cultivos legalmente permitidos. El proyecto utiliza Next.js App Router, TypeScript, Tailwind CSS y Supabase, e incluye calendario, tareas, bitacora, seguimiento por planta, datos meteorologicos y herramientas de calculo y asistencia basadas en los datos registrados por el usuario.

## Incluye

- Registro e inicio de sesion preparado para Supabase Auth.
- Guardado por usuario con Supabase Auth y snapshot `user_app_snapshots` cuando las variables de entorno estan configuradas.
- Espacios de cultivo, plantas asociadas y macetas numeradas como unidades independientes.
- Campos para variedad o semilla, fecha de inicio, modalidad, region aproximada, maceta, sustrato e iluminacion.
- Selector de semillas y geneticas con categorias horticolas y categorias sujetas a regulacion.
- Motor de calculos por semilla, maceta, iluminacion, espacio y demas datos disponibles.
- Estimaciones y sugerencias orientativas generadas a partir de los datos registrados.
- Registro de banco/catalogo, genetica, tipo declarado, dias informados, espacio, tamano de indoor, iluminacion, litros de maceta y fechas.
- Tareas manuales y recurrentes con vista de hoy.
- Calendario mensual.
- Bitacora de observaciones y fotografias.
- Linea de tiempo por planta que unifica inicio, tareas, eventos del calendario, fotos y observaciones.
- Interfaz de clima preparada para proveedor externo.
- Consentimiento de privacidad y uso legal.
- Base para exportacion y eliminacion completa de datos del usuario.

La app evita recomendaciones destinadas a evadir controles legales. El usuario es responsable de utilizar PlantCare Calendar conforme a la legislacion aplicable en su jurisdiccion. La demo no debe guardar numeros de registro, domicilios exactos ni datos medicos.

## Motor de calculos y sugerencias

PlantCare Calendar puede realizar calculos automaticos, estimaciones orientativas y sugerencias basadas en datos ingresados por el usuario, datos de catalogo, mediciones reales o valores calculados.

El motor puede utilizar, entre otros datos:

- especie, semilla y genetica;
- etapa y edad de la planta;
- fechas registradas;
- tamano de maceta;
- tipo y volumen de sustrato;
- modalidad indoor/outdoor;
- dimensiones del espacio;
- iluminacion;
- temperatura y humedad;
- registros de riego;
- observaciones;
- fotografias;
- historial y linea de tiempo de la planta;
- informacion declarada o disponible en catalogos compatibles.

Las estimaciones deben identificarse como orientativas y diferenciarse de los datos medidos o ingresados directamente por el usuario.

## Regla de negocio: datos, calculos y cultivos regulados

En `lib/seed-catalog.ts`, una semilla puede clasificarse como regulada mediante `regulated: true` o mediante categorias especificas como `"cannabis"` o `"regulated"`.

`regulated` es una clasificacion legal, no un interruptor tecnico. La app desacopla:

- clasificacion legal;
- capacidad de calculo;
- origen de cada dato.

La clasificacion como cultivo regulado no desactiva por si misma el motor de calculos, estimaciones o sugerencias. La calculadora se activa cuando hay datos suficientes. Si falta informacion, `calculateHorticulturePlan` devuelve `automaticEnabled: false` junto con `missingInputs`, para que la UI indique exactamente que dato falta.

Cada valor debe poder distinguir su origen:

- `user`: cargado o elegido por el usuario;
- `catalog`: proveniente de un catalogo o referencia estatica;
- `measurement`: medicion real manual, de dispositivo o sensor;
- `calculated`: valor estimado por el sistema;
- `suggestion`: sugerencia generada a partir de datos existentes;
- `missing`: dato faltante que impide estimar con confianza.

PlantCare puede registrar y procesar datos de cultivos sujetos a regulacion cuando el usuario declara que su actividad se encuentra legalmente permitida. La aplicacion no verifica permisos, registros, recetas, autorizaciones ni documentacion legal.

La app no debe inventar valores cuando faltan datos. En ese caso debe listar los datos faltantes y mantener la accion como pendiente o manual.

## Catalogo de geneticas

El catalogo `lib/genetics-catalog.ts` puede incluir referencias tabulares importadas desde fuentes estructuradas, incluyendo archivos Excel u otros datasets compatibles.

Las columnas originales pueden conservarse en `raw_fields` para mantener trazabilidad de los datos importados.

Los datos del catalogo pueden utilizarse como entrada del motor de calculos y sugerencias cuando corresponda, siempre diferenciando su origen y sin ocultar que son datos de catalogo.

## Mediciones e historial

PlantCare puede incorporar mediciones periodicas asociadas a una planta o espacio de cultivo:

- temperatura;
- humedad ambiental;
- humedad del sustrato;
- altura de planta;
- volumen de agua registrado;
- pH y EC/ppm de entrada o drenaje, solo cuando fueron medidos;
- condiciones de iluminacion y PPFD a nivel de la copa;
- observaciones;
- fotografias.

Las mediciones conservan fecha, hora y origen (`manual`, `device` o `sensor`) para construir series historicas y analizar evolucion. El acceso `Mediciones ambientales` esta visible desde Hoy y al comienzo de Espacios. Permite elegir una maceta independiente y registrar fecha/hora, temperatura y humedad; tambien admite temperatura foliar, humedad de sustrato, PPFD, altura, agua, pH, EC/ppm, drenaje, observaciones y foto. EC y ppm se guardan como mediciones independientes y nunca se convierten ni se inventan. La ficha expandida de cada maceta muestra el VPD calculado de cada lectura, todos los campos registrados y una galeria cronologica para comparar dos fotografias de la misma maceta sin inferir diagnosticos. Esos datos forman parte del snapshot del usuario y se sincronizan junto con sus plantas cuando la cuenta esta conectada.

`assessPlantEnvironment` calcula un VPD estimado y lo compara con una banda orientativa segun la etapa declarada. Si el usuario registra temperatura foliar, calcula VPD foliar con temperatura ambiental, foliar y humedad relativa. Si falta ese dato, muestra VPD del aire sin inventar una diferencia fija entre hoja y ambiente. El formulario muestra el VPD en vivo antes de guardar y la ficha presenta tendencias de temperatura, humedad y VPD usando exclusivamente las lecturas registradas, sin completar huecos. La interfaz diferencia la medicion original del valor `calculated`, muestra la banda utilizada y avisa cuando falta temperatura, humedad o PPFD.

Cada maceta incluye un resumen movil de los ultimos siete dias. Cuenta mediciones, riegos, notas, fotos y acciones completadas con fechas existentes; muestra las tareas abiertas como pendientes actuales porque no tienen una fecha de ejecucion confirmada. La tendencia VPD compara solamente la primera y la ultima lectura calculable del periodo y explicita cuando faltan datos.

`buildCultivationSuggestions` transforma la etapa declarada, las mediciones recientes, el setup y los datos de catalogo disponibles en revisiones explicables. Cada sugerencia muestra evidencia, origen, datos faltantes y una fecha orientativa. Nunca entra al calendario automaticamente: el usuario debe pulsar `Agregar al calendario`. Tampoco calcula dosis universales de agua o fertilizante ni fuerza poda, flora, cosecha o ajustes de equipos.

El esquema `plant_measurements` y la Edge Function `supabase/functions/ingest-sensor` permiten que un ESP32, Raspberry Pi u otro gateway escriba mediciones con `source = 'sensor'`. Cada dispositivo usa un token propio revocable cuyo hash se guarda en `sensor_devices`; nunca se expone una clave `service_role` en el sensor o en el navegador. La activacion y el ejemplo de peticion estan documentados junto a la funcion.

## Analisis asistido por IA

La arquitectura queda preparada para incorporar funciones futuras de inteligencia artificial sin agregar todavia APIs pagas, secretos ni llamadas a modelos.

La IA podria utilizar historial, mediciones, fotografias, observaciones, calendario, etapa, datos ambientales y datos de catalogo para:

- resumir la evolucion de una planta;
- comparar periodos;
- detectar cambios visuales;
- identificar anomalias respecto del historial;
- explicar tendencias observadas;
- senalar informacion faltante;
- generar sugerencias de seguimiento.

Las respuestas generadas mediante IA deben presentarse como asistencia orientativa y no como mediciones reales cuando no exista un sensor o dato objetivo que las respalde.

## Casos de prueba manuales

1. Cultivo sujeto a regulacion: elegir una opcion clasificada como `regulated`. Resultado esperado: la clasificacion legal se conserva, pero no desactiva automaticamente el motor de calculo.
2. Cultivo sujeto a regulacion sin datos suficientes: dejar vacios maceta, luz o ventana de ciclo. Resultado esperado: `automaticEnabled` queda en `false` y muestra `missingInputs`.
3. Cultivo con datos suficientes: completar los datos tecnicos requeridos. Resultado esperado: la calculadora puede mostrar estimaciones, marcadas como `calculated`.
4. Cultivo horticola: elegir `Tomate - Roma`, modificar maceta, luz e indoor/espacio. Resultado esperado: la calculadora actualiza los valores orientativos correspondientes.
5. Datos de genetica: completar banco/catalogo, genetica, tipo declarado, dias publicados y fechas. Resultado esperado: los datos quedan asociados a la planta y pueden ser utilizados por funciones compatibles del motor.
6. Historial: agregar nuevas mediciones u observaciones. Resultado esperado: quedan registradas cronologicamente y disponibles para comparacion.
7. Ambiente: registrar temperatura y humedad en una maceta. Resultado esperado: aparece un VPD estimado, su rango orientativo, el origen de los datos y una alerta explicable si queda fuera de banda.
8. Luz: registrar PPFD. Resultado esperado: se compara con la referencia de la etapa declarada; si no hay medicion, la app informa que falta el dato en vez de inventarlo.
9. Sugerencias: expandir una maceta. Resultado esperado: aparecen revisiones explicadas con sus fuentes y faltantes; al pulsar `Agregar al calendario` se crea una sola tarea vinculada a esa planta.
10. Sensor: enviar una peticion valida a `ingest-sensor`. Resultado esperado: se crea una medicion con origen `sensor`; un token inexistente o desactivado recibe HTTP 401.

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

Para el sitio publicado en GitHub Pages, las credenciales de Supabase se leen de `.env.production`, que esta versionado en el repo.

Las dos variables `NEXT_PUBLIC_SUPABASE_*` son publicas por diseno: Next.js las incrusta en el bundle del navegador, y lo que protege los datos son las reglas de Row Level Security de `supabase/schema.sql`.

La clave `service_role` nunca debe almacenarse ahi ni exponerse en el navegador.

## Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en el SQL editor.
3. Configurar el bucket privado `plant-photos` si no se creo automaticamente.
4. Completar las variables de entorno.
5. La pantalla Privacidad permite conectar una cuenta por magic link y guardar/cargar el snapshot de la app por usuario.
6. Las tablas `plant_measurements` y `plant_insights` preparan la base para historico de mediciones, sensores e insights futuros.
7. En proyectos Supabase nuevos, revisar que las tablas necesarias esten expuestas a la Data API cuando se vayan a consumir desde el cliente; conservar siempre RLS habilitado.
8. Reemplazar gradualmente el snapshot por tablas normalizadas si se necesita operacion multiusuario avanzada.
9. Para sensores, ejecutar el bloque actualizado de `supabase/schema.sql`, desplegar `ingest-sensor` y seguir `supabase/functions/ingest-sensor/README.md`.

## Timeline

La base de historial unificado vive en `lib/timeline.ts` y se muestra con `components/plant-timeline.tsx`.

Actualmente combina los datos disponibles de cada planta para construir su historial cronologico. La evolucion futura del timeline puede incorporar mediciones, resultados calculados, alertas y analisis generados por IA.

## Arquitectura futura

```text
Planta
-> Datos y configuracion
-> Calendario y tareas
-> Mediciones
-> Bitacora + fotografias
-> Historico
-> Motor de calculos
-> Analisis / IA
-> Sugerencias y alertas
```

Tambien puede incorporarse una capa IoT:

```text
Sensores / ESP32 / Raspberry Pi
-> Supabase
-> PlantCare
-> Historico y analisis
```

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
lib/                  tipos, datos, calculos, i18n, clima y Supabase
public/               manifest PWA y service worker basico
supabase/schema.sql   esquema PostgreSQL, RLS y storage
```
