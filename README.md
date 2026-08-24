# CultiPilot

CultiPilot es una PWA mobile-first para seguimiento, gestion, calculo y asistencia integral de cultivos. El proyecto utiliza Next.js App Router, TypeScript, Tailwind CSS y Supabase, e incluye calendario, tareas, bitacora, seguimiento por planta, datos meteorologicos y recomendaciones basadas en los datos disponibles.

La interfaz utiliza un sistema visual propio inspirado en patrones shadcn y en la jerarquia tipografica de Geist: tokens unificados para superficies, bordes, radios, sombras, foco, tipografia y metricas. La navegacion movil mantiene todas las secciones accesibles mediante una barra inferior desplazable, el encabezado prioriza VPD y cuenta, y Hoy funciona como panel operativo con contexto de fecha, metricas y superficies diferenciadas. Estos cambios son visuales y de accesibilidad; no modifican calculos, datos ni reglas de cultivo.

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
- Notificaciones push reales de tareas vencidas o de hoy, entregadas por Supabase aunque la app este cerrada.
- Interfaz de clima preparada para proveedor externo.
- Consentimiento de privacidad y uso legal.
- Base para exportacion y eliminacion completa de datos del usuario.

CultiPilot aplica el mismo motor de calculos y sugerencias a todos los cultivos. La clasificacion legal se conserva como metadato y nunca reduce las capacidades tecnicas de la aplicacion.

## Motor de calculos y sugerencias

CultiPilot puede realizar calculos automaticos, estimaciones orientativas y sugerencias basadas en datos ingresados por el usuario, datos de catalogo, mediciones reales o valores calculados.

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

Cada resultado identifica si proviene de una medicion, un dato del usuario, el catalogo, una formula o una sugerencia. Cuando faltan entradas, CultiPilot las solicita y puede mostrar escenarios calculados con supuestos visibles.

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

CultiPilot registra y procesa cultivos sujetos a regulacion con las mismas herramientas disponibles para cualquier otro cultivo. Las mediciones reales permanecen diferenciadas de estimaciones y escenarios para que el usuario siempre conozca el origen de cada valor.

## Catalogo de geneticas

El catálogo suma 69 variedades únicas del informe comparativo *Catálogos de semillas de cannabis, edición ampliada 2026*. Durante la importación se omitieron 18 nombres ya presentes (comparación normalizada, sin distinguir mayúsculas, acentos ni signos). Cada registro conserva banco, tipo, duración, THC, CBD, sabor/aroma y referencia publicados en `raw_fields`, sin completar datos ausentes ni presentarlos como mediciones.

El catalogo `lib/genetics-catalog.ts` puede incluir referencias tabulares importadas desde fuentes estructuradas, incluyendo archivos Excel u otros datasets compatibles.

Las columnas originales pueden conservarse en `raw_fields` para mantener trazabilidad de los datos importados.

Los datos del catalogo pueden utilizarse como entrada del motor de calculos y sugerencias cuando corresponda, siempre diferenciando su origen y sin ocultar que son datos de catalogo.

La auditoría del catálogo valida identificadores y contenido exacto: no hay fichas idénticas ni IDs repetidos. Un mismo nombre puede mantenerse cuando corresponde a bancos, productos o fuentes diferentes; el Finder y el selector muestran la fuente y conservan el ID elegido para no sustituir silenciosamente una ficha por otra del mismo nombre. La búsqueda ignora mayúsculas y acentos. En `Mi cultivo` se retiraron `Banco o catálogo` y `Registro legal` porque eran controles decorativos que no se guardaban ni intervenían en cálculos.

## Mediciones e historial

CultiPilot puede incorporar mediciones periodicas asociadas a una planta o espacio de cultivo:

- temperatura;
- humedad ambiental;
- humedad del sustrato;
- altura de planta;
- volumen de agua registrado;
- pH y EC/ppm de entrada o drenaje, solo cuando fueron medidos;
- condiciones de iluminacion y PPFD a nivel de la copa;
- observaciones;
- fotografias.

