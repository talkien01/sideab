# SIDEAB — Sistema Integral de Entrega a Beneficiarios

Sistema Offline-First con Portal Administrativo para gestión y auditoría de entregas de apoyos a beneficiarios.

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React + Vite + TypeScript + TailwindCSS (PWA) |
| Backend | Node.js + Express + SQLite |
| Autenticación | JWT con roles (ADMIN / OPERATOR) |
| Escaneo | html5-qrcode |
| Reportes | xlsx (generado en backend) |
| HTTPS Dev | @vitejs/plugin-basic-ssl |

## Ejecución Local

### Backend (puerto 3001)
```bash
cd backend
cp .env.example .env   # solo la primera vez
npm install
npm run start
```

### Frontend (puerto 5173 HTTPS)
```bash
cd frontend
npm install
npm run dev -- --host
```

Acceso: `https://localhost:5173`

> En la primera conexión desde móvil (`https://IP:5173`) acepta el aviso de certificado → **Avanzado → Continuar**.

## Credenciales de Prueba

| Usuario | ID | Contraseña | Rol |
|---------|-----|-----------|-----|
| Coordinador | `COORD01` | `admin1234` | ADMIN |
| Operador | `ADMIN01` | `12345678` | OPERATOR |

## Funcionalidades

### Portal Operativo (móvil)
- Login con rol diferenciado
- Escaneo QR con cámara nativa
- Captura obligatoria de evidencia fotográfica
- Sincronización offline con cola persistente

### Portal Administrativo
- **Resumen**: Dashboard con gráficas en tiempo real
- **Mesa de Control**:
  - Sub-vista *Padrón Completo* — todos los beneficiarios con estatus, filtros, orden por columna y exportación Excel
  - Sub-vista *Entregas Registradas* — historial con fotos, filtros por programa/fecha/nombre
- **Carga Masiva**: Importar padrón desde archivo CSV
- **Operadores**: CRUD de usuarios del sistema

## Formato CSV para Carga Masiva

```
folio,fullName,age,address,phone,programName
2026-0001,Juan Pérez García,65,Calle Principal 123,555-1234,Apoyo Alimentario
```

## Estructura del Proyecto

```
Beneficiarios_2026/
├── backend/
│   ├── index.ts          # API + lógica de BD
│   ├── .env.example      # Plantilla de variables de entorno
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Enrutamiento y autenticación
│   │   ├── AdminPanel.tsx    # Portal administrativo
│   │   ├── Scanner.tsx       # Módulo de campo (operador)
│   │   ├── api.ts            # Cliente HTTP
│   │   └── storage.ts        # Persistencia local
│   └── vite.config.ts        # HTTPS + proxy al backend
├── .gitignore
└── README.md
```

## Variables de Entorno (backend/.env)

```env
PORT=3001
JWT_SECRET=genera_uno_con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Despliegue en Producción

Ver el manual completo en la documentación del proyecto para instrucciones de despliegue en:
- **VPS Ubuntu 22.04** con Nginx + PM2 + Let's Encrypt
- **Hostinger con EasyPanel**
