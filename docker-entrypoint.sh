#!/bin/sh
set -e

API_PORT="${MASSCODE_PORT:-4321}"
API_URL="${MASSCODE_API_URL:-/api}"
API_TOKEN="${MASSCODE_API_TOKEN:-}"

# Inject runtime config into the web build
cat > /usr/share/nginx/html/config.js << EOF
window.__MASSCODE_API_URL__ = "${API_URL}";
window.__MASSCODE_API_TOKEN__ = "${API_TOKEN}";
EOF

# Add config.js script tag to index.html if not already present
if ! grep -q 'config.js' /usr/share/nginx/html/index.html; then
  sed -i 's|</head>|<script src="./config.js"></script></head>|' /usr/share/nginx/html/index.html
fi

# Start nginx in background
nginx -g 'daemon off;' &

# Start Node.js API server in foreground
exec node build/server/server/index.js