Las mediciones conservan fecha, hora y origen (`manual`, `device` o `sensor`) para construir series historicas y analizar evolucion. El acceso `Mediciones ambientales` esta visible desde Hoy y al comienzo de Espacios. Permite elegir una maceta independiente y registrar fecha/hora, temperatura y humedad; tambien admite temperatura foliar, humedad de sustrato, PPFD, altura, agua, pH, EC/ppm, drenaje, observaciones y foto. EC y ppm se guardan como mediciones independientes y nunca se convierten ni se inventan. La ficha expandida de cada maceta muestra el VPD calculado de cada lectura, todos los campos registrados y una galeria cronologica para comparar dos fotografias de la misma maceta sin inferir diagnosticos. También permite importar un histórico CSV por maceta: detecta delimitador, propone el mapeo de columnas, muestra una vista previa, valida rangos, omite duplicados y conserva el nombre del archivo u origen declarado sin completar valores ausentes. Esos datos forman parte del snapshot del usuario y se sincronizan junto con sus plantas cuando la cuenta esta conectada.

Las lecturas manuales o cargadas desde un dispositivo pueden editarse conservando su identificador y reemplazando el registro dentro del snapshot; las lecturas originadas por sensores permanecen de solo lectura para preservar su procedencia.

El riego por lote permite seleccionar varias macetas y registrar fecha, agua, pH, EC, ppm y observacion comunes. La interfaz crea una medicion independiente por maceta para que luego pueda editarse, compararse o exportarse sin mezclar historiales. El usuario puede guardar esos valores como receta propia y reutilizarlos; CultiPilot puede calcular cantidades y escenarios a partir de volumen, concentracion, producto, etapa y objetivo declarados.

Espacios incluye un inventario manual de insumos con nombre, categoria, cantidad, unidad y minimo opcional definidos por el usuario. Un riego por lote puede vincular un insumo y una cantidad por maceta: antes de guardar muestra el total, evita consumos superiores al stock y, tras la confirmacion, descuenta una sola vez mientras conserva un registro de riego independiente por maceta. CultiPilot puede recomendar productos compatibles, comparar alternativas y anticipar reposiciones usando catalogo, etapa, modalidad, inventario y mediciones disponibles. El inventario y las referencias guardadas en recetas forman parte del mismo snapshot privado sincronizado por usuario, sin una tabla compartida adicional.

El catalogo privado de productos permite transcribir nombre, marca, categoria, composicion, etapas y modalidades declaradas, contenido, precio, moneda, fuente y fecha de revision. El comparador contrasta esos datos con la etapa y modalidad que el usuario declaro para una maceta, calcula precio por unidad solo cuando existen precio y contenido, y enumera la informacion faltante. Una coincidencia significa exclusivamente compatibilidad declarada: no es una indicacion de compra, diagnostico ni dosis. Las fuentes deben ser enlaces HTTP o HTTPS y no se incorporan productos, precios o etiquetas predeterminados sin una referencia verificable.

Una referencia puede vincularse a una existencia del inventario conservando su fuente, lote y vencimiento opcionales. Desde alli puede usarse en una receta propia y descontarse mediante el riego por lote, manteniendo separados el dato publicado, la existencia declarada y la aplicacion realmente registrada. Catalogo e inventario se sincronizan dentro del snapshot privado de cada usuario; no agregan tablas publicas ni cambian las politicas RLS existentes.

Cada cambio futuro de cantidad genera un movimiento de inventario con fecha, diferencia, saldo resultante y motivo. Los consumos por riego conservan las macetas involucradas y la fecha del registro; los ajustes `+1` y `-1` se identifican como movimientos manuales. La app no reconstruye movimientos anteriores a esta funcionalidad porque no existe evidencia suficiente para atribuirles fecha o causa.

