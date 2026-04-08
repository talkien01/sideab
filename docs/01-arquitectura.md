# 01 - Arquitectura del Sistema

## Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    DISPOSITIVO MÓVIL                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                           APLICACIÓN FLUTTER                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │     UI      │  │   Estado    │  │   Lógica    │  │     Servicios       │  │  │
│  │  │   Layer     │◄─┤  Management │◄─┤   Negocio   │◄─┤                     │  │  │
│  │  │             │  │  (Riverpod) │  │             │  │ • SQLite (cifrado)  │  │  │
│  │  │ • Pantallas │  │             │  │ • Validación│  │ • Cámara            │  │  │
│  │  │ • Widgets   │  │ • Beneficiario│ │ • Registro  │  │ • QR Scanner        │  │  │
│  │  │ • Forms     │  │ • Entrega   │  │ • Sync      │  │ • GPS               │  │  │
│  │  │             │  │ • Sincronización││ • Auditoría │  │ • Cola Offline      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                           │
│  ┌───────────────────────────────────────┴───────────────────────────────────────┐  │
│  │                           ALMACENAMIENTO LOCAL                                  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │  │
│  │  │  SQLite (SQLCipher)│  │  Secure Storage │  │      File System            │  │  │
│  │  │  • Beneficiarios   │  │  • Token JWT    │  │  • Fotos evidencia          │  │  │
│  │  │  • Entregas        │  │  • Claves       │  │  • Logs                     │  │  │
│  │  │  • Incidencias     │  │  • Config       │  │  • Queue sync               │  │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │ HTTPS/TLS
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND / API                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                          NODE.JS / EXPRESS                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │   Routes    │  │  Middleware │  │ Controllers │  │      Services       │  │  │
│  │  │             │◄─┤  • JWT Auth │◄─┤             │◄─┤                     │  │  │
│  │  │ /auth/*     │  │  • Roles    │  │ • Auth      │  │ • Beneficiario      │  │  │
│  │  │ /beneficiarios  │ • Validation│  │ • Beneficiario│ │ • Entrega           │  │  │
│  │  │ /entregas/* │  │  • Rate Lim │  │ • Entrega   │  │ • Sync              │  │  │
│  │  │ /sync/*     │  │  • Logging  │  │ • Sync      │  │ • Incidencia        │  │  │
│  │  │ /incidencias  │             │  │ • Reportes  │  │ • Reportes          │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                         │
│  ┌────────────────────────────────────────┴─────────────────────────────────────┐   │
│  │                         SERVICIOS EXTERNOS                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Email     │  │    SMS      │  │  Storage    │  │      Logging        │  │   │
│  │  │ (SendGrid)  │  │ (Twilio)    │  │  (AWS S3)   │  │   (Winston/CloudWatch│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              INFRAESTRUCTURA DE DATOS                                │
│  ┌─────────────────────────┐      ┌─────────────────────────┐      ┌───────────────┐  │
│  │      POSTGRESQL         │      │     REDIS (Cache)       │      │  NAS/S3 (Files)│  │
│  │    (Base Central)         │      │  • Sesiones             │      │ • Evidencias  │  │
│  │                         │      │  • Rate limiting        │      │ • Backups     │  │
│  │ • Beneficiarios         │      │  • Colas temporales     │      │ • Logs        │  │
│  │ • Usuarios              │      │                         │      │               │  │
│  │ • Entregas              │      │                         │      │               │  │
│  │ • Auditoría             │      │                         │      │               │  │
│  │ • Incidencias           │      │                         │      │               │  │
│  └─────────────────────────┘      └─────────────────────────┘      └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Patrones de Arquitectura

### 1. Clean Architecture (App Móvil)

```
lib/
├── core/                          # Capa base
│   ├── constants/                 # Constantes globales
│   ├── errors/                    # Manejo de errores
│   ├── usecases/                  # Casos de uso base
│   └── utils/                     # Utilidades
│
├── features/                      # Features del negocio
│   ├── auth/                      # Autenticación
│   │   ├── data/                  # Capa de datos
│   │   │   ├── datasources/       # Fuentes de datos
│   │   │   ├── models/            # Modelos de datos
│   │   │   └── repositories/      # Implementaciones
│   │   ├── domain/                # Capa de dominio
│   │   │   ├── entities/          # Entidades
│   │   │   ├── repositories/      # Interfaces
│   │   │   └── usecases/          # Casos de uso
│   │   └── presentation/          # Capa de presentación
│   │       ├── bloc/              # State management
│   │       ├── pages/             # Pantallas
│   │       └── widgets/           # Widgets
│   │
│   ├── beneficiarios/             # Gestión de beneficiarios
│   ├── entregas/                  # Registro de entregas
│   ├── sincronizacion/            # Sincronización
│   └── incidencias/               # Manejo de incidencias
│
└── main.dart
```

### 2. Arquitectura en Capas (Backend)

```
src/
├── config/                        # Configuraciones
├── api/
│   ├── routes/                    # Definición de rutas
│   ├── middlewares/               # Middlewares
│   ├── controllers/               # Controladores
│   └── validators/                # Validaciones
├── services/                      # Lógica de negocio
├── models/                        # Modelos de datos
├── repositories/                  # Acceso a datos
├── utils/                         # Utilidades
└── app.js
```

---

## Flujo de Datos

### Sincronización Offline → Online

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   App       │     │   Cola      │     │   Sync      │     │   Backend   │
│   Móvil     │     │   Local     │     │   Service   │     │   API       │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Entrega        │                   │                   │
       │    Offline         │                   │                   │
       ├──────────────────►│                   │                   │
       │                   │ 2. Guardar en     │                   │
       │                   │    cola           │                   │
       │◄──────────────────┤                   │                   │
       │                   │                   │                   │
       │                   │ 3. Detectar       │                   │
       │                   │    conectividad   │                   │
       │                   ├──────────────────►│                   │
       │                   │                   │ 4. Procesar      │
       │                   │                   │    cola          │
       │                   │◄──────────────────┤                   │
       │                   │                   │                   │
       │                   │ 5. Enviar batch   │                   │
       │                   │    a API          │                   │
       │                   ├───────────────────┼──────────────────►│
       │                   │                   │                   │
       │                   │ 6. Validar       │                   │
       │                   │    y confirmar    │                   │
       │                   │◄──────────────────┼───────────────────┤
       │                   │                   │                   │
       │ 7. Actualizar     │                   │                   │
       │    estado local    │                   │                   │
       │◄──────────────────┤                   │                   │
       │                   │                   │                   │
```

---

## Componentes Clave

### 1. Motor de Sincronización

```dart
abstract class SyncEngine {
  // Encolar operación para sincronización
  Future<void> queueOperation(SyncOperation operation);

  // Procesar cola pendiente
  Future<SyncResult> processQueue();

  // Verificar estado de sincronización
  Stream<SyncStatus> get syncStatus;

  // Resolver conflictos
  Future<ConflictResolution> resolveConflict(
    SyncConflict conflict,
    ConflictStrategy strategy,
  );
}
```

### 2. Validador de QR Seguro

```dart
class SecureQRValidator {
  // Validar estructura del QR
  ValidationResult validateStructure(String qrData);

  // Verificar checksum
  bool verifyChecksum(QRData data);

  // Extraer folio
  String extractFolio(QRData data);

  // Verificar autenticidad
  Future<bool> verifyAuthenticity(QRData data);
}
```

### 3. Gestor de Evidencias

```dart
abstract class EvidenceManager {
  // Capturar foto con metadatos
  Future<Evidence> capturePhoto({
    required String folio,
    required Position? location,
  });

  // Almacenar localmente
  Future<void> storeLocal(Evidence evidence);

  // Subir a servidor
  Future<UploadResult> uploadToServer(Evidence evidence);

  // Generar hash de verificación
  String generateHash(Evidence evidence);
}
```

---

## Decisiones de Diseño

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| **Framework Móvil** | Flutter | Single codebase, offline capability, excelente performance |
| **Base Local** | SQLite + SQLCipher | SQL estándar, cifrado AES-256, soporte offline robusto |
| **State Management** | Riverpod | Type-safe, testable, manejo de dependencias |
| **Backend** | Node.js + Express | JavaScript unificado, gran ecosistema, escalable |
| **ORM** | Prisma | Type-safe, migraciones, buen DX |
| **Base Central** | PostgreSQL | ACID, JSON support, GIS para ubicaciones |
| **Autenticación** | JWT + Refresh Tokens | Stateless, seguro, fácil invalidación |
| **Storage** | AWS S3 / MinIO | Escalable, versionado, CDN opcional |

---

## Escalabilidad

### Estrategias de Escalado

1. **Horizontal**: Múltiples instancias de API con load balancer
2. **Caching**: Redis para sesiones y datos frecuentes
3. **CDN**: CloudFront/CloudFlare para evidencias
4. **Database**: Read replicas para consultas, sharding si es necesario
5. **Cola de procesamiento**: BullMQ para tareas asíncronas

---

## Consideraciones de Resiliencia

```
┌─────────────────────────────────────────────────────────┐
│              ESTRATEGIAS DE RESILIENCIA                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐ │
│  │  Circuit    │     │   Retry     │     │   Timeout   │ │
│  │  Breaker    │     │   Pattern   │     │   Pattern   │ │
│  │             │     │             │     │             │ │
│  │ Fallar      │     │ Reintentos  │     │ Límites de  │ │
│  │ rápido si   │     │ exponenciales│    │ tiempo en   │ │
│  │ API caída   │     │ con backoff │     │ operaciones │ │
│  └─────────────┘     └─────────────┘     └─────────────┘ │
│                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐ │
│  │   Queue     │     │   Bulkhead  │     │   Health    │ │
│  │   Pattern   │     │   Pattern   │     │   Checks    │ │
│  │             │     │             │     │             │ │
│  │ Operaciones │     │ Aislar      │     │ Monitoreo   │ │
│  │ asíncronas  │     │ recursos    │     │ continuo    │ │
│  │ en cola     │     │ críticos    │     │             │ │
│  └─────────────┘     └─────────────┘     └─────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Métricas de Monitoreo

| Métrica | Herramienta | Umbral Alerta |
|---------|-------------|---------------|
| Latencia API | Prometheus | > 500ms p95 |
| Tasa de error | Grafana | > 1% |
| Sync pendiente | Dashboard | > 1000 registros |
| Espacio local | App metrics | > 90% |
| Autenticación fallida | SIEM | > 10/min |

---

*Documento 01 - Arquitectura*
*Versión: 1.0*
