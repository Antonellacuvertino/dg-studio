# Genera beta/index.html a partir de index.html (correr después de cambiar index.html):
#   python tools/make_beta.py
# La beta usa el mismo código, pero solo muestra Estudio y Loops (window.DG_BETA).
import json, os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

def sub(s, a, b):
    if a not in s: sys.exit(f'no encontré: {a}')
    return s.replace(a, b, 1)

s = sub(src, '<head>\n', '<head>\n  <base href="../">\n  <script>window.DG_BETA = true;</script>\n')
s = sub(s, '<title>DG Studio</title>', '<title>DG Studio Beta</title>')
s = sub(s, '<link rel="manifest" href="manifest.json">', '<link rel="manifest" href="manifest-beta.json">')
s = sub(s, '<meta name="apple-mobile-web-app-title" content="DG Studio">', '<meta name="apple-mobile-web-app-title" content="DG Beta">')
s = s.replace('<!doctype html>', '<!doctype html>\n<!-- GENERADO por tools/make_beta.py: no editar a mano -->', 1)
os.makedirs(os.path.join(root, 'beta'), exist_ok=True)
open(os.path.join(root, 'beta', 'index.html'), 'w', encoding='utf-8', newline='\n').write(s)

m = json.load(open(os.path.join(root, 'manifest.json'), encoding='utf-8'))
m.update({'name': 'DG Studio Beta — differentgyal', 'short_name': 'DG Beta', 'start_url': './beta/', 'id': './beta/',
          'description': 'Beta de DG Studio: Estudio y Loops.'})
json.dump(m, open(os.path.join(root, 'manifest-beta.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print('beta/index.html y manifest-beta.json listos')
