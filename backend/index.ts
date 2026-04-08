import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const app = express();
app.use(cors());
app.use(express.json());

// Set up image upload directory
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

const SECRET = 'SIDEAB_SUPER_SECRET';

// Initialize SQLite DB (File-based so it persists for the session)
const db = new sqlite3.Database('./sideab.db');

db.serialize(() => {
    // ── CORE TABLES (existing) ──────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT, password TEXT, role TEXT DEFAULT 'OPERATOR'
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS beneficiaries (
        folio TEXT PRIMARY KEY, fullName TEXT, age INTEGER, address TEXT,
        phone TEXT, programName TEXT, approvalStatus TEXT, deliveryStatus TEXT, updatedAt DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, beneficiaryFolio TEXT, operatorId TEXT,
        scannedAt DATETIME, deviceId TEXT, location TEXT,
        evidencePhotoCloudUrl TEXT, integrityHash TEXT,
        cycle_id TEXT
    )`);

    // ── PHASE 8 TABLES ──────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, institution TEXT,
        description TEXT, status TEXT DEFAULT 'ACTIVE',
        created_at TEXT, created_by TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS program_document_types (
        id TEXT PRIMARY KEY, program_id TEXT REFERENCES programs(id),
        name TEXT, is_required INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS program_custom_fields (
        id TEXT PRIMARY KEY, program_id TEXT REFERENCES programs(id),
        field_key TEXT, field_label TEXT,
        field_type TEXT DEFAULT 'text',
        field_options TEXT, is_required INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS cycles (
        id TEXT PRIMARY KEY, program_id TEXT REFERENCES programs(id),
        name TEXT, period TEXT, status TEXT DEFAULT 'OPEN', created_at TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS beneficiary_custom_values (
        beneficiary_folio TEXT, program_id TEXT, field_key TEXT, value TEXT,
        PRIMARY KEY (beneficiary_folio, program_id, field_key)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, beneficiary_folio TEXT, program_id TEXT,
        doc_type_id TEXT, doc_type_name TEXT,
        file_url TEXT, uploaded_at TEXT, uploaded_by TEXT
    )`);

    // ── SEED USERS ──────────────────────────────────────────────────────
    db.get('SELECT COUNT(*) as count FROM users', [], (err, row: any) => {
        if (row.count === 0) {
            db.run(`INSERT INTO users VALUES ('ADMIN01','Operador Alfa','12345678','OPERATOR')`);
            db.run(`INSERT INTO users VALUES ('COORD01','Coordinador General','admin1234','ADMIN')`);
        }
    });

    // ── AUTO-MIGRATION: create default program for existing beneficiaries ─
    db.get("SELECT COUNT(*) as count FROM programs WHERE id = 'PROG-DEFAULT'", [], (err, row: any) => {
        if (row && row.count === 0) {
            const now = new Date().toISOString();
            db.run(`INSERT INTO programs (id, name, institution, description, status, created_at, created_by)
                    VALUES ('PROG-DEFAULT', 'Programa General', 'DIF / Gobierno Municipal',
                            'Programa migrado automáticamente desde datos existentes', 'ACTIVE', ?, 'SYSTEM')`, [now]);
            // Default document types
            const docTypes = ['INE Anverso', 'INE Reverso', 'CURP', 'Comprobante de Domicilio'];
            docTypes.forEach((name, i) => {
                const id = `DT-${i + 1}`;
                db.run(`INSERT OR IGNORE INTO program_document_types (id, program_id, name, is_required, sort_order)
                        VALUES (?, 'PROG-DEFAULT', ?, 1, ?)`, [id, name, i]);
            });
            // Default custom field: CURP
            db.run(`INSERT OR IGNORE INTO program_custom_fields
                    (id, program_id, field_key, field_label, field_type, is_required, sort_order)
                    VALUES ('CF-1', 'PROG-DEFAULT', 'curp', 'CURP', 'text', 1, 0)`);
            // Default cycle
            db.run(`INSERT OR IGNORE INTO cycles (id, program_id, name, period, status, created_at)
                    VALUES ('CYC-1', 'PROG-DEFAULT', 'Ciclo General 2026', '2026', 'OPEN', ?)`, [now]);
            console.log('[SIDEAB] Auto-migración: Programa General creado con datos existentes.');
        }
    });

    // ── SEED TEST BENEFICIARIES ─────────────────────────────────────────
    db.get('SELECT COUNT(*) as count FROM beneficiaries', [], (err, row: any) => {
        if (row.count === 0) {
            const stmt = db.prepare(`INSERT INTO beneficiaries VALUES (?,?,?,?,?,?,?,?,?)`);
            stmt.run('FOL-00001','Juan Carlos Pérez',45,'Calle 1 Local','555-1234','Apoyo Alimentario','APPROVED','PENDING',new Date().toISOString());
            stmt.run('FOL-00002','Marta Rodríguez',62,'Av. Principal 44','555-5678','Salud en Casa','APPROVED','DELIVERED',new Date().toISOString());
            stmt.run('FOL-00003','Roberto Sanabria',28,'Privada 4 sur','555-9012','Jóvenes Emprendedores','APPROVED','PENDING',new Date().toISOString());
            stmt.finalize();
        }
    });
});


