# DG Studio — by differentgyal

Escribe una letra, graba tu voz o sube un audio, y la app produce la canción y te deja descargar el MP3.

## Cómo usarla en tu PC
Doble clic en **INICIAR.bat** → se abre `http://localhost:5517` en tu navegador (Chrome o Edge).
Necesita Python (ya lo tienes instalado). Para cerrarla, cierra la ventana negra.

## Qué hace
| Entrada | Lo que pasa |
|---|---|
| ✍️ **Letra** | Cuenta sílabas, detecta rimas (A, B, C…), coros (`[Coro]` o bloques repetidos) y palabras clave → elige estilo, tempo y tonalidad; arma intro / verso / coro / coro final / outro; te muestra la letra marcada a tiempo. |
| 🎤 **Tu voz** (grabada o subida) | Detecta tempo, tonalidad y si cantas o rapeas → le hace un beat a medida y mezcla tu voz (ecualizador, compresor, reverb). |
| 🎵 **Una canción** | Aprende su "ADN": BPM, tonalidad, patrón de batería y estilo; lo guarda. Luego eliges: beat para tu letra, para tu audio o una canción con ese ritmo. |
| 🥁 **Sonidos** (beatbox, palmas, golpes) | Separa bombo / caja / hi-hat, detecta el tempo y arma una batería **con tus propios sonidos**. |
| 🗣️ **Mi voz** | Grabas 7 sonidos (a, e, i, o, u, m, s) y la app guarda tu timbre en el dispositivo. Desde ahí canta o rapea cualquier letra escrita con tu voz (rap en Trap/Drill/Hip-Hop/Dembow, cantado en el resto). Sin perfil usa la "Voz DG" sintética. |
| 🎚️ **Elegir estilo** | Al grabar o subir tu voz o tus sonidos, eliges el estilo (o Auto). |
| 🎙️ **Grabar sobre el beat** | Suena el beat, la letra se va marcando y tu toma se mezcla automáticamente (usa audífonos). |
| ⬇️ **MP3** | 192 kbps con etiquetas: artista, título, © differentgyal, BPM, tonalidad. |
| 📜 **Licencia** | Certificado de autoría con fecha y huella SHA-256 del MP3. |

17 estilos: Techno, Trap, Drill, Reggaetón, Dembow, Hip-Hop, Lo-Fi, R&B, Pop, Rock, Reggae, Dancehall, Afrobeat, House, EDM, Cumbia, Balada.
Cada "🎲 Otro beat" genera una variación nueva (combinaciones prácticamente infinitas).

## 🧬 Voz realista con IA (gratis, Google Colab)
La voz de la app suena a tu timbre pero robótica. Para que suene como tú de verdad:
1. En 🗣️ **Mi voz** completa los 8 pasos (el último es leer un texto 15 segundos).
2. Crea una canción con tu letra → toca **🧬 Voz realista (IA)** → **Descargar voz guía + mi voz** y **Descargar cuaderno** (solo la primera vez).
3. Entra a [colab.research.google.com](https://colab.research.google.com) → *Archivo → Subir cuaderno* → `DG_Voz_IA.ipynb`.
   Elige *Entorno de ejecución → Cambiar tipo → GPU (T4)* y ejecuta las celdas. Sube `voz_guia.wav` y `mi_voz.wav` cuando te los pida.
4. Descarga `voz_ia.wav` → en la app, **📥 Importar voz IA** → descarga el MP3.

Usa el modelo **Seed-VC** (código y pesos GPL-3.0): las canciones que generes son tuyas y puedes monetizarlas.
Si algún día la app se vende en la App Store, Seed-VC debe quedarse como herramienta aparte (como ahora) y no meterse dentro de la app.

## Derechos y YouTube
Todos los sonidos se **sintetizan desde cero** en tu dispositivo: no hay samples de otras personas, así que el beat es tuyo.
Cuando subes una canción, la app solo aprende su ritmo y lo vuelve a sintetizar; nunca copia el audio original.
El certificado sirve como prueba de fecha, pero para tener protección legal completa registra tus canciones en la oficina de derechos de autor de tu país.

## Para el iPhone
El micrófono del iPhone solo funciona en páginas **https**, así que hay que publicar la app gratis (GitHub Pages, Netlify o Cloudflare Pages).
Después, en Safari: Compartir → **Añadir a pantalla de inicio**, y se abre como una app.

## App Store (cuando la apruebes)
1. Cuenta de Apple Developer: **USD 99 al año**.
2. Hace falta un **Mac con Xcode** (o un servicio de compilación en la nube) para empaquetarla con Capacitor.
3. Apple rechaza las apps que son solo una página web, así que conviene agregar funciones nativas (guardar en Archivos, compartir, etc.).
4. Puedes cobrar un precio de descarga o, mejor, ofrecer descarga gratis con suscripción o compras dentro de la app. Apple se queda con un 15–30 %.
