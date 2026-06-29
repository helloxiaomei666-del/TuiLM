from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os


ROOT = Path(__file__).resolve().parent
LOG = ROOT / ".runtime" / "dev-static-server.log"
LOG.parent.mkdir(exist_ok=True)
os.chdir(ROOT)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        with LOG.open("a", encoding="utf-8") as handle:
            handle.write("%s - %s\n" % (self.address_string(), format % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the wealth-freedom-demo static server.")
    parser.add_argument("--host", default=os.environ.get("DEMO_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("DEMO_PORT", "8000")))
    args = parser.parse_args()

    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    with LOG.open("a", encoding="utf-8") as handle:
        handle.write(f"Serving http://{args.host}:{args.port}\n")
    server.serve_forever()
