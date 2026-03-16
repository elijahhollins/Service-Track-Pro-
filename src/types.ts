export interface Company {
  id: string;
  name: string;
  created_at?: string;
}

export interface Employee {
  id?: number;
  name: string;
  role: string;
  hourly_rate: number;
  company_id?: string;
}

export interface Equipment {
  id?: number;
  name: string;
  hourly_rate: number;
  company_id?: string;
}

export interface Material {
  id?: number;
  name: string;
  unit_price: number;
  company_id?: string;
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
  company_id?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'foreman' | 'crew';
  company_id?: string;
}

export interface Invitation {
  id: string;
  email: string;
  company_id: string;
  role: 'admin' | 'foreman' | 'crew';
  invited_by?: number;
  invite_token: string;
  accepted_at?: string;
  created_at: string;
}

export interface Job {
  id?: number;
  customer_name: string;
  job_name: string;
  job_number: string;
  address: string;
  start_date: string;
  end_date: string;
  notes: string;
  status: 'active' | 'completed';
  foreman_id?: number;
  logs?: WorkLog[];
  company_id?: string;
}

export interface Template {
  id?: number;
  name: string;
  data: WorkLogEntry;
  company_id?: string;
}

export interface CompanySettings {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  paymentTerms: string;
}

export interface CustomerDetails {
  phone: string;
  email: string;
  billToAddress: string;
}

export interface InvoiceDetails {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  dateOfOrder: string;
  jobLocation: string;
}
