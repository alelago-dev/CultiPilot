PlantCare Calendar

PlantCare Calendar es una PWA mobile-first para seguimiento y gestión de cultivos legalmente permitidos. El proyecto utiliza Next.js App Router, TypeScript, Tailwind CSS y Supabase, e incluye calendario, tareas, bitácora, seguimiento por planta, datos meteorológicos y herramientas de cálculo y asistencia basadas en los datos registrados por el usuario.

Incluye

- Registro e inicio de sesión preparado para Supabase Auth.
- Guardado por usuario con Supabase Auth y snapshot "user_app_snapshots" cuando las variables de entorno están configuradas.
- Espacios de cultivo, plantas asociadas y macetas numeradas como unidades independientes.
- Campos para variedad o semilla, fecha de inicio, modalidad, región aproximada, maceta, sustrato e iluminación.
- Selector de semillas y genéticas con categorías hortícolas y categorías sujetas a regulación.
- Calculadora basada en semilla/genética, maceta, iluminación, espacio y demás datos disponibles.
- Estimaciones y sugerencias orientativas generadas a partir de los datos registrados.
- Registro de banco/catálogo, genética, tipo declarado, días informados, espacio, tamaño de indoor, iluminación, litros de maceta y fechas.
- Tareas manuales y recurrentes con vista de hoy.
- Calendario mensual.
- Bitácora de observaciones y fotografías.
- Línea de tiempo por planta que unifica inicio, tareas, eventos del calendario, fotos y observaciones.
- Interfaz de clima preparada para proveedor externo.
- Consentimiento de privacidad y uso legal.
- Base para exportación y eliminación completa de datos del usuario.

Motor de cálculos y sugerencias

PlantCare Calendar puede realizar cálculos automáticos, estimaciones orientativas y sugerencias basadas en los datos ingresados por el usuario para cultivos legalmente permitidos en su jurisdicción.

El motor puede utilizar, entre otros datos:

- especie, semilla y genética;
- etapa y edad de la planta;
- fechas registradas;
- tamaño de maceta;
- tipo y volumen de sustrato;
- modalidad indoor/outdoor;
- dimensiones del espacio;
- iluminación;
- temperatura y humedad;
- registros de riego;
- observaciones;
- fotografías;
- historial y línea de tiempo de la planta;
- información declarada o disponible en catálogos compatibles.

A partir de estos datos, PlantCare puede generar cálculos, estimaciones, alertas y sugerencias automáticas de seguimiento.

Las estimaciones deben identificarse como orientativas y diferenciarse de los datos medidos o ingresados directamente por el usuario.

Regla de negocio: cultivos sujetos a regulación

En "lib/seed-catalog.ts", una semilla puede clasificarse como regulada mediante "regulated: true" o mediante categorías específicas como ""cannabis"" o ""regulated"".

La propiedad "regulated" indica que la especie o variedad puede encontrarse sometida a requisitos legales específicos.

La clasificación como cultivo regulado no desactiva por sí misma el motor de cálculos, estimaciones o sugerencias.

PlantCare puede registrar y procesar datos de estos cultivos cuando el usuario declara que su actividad se encuentra legalmente permitida en su jurisdicción.

Para cultivos sujetos a regulación, PlantCare puede:

- realizar cálculos automáticos a partir de los parámetros registrados;
- generar sugerencias basadas en los datos disponibles;
- utilizar información declarada de genética o variedad;
- utilizar información disponible en catálogos compatibles;
- generar calendarios y estimaciones temporales;
- calcular y registrar parámetros relacionados con sustrato, agua, iluminación, espacio y condiciones ambientales;
- comparar mediciones e historial;
- generar alertas ante desviaciones de parámetros configurados;
- utilizar fotografías y observaciones como parte del seguimiento;
- adaptar sugerencias a la etapa registrada de cada planta.

La aplicación no verifica por sí misma la validez de permisos, registros, recetas, autorizaciones o documentación legal.

El usuario es responsable de utilizar PlantCare Calendar conforme a la legislación aplicable en su jurisdicción.

La aplicación no debe utilizarse para evadir controles legales.

La demo no debe almacenar números de registro, domicilios exactos ni datos médicos.

Catálogo de genéticas

El catálogo "lib/genetics-catalog.ts" puede incluir referencias tabulares importadas desde fuentes estructuradas, incluyendo archivos Excel u otros datasets compatibles.

Las columnas originales pueden conservarse en "raw_fields" para mantener trazabilidad de los datos importados.

Los datos del catálogo pueden utilizarse como entrada del motor de cálculos y sugerencias cuando corresponda.

PlantCare debe diferenciar siempre entre:

- datos ingresados por el usuario;
- datos importados desde catálogos;
- mediciones reales;
- estimaciones calculadas;
- sugerencias generadas automáticamente.

Cálculos automáticos

El motor de cálculo puede utilizar los parámetros disponibles de cada planta para producir estimaciones orientativas.

Entre otras funciones, puede contemplar:

- volumen de sustrato;
- seguimiento de humedad;
- consumo o necesidades estimadas de agua;
- iluminación;
- utilización del espacio;
- fechas y etapas;
- ventanas temporales estimadas;
- evolución registrada;
- comparación entre valores actuales e históricos.

Los cálculos deben actualizarse cuando cambien los datos que los alimentan.

