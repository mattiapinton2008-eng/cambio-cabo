CAMBIO - FIX SALIR Y REINICIAR

Archivos incluidos:
- server.js
- public/client.js
- public/index.html

Cambios:
- Botón Salir en la partida con confirmación.
- Salida real del servidor (abandona la sala; en solo elimina la sala).
- Limpia token y sala guardados en el navegador para evitar reconexión automática tras salir.
- Botón Reiniciar visible solo para anfitrión, disponible durante la partida y al finalizar.
- Reiniciar reparte cartas nuevas y vuelve al inicio de la partida.

Pruebas ejecutadas:
- node --check server.js: OK
- node --check public/client.js: OK
- npm test: 26/26 pruebas existentes pasan.

Importante: copiar los 3 archivos a sus rutas correspondientes dentro de la carpeta del proyecto que Render utiliza como Root Directory.
