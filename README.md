EdgeOne Pages + KV File Storage (fixed)

- Functions are at functions/ root.
- Bind KV namespace to variable name: wj
- Publish directory: public
- Endpoints available (after deployment):
  - GET/POST /api/check_password
  - POST /api/upload
  - GET /api/list?dir=...
  - GET /api/download?path=...
  - POST /api/delete
  - GET/POST/DELETE /api/randomconfig
  - GET /api/random?dir=...&type=img|video

Notes:
- To have root path like /random without /api prefix, configure routing in EdgeOne or add a rewrite.
