# What Meal

Aplicación Next.js con React, TypeScript, Auth.js y MongoDB.

## Entorno

Utiliza Node.js **24.22.3 LTS** y npm **11.19.1**, distribuido con esa versión.
Con nvm, ejecuta `nvm install` y `nvm use`. Comprueba `node --version` y
`npm --version` antes de ejecutar `npm ci`. El archivo de bloqueo se versiona.
No utilices `--force` ni `--legacy-peer-deps`.

## Comandos

- `npm run dev`: desarrollo.
- `npm run build`: compilación.
- `npm start`: ejecución de la compilación.
- `npm test`: pruebas unitarias (`tests/unit`).
- `npm run test:integration`: pruebas con MongoDB real (`tests/integration`).

Vitest utiliza proyectos separados y la condición `react-server` para probar
módulos exclusivos del servidor. Las pruebas de integración se ejecutan en serie.

## Fuentes técnicas

- [Distribución oficial de Node.js](https://nodejs.org/dist/v24.22.3/SHASUMS256.txt).
- [Requisitos de Vitest](https://vitest.dev/guide/).
- [Proyectos de Vitest](https://vitest.dev/guide/projects).

Las rutas dinámicas resuelven `params` como promesa, conforme a
[Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/route#context-optional).
Los tipos de Auth.js amplían los campos `id` y `role` del contrato JWT existente.

## Configuración

Copia `.env.example` a `.env.local`. Genera un secreto nuevo mediante
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
y escribe el resultado en `AUTH_SECRET`. No publiques ese archivo.

`MONGODB_URI` identifica el servidor y `MONGODB_DB` la base nueva.
El nombre admite letras ASCII, cifras, guiones y guiones bajos, hasta 63 caracteres.
La autenticación exige un secreto de al menos 32 caracteres.
Cada componente valida sus variables al consumirlas. La compilación no exige
MongoDB ni credenciales Firebase. Los errores identifican la variable sin su valor.
Las variables `NEXT_PUBLIC_*` son públicas y nunca contienen secretos.

Las notificaciones permanecen desactivadas salvo activación explícita mediante
`NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true`. En modo desactivado no se carga Firebase,
no se solicitan permisos ni se registra un trabajador. El trabajador anterior
se sustituye por uno inerte que cancela su registro al actualizarse.
La quest de notificaciones entrega la configuración y el trabajador nuevos antes
 de habilitar envíos en segundo plano.

Las tres rutas de notificaciones responden `503` con
`{"code":"NOTIFICATIONS_DISABLED"}` mientras la capacidad está desactivada.
No conectan MongoDB ni inicializan Firebase Admin en ese estado.
