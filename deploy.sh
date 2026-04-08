#!/bin/bash
# =====================================================================
# SIDEAB — Script de Despliegue Automático en VPS Ubuntu 24.04
# Uso: bash deploy.sh
# =====================================================================
set -e

echo "======================================"
echo "  SIDEAB — Instalación en VPS"
echo "======================================"

# --- 1. Actualizar sistema ---
echo "[1/8] Actualizando sistema..."
apt update && apt upgrade -y

# --- 2. Instalar Node.js 20 ---
echo "[2/8] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# --- 3. Instalar PM2 y Nginx ---
echo "[3/8] Instalando PM2 y Nginx..."
npm install -g pm2
apt install -y nginx

# --- 4. Instalar Certbot (SSL) ---
echo "[4/8] Instalando Certbot..."
apt install -y certbot python3-certbot-nginx

# --- 5. Clonar repositorio ---
echo "[5/8] Clonando repositorio SIDEAB..."
mkdir -p /var/www
cd /var/www
rm -rf sideab
git clone https://github.com/talkien01/sideab.git
cd sideab

# --- 6. Configurar Backend ---
echo "[6/8] Configurando backend..."
cd /var/www/sideab/backend
npm install

# Generar JWT_SECRET seguro automáticamente
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cat > .env << EOF
PORT=3001
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
EOF

echo "✓ JWT_SECRET generado: ${JWT_SECRET}"
echo "  (Guarda este valor en un lugar seguro)"

# Crear directorio de uploads
mkdir -p uploads

# Instalar ts-node globalmente para producción
npm install -g ts-node typescript

# --- 7. Build del Frontend ---
echo "[7/8] Construyendo frontend..."
cd /var/www/sideab/frontend
npm install
# Configurar API URL para producción (relativa, sin hardcode)
npm run build

# --- 8. Configurar Nginx ---
echo "[8/8] Configurando Nginx..."

HOSTNAME=$(hostname -f)
SERVER_IP=$(curl -s ifconfig.me)

cat > /etc/nginx/sites-available/sideab << NGINX_EOF
server {
    listen 80;
    server_name ${SERVER_IP} ${HOSTNAME};

    # Frontend (archivos estáticos)
    location / {
        root /var/www/sideab/frontend/dist;
        try_files \$uri /index.html;
        add_header Cache-Control "no-cache";
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 20M;
    }

    # Fotos de evidencia
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
    }
}
NGINX_EOF

# Activar sitio
ln -sf /etc/nginx/sites-available/sideab /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# --- Iniciar Backend con PM2 ---
echo "Iniciando backend con PM2..."
cd /var/www/sideab/backend
pm2 start "npx ts-node index.ts" --name sideab-api
pm2 startup
pm2 save

echo ""
echo "======================================"
echo "  SIDEAB instalado exitosamente!"
echo "======================================"
echo ""
echo "  URL: http://${SERVER_IP}"
echo "  URL: http://${HOSTNAME}"
echo ""
echo "  Backend: PM2 (sideab-api)"
echo "  Frontend: Nginx"
echo ""
echo "  Credenciales iniciales:"
echo "  Admin:    COORD01 / admin1234"
echo "  Operador: ADMIN01 / 12345678"
echo ""
echo "  IMPORTANTE: Cambia las contraseñas después del primer login"
echo ""
echo "  Para SSL con dominio propio:"
echo "  certbot --nginx -d tudominio.com"
echo "======================================"
