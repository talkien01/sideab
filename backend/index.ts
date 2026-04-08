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
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        password TEXT,
        role TEXT DEFAULT 'OPERATOR'
    )`);

    // Beneficiaries table
    db.run(`CREATE TABLE IF NOT EXISTS beneficiaries (
        folio TEXT PRIMARY KEY,
        fullName TEXT,
        age INTEGER,
        address TEXT,
        phone TEXT,
        programName TEXT,
        approvalStatus TEXT,
        deliveryStatus TEXT,
        updatedAt DATETIME
    )`);

    // Deliveries table
    db.run(`CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        beneficiaryFolio TEXT,
        operatorId TEXT,
        scannedAt DATETIME,
        deviceId TEXT,
        location TEXT,
        evidencePhotoCloudUrl TEXT,
        integrityHash TEXT
    )`);

    // Insert dummy data securely using parameterized query simulation
    db.get('SELECT COUNT(*) as count FROM users', [], (err, row: any) => {
        if (row.count === 0) {
            db.run(`INSERT INTO users (id, name, password, role) VALUES ('ADMIN01', 'Operador Alfa', '12345678', 'OPERATOR')`);
            db.run(`INSERT INTO users (id, name, password, role) VALUES ('COORD01', 'Coordinador General', 'admin1234', 'ADMIN')`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM beneficiaries', [], (err, row: any) => {
        if (row.count === 0) {
            // Un par de beneficiarios de prueba
            const stmt = db.prepare(`INSERT INTO beneficiaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            stmt.run('FOL-00001', 'Juan Carlos Pérez', 45, 'Calle 1 Local', '555-1234', 'Apoyo Alimentario', 'APPROVED', 'PENDING', new Date().toISOString());
            stmt.run('FOL-00002', 'Marta Rodríguez', 62, 'Av. Principal 44', '555-5678', 'Salud en Casa', 'APPROVED', 'DELIVERED', new Date().toISOString());
            stmt.run('FOL-00003', 'Roberto Sanabria', 28, 'Privada 4 sur', '555-9012', 'Jóvenes Emprendedores', 'APPROVED', 'PENDING', new Date().toISOString());
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
    // This would ideally accept a last_sync_timestamp and return only modified records
    db.all('SELECT * FROM beneficiaries', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ beneficiaries: rows });
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

app.listen(3001, '0.0.0.0', () => {
    console.log('SIDEAB Backend (Offline-First Sync API) running on http://0.0.0.0:3001');
});
