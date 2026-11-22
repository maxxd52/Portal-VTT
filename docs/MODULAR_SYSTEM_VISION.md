# Visión y Especificación: Arquitectura de Módulos de Reglas y `.baul`

Este documento resume las decisiones de producto y diseño acordadas para unificar la VTT alrededor del **Sistema Genérico** como único motor. No impone detalles de implementación técnica (que quedan a criterio del agente/arquitecto en la próxima sesión), sino **el qué y el porqué** sin ambigüedades.

---

## 1. Visión de Producto (Comercial + IA)

El proyecto apunta a una herramienta comercial con dos niveles claros:

- **Versión Free**: Incluye los **Módulos de Reglas cerrados** (listos para jugar, con su ficha, reglas, pantalla del DJ, baúl y diario inicial). Además, un usuario Free **puede importar y jugar de forma completa cualquier `.system` creado por un usuario Pro**, manteniendo bloqueada únicamente su edición estructural. Puede jugar, usar el Baúl y adaptar su Pantalla del DJ, pero no modificar la estructura base del sistema.
- **Versión Pro**: Desbloquea el **Sistema Genérico** como herramienta de autoría para diseñar sistemas desde cero, editar su estructura visualmente y exportar nuevos módulos.
- **Flujo asistido por IA**: Al basar todo en un único formato declarativo de módulo (JSON), una IA puede leer un manual de rol (PDF) y generar el módulo completo —o expansiones de contenido en `.baul`— sin tocar código de la VTT.

---

## 2. Decisión de Base Limpia (Eliminar sistemas actuales)

- Estamos en etapa de pruebas y **no es necesario migrar ni mantener retrocompatibilidad** con los presets actuales (`dnd55`, `pbta`, `pool`, `d100`, ni la versión actual de `vieja_escuela`).
- **Decisión**: Eliminar los sistemas predefinidos actuales y toda la lógica/ramas especiales acopladas a ellos (ej. renderizador dual de fichas, casos especiales por `preset`), dejando **únicamente al Sistema Genérico** como motor central y punto de partida.
- Una vez limpia y adaptada la base, los sistemas de reglas (como *Vieja Escuela* u otros) se crearán nuevamente como **módulos puros** sobre ese motor.

---

## 3. Reglas de Bloqueo vs Libertad en un Portal

Al crear una partida nueva a partir de un **Módulo de Reglas**:

- El portal se inicializa con todo el paquete del módulo: reglas, ficha, estética, Pantalla del DJ, Baúl y Diario inicial.
- **Ficha y Reglas base — BLOQUEADAS**: No se pueden agregar pestañas nuevas ni alterar bloques estructurales; solo se permiten opciones/switches seguros (activar/desactivar elementos previstos por el sistema).
- **Pantalla del DJ — LIBRE**: Incluso en módulos cerrados, el narrador parte de la Pantalla del módulo pero puede agregar, editar o quitar relojes, tablas, notas y tarjetas propias, ya que es su mesa de trabajo privada y no rompe el contrato de las fichas.
- **Baúl (Compendio) — EXTENSIBLE**: Los elementos base del módulo quedan intactos, pero el DJ puede agregar contenido propio, duplicar elementos base para editarlos e importar/exportar baúles.

En el **Sistema Genérico (Pro)**, la estructura de ficha y reglas también es libre y exportable como módulo.

---

## 4. El Sistema Genérico como Motor Único (y UX estilo Apple)

Todo sistema nuevo debe poder expresarse usando únicamente las herramientas y bloques del Sistema Genérico. Esto implica que el Genérico debe cubrir (o ampliarse para cubrir) lo que hoy requería código especial, manteniendo la interfaz simple:

