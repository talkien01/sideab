# 02 - Modelo de Datos

## Diagrama Entidad-Relación

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    MODELO DE DATOS                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│    USUARIOS         │       │      JORNADAS       │       │  ZONAS_OPERATIVAS   │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ PK id               │       │ PK id               │       │ PK id               │
│    username         │       │    nombre           │       │    nombre           │
│    email            │       │    fecha_inicio     │       │    descripcion      │
│    password_hash    │       │    fecha_fin        │       │    poligono_geojson │
│    rol              │       │    estatus          │       │    estatus          │
│    telefono         │◄──────┤ FK zona_id          │◄──────┤    fecha_creacion   │
│    estatus          │       │ FK supervisor_id    │       └─────────────────────┘
│    ultimo_acceso    │       │    estatus_sync     │
│    fecha_creacion   │       │    version_bd       │
└─────────────────────┘       │    fecha_creacion   │
         │                    └─────────────────────┘
         │                             │
         │                             │
         │                    ┌────────▼────────┐
         │                    │  DISPOSITIVOS   │
         │                    ├─────────────────┤
         │                    │ PK id           │
         │                    │    uuid         │
         │                    │    modelo       │
         └───────────────────►│ FK usuario_id   │
                              │    estatus      │
                              │    ultima_sync  │
                              └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                       BENEFICIARIOS                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│   BENEFICIARIOS     │       │  BENEFICIARIO_FOTOS │       │ HISTORIAL_ESTATUS   │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ PK id               │       │ PK id               │       │ PK id               │
│    folio            │◄──────┤ FK beneficiario_id  │◄──────┤ FK beneficiario_id  │
│    nombre_completo  │       │    tipo             │       │    estatus_anterior │
│    edad             │       │    url              │       │    estatus_nuevo    │
│    domicilio        │       │    fecha_captura    │       │    motivo           │
│    telefono         │       │    estatus_sync     │       │    usuario_cambio   │
│    programa_id      │       │    hash_verificacion│       │    fecha_cambio     │
│    estatus_aprobacion│      └─────────────────────┘       │    fecha_registro   │
│    estatus_operativo│                                    └─────────────────────┘
│    folio_qr_data    │
│    checksum_qr      │
│    es_entregado     │       ┌─────────────────────┐
│    fecha_entrega    │       │     PROGRAMAS       │
│    latitud          │       ├─────────────────────┤
│    longitud         │       │ PK id               │
│    zona_id          │◄──────┤    nombre           │
│    estatus_sync     │       │    descripcion      │
│    version_local     │       │    requisitos       │
│    fecha_carga      │       │    estatus          │
│    fecha_modificacion│      │    fecha_creacion   │
└─────────────────────┘       └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                      ENTREGAS                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│     ENTREGAS        │       │ EVIDENCIAS_ENTREGA  │       │  ENTREGA_REVISION   │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ PK id               │◄──────┤ PK id               │       │ PK id               │
│ FK beneficiario_id  │       │ FK entrega_id       │◄──────┤ FK entrega_id       │
│ FK operador_id      │       │    tipo             │       │    tipo_revision    │
│ FK jornada_id       │       │    url_original     │       │    resultado        │
│    fecha_registro   │       │    url_thumbnail    │       │    observaciones    │
│    fecha_device     │       │    hash_sha256      │       │    supervisor_id    │
│    latitud          │       │    metadatos_json   │       │    fecha_revision   │
│    longitud         │       │    fecha_captura    │       │    estatus          │
│    estatus          │       │    estatus_validacion│      └─────────────────────┘
│    metadatos_json   │       │    fecha_validacion │
│    estatus_sync     │       │    validador_id     │
│    hash_registro    │       └─────────────────────┘
│    requiere_revision│
│    motivo_revision  │
│    fecha_creacion   │
└─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    INCIDENCIAS                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│    INCIDENCIAS      │       │ INCIDENCIA_EVIDENCIA│       │   TIPO_INCIDENCIA   │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ PK id               │◄──────┤ PK id               │       │ PK id               │
│ FK beneficiario_id  │       │ FK incidencia_id    │◄──────┤    codigo           │
│ FK tipo_id          │◄──────┤ FK evidencia_id     │       │    nombre           │
│ FK reportado_por    │       │    fecha_asociacion │       │    descripcion      │
│    descripcion      │       │    estatus          │       │    requiere_foto    │
│    gravedad         │       └─────────────────────┘       │    estatus          │
│    estatus          │                                   └─────────────────────┘
│    resolucion       │
│    resuelto_por     │       ┌─────────────────────┐
│    fecha_resolucion │       │    AUDITORIA_LOG    │
│    latitud          │       ├─────────────────────┤
│    longitud         │       │ PK id               │
│    estatus_sync     │       │    tabla_afectada   │
│    fecha_creacion   │       │    registro_id      │
└─────────────────────┘       │    accion           │
                              │    datos_anteriores │
