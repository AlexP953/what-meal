# Contratos de persistencia

## Módulos y conexión

Los módulos de `src/server` importan `server-only`. Nunca se importan desde
componentes cliente. Los contratos públicos se encuentran en `src/shared`.
`src/lib/db.ts` conserva un adaptador para consumidores existentes.

```ts
import { dbConnect } from "@/server/persistence/connection";
await dbConnect();
```

La conexión utiliza `MONGODB_URI` y `MONGODB_DB`, con selección de servidor limitada
a **5000 ms** y sin almacenamiento temporal de operaciones desconectadas.
Las llamadas simultáneas comparten un intento. Un fallo permite un intento posterior.
El proceso reutiliza la conexión y su caché durante la recarga de desarrollo.
Cambia la configuración mediante un reinicio de la aplicación.

Una configuración inválida identifica la variable sin mostrar su valor.
Los fallos de conexión producen `DatabaseConnectionError` con un mensaje genérico.
No publiques excepciones internas ni valores de configuración en respuestas o registros.
Las quests consumidoras deciden las respuestas HTTP y los permisos.

## Pruebas aisladas

`npm run test:integration` exige MongoDB real. `TEST_MONGODB_URI` es opcional y
su valor predeterminado es `mongodb://127.0.0.1:27017`.
Cada archivo genera una base `whatmeal_test_<uuid>`. La limpieza comprueba el nombre
exacto de su base antes de eliminarla y siempre cierra la conexión.
Las pruebas nunca utilizan `MONGODB_DB` para elegir un destino de limpieza.

## Límites de acceso

`access_limits` comparte ventanas móviles entre procesos mediante actualizaciones
atómicas de un documento por clave. El índice TTL sobre `expiresAt` elimina
documentos inactivos. Las consultas excluyen eventos caducados sin depender del TTL.
La preparación crea el índice sin eventos iniciales.

El registro reserva veinte intentos por hora en una cuota compartida para todos
los orígenes no verificables. No utiliza cabeceras de IP del cliente. Una persona
puede agotar temporalmente esa cuota para toda la instalación.
El acceso reserva diez intentos por correo durante quince minutos. La clave usa
HMAC con `AUTH_SECRET` sobre el correo normalizado, sin almacenar el correo.
Una reserva pendiente caduca en sesenta segundos. Su finalización es única y
atómica. Un acceso correcto libera exclusivamente su reserva y conserva fallos
previos. Un fallo confirmado ocupa su plaza durante quince minutos desde su
confirmación. Una reserva caducada no permite emitir una sesión.

## User

Importa `User`, `UserRecord` y `serializeUser` desde
`@/server/persistence/user`. `@/app/models/User` conserva un adaptador.
Los componentes cliente importan `PublicUser` y `UserRole` desde `@/shared/user`.

| Campo | Contrato |
| --- | --- |
| `_id` | ObjectId generado por MongoDB |
| `email` | Cadena obligatoria, sin espacios exteriores y en minúsculas |
| `passwordHash` | Cadena obligatoria, excluida de consultas por defecto |
| `authVersion` | Número privado, predeterminado cero, excluido de consultas por defecto |
| `name` | Cadena opcional |
| `role` | Obligatorio, `admin` o `user`, predeterminado `user` |
| `fcmToken` | Cadena o null, predeterminado null, excluida por defecto |
| `createdAt`, `updatedAt` | Fechas mantenidas por Mongoose |

Los índices incluyen correo único y rol. La unicidad reside en MongoDB y protege
las escrituras simultáneas. `serializeUser` permite únicamente campos públicos,
convierte `_id` y su alias `id` a cadenas y las fechas a ISO 8601. Funciona con
documentos y consultas lean. No incluye hashes ni tokens aunque estén cargados.
La transformación `toJSON` aplica esa protección y conserva comidas pobladas.
La autenticación solicita explícitamente `+passwordHash`.
El verificador de sesiones solicita `+authVersion`. Los documentos anteriores sin
ese campo equivalen a versión cero. El campo nunca pertenece a `PublicUser` ni
a respuestas públicas. `verifySessionAccount` devuelve `valid`, `invalid` o
`unavailable`, consulta el rol vigente y nunca concede acceso si falla MongoDB.
Los consumidores de notificaciones deben solicitar `+fcmToken`.

## Identidad y autorización

