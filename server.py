# Servidor local de DG Studio (siempre entrega la versión más nueva de los archivos)
import http.server, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5517

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.ipynb': 'application/json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'DG Studio en http://localhost:{PORT}')
    httpd.serve_forever()
