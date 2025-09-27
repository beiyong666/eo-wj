# EdgeOne Pages + KV File Storage (kv name: `wj`)

This project provides a simple file storage web UI that works with EdgeOne Pages (Pages + Functions) and a KV namespace named `wj`.

**Features**
- Upload files (stored in KV)
- List uploaded files with metadata
- Download files
- Delete files

**Structure**
```
/public
  index.html
  app.js
  style.css
/functions
  api
    upload.js      -> POST /api/upload  (multipart/form-data)
    list.js        -> GET  /api/list
    download.js    -> GET  /api/download?id=<id>
    delete.js      -> POST /api/delete (JSON { id })
README.md
```

**KV binding name**
Make sure you bind your KV namespace to the Functions environment with the binding **name** `wj` (lowercase), because the code expects `env.wj`.

If you are using EdgeOne Pages: follow EdgeOne/Pages documentation to add a KV namespace bound to the Pages Functions environment and name it `wj`.

If you are using Cloudflare Pages/Workers, use the appropriate `wrangler` / project configuration to bind a KV namespace and name it `wj`.

**Deploy notes**
- Files are stored as `file:<id>` (value = binary) and metadata as `meta:<id>` (value = JSON string).
- A single index list is kept under key `index` (JSON array of metadata objects).
- KV has limits on value size — large files may not be supported depending on your KV provider limits.

**Security**
This example does not require authentication. Add your own auth checks if needed.

**How to test locally**
- Deploy the public folder as static assets
- Ensure Functions are deployed to `/api/*` paths and have the `wj` KV bound

