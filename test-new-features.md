# Pruebas de las Nuevas Funcionalidades de Gemini CLI

## 1. Clear Input on CTRL+C (PR #1729)

**Cómo probar:**

1. Ejecuta Gemini CLI: `npm start`
2. Escribe algo de texto en el prompt
3. Presiona CTRL+C
4. **Resultado esperado:** El texto debe borrarse y el cursor debe volver al inicio

## 2. Save Dialog Before Exit (PR #1732)

### Prueba 1: Diálogo de guardado normal

1. Ejecuta: `npm start`
2. Escribe un comando que genere una respuesta del modelo (ej: "Hola, ¿cómo estás?")
3. Espera la respuesta
4. Escribe `/quit` o `/exit`
5. **Resultado esperado:** Debe aparecer un diálogo preguntando si quieres guardar el chat

### Prueba 2: Skip con variable de entorno

1. Ejecuta: `GEMINI_SKIP_SAVE_PROMPT=true npm start`
2. Interactúa con el modelo
3. Escribe `/quit`
4. **Resultado esperado:** Debe salir sin preguntar

### Prueba 3: Skip con flag CLI

1. Ejecuta: `npm start -- --no-save-prompt`
2. Interactúa con el modelo
3. Escribe `/quit`
4. **Resultado esperado:** Debe salir sin preguntar

### Prueba 4: Modo no interactivo

1. Ejecuta: `echo "¿Cuál es la capital de Francia?" | npm start -- --prompt "Responde brevemente"`
2. **Resultado esperado:** Debe responder y salir sin preguntar

## 3. System Prompts Mejorados (PR #1734)

### Prueba de comandos no interactivos

1. Ejecuta: `npm start`
2. Pide al modelo que ejecute comandos largos, por ejemplo:
   - "Ejecuta un servidor web simple con Python"
   - "Muestra el estado de git y luego haz un commit"
3. **Resultado esperado:**
   - El modelo debe sugerir usar flags no interactivas
   - Para comandos largos, debe sugerir usar `timeout`
   - Ejemplo: `timeout 30 python -m http.server 8080`

## 4. Comandos para probar todo junto

```bash
# Prueba 1: Modo interactivo normal
npm start

# Prueba 2: Sin diálogo de guardado (env var)
GEMINI_SKIP_SAVE_PROMPT=true npm start

# Prueba 3: Sin diálogo de guardado (CLI flag)
npm start -- --no-save-prompt

# Prueba 4: Modo no interactivo
echo "¿Qué es Node.js?" | npm start -- --prompt "Explica brevemente"

# Prueba 5: Con timeout en comandos
npm start -- --prompt "Muestra cómo ejecutar un servidor HTTP con timeout"
```

## Notas

- El diálogo de guardado solo aparece si hay respuestas del modelo
- En modo no interactivo (pipe) nunca aparece el diálogo
- Los prompts del sistema ahora incluyen mejores prácticas para comandos no interactivos