Cuando no existan suficientes datos para producir una estimación razonable, la interfaz debe indicarlo en lugar de inventar valores.

Sugerencias basadas en datos

PlantCare puede generar sugerencias automáticas utilizando la información disponible de cada planta y su entorno.

Las sugerencias deben indicar, cuando corresponda, qué datos fueron utilizados para producirlas.

Ejemplos:

- cambios detectados respecto de registros anteriores;
- recordatorios derivados de fechas y etapas;
- desviaciones de temperatura o humedad respecto de parámetros configurados;
- diferencias entre plantas del mismo espacio;
- necesidad de realizar una nueva medición;
- información faltante necesaria para mejorar una estimación.

Las sugerencias son orientativas y no sustituyen asesoramiento profesional cuando éste resulte necesario.

Mediciones e historial

PlantCare puede incorporar mediciones periódicas asociadas a una planta o espacio de cultivo.

Entre ellas:

- temperatura;
- humedad ambiental;
- humedad del sustrato;
- altura de planta;
- volumen de agua registrado;
- condiciones de iluminación;
- observaciones;
- fotografías.

Las mediciones deben conservar fecha y hora para permitir construir series históricas y analizar evolución.

En futuras versiones, estos datos podrán ingresarse manualmente o recibirse automáticamente desde sensores y dispositivos IoT.

Análisis asistido por IA

PlantCare puede incorporar funciones de inteligencia artificial para analizar los datos registrados.

La IA puede utilizar:

- historial;
- mediciones;
- fotografías;
- observaciones;
- calendario;
- etapa;
- datos ambientales;
- datos de catálogo.

Entre sus posibles funciones:

- resumir la evolución de una planta;
- comparar períodos;
- detectar cambios visuales;
- identificar anomalías respecto del historial;
- explicar tendencias observadas;
- señalar información faltante;
- generar sugerencias de seguimiento.

Las respuestas generadas mediante IA deben presentarse como asistencia orientativa y no como mediciones reales cuando no exista un sensor o dato objetivo que las respalde.

Casos de prueba manuales

1. Cultivo sujeto a regulación: elegir una opción clasificada como "regulated". Resultado esperado: la clasificación legal se conserva, pero no desactiva automáticamente el motor de cálculo.

2. Cultivo hortícola: elegir "Tomate - Roma", modificar maceta, luz e indoor/espacio. Resultado esperado: la calculadora actualiza los valores orientativos correspondientes.

3. Datos de genética: completar banco/catálogo, genética, tipo declarado, días publicados y fechas. Resultado esperado: los datos quedan asociados a la planta y pueden ser utilizados por las funciones compatibles del motor.

4. Datos insuficientes: crear una planta sin completar parámetros necesarios para un determinado cálculo. Resultado esperado: PlantCare solicita o identifica los datos faltantes en lugar de inventar un resultado.

5. Actualización de datos: modificar un parámetro utilizado por la calculadora. Resultado esperado: las estimaciones dependientes se recalculan.

6. Historial: agregar nuevas mediciones u observaciones. Resultado esperado: quedan registradas cronológicamente y disponibles para comparación.

Instalación

npm install
npm run dev

Abrir "http://localhost:3000/es".

Variables de entorno

Para desarrollo local, copiar ".env.example" a ".env.local" y completar:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WEATHER_PROVIDER=
NEXT_PUBLIC_WEATHER_API_KEY=

Para el sitio publicado en GitHub Pages, las credenciales de Supabase se leen de ".env.production", que está versionado en el repo.

Las dos variables "NEXT_PUBLIC_SUPABASE_*" son públicas por diseño (Next.js las incrusta en el bundle del navegador), y lo que protege los datos son las reglas de Row Level Security de "supabase/schema.sql".

La clave "service_role" nunca debe almacenarse allí ni exponerse en el navegador.

Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar "supabase/schema.sql" en el SQL editor.
3. Configurar el bucket privado "plant-photos" si no se creó automáticamente.
4. Completar las variables de entorno.
5. La pantalla Privacidad permite conectar una cuenta por magic link y guardar/cargar el snapshot de la app por usuario.
6. Reemplazar gradualmente el snapshot por tablas normalizadas si se necesita operación multiusuario avanzada.

Timeline

La base de historial unificado vive en "lib/timeline.ts" y se muestra con "components/plant-timeline.tsx".

Actualmente combina los datos disponibles de cada planta para construir su historial cronológico.

La evolución futura del timeline puede incorporar mediciones, resultados calculados, alertas y análisis generados por IA.

Arquitectura futura

La evolución prevista de PlantCare permite integrar:

Planta
  ↓
Datos y configuración
  ↓
Calendario y tareas
  ↓
Mediciones
  ↓
Bitácora + fotografías
  ↓
Historial
  ↓
Motor de cálculos
  ↓
Análisis / IA
  ↓
Sugerencias y alertas

También puede incorporarse una capa IoT:

Sensores / ESP32 / Raspberry Pi
              ↓
           Supabase
              ↓
          PlantCare
              ↓
     Histórico y análisis

Scripts

npm run lint
npm run typecheck
npm run build

Estructura

app/                  rutas App Router e interfaz
components/           componentes de pantalla
lib/                  tipos, datos, cálculos, i18n, clima y Supabase
public/               manifest PWA y service worker básico
supabase/schema.sql   esquema PostgreSQL, RLS y storage
