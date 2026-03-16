export interface Company {
  id: number;
  name: string;
  created_at?: string;
}

export interface Employee {
  id?: number;
  company_id: number;
  name: string;
  role: string;
  hourly_rate: number;
}

export interface Equipment {
  id?: number;
  company_id: number;
  name: string;
  hourly_rate: number;
}

export interface Material {
  id?: number;
  company_id: number;
  name: string;
  unit_price: number;
}

export interface WorkLogEntry {
  employees: { employeeId: number; hours: number; rate: number }[];
  equipment: { equipmentId: number; hours: number; rate: number }[];
  materials: { materialId?: number; name: string; quantity: number; unitPrice: number }[];
}

export interface WorkLog {
  id?: number;
  job_id: number;
  date: string;
  notes: string;
  data: WorkLogEntry;
}

export interface User {
  id: string;
  company_id: number | null;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'foreman';
}

export interface Job {
  id?: number;
  company_id: number;
  customer_name: string;
  job_name: string;
  job_number: string;
  address: string;
  start_date: string;
  end_date: string;
  notes: string;
  status: 'active' | 'completed';
  foreman_id?: string;
  logs?: WorkLog[];
}

export interface Template {
  id?: number;
  company_id: number;
  name: string;
  data: WorkLogEntry;
}

export interface Invitation {
  id: string;
  company_id: number | null;
  role: 'admin' | 'foreman';
  token: string;
  email?: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
}

export interface Invoice {
  id?: number;
  company_id: number;
  job_id: number;
  invoice_number: string;
  date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid';
  labor_total: number;
  equipment_total: number;
  material_total: number;
  grand_total: number;
  data: any;
  created_at?: string;
}
