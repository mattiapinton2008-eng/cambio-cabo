# CAMBIO · Cabo online

Juego de cartas online con baraja española, salas privadas por enlace y modo individual contra bots. Está construido con Node.js, Express, Socket.IO y JavaScript vanilla, sin framework ni proceso de compilación.

## Ejecutarlo

Necesitas Node.js 18 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:3000`. Para comprobar las reglas:

```bash
npm test
```

## Jugar con amigos

1. Una persona pulsa **Crear partida** y escribe su nombre.
2. Comparte el enlace o el código de sala por WhatsApp.
3. Los demás abren el enlace, escriben su nombre y entran.
4. Se necesitan entre 3 y 8 jugadores. El anfitrión puede añadir bots para completar la mesa y pulsa **Empezar partida**.
5. Cada persona elige dos cartas para memorizar. Cuando todos terminan, empieza la partida.

Para jugar en una misma Wi-Fi, ejecuta el servidor en un ordenador y comparte `http://IP-LOCAL:3000`.

## Publicarlo gratis en Render

Este proyecto incluye `render.yaml` para configurar el servicio automáticamente.

1. Crea un repositorio nuevo en GitHub (por ejemplo, `cambio-cabo`).
2. Descomprime el ZIP y sube **el contenido de la carpeta `cambio-game`** al nivel raíz del repositorio: `package.json`, `server.js`, `game.js`, `bot.js`, `public/` y `render.yaml`.
3. Entra en [Render](https://render.com/) e inicia sesión.
4. Pulsa **New + → Blueprint** y conecta el repositorio de GitHub.
5. Render detectará `render.yaml`. Confirma la creación del servicio `cambio-cabo`.
6. Cuando termine el despliegue, abre la URL `https://...onrender.com` que aparece en el panel. Esa será la dirección para compartir.
7. Si Render solicita el valor de `PUBLIC_URL`, introduce exactamente esa URL pública (sin barra final).

También puedes crear un **Web Service** manualmente con `npm install` como Build Command, `npm start` como Start Command y `/health` como Health Check Path.

**Importante:** el plan gratuito puede suspender el servicio por inactividad. La primera apertura puede tardar. Las partidas viven en memoria y se pierden si Render reinicia el proceso o se despliega otra versión. No cierres una partida importante durante ese periodo.

Los planes gratuitos pueden suspender el servicio tras un periodo sin actividad. La primera visita puede tardar en despertar el servidor. Las salas, las manos y los tokens de reconexión se guardan en memoria: si el proceso se reinicia o se despliega una nueva versión, las partidas activas se pierden. Para una versión de producción con partidas persistentes haría falta añadir una base de datos y almacenamiento compartido.

## Reglas disponibles

- Baraja española de 48 cartas: 4 palos y valores del 1 al 12.
- Cuatro cartas por jugador y memorización privada de dos cartas.
- Robo obligatorio y decisión entre tirar la carta robada o cambiarla por una carta propia.
- Tiradas rápidas de cartas propias o de rivales; las tiradas múltiples propias requieren que todas sean del mismo valor.
- Fallar devuelve la carta a su mano y añade una penalización; acertar a un rival obliga a entregarle una carta propia.
- Poder opcional del 10 (intercambio a ciegas) y del 12 (ver ambas cartas antes de decidir).
- Tocar mesa, última vuelta sin participación de quien la tocó y recuento final.
- El 11 vale cero puntos; gana la puntuación más baja.

## Ajustes

- `game.js`: `CONFIG` contiene tiempos y límites básicos del motor de juego.
- `bot.js`: `LEVELS` define retardos y umbrales de dificultad.
- `server.js`: configuración de salas, sesiones y automatización de bots.

## Seguridad y límites conocidos de esta versión

El servidor es la autoridad de las cartas y las acciones. A los navegadores solo les envía valores de sus propias cartas cuando tienen derecho a verlos, la carta superior del centro y los datos públicos de los demás. Las cartas ocultas se representan con identificadores aleatorios opacos. El resultado del 12 se envía únicamente al jugador que activa el poder. Los bots toman decisiones a partir de una vista filtrada y de la memoria de sus propias cartas vistas, no leyendo las manos reales de otros jugadores.

Las pruebas automatizadas cubren el ocultamiento de cartas, memorización, puntuación del 11, aciertos y fallos, entrega de cartas, poder del 12, última ronda y tiradas múltiples. Aun así, antes de una partida importante conviene probar el flujo completo con varios navegadores. Esta versión mantiene las salas en memoria y los bots tienen una estrategia deliberadamente sencilla; no implementa todavía persistencia tras reinicios, una memoria probabilística avanzada, panel de expulsión de desconectados ni monitorización/limitación avanzada contra abuso.


## Actualización visual premium (noviembre 2026)

La interfaz incluye mesa ovalada de fieltro verde con borde de madera/dorado, asientos de rivales distribuidos alrededor de la mesa según el número de jugadores (tu asiento permanece abajo), animaciones de robo y descarte, banners de acción, efectos diferenciados para 10 y 12 y sonidos sintetizados que se pueden silenciar.

La baraja de esta variante es de **48 cartas**: cuatro palos (Oros, Copas, Espadas y Bastos) por doce valores (1–12). No se incluyen comodines. La variante de 50 cartas suele añadir dos comodines, que no forman parte de las reglas definidas para CAMBIO.

### Publicar esta actualización en Render

1. Sube los archivos actualizados `public/index.html`, `public/style.css` y `public/client.js` al repositorio GitHub, sustituyendo los anteriores y manteniendo la carpeta `public`.
2. Pulsa **Commit changes**.
3. Render detectará el commit y desplegará la nueva versión automáticamente.
4. Cuando el servicio figure como **Live**, recarga la web con `Cmd + Shift + R` para evitar caché.


## Corrección de cartas y animaciones (noviembre 2026)

- Los anversos usan ilustraciones recortadas de la referencia visual de baraja española aportada para Oros, Bastos, Espadas y Copas; 8 y 9 tienen caras ilustradas de puntos creadas para completar la variante de 48 cartas.
- El reverso usa el patrón ornamental rojo de la referencia del usuario.
- La carta robada aparece junto al mazo sobrante.
- Las cartas nuevas que entran en la mano tras un intercambio o penalización reciben animación de reparto.
- El centro, las cartas robadas y las cartas recién repartidas tienen animaciones de entrada.
- Los rivales se distribuyen en el arco superior/lateral de la mesa, reservando el asiento inferior al jugador local.
- El estado del juego comparte los identificadores opacos de las cartas rivales (sin valor ni palo) para permitir la acción de intentar quitar una carta conocida sin revelar su contenido.


## CAMBIO — rediseño cenital de mesa completa

La partida ahora usa una vista cenital (top-down) de la mesa ovalada a pantalla completa. Todos los participantes, incluidas las cartas del usuario, se representan directamente sobre el tapete. El asiento del usuario permanece abajo y los demás se distribuyen por el perímetro según el número de jugadores. El mazo, la carta robada y los descartes quedan en el centro de la mesa.

### Publicar el rediseño

Sube el contenido completo de esta carpeta `cambio-game` al repositorio GitHub `cambio-cabo`, conservando las carpetas. Sobrescribe los archivos existentes y añade todos los recursos de `public/cards`. No cambies el nombre de la carpeta `public`. Render realizará el despliegue automático al guardar el commit.


### Reacción y ritmo de partida
La ventana para intentar tirar una carta del mismo valor dura 15 segundos. Los bots esperan varios segundos antes de robar para dar oportunidad de reaccionar. Las cartas muestran su valor numérico en pantalla y las cartas propias se juegan de una en una.
