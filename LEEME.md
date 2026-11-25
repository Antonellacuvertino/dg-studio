# DG Studio — by differentgyal

Estudio de producción musical en el teléfono o el PC, enfocado en **techno para DJ** (hard techno, techno latino, acid, rave…) y en **canciones con tu voz**.

**En el iPhone:** abre https://antonellacuvertino.github.io/dg-studio/ en Safari → Compartir → *Añadir a pantalla de inicio*.
**En el PC:** doble clic en `INICIAR.bat` (abre `http://localhost:5517`).

## Secciones
| | |
|---|---|
| ✍️ **Crear** | Escribe una letra (aunque sea corta) o graba/sube tu voz → canción completa: beat, voz cantada o rapeada, coros dobles, armonía, ecos y vocal chops. Duración: corta, normal, larga o **DJ extendida (~6 min)**. Edita la melodía sílaba por sílaba (🎼), graba encima del beat (con afinación opcional) y pasa todo al Estudio. |
| 🟥 **Estudio · modo fácil** | Como las tarjetas de "beat grids": eliges un estilo (Hard Techno, Techno Latino, Acid, House, Reggaetón, Trap, Boom bap…), ves una fila por instrumento con 16 casillas y un consejo. Tocas casillas, tocas el nombre de la fila para elegir el sonido en la **biblioteca** (▶ para escuchar) y exportas el loop o el tema completo. |
| 🎛️ **Estudio** | Proyectos con pistas de batería (pasos), sintetizadores (piano roll en la escala: siempre suena bien), sonidos propios, loops y voces. **Escenas** (Intro, Groove, Subida, Drop, Break, Outro) con efectos de build/drop. Mezcla por pista: volumen, paneo, filtro, resonancia, saturación, reverb, delay y **sidechain**. Exporta MP3, **WAV calidad DJ** (con BPM y clave Camelot en el nombre) o una escena como loop. Guía paso a paso "track techno para DJ". Todo se guarda solo. |
| 🎚️ **Mezcla (Multipista)** | Línea de tiempo con pistas de audio: junta el beat del Estudio, canciones de Crear, tu voz y cualquier archivo. Arrastra clips para moverlos, arrastra sus bordes para recortarlos, divide, duplica, entradas/salidas suaves, volumen, paneo, reverb, mute/solo, imán a tiempo, graba una pista nueva sobre la mezcla y exporta en MP3 o WAV. |
| 🔁 **Loops** | Biblioteca lista (bombos duros, rumbles, hats, percusión tribal, 6 líneas acid, stabs, hoover, pads, FX, latinos) que se adapta al BPM y tono del proyecto. Tus sonidos (sube o graba; detecta el BPM). **Recrear una canción**: detecta BPM, tonalidad, Camelot, batería y estilo, y arma un proyecto parecido o su versión hard techno / techno latino (sin copiar el audio). |
| 🎙️ **Editor de voz** (en 🎤 Voz) | Importa el audio de tu voz (notas de voz, MP3, WAV…) sin crear perfil: recorta, autotune con escala detectada, tono, color, quitar ruido, graves, brillo, compresión, reverb, eco y doble. Compara original/editada y mándala a la Multipista, guárdala o úsala en Crear. |
| ⏺️ **Grabadora** (en el Estudio) | Graba lo que suena, tu micrófono o ambos, con pausa y seguir. Luego escúchala, guárdala, expórtala o mándala a la Multipista. |
| 🎤 **Voz** | Crea tu voz (7 sonidos + 15 s de lectura). Ajustes: **Autotune** (natural → robot), tono, vibrato, humanizar, aire, coros, armonía, ad-libs, espacio. **Afinador real** para tus grabaciones (autotune a la escala, A/B original vs afinada). |
| 🐆 **Asistente** | Cuéntale lo que quieres ("hard techno oscuro a 150 para mi set") y te guía con botones que hacen las cosas por ti. Gratis y sin internet. Opcional: conectar Claude (IA de Anthropic) con tu propia clave de API (de pago por uso). |

17+ estilos: ⛓️ Hard Techno, 🔥 Techno Latino, 🏭 Techno, 🧪 Acid, 💥 Neo Rave, 🏗️ Industrial, 🥁 Hardgroove, 🌌 Melodic, House, EDM, Trap, Drill, Reggaetón, Dembow, Hip-Hop, Lo-Fi, R&B, Pop, Rock, Reggae, Dancehall, Afrobeat, Cumbia, Balada.

## 🧬 Pistas parecidas automáticas
Cada vez que subes una canción (en 🔁 Loops → Recrear o en ✍️ Crear), la app crea pistas parecidas a su BPM y tonalidad —bombo, caja/palmas, hats, percusión, bajo, acordes, melodía y beat completo— y las guarda al tiro en **Tus sonidos**. Se re-sintetizan: no se copia el audio original.

## 🎵 Biblioteca de sonidos
70+ sonidos: los "(DG)" los sintetiza la app y el resto son muestras de **dominio público (CC0)**: la TR-808 de Michael Fischer y percusión real de VCSL (bongós, congas, cajón, güiro, yunque, brake drum…). Puedes monetizar todo sin dar crédito. Detalle en `samples/LICENCIAS.txt`.

## 🎤 Tipos de voz
Mi voz natural · Mi voz + autotune · Voz normal · Otaku (anime) · Fina · Gruesa · Ronca · Susurro · Robot. Cambian tono, "color" (formantes), aire y textura; ▶ para escuchar antes de elegir.

## 🧬 Voz realista con IA (gratis, Google Colab)
La voz de la app tiene tu timbre pero suena sintética. Para que suene como tú de verdad: en ✍️ Crear → **🧬 Voz realista con IA** → descarga los archivos → en [colab.research.google.com](https://colab.research.google.com) *Archivo → Subir cuaderno* → `DG_Voz_IA.ipynb` → GPU (T4) → ejecuta → importa `voz_ia.wav`.
Usa Seed-VC (GPL-3.0): tus canciones son tuyas y puedes monetizarlas; si algún día vendes la app, Seed-VC debe seguir como herramienta aparte.

## Derechos
Los sonidos son sintetizados por la app o muestras de dominio público (CC0), así que puedes monetizar tus temas. Al recrear una canción solo se aprende su ritmo. El certificado de licencia prueba fecha y autoría; para protección legal completa registra tus obras en la oficina de derechos de autor de tu país.

## Datos
Proyectos, sonidos y tu voz se guardan **solo en tu dispositivo** (no se suben a internet). Si borras los datos de Safari se pierden: exporta tus temas.

## Versión beta (para productores que prueban la app)
- Link: `https://antonellacuvertino.github.io/dg-studio/beta/`. Solo muestra 🎛️ Estudio y 🔁 Loops (subir canciones y guardar sus sets incluido).
- `beta/index.html` y `manifest-beta.json` se generan con `python tools/make_beta.py`. Córrelo cada vez que cambies `index.html`.
