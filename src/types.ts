export interface Employee {
  id?: number;
  name: string;
  role: string;
  hourly_rate: number;
}

export interface Equipment {
  id?: number;
  name: string;
  hourly_rate: number;
}

export interface Material {
  id?: number;
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
  logs?: WorkLog[];
}

export interface Template {
  id?: number;
  name: string;
  data: WorkLogEntry;
}
