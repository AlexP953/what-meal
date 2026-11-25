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
La fecha original del JWT limita el acceso a 24 horas, aunque Auth.js renueve la
cookie. Los JWT anteriores sin versión y fecha original requieren otro acceso.
Si MongoDB impide verificar la cuenta, GET y POST de `/api/auth/session`
devuelven 503 `PERSISTENCE_UNAVAILABLE` sin datos de sesión y conservan la
cookie original. Una consulta posterior puede recuperar la sesión si la cookie
sigue vigente. El diario descarta el estado de la cuenta anterior al cambiar
de cuenta o perder la sesión.

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

MongoDB no comprueba que exista el User referenciado. El consumidor comprueba
existencia y permisos antes de escribir. La quest 150 define operaciones, filtros
y autorización del diario. Los modelos no incorporan reglas de sesiones ni permisos.

Las rutas del diario conservan sus envoltorios y alias HTTP existentes:
la lista y la creación devuelven `id` y `user`, mientras el detalle utiliza `meal`.
La actualización conserva `meal.id`. Los adaptadores emplean el serializador
común antes de construir cada respuesta. Las comidas pobladas de cuentas también
se serializan explícitamente. Las quests consumidoras pueden unificar esos alias
al especificar sus propios contratos HTTP.
`src/app/types/index.ts` conserva nombres de tipos existentes mediante contratos
públicos, sin importar Mongoose ni configuración privada.

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
