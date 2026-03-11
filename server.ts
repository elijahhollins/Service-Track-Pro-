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
    (1, 'Standard 3-Man Crew', '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":1,"hours":8,"rate":120}],"materials":[]}'),
    (2, '2-Man Electrical Crew', '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65}],"equipment":[],"materials":[{"materialId":4,"name":"#2 THHN Wire (per ft)","quantity":100,"unitPrice":1.45}]}');

  INSERT OR IGNORE INTO jobs (id, customer_name, job_name, job_number, address, start_date, end_date, notes, status, foreman_id) VALUES
    (1, 'Metro City Public Works', 'Main St Underground Utilities', 'JOB-2026-001', '123 Main St, Metro City', '2026-02-10', '2026-04-30', 'Bore and pull 2" conduit from Main/1st to Main/5th. Coordinate with traffic control.', 'active', 2),
    (2, 'Sunrise Properties LLC', 'Oak Ave Electrical Upgrade', 'JOB-2026-002', '450 Oak Ave, Westside', '2026-02-24', '2026-03-28', 'Panel upgrade and service entrance replacement for commercial strip mall.', 'active', 3),
    (3, 'County Road Dept', 'River Rd Storm Drain', 'JOB-2026-003', 'River Rd & Hwy 9 Intersection', '2026-01-06', '2026-02-14', 'Install 24" corrugated pipe and new catch basins. Completed ahead of schedule.', 'completed', 2),
    (4, 'TeleStar Communications', 'Downtown Fiber Install', 'JOB-2025-012', '200 Commerce Blvd, Downtown', '2025-11-03', '2025-12-19', 'Directional bore for fiber optic conduit through downtown core.', 'completed', 3),
    (5, 'Parks & Recreation Dept', 'Riverside Park Lighting', 'JOB-2026-004', '300 Park Dr, Riverside Park', '2026-03-03', '2026-03-28', 'Install new LED pathway lighting and underground wiring throughout park.', 'active', 2);

  INSERT OR IGNORE INTO work_logs (id, job_id, date, notes, data) VALUES
    (1,  1, '2026-02-10', 'Site setup and mobilization. Marked bore path and set up traffic control.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":3,"hours":8,"rate":250}],"materials":[{"materialId":1,"name":"2 inch PVC Conduit (10ft)","quantity":20,"unitPrice":18.50}]}'),
    (2,  1, '2026-02-11', 'Completed first 200ft bore. Pulled conduit and backfilled trench section A.',
      '{"employees":[{"employeeId":1,"hours":10,"rate":85},{"employeeId":2,"hours":10,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":3,"hours":10,"rate":250},{"equipmentId":1,"hours":4,"rate":120}],"materials":[{"materialId":1,"name":"2 inch PVC Conduit (10ft)","quantity":20,"unitPrice":18.50},{"materialId":2,"name":"2 inch PVC Coupling","quantity":20,"unitPrice":2.25}]}'),
    (3,  1, '2026-02-12', 'Second bore section complete. Hit rock at 180ft, switched to jackhammer. Minor delay.',
      '{"employees":[{"employeeId":1,"hours":10,"rate":85},{"employeeId":2,"hours":9,"rate":65},{"employeeId":3,"hours":9,"rate":45}],"equipment":[{"equipmentId":3,"hours":9,"rate":250},{"equipmentId":2,"hours":5,"rate":95}],"materials":[{"materialId":1,"name":"2 inch PVC Conduit (10ft)","quantity":15,"unitPrice":18.50},{"materialId":3,"name":"2 inch PVC Sweep","quantity":4,"unitPrice":12.00}]}'),
    (4,  2, '2026-02-24', 'Disconnected old service entrance. Installed new 400A panel and meter base.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65}],"equipment":[{"equipmentId":1,"hours":6,"rate":120}],"materials":[{"materialId":4,"name":"#2 THHN Wire (per ft)","quantity":150,"unitPrice":1.45}]}'),
    (5,  2, '2026-02-25', 'Ran new service conductors from transformer. Terminated and tested all panel circuits.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[],"materials":[{"materialId":4,"name":"#2 THHN Wire (per ft)","quantity":200,"unitPrice":1.45},{"materialId":2,"name":"2 inch PVC Coupling","quantity":8,"unitPrice":2.25}]}'),
    (6,  3, '2026-01-06', 'Mobilized equipment, excavated first catch basin location.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":2,"hours":8,"rate":95}],"materials":[]}'),
    (7,  3, '2026-01-07', 'Installed catch basin #1 and first 60ft of pipe.',
      '{"employees":[{"employeeId":1,"hours":9,"rate":85},{"employeeId":2,"hours":9,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":2,"hours":9,"rate":95},{"equipmentId":1,"hours":3,"rate":120}],"materials":[]}'),
    (8,  3, '2026-01-08', 'Installed catch basin #2, connected pipe sections, backfilled and compacted.',
      '{"employees":[{"employeeId":1,"hours":10,"rate":85},{"employeeId":2,"hours":10,"rate":65},{"employeeId":3,"hours":10,"rate":45}],"equipment":[{"equipmentId":2,"hours":10,"rate":95}],"materials":[]}'),
    (9,  3, '2026-01-09', 'Final inspection, restoration of roadway surface. Job signed off by inspector.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":2,"hours":4,"rate":95},{"equipmentId":1,"hours":2,"rate":120}],"materials":[]}'),
    (10, 4, '2025-11-03', 'Locates complete, bore entry and exit pits excavated at all 3 crossing points.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65}],"equipment":[{"equipmentId":3,"hours":6,"rate":250}],"materials":[{"materialId":1,"name":"2 inch PVC Conduit (10ft)","quantity":10,"unitPrice":18.50}]}'),
    (11, 4, '2025-11-04', 'Completed two bore crossings. Pulled fiber conduit and sealed both ends.',
      '{"employees":[{"employeeId":1,"hours":10,"rate":85},{"employeeId":2,"hours":10,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":3,"hours":10,"rate":250}],"materials":[{"materialId":1,"name":"2 inch PVC Conduit (10ft)","quantity":15,"unitPrice":18.50},{"materialId":2,"name":"2 inch PVC Coupling","quantity":15,"unitPrice":2.25}]}'),
    (12, 4, '2025-11-05', 'Final bore crossing complete. Restored all pit locations, final walkthrough with client.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65}],"equipment":[{"equipmentId":3,"hours":6,"rate":250},{"equipmentId":2,"hours":4,"rate":95}],"materials":[{"materialId":3,"name":"2 inch PVC Sweep","quantity":6,"unitPrice":12.00}]}'),
    (13, 5, '2026-03-03', 'Staked out light pole locations, trenched main feed run from panel to first junction.',
      '{"employees":[{"employeeId":1,"hours":8,"rate":85},{"employeeId":2,"hours":8,"rate":65},{"employeeId":3,"hours":8,"rate":45}],"equipment":[{"equipmentId":2,"hours":8,"rate":95}],"materials":[{"materialId":1,"name":"2 inch PVC Conduit (10ft)","quantity":15,"unitPrice":18.50},{"materialId":4,"name":"#2 THHN Wire (per ft)","quantity":300,"unitPrice":1.45}]}');
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
