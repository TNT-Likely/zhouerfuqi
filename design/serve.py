"""设计稿预览服务器:强制 no-cache,避免浏览器启发式缓存吃掉迭代版本。"""
import http.server
import socketserver

PORT = 8375


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print(f"serving design at http://127.0.0.1:{PORT}/ (no-cache)")
        httpd.serve_forever()
