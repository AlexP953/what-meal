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

## User

Importa `User`, `UserRecord` y `serializeUser` desde
`@/server/persistence/user`. `@/app/models/User` conserva un adaptador.
Los componentes cliente importan `PublicUser` y `UserRole` desde `@/shared/user`.

| Campo | Contrato |
| --- | --- |
| `_id` | ObjectId generado por MongoDB |
| `email` | Cadena obligatoria, sin espacios exteriores y en minúsculas |
| `passwordHash` | Cadena obligatoria, excluida de consultas por defecto |
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
Los consumidores de notificaciones deben solicitar `+fcmToken`.
El rol no admite null ni eliminación mediante `$unset`.
Las actualizaciones mediante consultas requieren `{runValidators: true}` para
aplicar las validaciones del esquema, incluida la obligatoriedad del rol.

Las rutas de cuentas mantienen sus envoltorios HTTP (`users`, `user` o campos
sueltos), pero utilizan serialización explícita para documentos y resultados lean.
Las rutas de token confirman el éxito sin devolver el token.
La quest 149 define creación inicial, sesiones y permisos. La quest 152 define
suscripciones, trabajador y envíos. Este contrato no autoriza propietarios ni crea
cuentas iniciales. Los errores de unicidad tienen código MongoDB `11000` y los
fallos de validación usan `mongoose.Error.ValidationError` o `CastError`.
No conviertas directamente esas excepciones a JSON ni registres sus documentos.

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
Crea `users`, `meals` y sus índices, sin documentos iniciales. No utiliza
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
Estos contratos no prescriben códigos HTTP ni políticas de autorización.
