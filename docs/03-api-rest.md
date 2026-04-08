# 03 - Especificación API REST

## Información General

| Aspecto | Valor |
|---------|-------|
| **Base URL** | `https://api.beneficios.institucion.gob.mx/v1` |
| **Protocolo** | HTTPS obligatorio (TLS 1.3) |
| **Formato** | JSON |
| **Autenticación** | JWT Bearer Token |
| **Rate Limit** | 1000 requests/hora por usuario |
| **Charset** | UTF-8 |

---

## Autenticación

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "device_id": "string (opcional)",
  "device_info": {
    "model": "Samsung Galaxy A52",
    "os": "Android 13",
    "app_version": "1.2.0"
  }
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "usuario": {
      "id": "uuid",
      "username": "juan.perez",
      "nombre": "Juan Pérez",
      "rol": "operador",
      "permisos": ["entregas.crear", "beneficiarios.consultar"]
    }
  }
}
```

**Respuestas Error:**
- `401 Unauthorized`: Credenciales inválidas
- `403 Forbidden`: Usuario bloqueado o sin permisos
- `429 Too Many Requests`: Demasiados intentos fallidos

### Refresh Token

```http
POST /auth/refresh
Authorization: Bearer {refresh_token}
```

### Logout

```http
POST /auth/logout
Authorization: Bearer {access_token}
```

---

## Beneficiarios

### Listar Beneficiarios

```http
GET /beneficiarios
Authorization: Bearer {token}

Query Parameters:
- page: número de página (default: 1)
- limit: registros por página (default: 50, max: 500)
- programa_id: filtrar por programa
- zona_id: filtrar por zona
- estatus: aprobado | no_aprobado | pendiente | entregado
- search: búsqueda por nombre, folio o teléfono
- fecha_corte: sincronizar solo cambios desde fecha (ISO 8601)
```

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "beneficiarios": [
      {
        "id": "uuid",
        "folio": "BEN-2026-001234",
        "nombre_completo": "María García López",
        "edad": 45,
        "domicilio": "Calle Principal #123, Col. Centro",
        "telefono": "5512345678",
        "programa": {
          "id": "uuid",
          "nombre": "Programa de Apoyo Social"
        },
        "estatus_aprobacion": "aprobado",
        "estatus_operativo": "pendiente_entrega",
        "folio_qr_data": "base64_encoded_data",
        "checksum_qr": "a1b2c3d4...",
        "es_entregado": false,
        "foto_url": "https://...",
        "version_local": 1,
        "fecha_carga": "2026-04-08T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1250,
      "total_pages": 25
    },
    "version_bd": "2026-04-08-080000"
  }
}
```

### Obtener Beneficiario por Folio

```http
GET /beneficiarios/{folio}
Authorization: Bearer {token}
```

### Validar QR

```http
POST /beneficiarios/validar-qr
Authorization: Bearer {token}
Content-Type: application/json

{
  "qr_data": "string_base64",
  "device_timestamp": "2026-04-08T14:30:00Z"
}
```

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "valido": true,
    "beneficiario": {
      "id": "uuid",
      "folio": "BEN-2026-001234",
      "nombre_completo": "María García López",
      "estatus_aprobacion": "aprobado",
      "estatus_operativo": "pendiente_entrega",
      "puede_entregar": true,
      "motivo_bloqueo": null
    },
    "validaciones": {
      "checksum_valido": true,
      "no_duplicado": true,
      "aprobado": true,
      "pendiente_entrega": true
    }
  }
}
```

---

## Entregas

### Registrar Entrega

```http
POST /entregas
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "beneficiario_id": "uuid",
  "jornada_id": "uuid (opcional)",
  "fecha_device": "2026-04-08T14:30:00Z",
  "latitud": 19.4326,
  "longitud": -99.1332,
  "metadatos": {
    "device_id": "device-uuid",
    "app_version": "1.2.0",
    "os_version": "Android 13"
  },
  "evidencias": [
    {
      "tipo": "foto_beneficiario",
      "archivo": <binary_file>,
      "metadatos_json": {...}
    }
  ]
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "data": {
    "entrega_id": "uuid",
    "folio": "BEN-2026-001234",
    "estatus": "completada",
    "fecha_registro": "2026-04-08T14:30:05Z",
    "hash_verificacion": "sha256_hash",
    "evidencias_procesadas": [
      {
        "id": "uuid",
        "url": "https://storage.../evidencia.jpg",
        "thumbnail_url": "https://storage.../evidencia_thumb.jpg",
        "hash_sha256": "hash_del_archivo"
      }
    ]
  }
}
```

**Respuestas Error:**
- `400 Bad Request`: Datos inválidos o faltantes
- `409 Conflict`: Beneficiario ya tiene entrega registrada
- `403 Forbidden`: Beneficiario no aprobado
- `422 Unprocessable`: Validación de negocio fallida

### Obtener Entrega

```http
GET /entregas/{id}
Authorization: Bearer {token}
```

### Listar Entregas

```http
GET /entregas
Authorization: Bearer {token}

