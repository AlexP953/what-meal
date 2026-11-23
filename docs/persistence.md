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
| `role` | `admin` o `user`, predeterminado `user` |
| `fcmToken` | Cadena o null, predeterminado null, excluida por defecto |
| `createdAt`, `updatedAt` | Fechas mantenidas por Mongoose |

Los índices incluyen correo único y rol. La unicidad reside en MongoDB y protege
las escrituras simultáneas. `serializeUser` permite únicamente campos públicos,
convierte `_id` y su alias `id` a cadenas y las fechas a ISO 8601. Funciona con
documentos y consultas lean. No incluye hashes ni tokens aunque estén cargados.
La transformación `toJSON` aplica esa protección y conserva comidas pobladas.
La autenticación solicita explícitamente `+passwordHash`.
Los consumidores de notificaciones deben solicitar `+fcmToken`.