┌─────────────────────┐       │    datos_nuevos     │
│  SYNC_QUEUE (Local) │       │    usuario_id       │
├─────────────────────┤       │    dispositivo_id   │
│ PK id               │       │    ip_address       │
│    tabla            │       │    user_agent       │
│    operacion        │       │    fecha_creacion   │
│    datos_json       │       └─────────────────────┘
│    fecha_creacion   │
│    reintentos       │
│    ultimo_error     │
│    estatus          │
└─────────────────────┘
```

---

## Descripción Detallada de Tablas

### 1. BENEFICIARIOS

Tabla central del sistema. Almacena la información de ciudadanos previamente aprobados.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único interno |
| folio | VARCHAR(50) | UNIQUE, NOT NULL, INDEX | Folio del trámite - **INMUTABLE** |
| nombre_completo | VARCHAR(200) | NOT NULL | Nombre completo del beneficiario |
| edad | INTEGER | CHECK > 0 | Edad en años |
| domicilio | TEXT | | Dirección completa |
| telefono | VARCHAR(20) | INDEX | Teléfono de contacto |
| programa_id | UUID | FK → PROGRAMAS | Programa asignado |
| estatus_aprobacion | ENUM | NOT NULL | aprobado, no_aprobado, pendiente |
| estatus_operativo | ENUM | NOT NULL, DEFAULT 'pendiente' | pendiente_entrega, entregado, bloqueado, etc. |
| folio_qr_data | TEXT | | Datos completos del QR |
| checksum_qr | VARCHAR(64) | | Hash de validación del QR |
| es_entregado | BOOLEAN | DEFAULT FALSE | Indicador de entrega completada |
| fecha_entrega | TIMESTAMP | | Fecha de última entrega |
| latitud | DECIMAL(10,8) | | Ubicación aproximada |
| longitud | DECIMAL(11,8) | | Ubicación aproximada |
| zona_id | UUID | FK → ZONAS | Zona operativa asignada |
| estatus_sync | ENUM | DEFAULT 'synced' | synced, pending, error, conflict |
| version_local | INTEGER | DEFAULT 1 | Versión del registro local |
| fecha_carga | TIMESTAMP | DEFAULT NOW() | Cuándo se cargó al dispositivo |
| fecha_modificacion | TIMESTAMP | | Última modificación |

**Índices:**
```sql
CREATE UNIQUE INDEX idx_folio ON beneficiarios(folio);
CREATE INDEX idx_programa ON beneficiarios(programa_id);
CREATE INDEX idx_estatus ON beneficiarios(estatus_operativo);
CREATE INDEX idx_zona ON beneficiarios(zona_id);
CREATE INDEX idx_telefono ON beneficiarios(telefono);
CREATE INDEX idx_nombre ON beneficiarios USING gin(to_tsvector('spanish', nombre_completo));
```

---

### 2. ENTREGAS

Registro de cada entrega realizada.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| beneficiario_id | UUID | FK, NOT NULL, UNIQUE | Referencia al beneficiario |
| operador_id | UUID | FK, NOT NULL | Usuario que realizó la entrega |
| jornada_id | UUID | FK | Jornada en que se realizó |
| fecha_registro | TIMESTAMP | NOT NULL, DEFAULT NOW() | Fecha/hora servidor |
| fecha_device | TIMESTAMP | NOT NULL | Fecha/hora del dispositivo |
| latitud | DECIMAL(10,8) | | Coordenada GPS |
| longitud | DECIMAL(11,8) | | Coordenada GPS |
| estatus | ENUM | DEFAULT 'completada' | completada, observada, rechazada |
| metadatos_json | JSONB | | Metadatos adicionales |
| estatus_sync | ENUM | DEFAULT 'synced' | Estado de sincronización |
| hash_registro | VARCHAR(64) | NOT NULL | Hash de integridad |
| requiere_revision | BOOLEAN | DEFAULT FALSE | Flag para revisión supervisor |
| motivo_revision | TEXT | | Motivo si requiere revisión |
| fecha_creacion | TIMESTAMP | DEFAULT NOW() | Timestamp creación |

**Reglas:**
- Un beneficiario solo puede tener UNA entrega completada (salvo excepción supervisor)
- El hash_registro se calcula sobre: folio + fecha_device + operador_id + evidencia_hash

---

### 3. EVIDENCIAS_ENTREGA

Fotografías y otros archivos de evidencia.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| entrega_id | UUID | FK → ENTREGAS |
| tipo | ENUM | foto_beneficiario, documento, firma, etc. |
| url_original | VARCHAR(500) | URL al archivo original |
| url_thumbnail | VARCHAR(500) | URL a versión miniatura |
| hash_sha256 | VARCHAR(64) | Hash SHA-256 del archivo |
| metadatos_json | JSONB | EXIF, GPS, dimensión, etc. |
| fecha_captura | TIMESTAMP | Fecha/hora de captura |
| estatus_validacion | ENUM | pendiente, validada, rechazada |
| fecha_validacion | TIMESTAMP | Cuándo se validó |
| validador_id | UUID | Quién validó |

**JSON Metadatos Ejemplo:**
```json
{
  "exif": {
    "device": "Samsung Galaxy A52",
    "resolution": "4032x3024",
    "orientation": "landscape"
  },
  "gps": {
    "lat": 19.4326,
    "lng": -99.1332,
    "accuracy": 5.2
  },
  "app": {
    "version": "1.2.0",
    "folio_ref": "BEN-2026-001234"
  }
}
```

---

### 4. USUARIOS

Operadores, supervisores y administradores del sistema.

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | UUID | PK |
| username | VARCHAR(50) | UNIQUE, NOT NULL |
| email | VARCHAR(100) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL (bcrypt) |
| rol | ENUM | operador, supervisor, administrador |
| telefono | VARCHAR(20) | |
| estatus | ENUM | activo, inactivo, bloqueado |
| ultimo_acceso | TIMESTAMP | |
| intentos_fallidos | INTEGER | DEFAULT 0 |
| fecha_creacion | TIMESTAMP | DEFAULT NOW() |

---

### 5. SYNC_QUEUE (Tabla Local en Móvil)

Cola de operaciones pendientes de sincronización.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK AUTOINCREMENT |
| tabla | VARCHAR(50) | Tabla afectada |
| operacion | ENUM | INSERT, UPDATE, DELETE |
| datos_json | TEXT | Datos serializados |
| fecha_creacion | TIMESTAMP | |
| reintentos | INTEGER | DEFAULT 0 |
| ultimo_error | TEXT | |
| estatus | ENUM | pending, processing, error, resolved |
| conflict_data | TEXT | Datos en conflicto (si aplica) |

---

### 6. AUDITORIA_LOG

Registro inmutable de todas las operaciones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| tabla_afectada | VARCHAR(50) | |
| registro_id | UUID | ID del registro afectado |
| accion | ENUM | CREATE, UPDATE, DELETE, VIEW |
| datos_anteriores | JSONB | Estado anterior (UPDATE/DELETE) |
| datos_nuevos | JSONB | Estado nuevo (CREATE/UPDATE) |
| usuario_id | UUID | Quién realizó la acción |
| dispositivo_id | UUID | Desde qué dispositivo |
| ip_address | INET | |
| user_agent | TEXT | |
| fecha_creacion | TIMESTAMP | |

---

## Estatus Operativos

### Flujo de Estatus de Beneficiarios

```
┌─────────────────┐
│   REGISTRADO    │
│  (en sistema)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│    APROBADO     │────►│  NO APROBADO    │
│ (para entrega)  │     │  (rechazado)    │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ PENDIENTE DE    │◄──── Inicio de jornada
│    ENTREGA      │      (carga a dispositivo)
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    │         │          │
    ▼         ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│ENTREGADO│ │BLOQUEADO│ │ENTREGA │
