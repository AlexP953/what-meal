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
contiene cuentas. Abre `/register` para crear una cuenta normal con correo,
contraseña de al menos doce caracteres (máximo 72 bytes UTF-8) y nombre opcional.
El registro confirma la creación en `/login`, sin iniciar sesión automáticamente.
Detén desarrollo con Ctrl+C antes de continuar:

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
Las pruebas de integración utilizan bases generadas `whatmeal_test_*` y solo
eliminan las bases que crean. `TEST_MONGODB_URI` permite usar otro servidor local.
No configures esa variable con servicios anteriores o bases de producción.
Las pruebas HTTP ejecutan Next.js en carpetas temporales sin archivos `.env`
del checkout y con las notificaciones desactivadas al compilar y arrancar.

## Entorno

Utiliza Node.js **24.22.3 LTS** y npm **11.19.1**, distribuido con esa versión.
Con nvm, ejecuta `nvm install` y `nvm use`. Comprueba `node --version` y
`npm --version` antes de ejecutar `npm ci`. El archivo de bloqueo se versiona.
No utilices `--force` ni `--legacy-peer-deps`.

## Primer administrador y recuperación

Crea primero una cuenta normal en `/register`. En el servidor autorizado,
desde la carpeta del proyecto y con `.env.local` configurado, ejecuta:

```bash
npm run users:promote -- --email <correo>
```

El comando normaliza el correo, exige una cuenta existente y cambia únicamente
su rol a `admin`. No crea cuentas ni contraseñas. Repetirlo es seguro y confirma
la promoción sin mostrar credenciales. Utiliza `MONGODB_URI` y `MONGODB_DB`.
La siguiente operación protegida utiliza el rol nuevo, sin exigir otro acceso.
Si no queda ningún administrador, registra una cuenta normal y ejecuta el mismo
comando para recuperar la administración. No existe una ruta HTTP de promoción
local. Los administradores también conservan la gestión mediante las API.

## Comandos

- `npm run dev`: desarrollo.
- `npm run build`: compilación.
- `npm start`: ejecución de la compilación.
- `npm test`: pruebas unitarias (`tests/unit`).
- `npm run test:integration`: pruebas con MongoDB real (`tests/integration`).
- `npm run verify:local`: instalación y reinicios en recursos temporales aislados.

`verify:local` requiere Linux, Bash, GNU tar, curl y util-linux (`setsid` y
`timeout`), además del entorno declarado y Docker Compose. Copia únicamente
archivos versionados del árbol de trabajo. Añade los archivos nuevos al índice
de Git antes de comprobarlos. No copia `.env.local` ni usa la configuración
heredada del entorno ni los archivos personales o globales de npm.
Genera su propio secreto temporal de autenticación.

El comando ejecuta `npm ci`, compara el lockfile, prepara MongoDB dos veces y
comprueba que no existen cuentas ni comidas. Comprueba `/login` por HTTP en
desarrollo y producción. Un documento de prueba demuestra persistencia después
de reiniciar la aplicación y MongoDB. Una prueba autenticada compara comidas,
filtros y fechas civiles en dos zonas horarias después de otro reinicio.
La compilación sucede con MongoDB detenido
y sin las variables de persistencia ni autenticación.

Cada ejecución genera un proyecto Compose con volumen propio y puertos locales
asignados por el sistema. Consulta de nuevo el puerto después de los reinicios.
Al terminar, incluso con errores o señales INT/TERM, detiene sus procesos y
elimina únicamente sus recursos. No modifica el MongoDB de desarrollo.
Los límites de tiempo evitan esperas indefinidas. Una terminación forzada del
runner (SIGKILL) impide ejecutar la limpieza.