// Middleware to verify JWT
const auth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
};

const isAdmin = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
    }
};

// --- AUTH ENDPOINTS ---
app.post('/api/login', (req, res) => {
    const { operator_id, password } = req.body;
    db.get('SELECT * FROM users WHERE id = ? AND password = ?', [operator_id, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });
        
        const user = row as any;
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: '12h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
});

// --- SYNC PULL (GET) ---
app.get('/api/sync/pull', auth, (req, res) => {
    // 1. Get beneficiaries
    db.all('SELECT * FROM beneficiaries', [], (err, beneficiaries) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 2. Get programs with their requirements
        db.all('SELECT * FROM programs WHERE status = "ACTIVE"', [], (err, programs) => {
            db.all('SELECT * FROM program_document_types', [], (err, docTypes) => {
                db.all('SELECT * FROM program_custom_fields', [], (err, customFields) => {
                    // 3. Get document status summary (to know what's already uploaded)
                    db.all('SELECT id, beneficiary_folio, doc_type_id FROM documents', [], (err, documents) => {
                        res.json({ 
                            beneficiaries, 
                            programs: programs.map((p: any) => ({
                                ...p,
                                docTypes: docTypes.filter((dt: any) => dt.program_id === p.id),
                                customFields: customFields.filter((cf: any) => cf.program_id === p.id)
                            })),
                            documents
                        });
                    });
                });
            });
        });
    });
});