│        │ │         │ │OBSERVADA│
└────────┘ └────────┘ └────────┘
```

### Estados de Sincronización

| Estado | Descripción |
|--------|-------------|
| synced | Sincronizado con servidor |
| pending | Pendiente de sincronizar |
| processing | En proceso de sincronización |
| error | Error en último intento |
| conflict | Conflicto de datos detectado |

---

## Constraints y Validaciones

### Constraints de Negocio (PostgreSQL)

```sql
-- Un folio no puede ser nulo ni vacío
ALTER TABLE beneficiarios ADD CONSTRAINT chk_folio_not_empty 
  CHECK (folio IS NOT NULL AND length(trim(folio)) > 0);

-- Solo un beneficiario aprobado puede tener entrega
ALTER TABLE entregas ADD CONSTRAINT chk_entrega_aprobada 
  CHECK (
    EXISTS (
      SELECT 1 FROM beneficiarios b 
      WHERE b.id = entregas.beneficiario_id 
      AND b.estatus_aprobacion = 'aprobado'
    )
  );

-- Fecha de dispositivo no puede ser futura
ALTER TABLE entregas ADD CONSTRAINT chk_fecha_device_valid 
  CHECK (fecha_device <= NOW() + INTERVAL '1 minute');

-- Validar coordenadas GPS
ALTER TABLE entregas ADD CONSTRAINT chk_latitud_valid 
  CHECK (latitud BETWEEN -90 AND 90);
  