El registro y las mutaciones autenticadas de cuentas y tokens rechazan un `Origin` ajeno o
`null` con 403 `FORBIDDEN_ORIGIN`. Comparan con `AUTH_URL` o con el origen servido,
sin utilizar cabeceras reenviadas. Configura `AUTH_URL` para HTTPS y proxies.
Sin esa variable, el origen usa HTTP y el `Host` directo, porque Next.js deriva
el protocolo de su URL interna mediante cabeceras reenviadas.
Fetch Metadata rechaza contextos ajenos.
Los clientes locales sin `Origin` ni Fetch Metadata conservan acceso mediante
su sesión válida. Las rutas de notificaciones deshabilitadas devuelven 503 antes
de comprobar origen, sesión o persistencia.

`requireSession` conserva `{session}` o `{error: NextResponse}`. Descifra el JWT
emitido por Auth.js, comprueba la fecha original y consulta la cuenta vigente sin
caché entre solicitudes. Devuelve 401 para ausencia, caducidad, revocación o cuenta
eliminada, y 503 genérico si no puede verificar la persistencia.
`isAdmin` comprueba el rol de una sesión previamente validada. `forbid` devuelve
403. El diario autoriza al propietario y conserva el acceso administrativo a
comidas ajenas. No utilices identificadores ni roles enviados por el cliente
como prueba de autorización. `user.id` es una cadena estable y `user.role` refleja
el rol vigente. Las sesiones públicas no incluyen versiones ni fechas privadas.
La fecha original del JWT limita el acceso a 24 horas. Solo el inicio y el cierre
de sesión escriben la cookie de sesión. Las consultas de sesión y las rutas de
cuentas pueden verificarla. Los JWT anteriores sin versión y fecha original
requieren otro acceso.
Si MongoDB impide verificar la cuenta, GET y POST de `/api/auth/session`
devuelven 503 `PERSISTENCE_UNAVAILABLE` sin datos de sesión y conservan la
cookie original. Una consulta posterior puede recuperar la sesión si la cookie
sigue vigente. El diario descarta el estado de la cuenta anterior al cambiar
de cuenta o perder la sesión. Al vencer `session.expires`, descarta el diario y
cancela la consulta en curso, aunque la pestaña permanezca inactiva.

## Validación del modelo User

El rol no admite null ni eliminación mediante `$unset`.
Las actualizaciones mediante consultas requieren `{runValidators: true}` para
aplicar las validaciones del esquema, incluida la obligatoriedad del rol.

Las rutas de cuentas mantienen sus envoltorios HTTP (`users`, `user` o campos
sueltos), pero utilizan serialización explícita para documentos y resultados lean.
Las rutas de token confirman el éxito sin devolver el token.
Las suscripciones, el trabajador y los envíos pertenecen a la quest de
notificaciones. Los errores de unicidad tienen código MongoDB `11000` y los
fallos de validación usan `mongoose.Error.ValidationError` o `CastError`.
No conviertas directamente esas excepciones a JSON ni registres sus documentos.

## API de cuentas

El registro público acepta exclusivamente `email`, `password` y `name` opcional.
Normaliza el correo antes de validarlo. La contraseña nueva contiene al menos
doce caracteres y como máximo 72 bytes UTF-8, conserva sus espacios y utiliza
bcrypt con coste 12. Un nombre proporcionado contiene entre uno y cien caracteres
después de eliminar espacios exteriores. Las modificaciones aplican las mismas
reglas y rechazan campos desconocidos. Las credenciales de acceso conservan
compatibilidad con contraseñas anteriores al mínimo nuevo.

| Operación | Cuenta normal | Administrador vigente |
| --- | --- | --- |
| POST `/api/users` | Registro público, siempre `user`, sin sesión automática | Igual |
| GET `/api/users` | 403 | Lista de cuentas |
| GET `/api/users/[id]` | Solo su cuenta y comidas | Cualquier cuenta y comidas |
| PATCH `/api/users/[id]` | Solo su email, name y password | Esos campos y role en cualquier cuenta |
| DELETE `/api/users/[id]` | 403 | Elimina la cuenta y conserva sus comidas |
| POST/DELETE `/api/users/[id]/token` | Solo su cuenta, cuando se habilita | Cualquier cuenta, cuando se habilita |