// --- SYNC PUSH (POST BATcH) ---
app.post('/api/sync/push', auth, (req, res) => {
    const deliveries: any[] = req.body;
    if (!Array.isArray(deliveries)) return res.status(400).json({ error: 'Se esperaba un arreglo de entregas' });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmtDelivery = db.prepare(`INSERT OR IGNORE INTO deliveries (id, beneficiaryFolio, operatorId, scannedAt, deviceId, location, evidencePhotoCloudUrl, integrityHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        const stmtUpdateBene = db.prepare(`UPDATE beneficiaries SET deliveryStatus = 'DELIVERED', updatedAt = ? WHERE folio = ? AND deliveryStatus = 'PENDING'`);
        
        let successCount = 0;
        let conflictCount = 0;

        for (const dev of deliveries) {
            // First check if already delivered to prevent duplicates overriding in the sync stream
            db.get(`SELECT deliveryStatus FROM beneficiaries WHERE folio = ?`, [dev.beneficiaryFolio], (err, row: any) => {
                if (row && row.deliveryStatus === 'PENDING') {
                    stmtDelivery.run(
                        dev.id, dev.beneficiaryFolio, dev.operatorId, dev.scannedAt, 
                        dev.deviceId, dev.location, dev.evidencePhotoCloudUrl, dev.integrityHash
                    );
                    stmtUpdateBene.run(new Date().toISOString(), dev.beneficiaryFolio);
                    successCount++;
                } else {
                    conflictCount++;
                }
            });
        }
        
        db.run('COMMIT', () => {
            stmtDelivery.finalize();
            stmtUpdateBene.finalize();
            res.json({ message: 'Sincronización procesada', successCount, conflictCount });
        });
    });
});

// --- UPLOAD EVIDENCE ---
app.post('/api/upload/evidence', auth, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió foto' });
    // In a real cloud env, this would upload to S3 and return the S3 URL
    const localUrl = `/uploads/${req.file.filename}`;
    res.json({ url: localUrl, message: 'Archivo subido correctamente' });
});

// Serve local uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// --- ADMIN ENDPOINTS ---

// GET Admin Stats
app.get('/api/admin/stats', auth, isAdmin, (req, res) => {
    const stats: any = {};
    db.get('SELECT COUNT(*) as total FROM beneficiaries', [], (err, row: any) => {
        stats.totalBeneficiaries = row.total;
        db.get("SELECT COUNT(*) as delivered FROM beneficiaries WHERE deliveryStatus = 'DELIVERED'", [], (err, row: any) => {
            stats.deliveredCount = row.delivered;
            db.all("SELECT programName, COUNT(*) as count FROM beneficiaries WHERE deliveryStatus = 'DELIVERED' GROUP BY programName", [], (err, rows) => {
                stats.byProgram = rows;
                res.json(stats);
            });
        });
    });
});

// GET All Beneficiaries (Padrón completo)
app.get('/api/admin/beneficiaries', auth, isAdmin, (req, res) => {
    db.all(`
        SELECT b.*, d.scannedAt, d.operatorId, d.evidencePhotoCloudUrl
        FROM beneficiaries b
        LEFT JOIN deliveries d ON d.beneficiaryFolio = b.folio
        ORDER BY b.deliveryStatus DESC, b.fullName ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET Admin Deliveries (Full History)
app.get('/api/admin/deliveries', auth, isAdmin, (req, res) => {
    const query = `
        SELECT d.*, b.fullName, b.programName 
        FROM deliveries d
        JOIN beneficiaries b ON d.beneficiaryFolio = b.folio
        ORDER BY d.scannedAt DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST Admin Import (CSV Upload)
app.post('/api/admin/import', auth, isAdmin, (req, res) => {
    const beneficiaries = req.body; // Expecting array of objects from frontend CSV parser
    if (!Array.isArray(beneficiaries)) return res.status(400).json({ error: 'Arreglo inválido' });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO beneficiaries 
            (folio, fullName, age, address, phone, programName, approvalStatus, deliveryStatus, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const b of beneficiaries) {
            stmt.run(
                b.folio, b.fullName, b.age || 0, b.address || '', b.phone || '', 
                b.programName || 'General', b.approvalStatus || 'APPROVED', 
                b.deliveryStatus || 'PENDING', new Date().toISOString()
            );
        }

        db.run('COMMIT', (err) => {
            stmt.finalize();
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Importación exitosa', count: beneficiaries.length });
        });
    });
});

// --- OPERATOR MANAGEMENT ENDPOINTS ---

// GET all operators
app.get('/api/admin/users', auth, isAdmin, (req, res) => {
    db.all('SELECT id, name, role FROM users ORDER BY role, name', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST create new operator
app.post('/api/admin/users', auth, isAdmin, (req, res) => {
    const { id, name, password, role } = req.body;
    if (!id || !name || !password) return res.status(400).json({ error: 'Faltan campos requeridos' });
    const userRole = role || 'OPERATOR';
    db.run(`INSERT INTO users (id, name, password, role) VALUES (?, ?, ?, ?)`, 
        [id, name, password, userRole], 
        function(err) {
            if (err) return res.status(409).json({ error: 'ID de usuario ya existe' });
            res.json({ message: 'Operador creado exitosamente', id });
        }
    );
});

// DELETE remove operator
app.delete('/api/admin/users/:id', auth, isAdmin, (req, res) => {
    const { id } = req.params;
    if (id === (req as any).user.id) return res.status(400).json({ error: 'No puede eliminar su propia cuenta' });
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Operador eliminado exitosamente' });
    });
});

// GET Export Excel — Entregas
app.get('/api/admin/export', (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    let user: any;
    try { user = jwt.verify(token, SECRET); } catch { return res.status(401).json({ error: 'Token inválido' }); }
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Acceso denegado' });

    const query = `
        SELECT d.beneficiaryFolio as Folio, b.fullName as Nombre, b.programName as Programa,
               d.operatorId as Operador, d.scannedAt as Fecha, d.deviceId as Dispositivo,
               d.evidencePhotoCloudUrl as Evidencia
        FROM deliveries d
        JOIN beneficiaries b ON d.beneficiaryFolio = b.folio
        ORDER BY d.scannedAt DESC
    `;
    db.all(query, [], (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        const data = rows.map(r => ({
            'Folio': r.Folio, 'Nombre Completo': r.Nombre, 'Programa': r.Programa,
            'Operador': r.Operador, 'Fecha y Hora': new Date(r.Fecha).toLocaleString('es-MX'),
            'Dispositivo': r.Dispositivo?.includes('Android') ? 'Android' : r.Dispositivo?.includes('iPhone') ? 'iPhone' : 'PC',
            'URL Evidencia': r.Evidencia || 'Sin foto',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 35 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Entregas SIDEAB');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        const filename = `reporte-entregas-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

// GET Export Excel — Padrón Completo (con filtros y orden)
app.get('/api/admin/export/padron', (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    let user: any;
    try { user = jwt.verify(token, SECRET); } catch { return res.status(401).json({ error: 'Token inválido' }); }
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Acceso denegado' });

    const search  = ((req.query.search  as string) || '').toLowerCase();
    const program = (req.query.program  as string) || '';
    const status  = (req.query.status   as string) || '';
    const sortBy  = (req.query.sortBy   as string) || 'fullName';
    const sortDir = (req.query.sortDir  as string) === 'desc' ? 'DESC' : 'ASC';

    const allowedSort: Record<string, string> = {
        fullName: 'b.fullName', folio: 'b.folio',
        programName: 'b.programName', deliveryStatus: 'b.deliveryStatus'
    };
    const orderCol = allowedSort[sortBy] || 'b.fullName';

    db.all(`
        SELECT b.*, d.scannedAt, d.operatorId
        FROM beneficiaries b
        LEFT JOIN deliveries d ON d.beneficiaryFolio = b.folio
        ORDER BY ${orderCol} ${sortDir}
    `, [], (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });

        let filtered = rows as any[];
        if (search)  filtered = filtered.filter(r => r.fullName?.toLowerCase().includes(search) || r.folio?.toLowerCase().includes(search));
        if (program) filtered = filtered.filter(r => r.programName === program);
        if (status)  filtered = filtered.filter(r => r.deliveryStatus === status);

        const data = filtered.map(r => ({
            'Folio': r.folio,
            'Nombre Completo': r.fullName,
            'Edad': r.age,
            'Dirección': r.address,
            'Teléfono': r.phone,
            'Programa': r.programName,
            'Estatus': r.deliveryStatus === 'DELIVERED' ? 'Entregado' : 'Pendiente',
            'Fecha de Entrega': r.scannedAt ? new Date(r.scannedAt).toLocaleString('es-MX') : '—',
            'Operador que Entregó': r.operatorId || '—',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 6 }, { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Padrón SIDEAB');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        const filename = `padron-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

// ── PHASE 8: PROGRAMS ───────────────────────────────────────────────────────

// GET all programs
app.get('/api/admin/programs', auth, isAdmin, (req, res) => {
    db.all(`SELECT p.*, 
        (SELECT COUNT(*) FROM program_document_types WHERE program_id = p.id) as docTypesCount,
        (SELECT COUNT(*) FROM program_custom_fields WHERE program_id = p.id) as customFieldsCount,
        (SELECT COUNT(*) FROM cycles WHERE program_id = p.id AND status = 'OPEN') as openCycles
        FROM programs p ORDER BY p.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET single program with full config
app.get('/api/admin/programs/:id', auth, isAdmin, (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM programs WHERE id = ?', [id], (err, program: any) => {
        if (err || !program) return res.status(404).json({ error: 'Programa no encontrado' });
        db.all('SELECT * FROM program_document_types WHERE program_id = ? ORDER BY sort_order', [id], (err, docTypes) => {
            db.all('SELECT * FROM program_custom_fields WHERE program_id = ? ORDER BY sort_order', [id], (err, customFields) => {
                db.all('SELECT * FROM cycles WHERE program_id = ? ORDER BY created_at DESC', [id], (err, cycles) => {
                    res.json({ ...program, docTypes, customFields, cycles });
                });
            });
        });
    });
});

// POST create new program
app.post('/api/admin/programs', auth, isAdmin, (req: any, res) => {
    const { name, institution, description, docTypes = [], customFields = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const id = `PROG-${Date.now()}`;
    const now = new Date().toISOString();
    db.run(`INSERT INTO programs (id, name, institution, description, status, created_at, created_by)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [id, name, institution || '', description || '', now, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            // Insert document types
            docTypes.forEach((dt: any, i: number) => {
                const dtId = `DT-${Date.now()}-${i}`;
                db.run(`INSERT INTO program_document_types (id, program_id, name, is_required, sort_order) VALUES (?,?,?,?,?)`,
                    [dtId, id, dt.name, dt.is_required ? 1 : 0, i]);
            });
            // Insert custom fields
            customFields.forEach((cf: any, i: number) => {
                const cfId = `CF-${Date.now()}-${i}`;
                db.run(`INSERT INTO program_custom_fields (id, program_id, field_key, field_label, field_type, field_options, is_required, sort_order)
                        VALUES (?,?,?,?,?,?,?,?)`,
                    [cfId, id, cf.field_key, cf.field_label, cf.field_type || 'text',
                     cf.field_options ? JSON.stringify(cf.field_options) : null, cf.is_required ? 1 : 0, i]);
            });
            // Auto-create first cycle
            db.run(`INSERT INTO cycles (id, program_id, name, period, status, created_at) VALUES (?,?,?,?,'OPEN',?)`,
                [`CYC-${Date.now()}`, id, `Ciclo Inicial`, new Date().toISOString().slice(0,7), now]);
            res.json({ message: 'Programa creado', id });
        }
    );
});

// POST update program status
app.patch('/api/admin/programs/:id', auth, isAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.run('UPDATE programs SET status = ? WHERE id = ?', [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Programa actualizado' });
    });
});

// POST bulk import programs
app.post('/api/admin/programs/import', auth, isAdmin, (req: any, res) => {
    const programs = req.body;
    if (!Array.isArray(programs)) return res.status(400).json({ error: 'Arreglo inválido' });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`INSERT OR REPLACE INTO programs (id, name, institution, description, status, created_at, created_by)
                                VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`);
        
        for (const p of programs) {
            const id = p.id || `PROG-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            stmt.run(id, p.name, p.institution || '', p.description || '', new Date().toISOString(), req.user.id);
        }

        db.run('COMMIT', (err) => {
            stmt.finalize();
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Programas importados', count: programs.length });
        });
    });
});

// ── PHASE 8: CYCLES ─────────────────────────────────────────────────────────

// POST create cycle
app.post('/api/admin/cycles', auth, isAdmin, (req, res) => {
    const { program_id, name, period } = req.body;
    if (!program_id || !name) return res.status(400).json({ error: 'program_id y name requeridos' });
    const id = `CYC-${Date.now()}`;
    db.run(`INSERT INTO cycles (id, program_id, name, period, status, created_at) VALUES (?,?,?,?,'OPEN',?)`,
        [id, program_id, name, period || '', new Date().toISOString()],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Ciclo creado', id });
        }
    );
});

// PATCH close/open cycle
app.patch('/api/admin/cycles/:id', auth, isAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.run('UPDATE cycles SET status = ? WHERE id = ?', [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Ciclo ${status === 'CLOSED' ? 'cerrado' : 'reabierto'}` });
    });
});

// ── PHASE 8: DOCUMENTS ──────────────────────────────────────────────────────

// Set up document upload directory
const DOC_UPLOAD_DIR = path.join(__dirname, 'uploads', 'docs');
if (!fs.existsSync(DOC_UPLOAD_DIR)) fs.mkdirSync(DOC_UPLOAD_DIR, { recursive: true });

const docUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, DOC_UPLOAD_DIR),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// POST upload document for a beneficiary
app.post('/api/upload/document', auth, docUpload.single('photo'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
    const { beneficiary_folio, program_id, doc_type_id, doc_type_name } = req.body;
    if (!beneficiary_folio || !program_id) return res.status(400).json({ error: 'Faltan parámetros' });

    const id = `DOC-${Date.now()}`;
    const fileUrl = `/uploads/docs/${req.file.filename}`;
    db.run(`INSERT INTO documents (id, beneficiary_folio, program_id, doc_type_id, doc_type_name, file_url, uploaded_at, uploaded_by)
            VALUES (?,?,?,?,?,?,?,?)`,
        [id, beneficiary_folio, program_id, doc_type_id || '', doc_type_name || 'Documento', fileUrl, new Date().toISOString(), req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ url: fileUrl, id, message: 'Documento subido correctamente' });
        }
    );
});

// ── PHASE 8: EXPEDIENTE ─────────────────────────────────────────────────────

// GET full expediente for a beneficiary
app.get('/api/admin/beneficiaries/:folio/expediente', auth, isAdmin, (req, res) => {
    const { folio } = req.params;
    db.get('SELECT * FROM beneficiaries WHERE folio = ?', [folio], (err, beneficiary: any) => {
        if (err || !beneficiary) return res.status(404).json({ error: 'Beneficiario no encontrado' });

        // Get documents
        db.all('SELECT * FROM documents WHERE beneficiary_folio = ? ORDER BY uploaded_at DESC', [folio], (err, documents) => {
            // Get full delivery history
            db.all(`SELECT d.*, c.name as cycle_name, c.period
                    FROM deliveries d
                    LEFT JOIN cycles c ON d.cycle_id = c.id
                    WHERE d.beneficiaryFolio = ?
                    ORDER BY d.scannedAt DESC`, [folio], (err, deliveries) => {
                // Get custom field values
                db.all('SELECT * FROM beneficiary_custom_values WHERE beneficiary_folio = ?', [folio], (err, customValues) => {
                    res.json({ beneficiary, documents, deliveries, customValues });
                });
            });
        });
    });
});

// Serve document uploads
app.use('/uploads/docs', express.static(DOC_UPLOAD_DIR));

app.listen(3001, '0.0.0.0', () => {
    console.log('SIDEAB Backend (Offline-First Sync API) running on http://0.0.0.0:3001');
});