ALTER TABLE entregas ADD CONSTRAINT chk_longitud_valid 
  CHECK (longitud BETWEEN -180 AND 180);
```

### Triggers de Auditoría

```sql
-- Trigger para logging automático
CREATE TRIGGER trg_auditoria_beneficiarios
  AFTER INSERT OR UPDATE OR DELETE ON beneficiarios
  FOR EACH ROW EXECUTE FUNCTION fn_log_auditoria();

-- Trigger para prevenir modificación de folio
CREATE TRIGGER trg_prevenir_folio_update
  BEFORE UPDATE ON beneficiarios
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_cambio_folio();
```

---

## Esquema SQLite (App Móvil)

Versión simplificada para operación offline:

```sql
-- Beneficiarios (local)
CREATE TABLE beneficiarios (
    id TEXT PRIMARY KEY,
    folio TEXT NOT NULL UNIQUE,
    nombre_completo TEXT NOT NULL,
    edad INTEGER,
    domicilio TEXT,
    telefono TEXT,
    programa_id TEXT,
    estatus_aprobacion TEXT NOT NULL,
    estatus_operativo TEXT DEFAULT 'pendiente_entrega',
    folio_qr_data TEXT,
    checksum_qr TEXT,
    es_entregado INTEGER DEFAULT 0,
    fecha_entrega TEXT,
    latitud REAL,
    longitud REAL,
    estatus_sync TEXT DEFAULT 'synced',
    version_local INTEGER DEFAULT 1,
    fecha_carga TEXT DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TEXT
);

-- Entregas (local)
CREATE TABLE entregas (
    id TEXT PRIMARY KEY,
    beneficiario_id TEXT NOT NULL,
    operador_id TEXT NOT NULL,
    jornada_id TEXT,
    fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
    fecha_device TEXT NOT NULL,
    latitud REAL,
    longitud REAL,
    estatus TEXT DEFAULT 'completada',
    metadatos_json TEXT,
    estatus_sync TEXT DEFAULT 'pending',
    hash_registro TEXT NOT NULL,
    requiere_revision INTEGER DEFAULT 0,
    motivo_revision TEXT,
    FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id)
);

-- Cola de sincronización
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    operacion TEXT NOT NULL,
    datos_json TEXT NOT NULL,
    fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
    reintentos INTEGER DEFAULT 0,
    ultimo_error TEXT,
    estatus TEXT DEFAULT 'pending'
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_benef_folio ON beneficiarios(folio);
CREATE INDEX idx_benef_nombre ON beneficiarios(nombre_complete);
CREATE INDEX idx_benef_telefono ON beneficiarios(telefono);
CREATE INDEX idx_benef_estatus ON beneficiarios(estatus_operativo);
CREATE INDEX idx_entregas_pendientes ON entregas(estatus_sync) WHERE estatus_sync = 'pending';
```

---

*Documento 02 - Modelo de Datos*
*Versión: 1.0*
