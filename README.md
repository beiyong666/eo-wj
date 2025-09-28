# EdgeOne Pages + KV File Storage (kv name: `wj`)
构建命令:
框架预设	Other
根目录	./
输出目录	public
编译命令	未设置
安装命令	未设置

This project stores uploaded files into KV as **base64 strings** for compatibility with KV bindings that accept strings.

**Important**
- Bind your KV namespace to the Functions environment with the binding name `wj`.
- Binary files are stored under key `file:<id>` as base64 string.
- Metadata under `meta:<id>` (JSON).
- Index under `index` (JSON array).

**Tradeoffs**
- Base64 increases size by ~33%. Watch your KV size limits.