Un intento de modificar `role` mediante una cuenta normal devuelve 403, aunque
se refiera a su propia cuenta. Cambiar `passwordHash` incrementa `authVersion`
en la misma escritura atómica. Las sesiones anteriores reciben 401 en la
siguiente operación. La eliminación no borra comidas y la sesión anterior no
puede acceder a ellas. El comando local `npm run users:promote -- --email <correo>`
modifica exclusivamente `role`, sin crear cuentas ni contraseñas.

Los envoltorios mantienen `users` para la lista y `user` para detalle con comidas.
El registro devuelve 201 con `{id,email,name,role}` y `name:null` si falta.
PATCH mantiene esos campos directos. DELETE confirma con `message` y los tokens
con `{success:true}`. `PublicUser` conserva `id`, `_id`, email, name opcional,
role, createdAt y updatedAt. Los identificadores son cadenas y las fechas son ISO.
Ninguna respuesta incluye hashes, tokens, versiones ni excepciones internas.

| Estado | code | Significado |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | JSON, identificador o campos no válidos |
| 401 | `UNAUTHORIZED` | Sesión ausente, caducada, revocada o cuenta eliminada |
| 403 | `FORBIDDEN` | Permisos insuficientes |
| 403 | `FORBIDDEN_ORIGIN` | Origen del navegador no permitido |
| 404 | `USER_NOT_FOUND` | Cuenta seleccionada inexistente |
| 409 | `EMAIL_EXISTS` | Correo normalizado duplicado |
| 429 | `RATE_LIMITED` | Cuota agotada, con `Retry-After` |
| 503 | `PERSISTENCE_UNAVAILABLE` | Persistencia no verificable |
| 500 | `INTERNAL_ERROR` | Error inesperado, mensaje genérico |

Las API de cuentas devuelven `{error,code}`, con `error` como mensaje público.
Auth.js conserva su transporte `{url}` para `signIn`, incluso con 429 y
`Retry-After`, y mantiene CSRF. Sus cookies utilizan HttpOnly y SameSite=Lax,
además de Secure con HTTPS. Las rutas de notificaciones deshabilitadas conservan
su excepción 503 `{code:"NOTIFICATIONS_DISABLED"}` sin MongoDB ni Firebase.

## Pruebas de identidad y acceso

| Requisitos | Pruebas |
| --- | --- |
| R1–R2 | registration, auth-session, access-http |
| R3–R4 | auth-session, session-account, authorization, access-interactive, access-http |
| R5 | users-promote |
| R6–R7 | user-permissions, token-permissions, notifications-routes, access-http |
| R8 | register-form, access-interactive y comprobación de teclado en navegador |
| R9 | access-limits, login-limits, request-origin, access-interactive, access-http |
| R10 | Comprobaciones comunes, verify:local y navegador en desarrollo y producción |

## Meal

Importa `Meal`, `MealRecord` y `serializeMeal` desde
`@/server/persistence/meal`. `@/app/models/Meal` conserva el adaptador existente.
Importa contratos, enumeraciones e `isCivilDate` desde `@/shared/meal` en clientes.

| Campo | Contrato |
| --- | --- |
| `_id` | ObjectId generado por MongoDB |
| `userId` | ObjectId obligatorio, referencia User |
| `name` | Cadena obligatoria no vacía tras eliminar espacios exteriores |
| `date` | Fecha civil gregoriana válida, cadena `YYYY-MM-DD` |
| `type` | `breakfast`, `lunch`, `dinner` o `snack` |
| `reaction` | `good`, `bad` o `neutral` |
| `place`, `notes` | Cadenas opcionales |
| `createdAt`, `updatedAt` | Fechas mantenidas por Mongoose |

Los índices compuestos son `{userId: 1, date: -1}`, `{userId: 1, type: 1}` y
`{userId: 1, reaction: 1}`. Se conservan índices simples de esos cuatro campos.
La fecha civil nunca se convierte a Date ni depende de una zona horaria.
El serializador representa identificadores como cadenas y marcas temporales ISO 8601.
Al actualizar mediante consultas, utiliza `{runValidators: true}`.

MongoDB no comprueba que exista el User referenciado. Las rutas verifican la
cuenta y sus permisos antes de escribir. Las comidas pobladas de cuentas también
se serializan explícitamente. `src/app/types/index.ts` conserva los nombres
de tipos existentes mediante contratos públicos.

## API del diario