Query Parameters:
- operador_id: filtrar por operador
- jornada_id: filtrar por jornada
- fecha_inicio: fecha desde (ISO 8601)
- fecha_fin: fecha hasta (ISO 8601)
- estatus: completada | observada | rechazada
```

### Batch de Entregas (Sync Offline)

```http
POST /entregas/batch
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "entregas": [
    {
      "temporal_id": "local-uuid-1",
      "beneficiario_id": "uuid",
      "fecha_device": "2026-04-08T10:00:00Z",
      "latitud": 19.4326,
      "longitud": -99.1332,
      "hash_local": "sha256_local"
    }
  ],
  "evidencias": [
    {
      "temporal_id": "local-evidencia-1",
      "entrega_temporal_id": "local-uuid-1",
      "tipo": "foto_beneficiario",
      "archivo": <binary_file>,
      "hash_local": "sha256_archivo"
    }
  ]
}
```

**Respuesta (207 Multi-Status):**
```json
{
  "success": true,
  "data": {
    "procesadas": 45,
    "exitosas": 43,
    "errores": 2,
    "resultados": [
      {
        "temporal_id": "local-uuid-1",
        "estatus": "creada",
        "entrega_id": "server-uuid-1"
      },
      {
        "temporal_id": "local-uuid-2",
        "estatus": "error",
        "error": "Beneficiario ya tiene entrega",
        "codigo": "DUPLICADO"
      }
    ]
  }
}
```

---

## Sincronización

### Obtener Cambios desde Última Sync

```http
GET /sync/cambios
Authorization: Bearer {token}

Query Parameters:
- ultima_version: versión local (ej: "2026-04-08-080000")
- zona_id: zona operativa del dispositivo
- limit: máximo registros (default: 1000)
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "nueva_version": "2026-04-08-120000",
    "cambios": {
      "beneficiarios": {
        "insertados": [...],
        "actualizados": [...],
        "eliminados": [...]
      }
    },
    "has_more": false,
    "total_cambios": 150
  }
}
```

### Subir Cambios Locales

```http
POST /sync/subir
Authorization: Bearer {token}
Content-Type: application/json

{
  "device_id": "device-uuid",
  "version_local": "2026-04-08-080000",
  "cambios": {
    "entregas": [...],
    "incidencias": [...]
  }
}
```

### Estado de Sincronización

```http
GET /sync/estado/{device_id}
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "device_id": "uuid",
    "ultima_sync": "2026-04-08T12:00:00Z",
    "version_bd_actual": "2026-04-08-120000",
    "registros_pendientes": 0,
    "estatus": "sincronizado"
  }
}
```

---

## Incidencias

### Crear Incidencia

```http
POST /incidencias
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "beneficiario_id": "uuid",
  "tipo_id": "uuid",
  "descripcion": "QR ilegible, beneficiario presenta folio físico",
  "gravedad": "media", // baja, media, alta, critica
  "latitud": 19.4326,
  "longitud": -99.1332,
  "evidencias": [<archivos>]
}
```

### Listar Tipos de Incidencia

```http
GET /incidencias/tipos
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "codigo": "QR_ILEGIBLE",
      "nombre": "QR no legible",
      "descripcion": "El código QR no puede escanearse",
      "requiere_foto": true,
      "estatus": "activo"
    },
    {
      "id": "uuid",
      "codigo": "BENEFICIARIO_NO_LOCALIZADO",
      "nombre": "Beneficiario no localizado",
      "descripcion": "El beneficiario no se presentó",
      "requiere_foto": false,
      "estatus": "activo"
    }
  ]
}
```

---

## Reportes

### Resumen de Entregas

```http
GET /reportes/resumen-entregas
Authorization: Bearer {token}

Query Parameters:
- jornada_id: filtrar por jornada
- programa_id: filtrar por programa
- zona_id: filtrar por zona
- fecha_inicio: fecha desde
- fecha_fin: fecha hasta
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "total_beneficiarios": 5000,
    "entregas_completadas": 3250,
    "entregas_pendientes": 1750,
    "entregas_por_programa": [
      {
        "programa": "Programa Social A",
        "total": 3000,
        "entregados": 2100,
        "pendientes": 900
      }
    ],
    "entregas_por_operador": [
      {
        "operador": "Juan Pérez",
        "entregas": 150
      }
    ],
    "incidencias_reportadas": 25
  }
}
```

### Exportar Datos

```http
POST /reportes/exportar
Authorization: Bearer {token}
Content-Type: application/json

{
  "tipo": "entregas", // entregas | beneficiarios | incidencias
  "formato": "xlsx", // csv | xlsx | pdf
  "filtros": {
    "jornada_id": "uuid",
    "fecha_inicio": "2026-04-01",
    "fecha_fin": "2026-04-08"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "download_url": "https://storage.../reporte.xlsx",
    "expires_at": "2026-04-08T15:00:00Z",
    "registros": 3250
  }
}
```

---

## Códigos de Error

| Código | HTTP | Descripción |
|--------|------|-------------|
| AUTH_001 | 401 | Token inválido o expirado |
| AUTH_002 | 403 | Permisos insuficientes |
| AUTH_003 | 429 | Demasiados intentos de login |
| VAL_001 | 400 | Datos de entrada inválidos |
| VAL_002 | 422 | Validación de negocio fallida |
| BEN_001 | 404 | Beneficiario no encontrado |
| BEN_002 | 409 | Beneficiario ya entregado |
| BEN_003 | 403 | Beneficiario no aprobado |
| ENT_001 | 409 | Entrega duplicada detectada |
| ENT_002 | 422 | Evidencia requerida faltante |
| SYNC_001 | 409 | Conflicto de sincronización |
| SYNC_002 | 422 | Versión de datos obsoleta |

---

## Headers Estándar

### Request Headers Requeridos

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
X-Device-ID: {device_uuid}
X-App-Version: 1.2.0
X-Platform: android | ios
```

### Response Headers

```
X-Request-ID: uuid-unico-para-tracing
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1699999999
```

---

## Rate Limiting

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| /auth/login | 5 | 15 minutos |
| /auth/refresh | 10 | 1 hora |
| /beneficiarios/* | 100 | 1 minuto |
| /entregas | 60 | 1 minuto |
| /sync/* | 30 | 1 minuto |
| Otros | 1000 | 1 hora |

---

*Documento 03 - API REST*
*Versión: 1.0*