Cuando una existencia vinculada usa la misma unidad que el contenido del producto y la referencia incluye precio y cantidad, el riego muestra y registra el costo matematico del consumo (`cantidad usada × precio / contenido`). Si falta precio, contenido o coincide una unidad diferente, informa que no es calculable. El valor es historico y no representa un precio de mercado actualizado.

Hoy tambien muestra existencias con vencimiento declarado dentro de los proximos 30 dias o con una fecha ya pasada. El aviso no estima estabilidad, seguridad ni vida util: reproduce exclusivamente la fecha cargada por el usuario.

Las inspecciones estructuradas registran por maceta el tipo y la zona observada, severidad declarada, nota, foto opcional, fecha de seguimiento y estado abierto o resuelto. Son observaciones del usuario y no diagnosticos automaticos. Recetas e inspecciones forman parte del snapshot sincronizado.

`assessPlantEnvironment` calcula un VPD estimado y lo compara con una banda orientativa segun la etapa declarada. Si el usuario registra temperatura foliar, calcula VPD foliar con temperatura ambiental, foliar y humedad relativa. Si falta ese dato, muestra VPD del aire sin inventar una diferencia fija entre hoja y ambiente. El formulario muestra el VPD en vivo antes de guardar y la ficha presenta tendencias de temperatura, humedad y VPD usando exclusivamente las lecturas registradas, sin completar huecos. La interfaz diferencia la medicion original del valor `calculated`, muestra la banda utilizada y avisa cuando falta temperatura, humedad o PPFD.

El panel `Calculos de esta maceta` obtiene DLI desde PPFD y horas de luz, porcentaje de drenaje desde agua aplicada y drenaje, diferencias de pH/EC y totales o rangos historicos. Cada tarjeta publica la formula, las entradas y la procedencia. Las calculadoras de nutricion y riego pueden proyectar dosis, mezclas y escenarios cuando el usuario aporta producto, concentracion, volumen y objetivo; sus resultados se identifican como calculados.

Cada maceta puede exportarse por ultimos 7 dias, ultimos 30 dias, ciclo registrado o historial completo. CSV contiene las mediciones en formato tabular; el libro XML compatible con Excel separa Resumen, Mediciones, Riegos, Comparaciones de 7/30 dias, Alertas, Bitacora, Calendario y Tareas, manteniendo numeros como valores numericos y declarando el origen de los resultados. El informe imprimible resume esos datos, explicita la base del VPD, incorpora alertas y comparaciones y agrega hasta seis fotos recientes de esa maceta para guardarlo como PDF desde el navegador. El libro Excel no incrusta fotos: solo informa su presencia para limitar el tamano y la exposicion del archivo.

Cada maceta incluye un resumen movil de los ultimos siete dias. Cuenta mediciones, riegos, notas, fotos y acciones completadas con fechas existentes; muestra las tareas abiertas como pendientes actuales porque no tienen una fecha de ejecucion confirmada. La tendencia VPD compara solamente la primera y la ultima lectura calculable del periodo y explicita cuando faltan datos.

El comparador permite elegir ventanas equivalentes de 7 o 30 dias para temperatura, humedad, VPD calculado, agua registrada y altura. Publica el numero de muestras usado en cada periodo y solo muestra una diferencia cuando ambos tienen datos. Ademas intenta una explicacion: compara la proporcion de mediciones con VPD fuera del rango orientativo de la etapa entre ambos periodos y, si el corrimiento es notable (al menos 3 lecturas comparables por periodo y un cambio de 30 puntos porcentuales o mas), lo cruza con la altura promedio registrada para proponer la lectura mas consistente con esos datos -- por ejemplo, que un VPD fuera de rango probablemente freno el crecimiento. Es una correlacion entre lo que el usuario registro, hecha con formulas visibles y sin modelo externo, no una causa confirmada; cuando no hay suficientes lecturas o el VPD se mantuvo estable, la app lo dice explicitamente en vez de forzar una explicacion.

