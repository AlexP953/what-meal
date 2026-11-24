# What Meal

Aplicación Next.js con React, TypeScript, Auth.js y MongoDB.

## Instalación desde cero

Necesitas Git, Node.js y npm en las versiones indicadas abajo, además de Docker
con Compose. Desde una copia nueva del repositorio:

```bash
npm ci
cp .env.example .env.local
```

Genera `AUTH_SECRET` como explica Configuración y escribe su valor en `.env.local`.
Conserva las direcciones locales y las notificaciones desactivadas del ejemplo.

```bash
docker compose up -d --wait mongo
npm run db:prepare
npm run db:prepare
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run dev -- --hostname 127.0.0.1
```

Abre `http://localhost:3000/login`. La pantalla de acceso debe aparecer sin
configurar Firebase ni solicitar permisos de notificaciones. La base nueva no
contiene cuentas. Detén desarrollo con Ctrl+C antes de continuar:

```bash
docker compose stop mongo
npm run build
git diff --exit-code -- package-lock.json
docker compose up -d --wait mongo
npm start -- --hostname 127.0.0.1
```

Abre de nuevo `/login` para comprobar la compilación. Ctrl+C detiene la
aplicación. `npm start` la reinicia sin eliminar documentos. Reinicia MongoDB con
`docker compose restart mongo`. Al terminar, `docker compose down` detiene los
contenedores y conserva el volumen. Consulta MongoDB local antes de eliminar datos.

Las pruebas verifican CRUD, índices, serialización y recuperación de conexión.
Cada archivo de integración utiliza una base generada `whatmeal_test_*` y elimina
solo esa base. `TEST_MONGODB_URI` permite usar otro servidor local para las pruebas.
No configures esa variable con servicios anteriores o bases de producción.

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
El controlador valida la sintaxis de la URI sin conectar ni consultar DNS.
Admite servidores múltiples, credenciales codificadas y direcciones SRV.
Los errores de sintaxis identifican `MONGODB_URI` sin mostrar su contenido.
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

## Compatibilidad

Next.js 16.4.6 utiliza React 19.3.1. Se conserva Auth.js 5.0.0-beta.32
con Credentials y sesiones JWT para evitar sustituir la autenticación.
Mongoose 9.13.0 conserva MongoDB como motor de persistencia.
El archivo `src/proxy.ts` conserva el matcher del middleware anterior.

- [Migración Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16).
- [Compatibilidad Mongoose y MongoDB](https://mongoosejs.com/docs/compatibility.html).
- [Compatibilidad Auth.js](https://registry.npmjs.org/next-auth/5.0.0-beta.32).

Firebase 13.4.0 y Firebase Admin 14.5.1 mantienen las APIs modulares utilizadas.
Las versiones antiguas arrastran dependencias vulnerables. La instalación utiliza
las versiones actuales sin habilitar notificaciones.
[Notas oficiales](https://firebase.google.com/support/release-notes/admin/node).

El override `@grpc/grpc-js=1.14.7` corrige las dependencias transitivas de
Firestore, que la aplicación no consume. Mantiene la versión mayor del protocolo.
Véanse [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
y [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4).

## Comprobaciones estáticas

`npm run typecheck` ejecuta TypeScript 5.9.3. `npm run lint` ejecuta ESLint
10.15.0 con las reglas recomendadas de JavaScript, TypeScript, Next.js y Hooks.
La configuración modular evita los peers incompatibles de `eslint-config-next`.
Las reglas adicionales de React, accesibilidad e imports de ese paquete no se
incluyen. La revisión de accesibilidad continúa siendo una comprobación de interfaz.
Solo se excluyen archivos generados. No se admiten advertencias de lint.
[Configuración oficial](https://nextjs.org/docs/app/api-reference/config/eslint#using-the-plugin-directly).

## MongoDB local

Instala Docker Engine o Docker Desktop con Compose 2.24 o posterior.
Comprueba `docker info` y `docker compose version`. Ejecuta:

```bash
docker compose up -d --wait mongo
```

MongoDB Community 8.0.38 está fijado mediante versión y digest. Solo publica
`127.0.0.1:27017`. El volumen `mongo-data` conserva documentos al reiniciar.
No se crean cuentas ni se importan datos anteriores. Esta configuración local
sin contraseña exige que la máquina sea de confianza y no sirve para producción.

`docker compose restart mongo` conserva los datos. `docker compose down` también
conserva el volumen. **`docker compose down --volumes` elimina deliberadamente los
datos de este proyecto.** No ejecutes esa eliminación para un reinicio ordinario.

Puedes cambiar el puerto con `MONGODB_PORT` y ajustar `MONGODB_URI` al mismo puerto.
Para ejecutar también la aplicación en un contenedor, configura `.env.local` y usa
`docker compose --env-file .env.local --profile app up -d --build`.
El contenedor usa Node y npm declarados, ejecuta `npm ci`, excluye secretos del
contexto de construcción y funciona con un usuario sin privilegios.

[Imagen oficial MongoDB](https://hub.docker.com/_/mongo).
[Disponibilidad en Compose](https://docs.docker.com/compose/how-tos/startup-order/).

La conexión espera como máximo 5000 ms para seleccionar un servidor y permite
reintentos tras un fallo. Consulta [los contratos de persistencia](docs/persistence.md).
Las pruebas de integración generan y eliminan únicamente sus bases aisladas.

## Preparar la base nueva

Después de configurar `.env.local` y arrancar MongoDB, ejecuta `npm run db:prepare`.
El comando carga `.env.local`, crea las colecciones e índices ausentes y termina
con `Database prepared.`. Repetirlo conserva documentos e índices adicionales.
No genera usuarios ni comidas. Una base recién preparada permanece vacía.
Para acceder con una cuenta nueva debes completar la quest de cuentas 149.

## Integración continua

El flujo `CI / quality` comprueba cada push y pull request con el entorno de
`.nvmrc` y `package.json`. Ejecuta instalación limpia, tipos, lint, pruebas
unitarias, auditoría de vulnerabilidades altas, integración y compilación.
MongoDB utiliza la misma imagen fijada en Compose. Cada ejecución crea su
propio proyecto y las pruebas generan bases aisladas. El flujo detiene MongoDB
antes de compilar, sin configurar Firebase ni secretos de servicios anteriores.
Comprueba que `package-lock.json` permanece intacto y elimina los recursos de
su proyecto tras una comprobación fallida mientras el runner permanece disponible.

La configuración sigue la [sintaxis oficial de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
y [setup-node](https://github.com/actions/setup-node#usage).
La protección de ramas y los despliegues corresponden a la quest 153.
