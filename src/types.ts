export interface Company {
  id: string;
  name: string;
  created_at?: string;
}

export interface Employee {
  id?: number;
  company_id: string;
  name: string;
  role: string;
  hourly_rate: number;
}

export interface Equipment {
  id?: number;
  company_id: string;
  name: string;
  hourly_rate: number;
}

export interface Material {
  id?: number;
  company_id: string;
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
  company_id: string | null;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'foreman';
}

export interface Job {
  id?: number;
  company_id: string;
  customer_name: string;
  job_name: string;
  job_number: string;
  address: string;
  start_date: string;
  end_date?: string | null;
  notes: string;
  status: 'active' | 'completed';
  foreman_id?: string;
  logs?: WorkLog[];
}

export interface Template {
  id?: number;
  company_id: string;
  name: string;
  data: WorkLogEntry;
}

export interface Invitation {
  id: string;
  company_id: string | null;
  role: 'admin' | 'foreman';
  token: string;
  email?: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
}

export interface InvoiceSettings {
  id?: number;
  company_id: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  logo_initials: string;
  payment_terms: string;
}

export interface Invoice {
  id?: number;
  company_id: string;
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