Hoy muestra por maceta cuándo se guardo la ultima medicion y su origen, sin imponer una frecuencia universal ni convertir antiguedad en alerta. Cada ficha agrega una cobertura objetiva de 30 dias para temperatura, humedad, temperatura foliar, PPFD, sustrato, altura, riego y fotos; un campo ausente se presenta solo como dato no registrado.

Cada maceta puede declarar antes del cierre un plan de ciclo con objetivo de días, peso seco objetivo y notas. Al cerrar y archivar el ciclo registra fecha, resultado, pesos, aprendizajes y el cambio que se quiere probar en el ciclo siguiente. El cierre no borra mediciones, riegos, fotos ni bitacora y puede revertirse. Espacios separa los ciclos cerrados de los activos y compara objetivos declarados con duración y peso reales cuando ambos existen; al clonar un ciclo crea una maceta independiente y lleva únicamente la configuración y el plan siguiente, nunca su historial.

Cada maceta activa puede registrar cambios de etapa con etapa anterior, etapa nueva, fecha y nota opcional declaradas. La accion actualiza la etapa vigente y conserva una transicion independiente que aparece en la linea de tiempo. El inicio del ciclo no se reetiqueta retroactivamente con la etapa actual y la app no reconstruye etapas anteriores sin evidencia.

Hoy muestra los dias calendario transcurridos desde la ultima transicion declarada de cada maceta. Si no existe una fecha de cambio, indica que falta el dato en lugar de usar automaticamente la fecha de inicio o estimar una etapa. El resumen no determina cuando corresponde realizar la proxima transicion.

El cierre de ciclo tambien admite resultado general declarado, pesos humedo y seco opcionales y aprendizajes escritos por el usuario. El resumen archivado distingue esos resultados de los calculos historicos. Desde un ciclo cerrado se puede crear una maceta nueva copiando solo su configuracion tecnica y declarando nombre, fecha y etapa inicial; la nueva maceta recibe un identificador independiente y nunca hereda tareas, mediciones, fotos, inspecciones ni resultados.

Las alertas personalizadas permiten que el usuario defina por maceta limites minimos y maximos de temperatura, humedad ambiental, VPD calculado y humedad de sustrato. No hay umbrales personalizados implicitos. Para evitar avisos por ruido aislado también configura lecturas consecutivas, duración mínima e histéresis de recuperación. Cada alerta cita valor, límite, cantidad de lecturas, tiempo sostenido, tendencia y primera evidencia; Hoy y la ficha usan la misma evaluación histórica. Los límites y la política forman parte del snapshot sincronizado.

Hoy reúne las alertas sostenidas activas de todas las macetas y enlaza directamente a cada ficha. El resumen y la ficha usan la misma función para evitar resultados distintos; requieren continuidad y duración, explican el desvío observado y no convierten una única lectura fuera de límite en alerta confirmada.

Una alerta de Hoy puede marcarse como revisada. La confirmacion queda vinculada a la maceta, metrica, direccion, última evidencia y limite, y se guarda en el snapshot del usuario; si llega otra lectura o cambia el umbral, la alerta sostenida actualizada vuelve a mostrarse.

