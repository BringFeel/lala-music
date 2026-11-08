# AGENTS.md

## Regla obligatoria antes de cada commit

Antes de crear **cualquier** commit hay que desplegar el bot en Docker y revisar
los logs del contenedor. Solo si no hay errores se procede con el commit.

Pasos:

1. `npm run typecheck` y `npm run lint` (verificación estática).
2. Construir y desplegar: `docker compose up -d --build`.
3. Esperar unos segundos a que el contenedor arranque.
4. Revisar logs: `docker compose logs --no-color`.
5. Comprobar que no hay errores (stack traces, login fallido, shards caídos,
   excepciones). Si los hay, corregir y repetir.
6. Limpiar: `docker compose down`.

Si no hay errores en el contenedor, se puede crear el commit.
