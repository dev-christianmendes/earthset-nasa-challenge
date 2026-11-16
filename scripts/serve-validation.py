# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Servidor local de dist com gzip HTTP, sem cache, só para medições reproduzíveis."""
import gzip
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass

    def do_GET(self):
        path = Path(self.translate_path(unquote(urlsplit(self.path).path)))
        if path.is_file() and path.suffix in ['.js', '.css', '.html', '.json', '.gltf', '.svg'] and 'gzip' in self.headers.get('Accept-Encoding', ''):
            data = gzip.compress(path.read_bytes())
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(str(path)))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 5189), partial(Handler, directory='dist')).serve_forever()