Las cinco operaciones requieren una sesión vigente. La lista utiliza la cuenta
autenticada, incluso si una cuenta normal envía `userId`. Un administrador
puede indicar otro propietario con un `userId` válido. Únicamente el propietario
o un administrador vigente puede consultar, editar o eliminar una comida por
identificador. Un identificador ajeno existente devuelve 403 a una cuenta normal.
POST, PATCH y DELETE aplican la comprobación de origen de cuentas y aceptan una
sesión válida sin cabeceras de origen ni Fetch Metadata.

Los formularios web incluyen `X-Expected-Account` con la cuenta que muestra el
diario. Si se envía, el servidor exige que coincida con la identidad de la
sesión verificada antes de escribir. Los clientes existentes pueden omitir la
cabecera. La sesión verificada sigue determinando la identidad y los permisos.

| Operación | Entrada | Resultado |
| --- | --- | --- |
| POST `/api/meals` | Objeto JSON con `name`, `date`, `type` y `reaction` obligatorios, y `place` y `notes` opcionales | 201 con la comida directamente y los alias `id` y `user` |
| GET `/api/meals` | Filtros opcionales en la URL | 200 con un array de comidas con `id` y `user`, o `[]` |
| GET `/api/meals/[id]` | Identificador de comida de 24 dígitos hexadecimales | 200 con `{meal}`, incluidos `meal._id`, `meal.id` y `meal.userId` |
| PATCH `/api/meals/[id]` | Objeto JSON con al menos uno de los seis campos editables | 200 con `{meal}`, incluidos `meal.id` y `meal.userId` |
| DELETE `/api/meals/[id]` | Identificador de comida de 24 dígitos hexadecimales | 200 con `{message}` tras confirmar la eliminación |

El alta asigna la comida a la cuenta autenticada. La edición conserva el
propietario y los campos omitidos. Ambas operaciones ignoran `userId` y los
demás campos ajenos al contrato. Envía `""` para vaciar `place` o `notes` al
editar. La lista, el alta y la edición vuelven con `null` para valores opcionales
ausentes. El detalle omite dichos campos cuando faltan. La lista, el alta y el
detalle incluyen `createdAt` y `updatedAt` como marcas ISO 8601. La edición
permite obtenerlas mediante una consulta posterior. Cada respuesta conserva
`date` como el día civil indicado, también en fechas bisiestas.

`type` acepta un tipo de comida. Repite `reaction` para seleccionar cualquiera
de las reacciones indicadas. Los filtros por tipo, reacción y fecha se combinan
dentro de la cuenta autorizada. `dateFrom` y `dateTo` aceptan días civiles
inclusivos y funcionan por separado. `sortDir` acepta `asc` y `desc` y solo
cambia el orden de `date`. Por defecto, se muestran las fechas más recientes.
Los empates se ordenan por `createdAt` y luego por identificador, ambos
descendentes. La misma consulta determina los resultados de la pantalla después
de cada mutación confirmada. La pantalla aplica la respuesta confirmada a las
filas visibles mientras vuelve a consultar el servidor. Si falla la consulta,
la pantalla conserva el cambio confirmado y ofrece reintentar la consulta.
Los filtros pendientes se confirman junto con las filas de una consulta exitosa.
Si esa consulta falla, las mutaciones siguen usando los filtros de las filas
visibles y el reintento conserva los filtros solicitados.
Las fechas de los filtros se validan en el diálogo antes de aplicar el rango.

| Estado | code | Significado |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | JSON, campos, identificadores o filtros inválidos, incluido un rango invertido |
| 401 | `UNAUTHORIZED` | Sesión ausente, caducada, revocada o cuenta eliminada |
| 403 | `FORBIDDEN` | Comida ajena para la cuenta normal |
| 403 | `FORBIDDEN_ORIGIN` | Origen rechazado para la mutación |
| 404 | `MEAL_NOT_FOUND` | Comida inexistente |
| 409 | `SESSION_ACCOUNT_CHANGED` | La cuenta esperada difiere de la sesión verificada |
| 503 | `PERSISTENCE_UNAVAILABLE` | Persistencia temporalmente indisponible |
| 500 | `INTERNAL_ERROR` | Fallo inesperado |

