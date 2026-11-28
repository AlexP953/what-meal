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

## Publicación gratuita en Vercel

Aplica los cambios remotos y comprueba el dominio público durante la publicación.
Usa el proyecto de What Meal en [Vercel Hobby](https://vercel.com/docs/plans/hobby)
para uso personal y no comercial, y el clúster autorizado de
[Atlas Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).
Conserva el clúster y la base actuales si ya contienen datos. En Vercel, confirma
el preset Next.js, [Node.js 24.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
y el dominio de producción asignado al proyecto.
Si el proyecto usa Vercel Authentication, el alcance
[Standard Protection](https://vercel.com/docs/deployment-protection#standard-protection)
permite abrir el dominio de producción y mantiene protegidas las vistas previas.

Configura estas variables en **Settings → Environment Variables → Production**:

| Variable | Valor |
| --- | --- |
| `AUTH_URL` | Origen HTTPS del dominio público de producción, sin ruta. |
| `AUTH_SECRET` | Secreto privado de producción. Genéralo según [Configuración](#configuración) en la primera publicación y consérvalo entre despliegues. |
| `MONGODB_URI` | URI privada de Atlas con el usuario de la aplicación, limitado a la base de What Meal. |
| `MONGODB_DB` | Nombre explícito de la base autorizada. |
| `NEXT_PUBLIC_NOTIFICATIONS_ENABLED` | `false` al compilar. Omite las variables de Firebase. |

Comprueba que Atlas admite la conexión desde el entorno de Vercel y desde la
máquina autorizada para preparar la base. Revisa la
[lista de acceso de Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
del proyecto antes de cambiarla. Sus reglas afectan a todos los clústeres del
proyecto. Las [salidas de Hobby son dinámicas](https://vercel.com/docs/networking/static-ips).
Si necesitas admitir cualquier IP, solicita autorización antes de ampliar
el acceso al proyecto de Atlas.
Mantén TLS y la autenticación de Atlas, con credenciales exclusivas para What Meal.

Desde la máquina autorizada, inyecta en una sesión privada `MONGODB_URI` y
`MONGODB_DB` para la misma base. Usa una cuenta autorizada para crear
colecciones e índices y ejecuta `npm run db:prepare`. Comprueba que muestra
`Database prepared.`. Ejecuta las pruebas de integración solo con MongoDB
aislado. Tras guardar las variables, crea un despliegue nuevo de la revisión
aprobada en **Production** y espera el estado **Ready**.

### Comprobar el acceso público

1. En **Deployments**, confirma que la URL de producción apunta a la revisión
   aprobada. Anota el SHA, el identificador del despliegue y la URL pública.
2. Confirma **Hobby** en la configuración del equipo de Vercel y **Free** en
   la ficha del clúster de Atlas. Registra ambos planes.
3. En una ventana privada, abre `/login` en el dominio público. Confirma que
   aparece What Meal directamente y que el navegador acepta el certificado HTTPS.
4. Registra un correo ficticio único. Confirma el aviso de cuenta creada en
   `/login` y que `/meals` todavía solicita acceso.
5. Inicia sesión, abre `/meals` y recarga la página. Confirma que conserva la
   sesión y que las redirecciones mantienen el origen HTTPS de producción.
6. En las herramientas del navegador, comprueba el atributo `Secure` de la
   cookie de sesión de Auth.js. Registra el resultado sin copiar su valor.
7. Cierra sesión desde el menú. Abre `/meals` directamente y comprueba que
   vuelve a `/login` en el mismo origen HTTPS.

### Comprobar la persistencia tras redesplegar

1. Usa un árbol de trabajo limpio en la revisión aprobada. Ejecuta
   `npm run verify:local` y conserva el comando, el SHA y el resultado junto
   con las demás comprobaciones del repositorio.
2. En el dominio público, ejecuta el [recorrido del diario](#recorrido-de-verificación-del-diario)
   con un correo ficticio único de `example.com` para la primera cuenta.
   Conserva temporalmente su credencial en un gestor de contraseñas privado.
3. Vuelve a iniciar sesión con la primera cuenta. En una carpeta privada temporal
   creada con `mktemp -d`, guarda las respuestas JSON de `/api/meals` y de
   `/api/meals/<id>` para cada comida conservada. Confirma que las tres respuestas
   devuelven 200 y que cada identificador y campo coincide con el recorrido.
   La lista contiene **Arroz editado** y **Pasta de prueba**. Registra el 404
   `MEAL_NOT_FOUND` de `/api/meals/<id>` para **Cena para eliminar**.
4. Ejecuta el [recuento de solo lectura](docs/persistence.md#recuentos-del-recorrido-publicado)
   para la primera cuenta. Comprueba que devuelve una cuenta y dos comidas.
5. En **Deployments** de Vercel, abre el despliegue comprobado y selecciona
   **Redeploy**. Cuando el nuevo despliegue esté **Ready** y sirva el dominio
   público, confirma que la revisión coincide y que el identificador cambió.
   Usa el mismo clúster, base de datos y configuración de autenticación.
6. Cierra todas las ventanas privadas y abre una nueva. Comprueba que `/meals`
   solicita acceso e inicia sesión con la misma cuenta sin registrarla de nuevo.
   Confirma que la lista y los detalles devuelven 200 y coinciden con los JSON
   anteriores. Repite la consulta de la comida eliminada y confirma el 404
   `MEAL_NOT_FOUND`. Ejecuta el recuento de nuevo y compara ambos resultados.
7. Registra la URL pública, la revisión, los dos identificadores de despliegue,
   los planes activos, los resultados del acceso y del diario, el 404 y ambos
   recuentos. Omite contraseñas, cookies y cadenas de conexión. Elimina los
   archivos temporales y retira la credencial temporal del gestor al terminar.

## Despliegue HTTPS

En un servidor Linux con Docker Engine y Compose 2.24 o posterior, usa un
almacenamiento persistente para los volúmenes de Docker. La referencia fija
Node.js 24.22.3, MongoDB 8.0.38 y Caddy 2.11.9 por digest. Usa una máquina
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

Si se interrumpe el primer arranque, repite `up -d --wait` con el mismo
proyecto y los mismos secretos. La tarea de MongoDB crea la primera cuenta
desde la conexión local o verifica la cuenta existente.

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

### Diagnóstico del despliegue

Desde un cliente, comprueba el certificado y la respuesta de Next.js a través
de Caddy. La petición no usa una sesión ni muestra el contenido de la página.

```bash
curl --silent --show-error --fail --max-time 10 --output /dev/null \
  --write-out '%{http_code}\n' "$AUTH_URL/login"
```

Espera 200. Si curl devuelve el código de salida 60, comprueba el nombre, la
cadena y la vigencia del certificado con la comprobación TLS anterior. El
código 35 señala un fallo al establecer TLS. Si curl muestra 502, revisa la
conexión entre Caddy y Next.js. Si la conexión se rechaza o vence el plazo,
comprueba DNS, cortafuegos y Caddy.

En el servidor, usa las variables y el nombre de proyecto de la instalación.
Consulta el estado y, según el componente que falle, sus últimos registros.

```bash
docker compose -p whatmeal-deploy -f compose.deploy.yml ps --all
docker compose -p whatmeal-deploy -f compose.deploy.yml logs --tail 50 caddy whatmeal mongo
docker compose -p whatmeal-deploy -f compose.deploy.yml logs --tail 50 mongo-provision db-prepare
```

Espera que Caddy esté en ejecución, que Next.js y MongoDB figuren como
`healthy` y que `mongo-provision` y `db-prepare` terminen con código 0.
El estado de Next.js comprueba `/login` dentro de su contenedor. El estado de
MongoDB comprueba el proceso. Ejecuta la [comprobación autenticada de MongoDB](docs/persistence.md#diagnóstico-de-mongodb)
para verificar también que la aplicación tiene acceso a su base. Registra los
estados y mensajes de error pertinentes sin copiar credenciales, cookies ni
contenido del diario.

### Actualización y recuperación

Ensaya cada cambio en un proyecto desechable con un proxy aislado o en otro
servidor. Registra la revisión de What Meal, las imágenes de MongoDB y Caddy,
y el nombre del proyecto. Conserva el
nombre, los secretos y los volúmenes al aplicar el cambio al servidor. Haz una
copia verificada antes de cada actualización y conserva la revisión que la
generó. Sigue el [ensayo de restauración](docs/persistence.md#ensayo-de-restauración)
para comprobar la copia antes de usarla para una recuperación.

Prepara dos revisiones separadas si cambian tanto la aplicación como MongoDB.
Primero usa una revisión de What Meal que conserve la imagen anterior de MongoDB.
Desde la revisión nueva, usa las mismas variables de la instalación. Sustituye
`whatmeal-deploy` por el nombre que usaste al instalar.

```bash
git rev-parse HEAD
docker compose -p whatmeal-deploy -f compose.deploy.yml build whatmeal db-prepare &&
docker compose -p whatmeal-deploy -f compose.deploy.yml run --rm --no-deps db-prepare &&
docker compose -p whatmeal-deploy -f compose.deploy.yml up -d --wait --no-deps whatmeal
```

Comprueba el inicio de sesión, una comida existente y la escritura de una
comida ficticia. Para actualizar MongoDB dentro de la serie 8.0, consulta las
notas del parche y utiliza una revisión con la imagen nueva fijada por digest.
Si hubo una actualización de serie reciente, verifica que la versión de
compatibilidad de funcionalidades ya está estable antes de continuar.
Detén la aplicación durante el cambio de MongoDB. Mantén suspendidos también
los demás escritores hasta comprobar la base.

```bash
docker compose -p whatmeal-deploy -f compose.deploy.yml pull mongo &&
docker compose -p whatmeal-deploy -f compose.deploy.yml stop whatmeal &&
docker compose -p whatmeal-deploy -f compose.deploy.yml up -d --wait mongo &&
docker compose -p whatmeal-deploy -f compose.deploy.yml run --rm --no-deps mongo-provision &&
docker compose -p whatmeal-deploy -f compose.deploy.yml run --rm --no-deps db-prepare &&
docker compose -p whatmeal-deploy -f compose.deploy.yml up -d --wait --no-deps whatmeal
```

Repite las comprobaciones de lectura y escritura. En un ensayo, usa la prueba
del diario para comparar sus identificadores, propietarios, fechas y contenido
antes y después de cada paso.

Si falla solo la actualización de What Meal y la revisión anterior sigue siendo
compatible con la base, vuelve a esa revisión y repite el bloque de actualización
de la aplicación. Comprueba el diario antes de reanudar el servicio.

Si falla MongoDB, conserva el volumen afectado. Restaura la copia anterior al
cambio con la revisión que la creó y comprueba el diario en el proyecto nuevo.
Antes de dirigir el tráfico al proyecto recuperado, suspende las escrituras
en el original y configura los secretos recuperados y el mismo origen HTTPS
en What Meal y Caddy. Si ambos proyectos comparten servidor, detén primero el
proxy anterior para liberar los puertos web. Los datos creados después de la
copia requieren recuperación aparte. Los cambios de serie de MongoDB requieren
un procedimiento propio.

`restart`, `up --force-recreate` y `down` conservan los volúmenes del despliegue.
`down --volumes`, `docker volume rm` y ciertas variantes de `docker volume prune`
pueden eliminar datos persistentes. Usa esas operaciones solo para recursos
desechables identificados o para una retirada deliberada.

[Actualización de parche de MongoDB 8.0](https://www.mongodb.com/docs/v8.0/tutorial/upgrade-revision/).

#### Actualizar Caddy

Desde la revisión nueva, conserva el nombre del proyecto, las variables de
la instalación y los volúmenes `caddy-data` y `caddy-config`. Sustituye
`whatmeal-deploy` por el nombre de tu instalación. Comprueba que What Meal
está en ejecución. El siguiente bloque descarga la imagen fijada
por digest, recrea solo Caddy y comprueba la imagen del contenedor activo.
El servicio HTTPS puede interrumpirse brevemente durante el reemplazo.

```bash
(
  set -euo pipefail
  caddy_compose() { docker compose -p whatmeal-deploy -f compose.deploy.yml "$@"; }
  expected_image=$(caddy_compose config --images | grep -E '^caddy:[^@]+@sha256:[0-9a-f]{64}$')
  caddy_compose pull caddy
  expected_id=$(docker image inspect --format '{{.Id}}' "$expected_image")
  caddy_compose up -d --wait --no-deps --force-recreate caddy
  proxy=$(caddy_compose ps --status running -q caddy)
  active_id=$(docker inspect --format '{{.Image}}' "$proxy")
  if [ "$active_id" != "$expected_id" ]; then
    printf 'La imagen activa difiere de %s\n' "$expected_image" >&2
    exit 1
  fi
  printf 'Imagen activa: %s\n' "$expected_image"
)
```

Espera que el bloque muestre la imagen con el digest de `compose.deploy.yml`.
Desde un cliente externo, ejecuta la comprobación HTTPS del
[diagnóstico del despliegue](#diagnóstico-del-despliegue). Espera 200 y
comprueba el nombre, la cadena y la vigencia del certificado con los comandos
de [Despliegue HTTPS](#despliegue-https).

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

## Recorrido de verificación del diario

Usa la [instalación local](#instalación-desde-cero) con MongoDB aislado o el
[dominio público](#publicación-gratuita-en-vercel) durante la publicación.
Usa dos cuentas ficticias nuevas con rol normal y correos distintos.

1. Abre `/login` y selecciona **Crear una cuenta**. Registra un correo nuevo y
   confirma que el aviso de cuenta creada aparece en la pantalla de acceso.
2. Inicia sesión con la primera cuenta. Abre **Añadir comida** y crea estas
   comidas. Crea al menos una desde el móvil y otra desde el escritorio.
   Recarga en ambos navegadores y comprueba que aparecen las tres.

   | Nombre | Fecha | Tipo | Reacción | Lugar |
   | --- | --- | --- | --- | --- |
   | Arroz de prueba | 2026-01-12 | Comida | Bien | Casa |
   | Pasta de prueba | 2026-01-13 | Comida | Mal | |
   | Cena para eliminar | 2026-01-14 | Cena | Bien | |

3. Abre **Filtros** y aplica **Comida**, **Bien** y el intervalo del 12 al
   13 de enero de 2026. Comprueba que solo queda **Arroz de prueba**.
   Cambia el tipo a **Desayuno** y comprueba que no hay coincidencias.
   Pulsa **Limpiar filtros** y confirma que reaparecen las tres comidas.
4. Abre **Arroz de prueba**, cambia su nombre a **Arroz editado** y borra
   **Lugar**. Guarda, recarga y abre la comida para comprobar los dos cambios.
5. Con la primera cuenta, abre `/api/meals` y conserva el `id` de
   **Arroz editado** y de **Cena para eliminar** en una nota privada.
6. Abre **Cena para eliminar** y selecciona **Eliminar**. Pulsa **Cancelar**
   y recarga para comprobar que sigue presente. Repite la operación con
   **Eliminar comida** y recarga para comprobar que desapareció.
7. En otro perfil de navegador, entra con la segunda cuenta y crea una comida
   ficticia. Comprueba que la lista del diario y `/api/meals` solo muestran
   esa comida. Usa su sesión para las comprobaciones de permisos de abajo.
8. Cierra sesión desde **Menú de cuenta** y confirma que `/meals` vuelve a
   `/login`.

Desde la consola de `/meals` en el perfil de la segunda cuenta, sustituye
`ID_ARROZ_EDITADO` por el identificador guardado. Usa solo la comida ficticia.
Ambas peticiones deben mostrar `403`. Vuelve a la primera cuenta y comprueba
que el nombre sigue siendo **Arroz editado**.

```js
const comidaAjena = "/api/meals/ID_ARROZ_EDITADO";
console.log((await fetch(comidaAjena)).status);
console.log((await fetch(comidaAjena, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Edición denegada" }),
})).status);
```

Haz el recorrido a 320 píxeles CSS y en una pantalla ancha. Usa Tab, Mayús+Tab
y Escape para comprobar el foco de los diálogos. En el navegador móvil, abre
el dominio público para la prueba de publicación. Para la prueba local en
Android, conecta el dispositivo mediante ADB o inicia el emulador. Ejecuta
`adb reverse tcp:3000 tcp:3000` en el equipo donde corre Next.js y abre
`http://localhost:3000/login` en Chrome para Android. Repite el recorrido con tacto.
El diario usa Web Locks para coordinar los cambios de sesión entre pestañas.
Usa HTTPS al acceder desde otro equipo y localhost para el desarrollo local.
Si otra pestaña intenta iniciar sesión, el diario se oculta hasta comprobar la
sesión. Si sigue vigente la misma sesión, vuelve el formulario con su borrador.
Con el teclado en pantalla abierto, enfoca Notas y desplaza el formulario hasta
la acción de guardar. Activa TalkBack para comprobar las etiquetas, los títulos
de los diálogos y los avisos de carga, error y confirmación.

Para probar la recuperación, bloquea temporalmente la consulta GET a
`/api/meals` desde las herramientas del navegador. Comprueba que un error de
la primera consulta ofrece **Reintentar consulta**. Tras guardar una comida,
verifica que el fallo del GET conserva el cambio confirmado y que el reintento
solo envía otra consulta. Si pierdes la respuesta de una operación, selecciona
**Consultar diario** para revisar todas tus comidas antes de repetirla.

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