### Capacidades mecánicas necesarias
- **Mantener solo 3 bloques fundamentales (`Número`, `Recurso`, `Texto`)**: No agregar un 4° tipo de bloque para conservar la simplicidad conceptual.
- **Extender `Texto` (modo `tags` / lista)**: Hoy solo guarda texto plano por línea; extenderlo para que cada ítem de la lista pueda llevar opcionalmente un valor numérico, nota o tirada propia (ideal para Trasfondos, Rasgos o Habilidades dinámicas).
- **Fórmulas y tablas**: Soportar aritmética y también tablas/tramos de valores (ej. modificadores de atributo por rango como en *Vieja Escuela*).
- **Ventaja / Desventaja adaptable por sistema**: Permitir declarar si la ventaja/desventaja del sistema funciona tirando 2 dados (`2d20` mayor/menor), sumando/restando dados a una reserva (`+1d` / `-1d`), o aplicando un modificador numérico fijo (`+2` / `-2`).
- **Iniciativa en 3 modos**: Configurable por sistema como **tirada** (`1d20+@des`), **valor directo de un bloque** (`@des` en *Vieja Escuela*) o **narrativa / sin orden fijo** (tipo *PbtA*).
- **Críticos y Pifias flexibles**: Poder configurar la regla de crítico/pifia del módulo (ej. `20` natural, rango `19–20`, dobles en `d100`, o `12+` en `2d6`).
- **Estados propios del módulo**: Incluir `statusesSchema` dentro del `.system` para que cada juego defina sus propias condiciones (ej. *Paralizado*, *Enloquecido*, *Aturdido*).
- **Identidad visual / Estética del módulo**: El módulo debe poder configurar la estética del portal de forma consistente (paleta/tema, colores de acento, estilo visual) sin inyectar código arbitrario inseguro.

### Mejoras de UX/UI en el Constructor (Divulgación Progresiva)
- **Básico visible vs `▸ Opciones avanzadas`**: Dejar arriba solo lo esencial de cada bloque (Nombre, qué hace al clic / máximo y visual, tamaño) y ocultar bajo `▸ Avanzado` los ajustes finos (`Ocultar valor`, `Signo +`, `Marca/Check`, `Sufijo`, lectura de tirada por bloque, `Usar para Iniciativa` y clave `@...`).
- **Lenguaje natural**: Reemplazar jerga técnica (`Calc (fx)`, `Sufijo`, `@key`) por etiquetas claras para jugadores/DJs y autogenerar la clave interna desde el nombre.
- **Herencia por defecto**: Que los bloques hereden la regla de tirada del sistema sin repetir ese selector a la vista en cada bloque.
- **Duplicar bloque (`⧉`)**: Permitir clonar un bloque ya configurado para crear atributos o habilidades similares en segundos.
- **Plantillas de inicio rápido**: Ofrecer 3–4 bases mínimas (*En blanco*, *Base 1d20*, *Base 2d6*, *Reserva d10*) al crear un sistema nuevo en Pro.

---

## 5. Formato `.baul` (Baúl Portable) y Duplicado de Base

### Archivo `.baul`
- El Baúl de una partida (fichas, complementos, mapas y carpetas) debe poder **exportarse e importarse** en un archivo con extensión propia **`.baul`** (JSON interno con formato identificado) para no confundirse con un `.json` genérico ni con un portal entero.
- Debe incluir la **identificación del sistema** (`systemId` / nombre del sistema) al que pertenece:
  - Si coincide con el sistema de la mesa actual, se importa directo.
  - Si no coincide, se muestra un **aviso claro** al usuario advirtiendo la diferencia de sistema y dándole la opción de importar igual (no bloquear de forma rígida).
- La importación debe fusionar como contenido propio sin sobrescribir ni romper los elementos base del módulo.

### "Duplicar para editar" en todo el Baúl
- Actualmente solo las fichas (actores) permiten duplicarse para editar.
- **Requerimiento**: Extender **"Duplicar para editar"** a **las 3 pestañas del Baúl** (Fichas, Complementos y Escenarios/Mapas), para que el DJ pueda tomar cualquier elemento base del módulo, clonarlo como copia editable y modificarlo sin empezar desde cero.

