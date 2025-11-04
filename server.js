const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Datenbank initialisieren
const db = new sqlite3.Database('./call_logs.db', (err) => {
    if (err) {
        console.error('Fehler beim Öffnen der Datenbank:', err);
    } else {
        console.log('Datenbank verbunden');
        initDatabase();
    }
});

// Tabelle erstellen
function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS call_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_name TEXT NOT NULL,
            doctor_phone TEXT NOT NULL,
            called_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            note TEXT,
            status TEXT DEFAULT 'called'
        )
    `, (err) => {
        if (err) {
            console.error('Fehler beim Erstellen der Tabelle:', err);
        } else {
            console.log('Tabelle call_logs bereit');
        }
    });
}

// API Endpoints

// Alle Anruflogs abrufen
app.get('/api/call-logs', (req, res) => {
    db.all('SELECT * FROM call_logs ORDER BY called_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Anruflog für einen bestimmten Therapeuten abrufen
app.get('/api/call-logs/:phone', (req, res) => {
    const phone = req.params.phone;
    db.get('SELECT * FROM call_logs WHERE doctor_phone = ? ORDER BY called_at DESC LIMIT 1', 
        [phone], 
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(row || null);
        }
    );
});

// Neuen Anruflog erstellen oder aktualisieren
app.post('/api/call-logs', (req, res) => {
    const { doctor_name, doctor_phone, note, status } = req.body;
    
    if (!doctor_name || !doctor_phone) {
        res.status(400).json({ error: 'doctor_name und doctor_phone sind erforderlich' });
        return;
    }

    // Prüfen, ob bereits ein Eintrag existiert
    db.get('SELECT id FROM call_logs WHERE doctor_phone = ?', [doctor_phone], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (row) {
            // Update existierenden Eintrag
            db.run(
                'UPDATE call_logs SET note = ?, status = ?, called_at = CURRENT_TIMESTAMP WHERE id = ?',
                [note || '', status || 'called', row.id],
                function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ 
                        id: row.id, 
                        message: 'Anruflog aktualisiert',
                        doctor_name,
                        doctor_phone,
                        note: note || '',
                        status: status || 'called'
                    });
                }
            );
        } else {
            // Neuen Eintrag erstellen
            db.run(
                'INSERT INTO call_logs (doctor_name, doctor_phone, note, status) VALUES (?, ?, ?, ?)',
                [doctor_name, doctor_phone, note || '', status || 'called'],
                function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ 
                        id: this.lastID, 
                        message: 'Anruflog erstellt',
                        doctor_name,
                        doctor_phone,
                        note: note || '',
                        status: status || 'called'
                    });
                }
            );
        }
    });
});

// Anruflog löschen
app.delete('/api/call-logs/:phone', (req, res) => {
    const phone = req.params.phone;
    
    db.run('DELETE FROM call_logs WHERE doctor_phone = ?', [phone], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            message: 'Anruflog gelöscht', 
            deleted: this.changes 
        });
    });
});

// Statistiken abrufen
app.get('/api/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total_calls FROM call_logs', [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ total_calls: row.total_calls });
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Fehler beim Schließen der Datenbank:', err);
        }
        console.log('\nDatenbank geschlossen');
        process.exit(0);
    });
});