Los errores contienen `{error,code}` con un mensaje público. Si se pierde la
respuesta de una mutación, consulta el diario para confirmar el estado antes de
reintentar. Repetir POST puede crear un duplicado. Tras un PATCH incierto, consulta
los campos actuales y vuelve a enviar los cambios que falten. Repetir DELETE
sobre una comida ausente devuelve 404 `MEAL_NOT_FOUND`.

`npm run verify:local` compara las respuestas autenticadas antes y después
de reiniciar Next.js y MongoDB en el mismo volumen aislado. Comprueba la
edición, la eliminación, una comida civil existente y la representación de
los días desde `Pacific/Kiritimati` y `Pacific/Honolulu`.

## Preparación y ejemplo

`npm run db:prepare` utiliza `prepareDatabase` de `@/server/persistence/prepare`.
Crea `users`, `meals`, `access_limits` y sus índices, sin documentos iniciales. No utiliza
`syncIndexes`, elimina índices ni importa datos anteriores. Si existen documentos
incompatibles, informa de un fallo y exige corregirlos sin borrarlos automáticamente.
El comando siempre cierra su conexión. La biblioteca deja la conexión al consumidor.

```ts
import { dbConnect } from "@/server/persistence/connection";
import { Meal, serializeMeal } from "@/server/persistence/meal";

// ownerId procede de un consumidor que ya comprueba existencia y permisos.
await dbConnect();
const rows = await Meal.find({ userId: ownerId }).lean();
const publicMeals = rows.map(serializeMeal);
```

Los módulos de configuración privada se importan desde `@/server/config`.
Los errores de configuración son `Error` con el nombre de la variable.
Los errores de conexión son `DatabaseConnectionError`. Los errores de datos son
`ValidationError` o `CastError`. La duplicidad usa el código MongoDB `11000`.
Los códigos HTTP y permisos de cuentas siguen la matriz anterior. Las operaciones
del diario conservan sus contratos y la autorización mediante `requireSession`.

## Copias del despliegue

La copia usa las herramientas de la imagen fijada de MongoDB y una cuenta de
solo lectura sobre `whatmeal`. Incluye las colecciones de la base, sus opciones
y sus índices. Las cuentas de MongoDB se vuelven a aprovisionar desde los
archivos de secretos. Las cuentas de What Meal forman parte de la copia.

Si la instalación ya existía antes de añadir las copias, genera únicamente
`mongo-backup-password` en el mismo directorio de secretos. Desde la revisión
nueva, ejecuta `docker compose -p whatmeal-deploy -f compose.deploy.yml run --rm mongo-provision`
para crear la cuenta de lectura. Sustituye `whatmeal-deploy` si usas otro nombre
de proyecto.

Ejecuta la tarea en Linux con Bash, util-linux (`flock`), GNU Coreutils y gzip.
Crea un directorio privado en un volumen cifrado, accesible solo para la cuenta
que ejecutará la tarea. Exporta el mismo `AUTH_URL` y `WHATMEAL_SECRETS_DIR` del
despliegue. Si usaste `-p` con otro nombre, exporta el mismo nombre en
`WHATMEAL_PROJECT_NAME`. Ejecuta la tarea desde la revisión desplegada.

```bash
install -d -m 0700 "$HOME/whatmeal-backups"
bash scripts/backup-deploy.sh "$HOME/whatmeal-backups"
```

Programa la tarea durante una ventana de mantenimiento. Suspende cualquier
otro escritor de la base y espera a que termine su trabajo antes de copiar.
Evita actualizaciones, cambios de esquema y arranques manuales durante la
ventana. La tarea detiene What Meal y recupera su estado anterior, incluso
cuando falla la copia. El comando devuelve un error si no puede recuperar el
servicio. Caddy puede responder 502 mientras la aplicación está parada. MongoDB puede
seguir eliminando límites de acceso caducados por TTL durante la copia.

El comando devuelve la ruta de una copia publicada. Los directorios
`.incomplete.*` corresponden a copias en curso o interrumpidas. Comprueba una
copia publicada antes de transferirla o restaurarla.

```bash
cd /ruta/a/la/copia-publicada
sha256sum --strict -c SHA256SUMS
gzip -t database.archive.gz
```

Transfiere el directorio con sus tres archivos mediante un canal cifrado a un
destino externo protegido. Guarda el acceso a ese destino en el gestor de
secretos. Por ejemplo, programa una copia diaria con un temporizador de
systemd que cargue las variables públicas del despliegue y registre solo el
resultado. Configura la retención en el destino externo según los objetivos
de recuperación de la instalación. Comprueba periódicamente la restauración
antes de retirar copias antiguas.

