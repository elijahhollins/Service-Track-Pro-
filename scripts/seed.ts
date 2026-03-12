/**
 * Service Track Pro — Supabase Sample Data Seed Script
 *
 * Usage:
 *   npm run seed
 *
 * Environment variables (loaded from .env.local or .env):
 *   VITE_SUPABASE_URL          — your Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — public anon key
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role key (required to create Auth users)
 *
 * The script is idempotent: running it more than once will not create
 * duplicate rows.  Auth user creation is skipped if the email already exists.
 */

import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load environment variables from .env.local then .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  'https://wmbvtjqymjmgcxhenvdo.supabase.co/';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtYnZ0anF5bWptZ2N4aGVudmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDc1MDMsImV4cCI6MjA4ODgyMzUwM30.oPj0SGYnRcDyFORf9yRvQOwgYOi5AWE5vXCnKVAOQ6c';

if (!SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
      '   Demo Auth users will be skipped.\n' +
      '   Set this variable in .env.local to seed full data.\n'
  );
}

// Use the service-role key when available so we can create Auth users and
// bypass Row-Level Security during seeding.
const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY ?? ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertRows<T extends object>(
  table: string,
  rows: T[],
  conflictColumn: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<(T & { id: number }  & Record<string, any>)[]> {
  const { data, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictColumn, ignoreDuplicates: true })
    .select();

  if (error) {
    console.error(`  ✗ Error upserting into "${table}":`, error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as (T & { id: number } & Record<string, any>)[];
}

function log(msg: string) {
  process.stdout.write(msg + '\n');
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------
const DEMO_USERS = [
  { email: 'admin@demo.com',   password: 'Demo1234!', name: 'Alice Johnson', role: 'admin'   as const },
  { email: 'foreman@demo.com', password: 'Demo1234!', name: 'Bob Martinez',  role: 'foreman' as const },
];

const EMPLOYEES = [
  { name: 'David Thompson',    role: 'Foreman',          hourly_rate: 75.00 },
  { name: 'Emma Rodriguez',    role: 'Electrician',       hourly_rate: 65.00 },
  { name: 'Frank Chen',        role: 'Plumber',           hourly_rate: 60.00 },
  { name: 'Grace Kim',         role: 'HVAC Technician',   hourly_rate: 70.00 },
  { name: 'Henry Wilson',      role: 'General Labor',     hourly_rate: 42.00 },
  { name: 'Isabella Martinez', role: 'Carpenter',         hourly_rate: 55.00 },
];

const EQUIPMENT = [
  { name: 'Excavator CAT 320',      hourly_rate: 150.00 },
  { name: 'Skid Steer Loader',       hourly_rate:  95.00 },
  { name: 'Concrete Mixer',          hourly_rate:  45.00 },
  { name: 'Scissor Lift 19 ft',      hourly_rate:  75.00 },
  { name: 'Generator 25 kW',         hourly_rate:  35.00 },
  { name: 'Air Compressor 60 gal',   hourly_rate:  25.00 },
  { name: 'Pressure Washer',         hourly_rate:  20.00 },
];

const MATERIALS = [
  { name: 'Lumber 2×4×8',                    unit_price:   8.50 },
  { name: 'Concrete Mix 50 lb bag',           unit_price:  12.00 },
  { name: 'PVC Pipe 4 in × 10 ft',           unit_price:  18.00 },
  { name: 'Electrical Wire 12/2 100 ft',      unit_price:  48.00 },
  { name: 'Drywall Sheet 4×8',               unit_price:  18.50 },
  { name: 'Roofing Shingles (bundle)',        unit_price:  35.00 },
  { name: 'Rebar #4 20 ft',                  unit_price:  14.00 },
  { name: 'Interior Paint 1 gal',            unit_price:  32.00 },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  log('\n🌱  Service Track Pro — Seeding Supabase...\n');

  // ── 1. Auth + profile users ────────────────────────────────────────────
  log('1/7  Creating demo users...');
  const profileInserts: { name: string; email: string; password: string; role: string }[] = [];

  if (SERVICE_ROLE_KEY) {
    for (const u of DEMO_USERS) {
      // Check whether the auth user already exists
      const { data: existing } = await supabase.auth.admin.listUsers();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alreadyExists = existing?.users?.some((au: any) => au.email === u.email);

      if (!alreadyExists) {
        const { error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
        if (error) {
          console.error(`  ✗ Auth user "${u.email}":`, error.message);
        } else {
          log(`  ✔  Auth user created: ${u.email}`);
        }
      } else {
        log(`  –  Auth user already exists: ${u.email}`);
      }

      profileInserts.push({
        name:     u.name,
        email:    u.email,
        password: u.password,
        role:     u.role,
      });
    }
  } else {
    log('  –  Skipped (no service role key). Create users via the app UI or Supabase dashboard.');
    log('     Demo credentials: admin@demo.com / foreman@demo.com  (password: Demo1234!)');
  }

  // Upsert public.users profiles (requires email to be a unique column)
  if (profileInserts.length > 0) {
    await upsertRows('users', profileInserts, 'email');
    log(`  ✔  ${profileInserts.length} user profile(s) upserted`);
  }

  // ── 2. Employees ───────────────────────────────────────────────────────
  log('\n2/7  Inserting employees...');
  const employees = await upsertRows('employees', EMPLOYEES, 'name');
  log(`  ✔  ${employees.length} employees`);

  // Build name → id maps for work-log composition
  const empByName = Object.fromEntries(
    employees.map((e) => [e.name, e.id])
  );

  // ── 3. Equipment ───────────────────────────────────────────────────────
  log('\n3/7  Inserting equipment...');
  const equipment = await upsertRows('equipment', EQUIPMENT, 'name');
  log(`  ✔  ${equipment.length} equipment items`);

  const eqByName = Object.fromEntries(
    equipment.map((e) => [e.name, e.id])
  );

  // ── 4. Materials ───────────────────────────────────────────────────────
  log('\n4/7  Inserting materials...');
  const materials = await upsertRows('materials', MATERIALS, 'name');
  log(`  ✔  ${materials.length} materials`);

  const matByName = Object.fromEntries(
    materials.map((m) => [m.name, m.id])
  );

  // ── 5. Jobs ────────────────────────────────────────────────────────────
  log('\n5/7  Inserting jobs...');

  // Resolve foreman's public.users id
  const { data: foremanRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'foreman@demo.com')
    .maybeSingle();
  const foremanId: number | undefined = foremanRow?.id;

  const jobsPayload = [
    {
      customer_name: 'Northside Properties LLC',
      job_name:      'Downtown Office Complex Renovation',
      job_number:    'JOB-2024-001',
      address:       '123 Main Street, Suite 400, Downtown, CA 90210',
      start_date:    '2024-01-15',
      end_date:      '2024-06-30',
      notes:         'Full interior renovation including electrical, plumbing, and HVAC upgrades. Client requires minimal disruption to occupied floors.',
      status:        'active'  as const,
      foreman_id:    foremanId,
    },
    {
      customer_name: 'Riverside Homes Inc.',
      job_name:      'Riverside Residential Development',
      job_number:    'JOB-2024-002',
      address:       '45 Oak Avenue, Riverside, CA 92501',
      start_date:    '2024-02-01',
      end_date:      '2024-08-15',
      notes:         'New construction of 12-unit residential complex. Foundation complete. Currently framing second floor.',
      status:        'active'  as const,
      foreman_id:    foremanId,
    },
    {
      customer_name: 'Greenfield School District',
      job_name:      'Elementary School Roof Repair',
      job_number:    'JOB-2024-003',
      address:       '789 School Lane, Greenfield, CA 93927',
      start_date:    '2024-03-10',
      end_date:      '2024-04-05',
      notes:         'Emergency roof repair following storm damage. Replaced 3,200 sq ft of shingles and repaired two skylights. Project completed ahead of schedule.',
      status:        'completed' as const,
      foreman_id:    foremanId,
    },
    {
      customer_name: 'Harbor View Restaurant Group',
      job_name:      'Restaurant Electrical Upgrade',
      job_number:    'JOB-2024-004',
      address:       '55 Harbor Drive, Marina Bay, CA 94925',
      start_date:    '2024-04-20',
      end_date:      '2024-05-31',
      notes:         'Upgrade main electrical panel to 400A service. Install dedicated circuits for new commercial kitchen equipment.',
      status:        'active'  as const,
      foreman_id:    foremanId,
    },
    {
      customer_name: 'Westside Mall Management',
      job_name:      'Shopping Center HVAC Installation',
      job_number:    'JOB-2024-005',
      address:       '1000 Westside Blvd, West City, CA 90025',
      start_date:    '2024-01-08',
      end_date:      '2024-03-22',
      notes:         'Install 8 commercial rooftop HVAC units across 45,000 sq ft retail space. All units commissioned and handed off.',
      status:        'completed' as const,
      foreman_id:    foremanId,
    },
  ];

  const jobs = await upsertRows('jobs', jobsPayload, 'job_number');
  log(`  ✔  ${jobs.length} jobs`);

  const jobByNumber = Object.fromEntries(
    jobs.map((j) => [j.job_number, j.id])
  );

  // ── 6. Work logs ───────────────────────────────────────────────────────
  log('\n6/7  Inserting work logs...');

  // Helper to build a work-log entry object
  function wle(
    empEntries: { name: string; hours: number; rate: number }[],
    eqEntries:  { name: string; hours: number; rate: number }[],
    matEntries: { name: string; quantity: number; unitPrice: number; useCatalog?: boolean }[]
  ) {
    return {
      employees: empEntries.map((e) => ({
        employeeId: empByName[e.name],
        hours: e.hours,
        rate:  e.rate,
      })),
      equipment: eqEntries.map((e) => ({
        equipmentId: eqByName[e.name],
        hours: e.hours,
        rate:  e.rate,
      })),
      materials: matEntries.map((m) => ({
        ...(m.useCatalog !== false && matByName[m.name] ? { materialId: matByName[m.name] } : {}),
        name:      m.name,
        quantity:  m.quantity,
        unitPrice: m.unitPrice,
      })),
    };
  }

  const workLogsPayload = [
    // JOB-2024-001 · Day 1
    {
      job_id: jobByNumber['JOB-2024-001'],
      date:   '2024-01-16',
      notes:  'Completed demolition of offices on floors 2–4. Removed old drywall and framing. Site secured for electrical rough-in tomorrow.',
      data: wle(
        [
          { name: 'David Thompson',    hours: 8, rate: 75.00 },
          { name: 'Henry Wilson',      hours: 8, rate: 42.00 },
          { name: 'Isabella Martinez', hours: 8, rate: 55.00 },
        ],
        [{ name: 'Air Compressor 60 gal', hours: 8, rate: 25.00 }],
        [{ name: 'Disposal Bags', quantity: 30, unitPrice: 3.50, useCatalog: false }]
      ),
    },
    // JOB-2024-001 · Day 2
    {
      job_id: jobByNumber['JOB-2024-001'],
      date:   '2024-01-17',
      notes:  'Electrical rough-in started on floors 2 and 3. New conduit runs laid for 200A sub-panel on floor 3.',
      data: wle(
        [
          { name: 'David Thompson', hours: 8, rate: 75.00 },
          { name: 'Emma Rodriguez', hours: 8, rate: 65.00 },
        ],
        [{ name: 'Scissor Lift 19 ft', hours: 6, rate: 75.00 }],
        [{ name: 'Electrical Wire 12/2 100 ft', quantity: 5, unitPrice: 48.00 }]
      ),
    },
    // JOB-2024-002 · Day 1
    {
      job_id: jobByNumber['JOB-2024-002'],
      date:   '2024-02-05',
      notes:  'Poured foundation footings for Building A. Concrete cured overnight. Rebar inspected and approved.',
      data: wle(
        [
          { name: 'David Thompson', hours: 10, rate: 75.00 },
          { name: 'Henry Wilson',   hours: 10, rate: 42.00 },
          { name: 'Frank Chen',     hours:  8, rate: 60.00 },
        ],
        [
          { name: 'Concrete Mixer',    hours: 8, rate:  45.00 },
          { name: 'Excavator CAT 320', hours: 4, rate: 150.00 },
        ],
        [
          { name: 'Concrete Mix 50 lb bag', quantity: 80, unitPrice: 12.00 },
          { name: 'Rebar #4 20 ft',         quantity: 40, unitPrice: 14.00 },
        ]
      ),
    },
    // JOB-2024-003 · Day 1
    {
      job_id: jobByNumber['JOB-2024-003'],
      date:   '2024-03-11',
      notes:  'Removed damaged shingles from west section (approx. 800 sq ft). Installed new underlayment and ice barrier.',
      data: wle(
        [
          { name: 'David Thompson',    hours: 8, rate: 75.00 },
          { name: 'Isabella Martinez', hours: 8, rate: 55.00 },
          { name: 'Henry Wilson',      hours: 8, rate: 42.00 },
        ],
        [{ name: 'Air Compressor 60 gal', hours: 8, rate: 25.00 }],
        [{ name: 'Roofing Shingles (bundle)', quantity: 20, unitPrice: 35.00 }]
      ),
    },
    // JOB-2024-003 · Day 2
    {
      job_id: jobByNumber['JOB-2024-003'],
      date:   '2024-03-12',
      notes:  'Completed shingle replacement on all sections. Installed ridge cap and sealed skylights. Final inspection passed.',
      data: wle(
        [
          { name: 'David Thompson',    hours: 8, rate: 75.00 },
          { name: 'Isabella Martinez', hours: 8, rate: 55.00 },
        ],
        [{ name: 'Air Compressor 60 gal', hours: 6, rate: 25.00 }],
        [
          { name: 'Roofing Shingles (bundle)', quantity: 15, unitPrice: 35.00 },
          { name: 'Roofing Nails (box)',        quantity:  4, unitPrice: 12.00, useCatalog: false },
          { name: 'Skylight Sealant',           quantity:  2, unitPrice: 18.50, useCatalog: false },
        ]
      ),
    },
    // JOB-2024-004 · Day 1
    {
      job_id: jobByNumber['JOB-2024-004'],
      date:   '2024-04-22',
      notes:  'Shut off main power and removed old 200A panel. Installed new 400A service entrance and main breaker.',
      data: wle(
        [
          { name: 'Emma Rodriguez', hours: 9, rate: 65.00 },
          { name: 'David Thompson', hours: 9, rate: 75.00 },
        ],
        [{ name: 'Generator 25 kW', hours: 9, rate: 35.00 }],
        [
          { name: 'Electrical Wire 12/2 100 ft', quantity:  3, unitPrice:   48.00 },
          { name: '400A Main Breaker Panel',      quantity:  1, unitPrice: 1250.00, useCatalog: false },
          { name: 'Service Entrance Cable 2/0',   quantity:  2, unitPrice:  185.00, useCatalog: false },
        ]
      ),
    },
  ];

  // Work logs don't have a natural unique key so we only insert if the
  // table is empty for these jobs (to avoid duplicating on re-runs).
  const jobIds = Object.values(jobByNumber).filter(Boolean);
  if (jobIds.length > 0) {
    const { count } = await supabase
      .from('work_logs')
      .select('id', { count: 'exact', head: true })
      .in('job_id', jobIds);

    if ((count ?? 0) === 0) {
      const { error } = await supabase.from('work_logs').insert(workLogsPayload);
      if (error) {
        console.error('  ✗ Error inserting work_logs:', error.message);
      } else {
        log(`  ✔  ${workLogsPayload.length} work logs`);
      }
    } else {
      log(`  –  Work logs already exist (${count} found), skipping`);
    }
  }

  // ── 7. Templates ───────────────────────────────────────────────────────
  log('\n7/7  Inserting templates...');

  const templatesPayload = [
    {
      name: 'Standard Electrical Day',
      data: wle(
        [{ name: 'Emma Rodriguez', hours: 8, rate: 65.00 }],
        [
          { name: 'Scissor Lift 19 ft', hours: 4, rate: 75.00 },
          { name: 'Generator 25 kW',   hours: 8, rate: 35.00 },
        ],
        [{ name: 'Electrical Wire 12/2 100 ft', quantity: 2, unitPrice: 48.00 }]
      ),
    },
    {
      name: 'General Construction Day',
      data: wle(
        [
          { name: 'David Thompson',    hours: 8, rate: 75.00 },
          { name: 'Henry Wilson',      hours: 8, rate: 42.00 },
          { name: 'Isabella Martinez', hours: 8, rate: 55.00 },
        ],
        [{ name: 'Air Compressor 60 gal', hours: 8, rate: 25.00 }],
        [
          { name: 'Lumber 2×4×8',      quantity: 20, unitPrice:  8.50 },
          { name: 'Drywall Sheet 4×8', quantity: 10, unitPrice: 18.50 },
        ]
      ),
    },
    {
      name: 'Roofing Crew Day',
      data: wle(
        [
          { name: 'David Thompson',    hours: 8, rate: 75.00 },
          { name: 'Isabella Martinez', hours: 8, rate: 55.00 },
          { name: 'Henry Wilson',      hours: 8, rate: 42.00 },
        ],
        [{ name: 'Air Compressor 60 gal', hours: 8, rate: 25.00 }],
        [
          { name: 'Roofing Shingles (bundle)', quantity: 15, unitPrice: 35.00 },
          { name: 'Roofing Nails (box)',        quantity:  3, unitPrice: 12.00, useCatalog: false },
        ]
      ),
    },
  ];

  await upsertRows('templates', templatesPayload, 'name');
  log(`  ✔  ${templatesPayload.length} templates`);

  // ── Summary ────────────────────────────────────────────────────────────
  log('\n✅  Seed complete!\n');
  log('  Demo login credentials:');
  log('    Admin  :  admin@demo.com   /  Demo1234!');
  log('    Foreman:  foreman@demo.com /  Demo1234!\n');
}

seed().catch((err) => {
  console.error('Fatal error during seed:', err);
  process.exit(1);
});