`buildCultivationSuggestions` transforma la etapa declarada, las mediciones recientes, el setup y los datos de catalogo disponibles en acciones explicables. Puede sugerir riego, nutricion, productos, poda, defoliacion, cambios de etapa, cosecha y ajustes ambientales o de iluminacion. Cada recomendacion muestra evidencia, origen, datos faltantes, fecha y criterio; el usuario decide si la agrega al calendario.

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
11. Notificaciones push: con sesion iniciada, activar los avisos en Hoy y llamar a `send-reminders` con el `x-cron-secret` correcto teniendo una tarea vencida. Resultado esperado: llega una notificacion del navegador; sin el header (o con uno incorrecto) la funcion responde HTTP 401.
12. Comparador de periodos: registrar al menos 3 mediciones por ventana con VPD fuera de rango en el periodo actual y dentro de rango en el anterior. Resultado esperado: aparece una explicacion senalando el corrimiento de VPD; con menos de 3 mediciones comparables por ventana, o sin corrimiento notable, la app dice explicitamente que faltan datos o que no encontro un cambio, en vez de forzar una lectura.
13. Espacios: crear un espacio nuevo desde "+ Nuevo espacio" (nombre, modalidad, region, privacidad). Editarlo con "Editar espacio" y confirmar que los cambios quedan. Borrar un espacio sin macetas se confirma y desaparece. Borrar un espacio con macetas exige elegir a que otro espacio se mudan (activas y archivadas); al confirmar, las macetas reaparecen bajo el espacio elegido. Con un solo espacio restante no se puede borrar: se muestra un aviso en vez de un boton.
14. Fotos (bitacora, mediciones, inspecciones, foto rapida del calendario): adjuntar una foto de camara sin editar (varios MB, resolucion completa). Resultado esperado: se guarda sin error y ocupa una fraccion del tamano original (se reescala a un maximo de 1280px de lado mayor y se recodifica como JPEG antes de guardar), para no agotar el espacio de `localStorage` del navegador con el uso normal de la app.
15. Traduccion (en curso, por seccion): en `/en/today/` (o tocando "EN" en el selector desde Hoy), el encabezado, la navegacion, la cuenta, el onboarding, el paso a paso entre secciones y toda la seccion Hoy (metricas, tareas, clima, centro operativo, chequeo rapido, temporada, alertas ambientales, inventario, inspecciones, notificaciones push) se ven en ingles. Datos declarados por el usuario (nombres de plantas, etapas, tareas cargadas, fechas y el texto del clima) siguen en el idioma en que se cargaron: no son textos de interfaz, son contenido. En `/en/seeds/` toda la seccion Semillas ya esta en ingles: el marco (titulo, cartel legal, solapas, paso a paso entre solapas) y el contenido completo de las cinco solapas. Finder traduce el buscador guiado paso a paso y sus resultados. Mi cultivo traduce el formulario manual completo (identificacion, datos de cultivo, fechas y recordatorios, incluidos los titulos de los eventos que crea en el calendario). Calculadora traduce el motor de cultivo hortícola y la calculadora de mezcla de nutrientes, incluidas las estimaciones calculadas (riego sugerido, ajuste de luz, sustrato), no solo las etiquetas fijas. Setups y Referencia siguen traducidas como antes. En `/en/spaces/` el marco de Espacios ya esta en ingles: encabezado, buscador, crear/editar/borrar espacio (incluido el mensaje de confirmacion al borrar), la tarjeta para cargar una medicion rapida, y el panel de referencia rapida de geneticas. El formulario de medicion ambiental que se abre desde esa tarjeta tambien esta traducido: fecha y hora, origen, temperatura, humedad, temperatura de hoja, humedad de sustrato, PPFD, altura, el bloque de riego (agua aplicada, pH, EC, ppm, drenaje), foto, observaciones, la vista previa de VPD en vivo (con el texto de "falta cargar" y el estado calculado) y el boton de guardar. Ese mismo formulario, cuando se abre desde el detalle de una maceta especifica (no desde la tarjeta de Espacios), todavia se ve en espanol; se traduce junto con el resto del detalle de la maceta en un proximo parche. El detalle de cada maceta dentro de un espacio (mediciones, alertas ambientales, sensores, exportacion, historial de etapas, inspecciones, notas) todavia se ve en espanol; se traduce en proximos parches, igual que el catalogo de productos, inventario y riego por lote que aparecen mas abajo en la misma pantalla. Las secciones Calendario y Diario todavia se ven en espanol aunque el selector diga "EN"; se traducen en proximos parches. El asistente de "primer cultivo" del onboarding tambien queda en espanol por ahora (es un flujo aparte, no forma parte de las cinco secciones principales).
16. Rediseño visual de Hoy (parte 1, mobile primero): con al menos dos macetas cargadas, abrir Hoy en un viewport angosto (~420px). Resultado esperado: el tema oscuro se aplica por defecto sin parpadeo ni error de hidratacion en consola; arriba aparece un encabezado compacto (saludo, fecha, cantidad de tareas de hoy) seguido de la tira semanal (7 dias, hoy resaltado), los tres atajos circulares (Medicion, Tareas, Clima) y la tarjeta "Necesita tu atencion". Esa tarjeta junta en chips clicables las alertas ambientales activas, revisiones de inspeccion vencidas, insumos bajos o por vencer y mediciones pendientes; si no hay ninguna, muestra un estado "Todo en orden" en vez de una tarjeta vacia. Cada chip linkea a la tarjeta con el detalle completo mas abajo en la misma pagina. Debajo aparece "Tus macetas", un carrusel horizontal con una tarjeta por planta (etapa, nombre, variedad, dias desde el inicio declarado); tocar una tarjeta lleva a su ficha en Espacios. Ni la tira semanal ni la barra de navegacion inferior (6 secciones) deben generar scroll horizontal en la pagina. Mas abajo siguen disponibles, sin cambios funcionales, todas las tarjetas que ya existian (centro operativo, cuenta, notificaciones push, mediciones ambientales, etapas declaradas, alertas ambientales, inspecciones, inventario, clima, chequeo rapido, resumen activo). Cambiar a tema claro desde el boton del encabezado no debe generar error de hidratacion tampoco, ni en `/es/hoy/` ni en `/en/today/`.

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
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

