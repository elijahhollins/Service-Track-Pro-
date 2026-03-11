import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("servicetrack.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL -- 'admin' or 'foreman'
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    hourly_rate REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hourly_rate REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit_price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL -- JSON string of template configuration
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    job_name TEXT NOT NULL,
    job_number TEXT,
    address TEXT,
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    foreman_id INTEGER,
    FOREIGN KEY (foreman_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS work_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    data TEXT NOT NULL, -- JSON string containing employees, equipment, materials
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  -- Seed Data
  INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES
    (1, 'Admin User', 'admin@example.com', 'admin123', 'admin'),
    (2, 'John Foreman', 'john@example.com', 'foreman123', 'foreman'),
    (3, 'Sarah Foreman', 'sarah@example.com', 'foreman123', 'foreman');

  INSERT OR IGNORE INTO employees (id, name, role, hourly_rate) VALUES 
    (1, 'John Smith', 'Foreman', 85.00),
    (2, 'Mike Johnson', 'Electrician', 65.00),
    (3, 'Sarah Williams', 'Apprentice', 45.00);

  INSERT OR IGNORE INTO equipment (id, name, hourly_rate) VALUES 
    (1, 'Bucket Truck #14', 120.00),
    (2, 'Mini Excavator', 95.00),
    (3, 'Bore Rig', 250.00);

  INSERT OR IGNORE INTO materials (id, name, unit_price) VALUES 
    (1, '2" PVC Conduit (10ft)', 18.50),
    (2, '2" PVC Coupling', 2.25),
    (3, '2" PVC Sweep', 12.00),
    (4, '#2 THHN Wire (per ft)', 1.45);

  INSERT OR IGNORE INTO templates (id, name, data) VALUES 
    (1, 'Standard 3-Man Crew', '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":1,"hours":8,"rate":120}],"materials":[]}');
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Auth
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT id, name, email, role FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, name, email, role FROM users").all();
    res.json(users);
  });

  app.post("/api/users/:id/promote", (req, res) => {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/foremen", (req, res) => {
    const foremen = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'foreman'").all();
    res.json(foremen);
  });

  // Jobs
  app.get("/api/jobs", (req, res) => {
    const userId = req.query.userId;
    const role = req.query.role;

    let jobs;
    if (role === 'foreman') {
      jobs = db.prepare("SELECT * FROM jobs WHERE foreman_id = ? ORDER BY id DESC").all(userId);
    } else {
      jobs = db.prepare("SELECT * FROM jobs ORDER BY id DESC").all();
    }
    res.json(jobs);
  });

  app.post("/api/jobs", (req, res) => {
    const { customer_name, job_name, job_number, address, start_date, end_date, notes, foreman_id } = req.body;
    const info = db.prepare(`
      INSERT INTO jobs (customer_name, job_name, job_number, address, start_date, end_date, notes, foreman_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_name, job_name, job_number, address, start_date, end_date, notes, foreman_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/jobs/:id", (req, res) => {
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
    const logs = db.prepare("SELECT * FROM work_logs WHERE job_id = ? ORDER BY date DESC").all(req.params.id);
    res.json({ ...job, logs: logs.map(l => ({ ...l, data: JSON.parse(l.data as string) })) });
  });

  // Work Logs
  app.post("/api/work-logs", (req, res) => {
    const { job_id, date, notes, data } = req.body;
    const info = db.prepare(`
      INSERT INTO work_logs (job_id, date, notes, data)
      VALUES (?, ?, ?, ?)
    `).run(job_id, date, notes, JSON.stringify(data));
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/work-logs/:id", (req, res) => {
    db.prepare("DELETE FROM work_logs WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Master Lists
  app.get("/api/employees", (req, res) => {
    res.json(db.prepare("SELECT * FROM employees").all());
  });

  app.post("/api/employees", (req, res) => {
    const { name, role, hourly_rate } = req.body;
    const info = db.prepare("INSERT INTO employees (name, role, hourly_rate) VALUES (?, ?, ?)").run(name, role, hourly_rate);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/equipment", (req, res) => {
    res.json(db.prepare("SELECT * FROM equipment").all());
  });

  app.post("/api/equipment", (req, res) => {
    const { name, hourly_rate } = req.body;
    const info = db.prepare("INSERT INTO equipment (name, hourly_rate) VALUES (?, ?)").run(name, hourly_rate);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/materials", (req, res) => {
    res.json(db.prepare("SELECT * FROM materials").all());
  });

  app.post("/api/materials", (req, res) => {
    const { name, unit_price } = req.body;
    const info = db.prepare("INSERT INTO materials (name, unit_price) VALUES (?, ?)").run(name, unit_price);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/templates", (req, res) => {
    const templates = db.prepare("SELECT * FROM templates").all();
    res.json(templates.map(t => ({ ...t, data: JSON.parse(t.data as string) })));
  });

  app.post("/api/templates", (req, res) => {
    const { name, data } = req.body;
    const info = db.prepare("INSERT INTO templates (name, data) VALUES (?, ?)").run(name, JSON.stringify(data));
    res.json({ id: info.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