La comprobación HTTP no ejecuta JavaScript del navegador. La revisión de `/login`
en un navegador comprueba además consola, solicitudes, permisos y trabajadores
con las notificaciones desactivadas, tanto en desarrollo como en producción.
El comando utiliza la [CLI de Next.js](https://nextjs.org/docs/app/api-reference/cli/next),
[la espera de Compose](https://docs.docker.com/reference/cli/docker/compose/up/)
y [la consulta del puerto publicado](https://docs.docker.com/reference/cli/docker/compose/port/).

Vitest utiliza proyectos separados y la condición `react-server` para probar
módulos exclusivos del servidor. Las pruebas de integración se ejecutan en serie.

## Fuentes técnicas

- [Distribución oficial de Node.js](https://nodejs.org/dist/v24.22.3/SHASUMS256.txt).
- [Requisitos de Vitest](https://vitest.dev/guide/).
- [Proyectos de Vitest](https://vitest.dev/guide/projects).

Las rutas dinámicas resuelven `params` como promesa, conforme a
[Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/route#context-optional).
Los tipos de Auth.js amplían los campos `id` y `role` del contrato JWT existente.
El JWT incorpora una versión privada y una fecha original para revocar sesiones
y limitar su duración. Esos campos no pertenecen a la sesión pública.

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
En producción, configura `AUTH_URL` con el origen público de la aplicación,
por ejemplo `https://comidas.example.com`. Auth.js usa ese origen para confiar
en el host y la aplicación limita las redirecciones al mismo origen. En desarrollo
local sin `AUTH_URL`, la aplicación usa HTTP y el `Host` directo para comprobar
el origen, sin utilizar cabeceras reenviadas.
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
Las rutas de cuentas verifican la sesión en el servidor mediante `requireSession`.

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

## Despliegue HTTPS

En un servidor Linux con Docker Engine y Compose 2.24 o posterior, usa un
almacenamiento persistente para los volúmenes de Docker. La referencia fija
Node.js 24.22.3, MongoDB 8.0.38 y Caddy 2.11.4 por digest. Usa una máquina
compatible con MongoDB 8.0 y con espacio para compilar la aplicación y conservar
los datos y certificados. Comprueba `docker info` y `docker compose version`.

Clona el repositorio y selecciona la revisión que vas a desplegar con
`git switch --detach <commit>`. Registra el resultado de `git rev-parse HEAD`.
Usa un nombre de proyecto estable, por ejemplo `whatmeal-deploy`, en cada
operación de esta instalación. Un nombre distinto usa otros volúmenes.

Crea un registro DNS A para el servidor. Añade AAAA solo si el servidor acepta
conexiones IPv6. Permite TCP 80 y 443 en el cortafuegos y en el proveedor.
Deja libres esos puertos para Caddy. Caddy necesita salida a Internet para
obtener y renovar el certificado. MongoDB y Next.js se comunican por redes
privadas de Compose.

Define `AUTH_URL` con el origen público, por ejemplo `https://comidas.tudominio.es`,
sin barra final ni puerto explícito. Define `WHATMEAL_SECRETS_DIR` con la ruta
absoluta a un directorio privado fuera del checkout. Los comandos siguientes
suponen Docker Engine en modo rootful, sin reasignación de UID. El contenedor
Next.js y la tarea de preparación leen archivos con UID 1000.

```bash
export AUTH_URL=https://comidas.tudominio.es
export WHATMEAL_SECRETS_DIR=/etc/whatmeal/secrets
sudo install -d -m 0700 -o "$(id -u)" "$WHATMEAL_SECRETS_DIR"
sudo bash -eu -o noclobber -c '
  umask 077
  for name in auth-secret mongo-app-password mongo-root-password mongo-backup-password; do
    openssl rand -hex 32 > "$1/$name"
  done
  chown 1000 "$1/auth-secret" "$1/mongo-app-password"
' _ "$WHATMEAL_SECRETS_DIR"

docker compose -p whatmeal-deploy -f compose.deploy.yml config --quiet
docker compose -p whatmeal-deploy -f compose.deploy.yml build
docker compose -p whatmeal-deploy -f compose.deploy.yml up -d --wait
```

Crea estos archivos una sola vez antes del primer arranque. Guarda los cuatro
valores por separado en tu gestor de secretos. Conserva los archivos al
reiniciar y actualizar. Cambiar el archivo de una contraseña de MongoDB
requiere cambiar también la cuenta correspondiente en la base. La compilación
y la ejecución mantienen desactivadas las notificaciones y prescinden de
Firebase. Compose verifica la cuenta de aplicación y prepara la base antes de
iniciar Next.js y Caddy.

En el primer arranque, sigue los registros de Caddy hasta que obtenga el
certificado. Verifica HTTP, la cadena de confianza, el nombre y la caducidad
del certificado desde otra red. Estos comandos usan el almacén de confianza del cliente.

```bash
curl -sSI "http://${AUTH_URL#https://}/login"
curl -fsS -o /dev/null -w '%{http_code}\n' "$AUTH_URL/login"
host=${AUTH_URL#https://}
openssl s_client -connect "$host:443" -servername "$host" \
  -verify_hostname "$host" -verify_return_error </dev/null |
  openssl x509 -noout -subject -issuer -dates
```

Espera el estado 308, una cabecera `Location` con el origen HTTPS y ninguna
cabecera `Set-Cookie` en HTTP. Espera 200 en HTTPS. Conserva el volumen `caddy-data` y mantén DNS
y puertos web disponibles para que Caddy renueve el certificado. Consulta
`docker compose -p whatmeal-deploy -f compose.deploy.yml logs --tail 50 caddy`
para ver la emisión y los errores de renovación. Programa una comprobación
periódica de la fecha de caducidad con el mismo cliente externo.

[HTTPS automático de Caddy](https://caddyserver.com/docs/automatic-https).
[Secretos en Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).

### Prueba desde Android

Usa un despliegue temporal con datos ficticios y un certificado de confianza
pública. En Android, desactiva el wifi y abre `$AUTH_URL/login` desde otra red.
Crea una cuenta de prueba, inicia sesión y guarda una comida. Vuelve a abrir el
diario y confirma que aparece. Comprueba en el inspector del navegador que la
cookie `__Secure-authjs.session-token` tiene el atributo `Secure` y que las
redirecciones de autenticación conservan el origen HTTPS.

Desde otro cliente con Node.js y las dependencias del repositorio instaladas,
ejecuta esta prueba complementaria. Comprueba la cookie y las redirecciones
y verifica las respuestas 401 sin sesión y 403 desde un origen ajeno.

```bash
scratch=$(mktemp -d)
node --import tsx scripts/deployment-diary-probe.ts --disposable seed "$AUTH_URL" "$scratch/diary.json"
node --import tsx scripts/deployment-diary-probe.ts --disposable read "$AUTH_URL" "$scratch/diary.json"
```

La prueba crea una cuenta y una comida ficticias. Conserva el archivo privado
si vas a comparar el diario tras una actualización o restauración. El archivo
contiene las credenciales de la cuenta ficticia y los datos esperados. Elimínalo
cuando termines y registra solo el resultado de las comprobaciones.

Para programar y verificar copias, consulta [el procedimiento de copia](docs/persistence.md#copias-del-despliegue).

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
Las pruebas unitarias de conexión controlan los intentos pendientes y simulan
recargas de módulos. Comprueban identidad de promesa, intento único y recuperación
con la configuración vigente después de un rechazo.

## Preparar la base nueva

Después de configurar `.env.local` y arrancar MongoDB, ejecuta `npm run db:prepare`.
El comando carga `.env.local`, crea las colecciones e índices ausentes y termina
con `Database prepared.`. Repetirlo conserva documentos e índices adicionales.
No genera usuarios ni comidas. Una base recién preparada permanece vacía.
Abre `/register` para crear la primera cuenta normal y después `/login` para
acceder. El menú ofrece **Cerrar sesión** y vuelve a `/login`. La sesión permite
recargar y dura como máximo 24 horas desde el acceso original. Cambiar la
contraseña invalida todas las sesiones anteriores, incluida la sesión actual.
Eliminar una cuenta invalida su sesión y conserva sus comidas, sin asignarlas
a otra cuenta. Consulta la matriz y los errores en [persistencia](docs/persistence.md).

El registro rechaza campos desconocidos y cualquier `role` recibido, incluso
para la primera cuenta. Las cuentas administrativas se habilitan mediante el
comando local anterior. El correo se normaliza antes de validar y almacenar.
Los accesos aceptan contraseñas existentes, aunque sean anteriores al mínimo nuevo.

La instalación comparte veinte intentos de registro por hora cuando no existe
una dirección de origen verificable. Una persona puede agotar esa cuota para
toda la instalación. Cada correo dispone de diez fallos de acceso por quince
minutos. MongoDB comparte los límites entre procesos. Las respuestas limitadas
incluyen 429 y `Retry-After`, sin distinguir cuentas existentes.

## Verificación del acceso

```bash
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
npm run verify:local
```

`tests/integration/access-http.test.ts` inicia la aplicación en desarrollo y
producción sobre bases generadas, con sesiones emitidas y CSRF reales. Compila
antes de comprobar producción. Comprueba registro sin sesión automática,
permisos de tres cuentas, cambios de rol, revocación, eliminación y cierre.
Los procesos de prueba usan puertos locales asignados por el sistema y se detienen
al terminar. Las demás pruebas cubren concurrencia, caducidad, fallos de conexión,
orígenes, cookies y el comando de promoción.

La comprobación de navegador completa registro, acceso, recarga y cierre mediante
teclado en desarrollo y producción. También comprueba consola, etiquetas, errores
400/409/429, desconexión y recuperación de los formularios. HTTP no sustituye
esa comprobación de interacción ni la inspección visual.

## Integración continua

El flujo `CI / quality` comprueba cada push y pull request con el entorno de
`.nvmrc` y `package.json`. Ejecuta instalación limpia, tipos, lint, pruebas
unitarias, auditoría de vulnerabilidades altas, integración y compilación.
La integración comprueba las fechas civiles con `TZ=UTC` y
`TZ=Pacific/Kiritimati`. Después ejecuta `npm run verify:local`, que informa
su resultado y duración. El flujo dispone de 20 minutos para cubrir descargas,
compilaciones y reinicios, con margen sobre la ejecución local.
MongoDB utiliza la misma imagen fijada en Compose. Cada ejecución crea su
propio proyecto con puerto asignado por el sistema y las pruebas generan bases
aisladas. El flujo detiene MongoDB
antes de compilar, sin configurar Firebase ni secretos de servicios anteriores.
Comprueba que `package-lock.json` permanece intacto y elimina los recursos de
su proyecto tras una comprobación fallida mientras el runner permanece disponible.

La configuración sigue la [sintaxis oficial de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
y [setup-node](https://github.com/actions/setup-node#usage).
La protección de ramas y los despliegues corresponden a la quest 153.