Para el sitio publicado en GitHub Pages, las credenciales de Supabase se leen de `.env.production`, que esta versionado en el repo.

Las variables `NEXT_PUBLIC_SUPABASE_*` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY` son publicas por diseno: Next.js las incrusta en el bundle del navegador, y lo que protege los datos son las reglas de Row Level Security de `supabase/schema.sql`. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` habilita el boton de notificaciones push en Hoy; ver `supabase/functions/send-reminders/README.md` para generarla junto con su clave privada.

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
10. Para notificaciones push reales (avisos de tareas vencidas o de hoy, aunque la app este cerrada), ejecutar el bloque de `push_subscriptions` y `pg_cron` de `supabase/schema.sql`, desplegar `send-reminders` y seguir `supabase/functions/send-reminders/README.md`.

## Timeline

La base de historial unificado vive en `lib/timeline.ts` y se muestra con `components/plant-timeline.tsx`.

Actualmente combina los datos disponibles de cada planta para construir su historial cronologico: inicio declarado, tareas, calendario, bitacora, fotos, mediciones ambientales, VPD calculado y alertas activadas por los limites personalizados actuales. Las alertas historicas se identifican como evaluaciones retrospectivas para no presentarlas como avisos que necesariamente existian al momento de la lectura. La evolucion futura del timeline puede incorporar analisis generados por IA.

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
-> CultiPilot
-> Historico y analisis
```

## Scripts

```bash
npm run lint
npm run typecheck
npm run build
```

## Sistema visual

La interfaz usa Geist Sans y Geist Mono autohospedadas, tokens compartidos de color, borde, radio, foco y elevación, y patrones de producto consistentes para navegación, tarjetas, formularios y estados vacíos. Espacios prioriza la carga ambiental y el acceso por maceta; Calendario agrupa navegación histórica, selector de período y vista mes/semana en una barra operativa única.

## Estructura

```text
app/                  rutas App Router e interfaz
components/           componentes de pantalla
lib/                  tipos, datos, calculos, i18n, clima y Supabase
public/               manifest PWA y service worker basico
supabase/schema.sql   esquema PostgreSQL, RLS y storage
```