---

## 6. Clonar / "Hackear" Módulos Cerrados (Pro)

Como todos los módulos cerrados corren sobre el mismo esquema del Sistema Genérico, la única diferencia con un sistema editable es el bloqueo de estructura:

- **Desbloquear como base editable**: Un usuario **Pro** puede tomar cualquier módulo cerrado (ej. *Vieja Escuela* o *5.5e*) al crear un portal —o desde un portal ya abierto— y convertirlo en un sistema editable propio ("Hacer Hack").
- **Sin conversión compleja**: Se clona el módulo completo (reglas, bloques, estética, Pantalla del DJ, Baúl y Diario) y simplemente se habilita el editor del Genérico sobre esa copia, manteniendo intacto el módulo original.
- **Compatibilidad heredada con `.baul`**: El hack conserva una referencia al sistema padre (`parentSystemId`), de modo que los archivos `.baul` creados para el sistema original sigan siendo compatibles sin fricción.

---

## 7. Formatos de Archivo y Capas Intercambiables

Para evitar confusiones entre partidas, contenido y reglas, se manejan **3 formatos diferenciados**:

1. **`.portal`** *(ya existente)*: Partida/campaña completa en curso (tokens en tablero, niebla explorada, chat, notas de sesión, diario).
2. **`.baul`**: Paquete portable de contenido (fichas, complementos, mapas y carpetas) etiquetado con su `systemId`.
3. **`.system`** *(plantilla limpia de módulo)*: Exporta únicamente el sistema de reglas limpio (reglas, ficha, estética, Pantalla del DJ base y Baúl base con mapas limpios), **descartando todo dato de partida** (sin tokens en tablero, niebla, chat ni notas de sesión). Permite crear una mesa nueva y cargarle ese `.system` para obtener un clon limpio de un sistema o hack propio.

### Versionado y sincronización P2P
- **Versionado de esquema (`schemaVersion`)**: Tanto `.system` como `.baul` deben incluir `schemaVersion: 1` desde el inicio para garantizar compatibilidad futura si el Sistema Genérico suma nuevos campos.
- **Sincronización automática con invitados**: La VTT ya sincroniza `systemConfig` y `sheetSchema` por P2P en `extractSerializableWorld` ([selector.js](file:///c:/Users/malon/Desktop/Proyectos%20de%20codigo/VTTonepage/js/core/selector.js#L1314-L1316)). Al guardar también la **estética del módulo dentro de `systemConfig`**, los jugadores invitados recibirán ficha, reglas, estados y estética del `.system` automáticamente al entrar por enlace, sin instalar nada.

### Capas intercambiables y recuperación
- **Estética y Pantalla del DJ intercambiables**: Al correr todo sobre el Sistema Genérico, se debe poder aplicar la **estética** de un módulo sobre las reglas de otro (ej. jugar *D&D* con estética de *Vampiro*), o importar/compartir únicamente una **Pantalla del DJ**.
- **Restaurar base del módulo**: Opción simple para revertir la Pantalla del DJ (o las reglas en un hack) a los valores originales del módulo sin perder las fichas ni el Baúl propio.

---

## 8. Orden Sugerido para la Próxima Sesión

1. **Limpieza al Genérico único**: Retirar los presets actuales y sus ramas especiales, dejando el motor único del Sistema Genérico con la suite de tests en verde.
2. **Baúl y Pantalla**: Asegurar Pantalla del DJ libre, "Duplicar para editar" en Fichas/Complementos/Escenarios y soporte de exportar/importar `.baul`.
3. **Esquema de Módulo Único + Ampliaciones del Genérico**: Definir el contrato único de módulo (reglas, ficha, estética, pantalla, baúl, diario) y ampliar el Genérico con las piezas faltantes para re-crear *Vieja Escuela* (y futuros sistemas) como módulos puros.
