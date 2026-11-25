# Servidor local de DG Studio (siempre entrega la versión más nueva de los archivos)
import http.server, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5517

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.ipynb': 'application/json'}
    # Guardar archivos generados (solo en tu PC): POST /save?name=archivo.mp4 → promo/out/
    def do_POST(self):
        import os, re, urllib.parse
        q = urllib.parse.urlparse(self.path)
        if q.path != '/save':
            self.send_error(404); return
        name = re.sub(r'[^A-Za-z0-9_.-]', '_', urllib.parse.parse_qs(q.query).get('name', ['archivo.bin'])[0])[:80]
        n = int(self.headers.get('Content-Length', 0))
        os.makedirs(os.path.join('promo', 'out'), exist_ok=True)
        with open(os.path.join('promo', 'out', name), 'wb') as f:
            f.write(self.rfile.read(n))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'DG Studio en http://localhost:{PORT}')
    httpd.serve_forever()
