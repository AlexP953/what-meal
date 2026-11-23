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