[Opciones de mongodump](https://www.mongodb.com/docs/database-tools/mongodump/).

### Ensayo de restauración

Usa una copia con datos ficticios y la revisión del despliegue que la creó.
Usa un directorio privado en almacenamiento cifrado para la copia temporal
y los secretos. Configura el almacenamiento de Docker sobre un disco cifrado
con espacio para el volumen de MongoDB.
Elige una ruta nueva fuera de la copia. El comando verifica las sumas y la
versión exacta de MongoDB. Crea un proyecto Compose con una red, un volumen y
secretos propios. Requiere Docker Engine en modo rootful, sin reasignación de
UID. Los dos secretos de la aplicación quedan con modo `0600` y UID `1000`.
El comando restaura la base `whatmeal` y conserva sus índices.

```bash
workspace="$HOME/ensayo-restauracion"
bash scripts/restore-deploy.sh /ruta/a/la/copia-publicada "$workspace"
test -f "$workspace/restore-complete"
export AUTH_URL=https://localhost
export WHATMEAL_SECRETS_DIR="$workspace/secrets"
project=$(cat "$workspace/project-name")
docker compose -p "$project" -f compose.deploy.yml up -d --wait whatmeal
```

La aplicación de ensayo queda en la red privada. Para comprobarla desde un
cliente HTTPS, conecta un proxy de ensayo aislado a esa red. Usa un origen
distinto del despliegue principal y configura el mismo `AUTH_URL` en la
aplicación y el proxy. En una máquina de ensayo también puedes usar Caddy con
`https://localhost` y una configuración Compose que limite sus puertos a
`127.0.0.1`. Confía en la autoridad local solo en el cliente de ensayo.
Ejecuta el modo `read` de la prueba del diario con el archivo privado creado
antes de la copia. Comprueba el inicio de sesión y que la comida conserva su
identificador, propietario, fecha y contenido. Compara los índices de las
colecciones con los del origen. El origen puede seguir en funcionamiento.

El comando devuelve un error si faltan archivos, las sumas no coinciden, la
versión difiere o MongoDB rechaza el archivo. Usa el marcador
`restore-complete` para identificar un ensayo terminado. Al acabar, elimina
solo los recursos del proyecto de ensayo mediante los comandos siguientes.

```bash
test -f "$workspace/restore-complete" &&
  docker compose -p "$project" -f compose.deploy.yml down --volumes
```

Borra después el directorio de ensayo y su archivo privado de prueba. Si una
interrupción deja recursos sin el marcador, consulta el proyecto indicado en
`project-name` y elimina solo sus recursos antes de repetir el ensayo.

[Compatibilidad de mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/mongorestore-behavior-access-usage/).

### Diagnóstico de MongoDB

Desde la revisión desplegada, exporta el mismo `AUTH_URL` y
`WHATMEAL_SECRETS_DIR` de la instalación y usa su nombre de proyecto. Ejecuta
la comprobación incluso cuando Next.js esté detenido. El contenedor temporal
usa la cuenta de aplicación y consulta los metadatos de la colección `meals`.

```bash
docker compose -p whatmeal-deploy -f compose.deploy.yml run --rm -T --no-deps \
  db-prepare --conditions=react-server --import tsx scripts/db-diagnose.ts
```

Espera `MongoDB application access OK` y código 0. Si aparece
`MongoDB application access failed`, consulta el estado de MongoDB y los
registros de `mongo`, `mongo-provision` y `db-prepare`. El mensaje también
cubre problemas de credenciales o de preparación de la base. El arranque
valida el origen HTTPS y los secretos antes de consultar MongoDB. Si indica
un archivo de secretos inválido, comprueba su ruta y permisos sin mostrar su
contenido. Repite el comando después de restablecer MongoDB.

En un proyecto de ensayo, detén `mongo` y confirma que la comprobación
devuelve un error aunque `/login` siga respondiendo. Inicia `mongo` y espera
su estado `healthy`. Repite la comprobación y espera el mensaje de éxito.
Consulta el [diagnóstico del despliegue](../README.md#diagnóstico-del-despliegue)
para comprobar HTTPS y Next.js por separado.
