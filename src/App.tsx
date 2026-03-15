import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, 
  Calendar, 
  Users, 
  Truck, 
  Package, 
  Settings as SettingsIcon, 
  Plus, 
  ChevronRight, 
  FileText, 
  Clock,
  ArrowLeft,
  Trash2,
  Copy,
  Check,
  Download,
  Printer,
  Search,
  X,
  MoreVertical,
  Filter,
  Building2,
  Upload,
  Phone,
  Mail,
  MapPin,
  Globe,
  Edit3,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Job, Employee, Equipment, Material, WorkLog, Template, WorkLogEntry, User, Company, CompanySettings, CustomerDetails, InvoiceDetails } from './types';
import { supabase } from './supabase';

// --- LocalStorage Helpers ---
const COMPANY_SETTINGS_KEY = 'stp_company_settings';
const customerDetailsKey = (jobId: string | number) => `stp_customer_${jobId}`;
const invoiceDetailsKey = (jobId: string | number) => `stp_invoice_${jobId}`;

const defaultCompanySettings: CompanySettings = {
  name: 'Service Track Pro',
  address: '123 Service Way',
  city: 'Springfield, ST 55555',
  phone: '(555) 123-4567',
  email: 'billing@servicetrackpro.com',
  website: 'www.servicetrackpro.com',
  logo: '',
  paymentTerms: 'Payment is due within 30 days of invoice date.',
};

function loadCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(COMPANY_SETTINGS_KEY);
    return raw ? { ...defaultCompanySettings, ...JSON.parse(raw) } : { ...defaultCompanySettings };
  } catch {
    return { ...defaultCompanySettings };
  }
}

function saveCompanySettings(settings: CompanySettings) {
  localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(settings));
}

function loadCustomerDetails(jobId: string | number): CustomerDetails {
  try {
    const raw = localStorage.getItem(customerDetailsKey(jobId));
    return raw ? JSON.parse(raw) : { phone: '', email: '', billToAddress: '' };
  } catch {
    return { phone: '', email: '', billToAddress: '' };
  }
}

function saveCustomerDetails(jobId: string | number, details: CustomerDetails) {
  localStorage.setItem(customerDetailsKey(jobId), JSON.stringify(details));
}

function loadInvoiceDetails(jobId: string | number, job: Job): InvoiceDetails {
  try {
    const raw = localStorage.getItem(invoiceDetailsKey(jobId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  return {
    invoiceNumber: `INV-${job.job_number || jobId}`,
    invoiceDate: today.toISOString().split('T')[0],
    dueDate: dueDate.toISOString().split('T')[0],
    dateOfOrder: job.start_date || today.toISOString().split('T')[0],
    jobLocation: job.address || '',
  };
}

function saveInvoiceDetails(jobId: string | number, details: InvoiceDetails) {
  localStorage.setItem(invoiceDetailsKey(jobId), JSON.stringify(details));
}

// --- Components ---

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        if (!companyName.trim()) {
          setError('Please enter your company name.');
          setLoading(false);
          return;
        }

        // 1. Sign up to Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Create profile + company via secure RPC (handles RLS bootstrap)
          const { error: regError } = await supabase.rpc('register_with_company', {
            p_user_name: name || email.split('@')[0],
            p_company_name: companyName.trim(),
          });

          if (regError) console.error('Registration error:', regError);

          setError('Account created! You can now sign in.');
          setIsSignUp(false);
        }
      } else {
        // Sign in
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

          if (profileError) {
            console.warn('Profile not found in public.users, using fallback');
            onLogin({
              id: 0,
              name: email.split('@')[0],
              email: email,
              role: 'foreman'
            });
          } else {
            onLogin(profile as User);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-brand/20">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Service Track Pro</h1>
          <p className="text-slate-500">{isSignUp ? 'Create your account' : 'Sign in to your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={`p-3 text-sm rounded-lg border ${error.includes('created') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              {error}
            </div>
          )}
          
          {isSignUp && (
            <>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Full Name</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="e.g. Acme Services LLC"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Enter your company name. If the company already exists you will join it; otherwise a new company will be created and you will be the admin.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Email Address</label>
            <input 
              type="email" 
              required 
              className="input-field" 
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Password</label>
            <input 
              type="password" 
              required 
              className="input-field" 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-lg mt-4 disabled:opacity-50">
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-brand font-medium hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {!isSignUp && (
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Note: Demo accounts from SQL must be "Signed Up" first to enable Authentication.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// --- Company Registration Modal (shown when user has no company_id) ---
const CompanyRegistration = ({ user, onComplete }: { user: User; onComplete: (companyId: string) => void }) => {
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('register_with_company', {
        p_user_name:    user.name,
        p_company_name: companyName.trim(),
      });

      if (rpcError) throw rpcError;

      const companyId = (data as { company_id: string })?.company_id;
      if (companyId) {
        onComplete(companyId);
      } else {
        throw new Error('Unexpected response from server.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-brand/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900">Set Up Your Company</h2>
          <p className="text-slate-500 text-sm text-center mt-1">
            Enter your company name to get started. Create a new company or join an existing one.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg border bg-red-50 text-red-600 border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Acme Services LLC"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              If this company already exists you will join it as a team member; otherwise a new company will be created and you will be the admin.
            </p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-lg mt-4 disabled:opacity-50">
            {loading ? 'Setting up…' : 'Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const Layout = ({ children, activeTab, setActiveTab, user, companyName, onLogout }: { children: React.ReactNode, activeTab: string, setActiveTab: (t: string) => void, user: User, companyName: string, onLogout: () => void }) => {
  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-400 flex flex-col border-r border-slate-800 flex-shrink-0 overflow-y-auto">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-white font-bold text-lg tracking-tight font-display">{companyName || 'Service Track Pro'}</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('jobs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'jobs' ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="font-medium">Jobs</span>
            {activeTab === 'jobs' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />}
          </button>
          {user.role === 'admin' && (
            <>
              <button 
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'users' ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Users</span>
                {activeTab === 'users' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />}
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'settings' ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
              >
                <SettingsIcon className="w-5 h-5" />
                <span className="font-medium">Settings</span>
                {activeTab === 'settings' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />}
              </button>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-bold border border-slate-600 flex-shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm text-white font-medium truncate">{user.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{user.role}</span>
              </div>
            </div>
            <button onClick={onLogout} className="text-slate-500 hover:text-white transition-colors">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </main>
    </div>
  );
};

const Dashboard = ({ onSelectJob, user }: { onSelectJob: (id: number) => void, user: User }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [foremen, setForemen] = useState<User[]>([]);
  const [newJob, setNewJob] = useState<Partial<Job>>({
    customer_name: '',
    job_name: '',
    job_number: '',
    address: '',
    status: 'active',
    foreman_id: undefined
  });
  const [newCustomer, setNewCustomer] = useState<CustomerDetails>({ phone: '', email: '', billToAddress: '' });

  useEffect(() => {
    const fetchJobs = async () => {
      let query = supabase.from('jobs').select('*').order('id', { ascending: false });
      
      if (user.role === 'foreman') {
        query = query.eq('foreman_id', user.id);
      }
      
      const { data, error } = await query;
      if (!error && data) setJobs(data as Job[]);
    };

    const fetchForemen = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'foreman');
      if (!error && data) setForemen(data as User[]);
    };

    fetchJobs();
    if (user.role === 'admin') {
      fetchForemen();
    }
  }, [user]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.company_id) return; // guard: user must belong to a company
    const jobWithCompany = { ...newJob, company_id: user.company_id };
    const { data, error } = await supabase
      .from('jobs')
      .insert([jobWithCompany])
      .select()
      .single();
      
    if (!error && data) {
      // Save customer contact details to localStorage
      if (newCustomer.phone || newCustomer.email || newCustomer.billToAddress) {
        saveCustomerDetails(data.id, newCustomer);
      }
      // Reset form state
      setNewCustomer({ phone: '', email: '', billToAddress: '' });
      setIsAdding(false);
      onSelectJob(data.id);
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.job_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">Active Jobs</h2>
          <p className="text-slate-500 mt-1">Manage your ongoing projects and daily logs.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search jobs..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {user.role === 'admin' && (
            <button 
              onClick={() => setIsAdding(true)}
              className="btn-primary flex items-center gap-2 whitespace-nowrap shadow-lg shadow-brand/20"
            >
              <Plus className="w-5 h-5" />
              New Job
            </button>
          )}
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="p-20 border-2 border-dashed border-slate-200 rounded-3xl text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No jobs found</h3>
          <p className="text-slate-500 mt-1">Try a different search or create a new project.</p>
          <button onClick={() => setIsAdding(true)} className="mt-4 text-brand font-bold hover:underline">Create your first job</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map(job => (
            <motion.div 
              key={job.id}
              whileHover={{ y: -4 }}
              className="card cursor-pointer group"
              onClick={() => onSelectJob(job.id!)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-100">
                    {job.status}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">#{job.job_number}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand transition-colors">{job.job_name}</h3>
                <p className="text-slate-500 text-sm mt-1">{job.customer_name}</p>
                
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">{job.start_date || 'No date'}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-bold font-display text-slate-900">New Project</h3>
                  <p className="text-slate-500 text-sm">Set up a new job to start tracking logs.</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleCreateJob} className="p-8 space-y-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Customer / Company</label>
                      <input 
                        required
                        className="input-field text-lg" 
                        placeholder="e.g. City Power & Light"
                        value={newJob.customer_name ?? ''}
                        onChange={e => setNewJob({...newJob, customer_name: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Project Name</label>
                      <input 
                        required
                        className="input-field text-lg" 
                        placeholder="e.g. Substation Upgrade"
                        value={newJob.job_name ?? ''}
                        onChange={e => setNewJob({...newJob, job_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Job Number</label>
                      <input 
                        className="input-field font-mono" 
                        placeholder="e.g. 2024-001"
                        value={newJob.job_number ?? ''}
                        onChange={e => setNewJob({...newJob, job_number: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Start Date</label>
                      <input 
                        type="date"
                        className="input-field"
                        value={newJob.start_date ?? ''}
                        onChange={e => setNewJob({...newJob, start_date: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Assign Foreman</label>
                      <select 
                        required
                        className="input-field"
                        value={newJob.foreman_id ?? ''}
                        onChange={e => setNewJob({...newJob, foreman_id: Number(e.target.value)})}
                      >
                        <option value="">Select a Foreman</option>
                        {foremen.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Site Address</label>
                      <input 
                        className="input-field" 
                        placeholder="123 Industrial Way, Springfield"
                        value={newJob.address ?? ''}
                        onChange={e => setNewJob({...newJob, address: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Contact Details */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Contact Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Customer Phone</label>
                      <input 
                        type="tel"
                        className="input-field" 
                        placeholder="(555) 000-0000"
                        value={newCustomer.phone}
                        onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Customer Email</label>
                      <input 
                        type="email"
                        className="input-field" 
                        placeholder="contact@company.com"
                        value={newCustomer.email}
                        onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Billing Address (if different from site)</label>
                      <input 
                        className="input-field" 
                        placeholder="PO Box / Billing address"
                        value={newCustomer.billToAddress}
                        onChange={e => setNewCustomer({...newCustomer, billToAddress: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary flex-1 py-4">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 py-4 text-lg shadow-xl shadow-brand/20">Create Project</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const JobDetails = ({ jobId, onBack, user }: { jobId: number, onBack: () => void, user: User }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [isViewingInvoice, setIsViewingInvoice] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const fetchJob = async () => {
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();
      
    if (!jobError && jobData) {
      const { data: logsData, error: logsError } = await supabase
        .from('work_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('date', { ascending: false });
        
      if (!logsError && logsData) {
        setJob({ ...jobData, logs: logsData } as Job);
      } else {
        setJob(jobData as Job);
      }
    }
  };

  useEffect(() => {
    fetchJob();
    const fetchData = async () => {
      const [empRes, eqRes, matRes, tempRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('equipment').select('*'),
        supabase.from('materials').select('*'),
        supabase.from('templates').select('*')
      ]);
      
      if (empRes.data) setEmployees(empRes.data);
      if (eqRes.data) setEquipment(eqRes.data);
      if (matRes.data) setMaterials(matRes.data);
      if (tempRes.data) setTemplates(tempRes.data);
    };
    fetchData();
  }, [jobId]);

  const handleDeleteLog = async (id: number) => {
    if (!confirm('Are you sure you want to delete this log?')) return;
    await supabase.from('work_logs').delete().eq('id', id);
    fetchJob();
  };

  const handleRepeatLog = async (log: WorkLog) => {
    if (!user.company_id) return; // guard: user must belong to a company
    const newLog = {
      job_id: jobId,
      date: new Date().toISOString().split('T')[0],
      notes: log.notes,
      data: log.data,
      company_id: user.company_id,
    };
    await supabase.from('work_logs').insert([newLog]);
    fetchJob();
  };

  if (!job) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-brand mb-6 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">{job.job_name}</h2>
            <span className="px-2 py-1 bg-blue-50 text-brand text-[10px] font-bold uppercase tracking-wider rounded border border-blue-100">
              {job.job_number}
            </span>
          </div>
          <p className="text-slate-500 text-lg">{job.customer_name} • {job.address}</p>
        </div>
        <div className="flex gap-3">
          {user.role === 'admin' && (
            <button 
              onClick={() => setIsViewingInvoice(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Invoice
            </button>
          )}
          <button 
            onClick={() => setIsAddingLog(true)}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-brand/20"
          >
            <Plus className="w-5 h-5" />
            Add Daily Log
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
          <Clock className="w-5 h-5 text-brand" />
          Work History
        </h3>
        
        {job.logs?.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center">
            <p className="text-slate-400">No work logs recorded yet.</p>
            <button onClick={() => setIsAddingLog(true)} className="text-slate-900 font-bold mt-2 hover:underline">Add your first day</button>
          </div>
        ) : (
          job.logs?.map(log => (
            <div key={log.id} className="card">
              <div className="p-6 flex justify-between items-center bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-900 font-bold">
                    {new Date(log.date).getDate()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                    {log.notes ? (
                      <p className="text-sm text-slate-600 mt-0.5 max-w-lg">{log.notes}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No description</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleRepeatLog(log)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                    title="Repeat Day"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteLog(log.id!)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                    title="Delete Log"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users className="w-3 h-3" /> Employees
                  </h5>
                  <ul className="space-y-2">
                    {log.data.employees.map((e, idx) => (
                      <li key={idx} className="text-sm flex justify-between">
                        <span className="text-slate-600">{employees.find(emp => emp.id === e.employeeId)?.name}</span>
                        <span className="font-mono font-medium">{e.hours}h</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Truck className="w-3 h-3" /> Equipment
                  </h5>
                  <ul className="space-y-2">
                    {log.data.equipment.map((e, idx) => (
                      <li key={idx} className="text-sm flex justify-between">
                        <span className="text-slate-600">{equipment.find(eq => eq.id === e.equipmentId)?.name}</span>
                        <span className="font-mono font-medium">{e.hours}h</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Package className="w-3 h-3" /> Materials
                  </h5>
                  <ul className="space-y-2">
                    {log.data.materials.map((m, idx) => (
                      <li key={idx} className="text-sm flex justify-between">
                        <span className="text-slate-600">{m.name}</span>
                        <span className="font-mono font-medium">x{m.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isAddingLog && (
          <WorkLogForm 
            jobId={jobId}
            companyId={user.company_id}
            employees={employees} 
            equipment={equipment} 
            materials={materials}
            templates={templates}
            onClose={() => setIsAddingLog(false)} 
            onSave={() => {
              setIsAddingLog(false);
              fetchJob();
            }} 
          />
        )}
        {isViewingInvoice && (
          <InvoiceView 
            job={job} 
            employees={employees} 
            equipment={equipment} 
            materials={materials}
            onClose={() => setIsViewingInvoice(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const WorkLogForm = ({ jobId, companyId, employees, equipment, materials, templates, onClose, onSave }: { 
  jobId: number,
  companyId: string | undefined,
  employees: Employee[], 
  equipment: Equipment[], 
  materials: Material[],
  templates: Template[],
  onClose: () => void, 
  onSave: () => void 
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [matchHours, setMatchHours] = useState(true);
  const [crewHours, setCrewHours] = useState(8);
  const [isMaterialMenuOpen, setIsMaterialMenuOpen] = useState(false);
  const [materialMenuPos, setMaterialMenuPos] = useState({ top: 0, right: 0 });
  
  const [selectedEmployees, setSelectedEmployees] = useState<{ employeeId: number; hours: number; rate: number }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<{ equipmentId: number; hours: number; rate: number }[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<{ materialId?: number; name: string; quantity: number; unitPrice: number }[]>([]);

  const materialBtnRef = useRef<HTMLButtonElement>(null);
  const formScrollRef = useRef<HTMLFormElement>(null);
  const materialsEndRef = useRef<HTMLDivElement>(null);

  const applyTemplate = (template: Template) => {
    setSelectedEmployees(template.data.employees);
    setSelectedEquipment(template.data.equipment);
    setSelectedMaterials(template.data.materials);
  };

  const handleAddEmployee = (id: number) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    setSelectedEmployees([...selectedEmployees, { employeeId: id, hours: crewHours, rate: emp.hourly_rate }]);
  };

  const handleAddEquipment = (id: number) => {
    const eq = equipment.find(e => e.id === id);
    if (!eq) return;
    setSelectedEquipment([...selectedEquipment, { equipmentId: id, hours: crewHours, rate: eq.hourly_rate }]);
  };

  const handleOpenMaterialMenu = () => {
    if (materialBtnRef.current) {
      const rect = materialBtnRef.current.getBoundingClientRect();
      setMaterialMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsMaterialMenuOpen(v => !v);
  };

  const handleAddMaterial = (mat: Material) => {
    setSelectedMaterials(prev => [...prev, { materialId: mat.id, name: mat.name, quantity: 1, unitPrice: mat.unit_price }]);
    // Delay slightly to let React render the new item before scrolling to it
    setTimeout(() => {
      materialsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  useEffect(() => {
    if (matchHours) {
      setSelectedEmployees(prev => prev.map(e => ({ ...e, hours: crewHours })));
      setSelectedEquipment(prev => prev.map(e => ({ ...e, hours: crewHours })));
    }
  }, [crewHours, matchHours]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return; // guard: must have a company to save logs
    const logData: WorkLogEntry = {
      employees: selectedEmployees,
      equipment: selectedEquipment,
      materials: selectedMaterials
    };
    
    const { error } = await supabase
      .from('work_logs')
      .insert([{ job_id: jobId, date, notes, data: logData, company_id: companyId }]);
      
    if (!error) onSave();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Daily Work Log</h3>
            <p className="text-slate-500 text-sm">Record crew, equipment, and materials for the day.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <form ref={formScrollRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-8 space-y-10">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description / Notes</label>
              <textarea 
                className="input-field resize-none" 
                rows={3}
                placeholder="e.g. Completed trenching for main conduit run. Site conditions were good. Crew worked efficiently on the east side perimeter." 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
              />
            </div>
          </div>

          {/* Quick Controls */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-wrap items-center gap-8 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <span className="font-bold">Crew Hours</span>
              </div>
              <input 
                type="number" 
                className="w-20 bg-slate-800 border-none rounded-lg px-3 py-2 text-center font-mono text-lg focus:ring-2 focus:ring-white/20" 
                value={crewHours}
                onChange={e => setCrewHours(Number(e.target.value))}
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${matchHours ? 'bg-brand border-brand' : 'border-slate-700 group-hover:border-slate-500'}`}>
                {matchHours && <Check className="w-4 h-4 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={matchHours} onChange={e => setMatchHours(e.target.checked)} />
              <span className="text-sm font-medium">Match Employee & Equipment Hours</span>
            </label>
            <div className="h-8 w-px bg-slate-800 hidden md:block" />
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Templates</span>
              <div className="flex gap-2">
                {templates.map(t => (
                  <button 
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Data Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Employees */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-400" /> Employees
                </h4>
                <select 
                  className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 outline-none"
                  onChange={(e) => handleAddEmployee(Number(e.target.value))}
                  value=""
                >
                  <option value="" disabled>+ Add Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                {selectedEmployees.map((se, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{employees.find(e => e.id === se.employeeId)?.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{employees.find(e => e.id === se.employeeId)?.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono" 
                        value={se.hours}
                        onChange={e => {
                          const newEmps = [...selectedEmployees];
                          newEmps[idx].hours = Number(e.target.value);
                          setSelectedEmployees(newEmps);
                        }}
                      />
                      <span className="text-xs text-slate-400">hrs</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedEmployees(selectedEmployees.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Equipment */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Truck className="w-5 h-5 text-slate-400" /> Equipment
                </h4>
                <select 
                  className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 outline-none"
                  onChange={(e) => handleAddEquipment(Number(e.target.value))}
                  value=""
                >
                  <option value="" disabled>+ Add Equipment</option>
                  {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                {selectedEquipment.map((se, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{equipment.find(e => e.id === se.equipmentId)?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono" 
                        value={se.hours}
                        onChange={e => {
                          const newEq = [...selectedEquipment];
                          newEq[idx].hours = Number(e.target.value);
                          setSelectedEquipment(newEq);
                        }}
                      />
                      <span className="text-xs text-slate-400">hrs</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedEquipment(selectedEquipment.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Materials */}
            <section className="lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-400" /> Materials
                </h4>
                <div className="relative">
                  <button 
                    ref={materialBtnRef}
                    type="button" 
                    onClick={handleOpenMaterialMenu}
                    className="text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 flex items-center gap-2 hover:bg-slate-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Material
                  </button>
                  <AnimatePresence>
                    {isMaterialMenuOpen && (
                      <>
                        {/* z-[55]/z-[60]: above the modal's z-50, backdrop below dropdown */}
                        <div className="fixed inset-0 z-[55]" onClick={() => setIsMaterialMenuOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          style={{ top: materialMenuPos.top, right: materialMenuPos.right }}
                          className="fixed w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[60] max-h-64 overflow-y-auto"
                        >
                          {materials.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-400">No materials found.</p>
                          ) : materials.map(m => (
                            <button 
                              key={m.id}
                              type="button"
                              onClick={() => {
                                handleAddMaterial(m);
                                setIsMaterialMenuOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-none"
                            >
                              <p className="font-medium">{m.name}</p>
                              <p className="text-[10px] text-slate-400">${m.unit_price} / unit</p>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedMaterials.map((sm, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{sm.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">${sm.unitPrice} / unit</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Qty</span>
                      <input 
                        type="number" 
                        className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono" 
                        value={sm.quantity}
                        onChange={e => {
                          const newMats = [...selectedMaterials];
                          newMats[idx].quantity = Number(e.target.value);
                          setSelectedMaterials(newMats);
                        }}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedMaterials(selectedMaterials.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div ref={materialsEndRef} />
              </div>
            </section>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex gap-8">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Labor</p>
              <p className="text-lg font-bold font-mono">${selectedEmployees.reduce((acc, e) => acc + (e.hours * e.rate), 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipment</p>
              <p className="text-lg font-bold font-mono">${selectedEquipment.reduce((acc, e) => acc + (e.hours * e.rate), 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materials</p>
              <p className="text-lg font-bold font-mono">${selectedMaterials.reduce((acc, m) => acc + (m.quantity * m.unitPrice), 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSubmit} className="btn-primary px-8">Save Work Log</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const InvoiceView = ({ job, employees, equipment, materials, onClose }: { 
  job: Job, 
  employees: Employee[], 
  equipment: Equipment[], 
  materials: Material[],
  onClose: () => void 
}) => {
  const [company, setCompany] = useState<CompanySettings>(loadCompanySettings);
  const [customer, setCustomer] = useState<CustomerDetails>(() => loadCustomerDetails(job.id!));
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails>(() => loadInvoiceDetails(job.id!, job));
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const laborTotal = job.logs?.reduce((acc, log) => acc + log.data.employees.reduce((lAcc, e) => lAcc + (e.hours * e.rate), 0), 0) || 0;
  const equipmentTotal = job.logs?.reduce((acc, log) => acc + log.data.equipment.reduce((eAcc, e) => eAcc + (e.hours * e.rate), 0), 0) || 0;
  const materialTotal = job.logs?.reduce((acc, log) => acc + log.data.materials.reduce((mAcc, m) => mAcc + (m.quantity * m.unitPrice), 0), 0) || 0;
  const grandTotal = laborTotal + equipmentTotal + materialTotal;

  const billToAddress = customer.billToAddress || job.address;

  const handleSaveSettings = () => {
    saveCompanySettings(company);
    saveCustomerDetails(job.id!, customer);
    saveInvoiceDetails(job.id!, invoiceDetails);
    setIsEditingSettings(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfError('');

    // Open a blank window IMMEDIATELY — while we're still in the user-gesture
    // context.  iOS Safari and Android Chrome both block window.open() that
    // happens inside an async callback after an await, so we grab the handle
    // here (synchronous) and navigate it to the PDF once it's ready.
    const pdfWindow = window.open('about:blank', '_blank');
    if (pdfWindow) {
      // Populate the loading screen using DOM methods (avoids document.write).
      const doc = pdfWindow.document;
      doc.title = 'Invoice';
      const body = doc.body;
      body.style.cssText = 'margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;font-size:1.1rem;color:#64748b;background:#f8fafc;';
      const msg = doc.createElement('p');
      msg.textContent = 'Generating PDF\u2026';
      body.appendChild(msg);
    }

    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const BRAND = [59, 130, 246] as [number, number, number];
      const DARK  = [15, 23, 42]  as [number, number, number];
      const GRAY  = [100, 116, 139] as [number, number, number];
      const LIGHT = [248, 250, 252] as [number, number, number];
      const WHITE = [255, 255, 255] as [number, number, number];

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const PW = pdf.internal.pageSize.getWidth();   // 595
      const PH = pdf.internal.pageSize.getHeight();  // 842
      const M  = 40; // margin
      const CW = PW - M * 2; // content width

      // ── Brand accent bar (top) ──────────────────────────────────────
      pdf.setFillColor(...BRAND);
      pdf.rect(0, 0, PW, 8, 'F');

      // ── Company section (left) ──────────────────────────────────────
      let y = 32;
      const cLines = [company.address, company.city, company.phone, company.email, company.website].filter(Boolean) as string[];
      // Logo (base64 image) if present
      if (company.logo) {
        try {
          const ext = company.logo.startsWith('data:image/png') ? 'PNG'
                    : company.logo.startsWith('data:image/svg') ? 'SVG'
                    : 'JPEG';
          pdf.addImage(company.logo, ext, M, y, 50, 50, undefined, 'FAST');
          // company text to the right of logo
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          pdf.setTextColor(...DARK);
          pdf.text(company.name || 'Company Name', M + 58, y + 14);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...GRAY);
          cLines.forEach((line, i) => pdf.text(line, M + 58, y + 26 + i * 10));
        } catch {
          // Logo failed — fall back to text-only
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          pdf.setTextColor(...DARK);
          pdf.text(company.name || 'Company Name', M, y + 10);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...GRAY);
          cLines.forEach((line, i) => pdf.text(line, M, y + 22 + i * 10));
        }
      } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(...DARK);
        pdf.text(company.name || 'Company Name', M, y + 10);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...GRAY);
        cLines.forEach((line, i) => pdf.text(line, M, y + 22 + i * 10));
      }

      // ── INVOICE title + meta (right) ─────────────────────────────────
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(36);
      pdf.setTextColor(220, 226, 236);
      pdf.text('INVOICE', PW - M, y + 28, { align: 'right' });

      pdf.setFontSize(8);
      const metaLeft  = PW - M - 130;
      const metaRight = PW - M;
      const metaRows = [
        ['Invoice #',    invoiceDetails.invoiceNumber || '—'],
        ['Invoice Date', formatDate(invoiceDetails.invoiceDate)],
        ['Due Date',     formatDate(invoiceDetails.dueDate)],
        ['Date of Order',formatDate(invoiceDetails.dateOfOrder)],
      ];
      metaRows.forEach(([label, value], i) => {
        const ry = y + 44 + i * 12;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...GRAY);
        pdf.text(label, metaLeft, ry, { align: 'left' });
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...DARK);
        pdf.text(value, metaRight, ry, { align: 'right' });
      });

      // ── Horizontal rule ─────────────────────────────────────────────
      y += 100;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(M, y, PW - M, y);
      y += 14;

      // ── Bill To + Project grid ───────────────────────────────────────
      const colW = CW / 4;
      const boxH = 68;
      const boxPad = 8;
      const labelFontSize = 7;
      const valueFontSize = 9;
      const boxes = [
        { title: 'Bill To',      lines: [job.customer_name, billToAddress, customer.phone, customer.email].filter(Boolean) as string[] },
        { title: 'Project',      lines: [job.job_name, `Status: ${job.status}`] },
        { title: 'Job Number',   lines: [job.job_number] },
        { title: 'Job Location', lines: [invoiceDetails.jobLocation || job.address || '—'] },
      ];

      boxes.forEach((box, i) => {
        const bx = M + i * colW;
        const by = y;
        pdf.setFillColor(...LIGHT);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(bx, by, colW - 4, boxH, 4, 4, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(labelFontSize);
        pdf.setTextColor(...BRAND);
        pdf.text(box.title.toUpperCase(), bx + boxPad, by + boxPad + 6);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(valueFontSize);
        pdf.setTextColor(...DARK);
        box.lines.slice(0, 4).forEach((line, li) => {
          const displayLine = pdf.splitTextToSize(line, colW - boxPad * 2 - 4)[0];
          pdf.text(displayLine, bx + boxPad, by + boxPad + 18 + li * 11);
        });
      });

      // Amount Due box (replaces last box — full right column)
      const adX = M + 3 * colW;
      const adY = y;
      pdf.setFillColor(...BRAND);
      pdf.roundedRect(adX, adY, colW - 4, boxH, 4, 4, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text('AMOUNT DUE', adX + boxPad, adY + boxPad + 6);
      pdf.setFontSize(18);
      pdf.text(`$${grandTotal.toFixed(2)}`, adX + boxPad, adY + boxPad + 26);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(200, 220, 255);
      pdf.text(`Due ${formatDate(invoiceDetails.dueDate)}`, adX + boxPad, adY + boxPad + 40);

      y += boxH + 18;

      // ── Line Items Table ────────────────────────────────────────────
      const tableBody: (string | { content: string; colSpan?: number; styles?: object })[][] = [];

      (job.logs || []).forEach((log, logIdx) => {
        const logDate = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const headerLabel = `Daily Log #${logIdx + 1}${log.notes ? `  —  ${log.notes}` : ''}`;
        tableBody.push([
          { content: headerLabel, colSpan: 5, styles: { fillColor: [239, 246, 255], textColor: BRAND, fontStyle: 'bold', fontSize: 7, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } } },
        ]);

        log.data.employees.forEach((e) => {
          const empName = employees.find(emp => emp.id === e.employeeId)?.name || `Employee #${e.employeeId}`;
          const role    = employees.find(emp => emp.id === e.employeeId)?.role || '';
          tableBody.push([
            `Labor — ${empName}${role ? `  (${role})` : ''}`,
            logDate,
            `${e.hours}h`,
            `$${e.rate.toFixed(2)}/hr`,
            `$${(e.hours * e.rate).toFixed(2)}`,
          ]);
        });
        log.data.equipment.forEach((e) => {
          const eqName = equipment.find(eq => eq.id === e.equipmentId)?.name || `Equipment #${e.equipmentId}`;
          tableBody.push([`Equipment — ${eqName}`, logDate, `${e.hours}h`, `$${e.rate.toFixed(2)}/hr`, `$${(e.hours * e.rate).toFixed(2)}`]);
        });
        log.data.materials.forEach((m) => {
          tableBody.push([`Material — ${m.name}`, logDate, `${m.quantity} units`, `$${m.unitPrice.toFixed(2)}/unit`, `$${(m.quantity * m.unitPrice).toFixed(2)}`]);
        });
      });

      // Reserve 210pt at the bottom so totals + footer always fit on the same
      // page as the last table row (totals≈100pt + footer≈80pt + brand bar≈30pt).
      autoTable(pdf, {
        startY: y,
        margin: { left: M, right: M, bottom: 210 },
        head: [['Description', 'Date', 'Qty / Hrs', 'Rate', 'Total']],
        body: tableBody,
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, textColor: DARK, lineColor: [226, 232, 240], lineWidth: 0.3 },
        headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 7, cellPadding: { top: 6, bottom: 6, left: 5, right: 5 } },
        alternateRowStyles: { fillColor: LIGHT },
        columnStyles: {
          0: { cellWidth: CW * 0.38 },
          1: { cellWidth: CW * 0.16 },
          2: { cellWidth: CW * 0.13, halign: 'center' },
          3: { cellWidth: CW * 0.15, halign: 'right' },
          4: { cellWidth: CW * 0.18, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell(data) {
          // Style the "Daily Log" group header rows
          if (Array.isArray(data.row.raw) && data.row.raw.length === 1 && typeof data.row.raw[0] === 'object' && 'colSpan' in data.row.raw[0]) {
            data.cell.styles.fillColor = [239, 246, 255];
            data.cell.styles.textColor = BRAND;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize  = 7.5;
          }
        },
      });

      // ── Totals ───────────────────────────────────────────────────────
      const pdfWithTable = pdf as unknown as { lastAutoTable: { finalY: number } };
      const finalY = pdfWithTable.lastAutoTable.finalY + 16;
      const totW = 200;
      const totX = PW - M - totW;

      pdf.setFillColor(...LIGHT);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(totX, finalY, totW, 80, 4, 4, 'FD');

      const totals = [
        ['Labor Subtotal',     `$${laborTotal.toFixed(2)}`],
        ['Equipment Subtotal', `$${equipmentTotal.toFixed(2)}`],
        ['Materials Subtotal', `$${materialTotal.toFixed(2)}`],
      ];
      totals.forEach(([label, val], i) => {
        const ty = finalY + 12 + i * 14;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...GRAY);
        pdf.text(label, totX + 10, ty);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...DARK);
        pdf.text(val, totX + totW - 10, ty, { align: 'right' });
      });
      // Divider
      pdf.setDrawColor(226, 232, 240);
      pdf.line(totX + 6, finalY + 52, totX + totW - 6, finalY + 52);
      // Grand total
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...DARK);
      pdf.text('Total Due', totX + 10, finalY + 66);
      pdf.setFontSize(14);
      pdf.setTextColor(...BRAND);
      pdf.text(`$${grandTotal.toFixed(2)}`, totX + totW - 10, finalY + 66, { align: 'right' });

      // ── Footer ───────────────────────────────────────────────────────
      // autoTable's margin.bottom=210 guarantees at least 210 pt of space
      // below the last table row, so totals + footer always sit on the same
      // page without an extra page break.
      const totalsEndY = finalY + 80;
      const footerStart = totalsEndY + 20;

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(M, footerStart, PW - M, footerStart);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...GRAY);
      pdf.text('PAYMENT TERMS', M, footerStart + 12);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...DARK);
      pdf.text(company.paymentTerms || 'Net 30', M, footerStart + 24);
      pdf.setFontSize(7);
      pdf.setTextColor(...GRAY);
      pdf.text(`Please include invoice number ${invoiceDetails.invoiceNumber} on all payments.`, M, footerStart + 36);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...GRAY);
      pdf.text('MAKE CHECKS PAYABLE TO:', PW - M, footerStart + 12, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...DARK);
      pdf.text(company.name || '', PW - M, footerStart + 24, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...GRAY);
      const remitLines = [[company.address, company.city].filter(Boolean).join(', '), company.email].filter(Boolean);
      remitLines.forEach((line, i) => pdf.text(line, PW - M, footerStart + 36 + i * 10, { align: 'right' }));

      // Thank you note
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(203, 213, 225);
      pdf.text('THANK YOU FOR YOUR BUSINESS!', PW / 2, footerStart + 58, { align: 'center' });

      // Brand accent bar (bottom) — drawn on the very last page
      pdf.setPage(pdf.getNumberOfPages());
      pdf.setFillColor(...BRAND);
      pdf.rect(0, PH - 8, PW, 8, 'F');

      // ── Download ─────────────────────────────────────────────────────
      const fileName = `Invoice-${invoiceDetails.invoiceNumber || job.job_number || 'export'}.pdf`;
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      if (pdfWindow && !pdfWindow.closed) {
        // Navigate the pre-opened window to the PDF blob URL.
        // • iOS Safari  → opens the PDF viewer; Share Sheet lets user save/share
        // • Android     → opens PDF in Chrome PDF viewer (download from menu)
        // • Desktop     → opens PDF in browser PDF viewer or prompts download
        pdfWindow.location.href = blobUrl;
      } else {
        // Popup was blocked — fall back to a hidden <a download> click.
        // Works on Android Chrome and desktop browsers.
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Revoke the blob URL after enough time for the viewer/download to start.
      // 30 s is generous: iOS Share Sheet and Android download manager both
      // read the blob well within this window.
      const BLOB_CLEANUP_MS = 30_000;
      setTimeout(() => URL.revokeObjectURL(blobUrl), BLOB_CLEANUP_MS);
    } catch (err) {
      if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
      console.error('PDF export failed:', err);
      setPdfError('Could not generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex flex-col">
      {/* Toolbar — always visible, never scrolls away */}
      <div className="flex-shrink-0 w-full max-w-5xl mx-auto pt-6 pb-4 px-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-white">
          <h3 className="text-xl sm:text-2xl font-bold font-display">Invoice Preview</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2 text-sm"
            >
              <Edit3 className="w-4 h-4" /> {isEditingSettings ? 'Hide Details' : 'Edit Details'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2 text-sm disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {isExportingPdf ? 'Generating…' : 'Download PDF'}
            </button>
            <button onClick={() => window.print()} className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2 text-sm print:hidden">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="btn-primary bg-white text-slate-900 hover:bg-slate-100 text-sm">Close</button>
          </div>
        </div>
      </div>

      {/* Scrollable invoice content */}
      <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto pb-8 px-4">

        {/* PDF error banner */}
        {pdfError && (
          <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium print:hidden">
            <span>{pdfError}</span>
            <button onClick={() => setPdfError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Editable Invoice Settings Panel */}
        {isEditingSettings && (
          <div className="bg-white rounded-2xl shadow-xl mb-6 overflow-hidden print:hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h4 className="font-bold text-slate-900 flex items-center gap-2"><Edit3 className="w-4 h-4 text-brand" /> Invoice & Customer Details</h4>
              <button onClick={handleSaveSettings} className="btn-primary flex items-center gap-2 text-sm py-2">
                <Save className="w-4 h-4" /> Save Details
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Details */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Details</p>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Invoice Number</label>
                  <input className="input-field" value={invoiceDetails.invoiceNumber} onChange={e => setInvoiceDetails({...invoiceDetails, invoiceNumber: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Invoice Date</label>
                  <input type="date" className="input-field" value={invoiceDetails.invoiceDate} onChange={e => setInvoiceDetails({...invoiceDetails, invoiceDate: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Due Date</label>
                  <input type="date" className="input-field" value={invoiceDetails.dueDate} onChange={e => setInvoiceDetails({...invoiceDetails, dueDate: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date of Order</label>
                  <input type="date" className="input-field" value={invoiceDetails.dateOfOrder} onChange={e => setInvoiceDetails({...invoiceDetails, dateOfOrder: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Job Location</label>
                  <input className="input-field" placeholder="Job site location" value={invoiceDetails.jobLocation} onChange={e => setInvoiceDetails({...invoiceDetails, jobLocation: e.target.value})} />
                </div>
              </div>
              {/* Customer Details */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Contact</p>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Customer Phone</label>
                  <input className="input-field" type="tel" placeholder="(555) 000-0000" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Customer Email</label>
                  <input className="input-field" type="email" placeholder="contact@company.com" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Billing Address (if different from site)</label>
                  <input className="input-field" placeholder="Billing / PO address" value={customer.billToAddress} onChange={e => setCustomer({...customer, billToAddress: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== INVOICE DOCUMENT ===================== */}
        <div className="bg-white rounded-lg shadow-2xl text-slate-900 print:shadow-none print:rounded-none" id="invoice">

          {/* Color Bar */}
          <div className="h-2 bg-brand rounded-t-lg print:rounded-none" />

          <div className="p-5 sm:p-8 md:p-10">
            {/* Header: Company + INVOICE */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5 mb-8">
              {/* Company Info */}
              <div className="flex items-start gap-4">
                {company.logo ? (
                  <img src={company.logo} alt="Company Logo" className="h-12 w-auto object-contain sm:h-16" />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 flex-shrink-0">
                    <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-slate-900">{company.name}</h1>
                  <p className="text-sm text-slate-500 mt-0.5">{company.address}</p>
                  <p className="text-sm text-slate-500">{company.city}</p>
                  <div className="flex flex-wrap gap-x-4 mt-1">
                    {company.phone && <p className="text-sm text-slate-500">{company.phone}</p>}
                    {company.email && <p className="text-sm text-slate-500">{company.email}</p>}
                    {company.website && <p className="text-sm text-slate-500">{company.website}</p>}
                  </div>
                </div>
              </div>

              {/* Invoice Title + Meta */}
              <div className="sm:text-right">
                <h2 className="text-4xl sm:text-6xl font-black text-slate-100 uppercase tracking-tighter font-display leading-none mb-3">INVOICE</h2>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center sm:justify-end gap-3">
                    <span className="text-slate-400 font-medium">Invoice #</span>
                    <span className="font-bold text-slate-900 font-mono">{invoiceDetails.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center sm:justify-end gap-3">
                    <span className="text-slate-400 font-medium">Invoice Date</span>
                    <span className="font-semibold text-slate-700">{formatDate(invoiceDetails.invoiceDate)}</span>
                  </div>
                  <div className="flex items-center sm:justify-end gap-3">
                    <span className="text-slate-400 font-medium">Due Date</span>
                    <span className="font-semibold text-red-600">{formatDate(invoiceDetails.dueDate)}</span>
                  </div>
                  <div className="flex items-center sm:justify-end gap-3">
                    <span className="text-slate-400 font-medium">Date of Order</span>
                    <span className="font-semibold text-slate-700">{formatDate(invoiceDetails.dateOfOrder)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-200 mb-8" />

            {/* Bill To + Project Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Bill To */}
              <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-100">
                <p className="text-[10px] font-bold text-brand uppercase tracking-widest mb-3">Bill To</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{job.customer_name}</p>
                <p className="text-sm text-slate-600 mt-1">{billToAddress}</p>
                {customer.phone && (
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" />{customer.phone}</p>
                )}
                {customer.email && (
                  <p className="text-sm text-slate-600 flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" />{customer.email}</p>
                )}
              </div>

              {/* Project Details */}
              <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Project</p>
                  <p className="font-bold text-slate-900 text-sm sm:text-base">{job.job_name}</p>
                  <span className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                    job.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>{job.status}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Job Number</p>
                  <p className="font-bold font-mono text-slate-900 text-sm sm:text-base break-all">{job.job_number}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Job Location</p>
                  <p className="text-sm text-slate-700 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    {invoiceDetails.jobLocation || job.address || '—'}
                  </p>
                </div>
                <div className="bg-brand rounded-xl p-3 sm:p-4 text-white">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">Amount Due</p>
                  <p className="text-xl sm:text-2xl font-black font-mono">${grandTotal.toFixed(2)}</p>
                  <p className="text-[10px] text-white/60 mt-1">Due {formatDate(invoiceDetails.dueDate)}</p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-6 sm:mb-8">
              <div className="rounded-xl overflow-hidden border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-4 sm:px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest">Description</th>
                      <th className="px-4 sm:px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest">Date</th>
                      <th className="px-4 sm:px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest">Qty / Hrs</th>
                      <th className="px-4 sm:px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest">Rate</th>
                      <th className="px-4 sm:px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.logs?.map((log, logIdx) => {
                      const rows: React.ReactNode[] = [];
                      const logDate = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      if (log.notes) {
                        rows.push(
                          <tr key={`desc-${log.id}`} className={logIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td colSpan={5} className="px-5 pt-4 pb-1">
                              <span className="text-[10px] font-bold text-brand uppercase tracking-widest mr-2">Daily Log #{logIdx + 1}</span>
                              <span className="text-xs text-slate-500 italic">{log.notes}</span>
                            </td>
                          </tr>
                        );
                      } else {
                        rows.push(
                          <tr key={`header-${log.id}`} className={logIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td colSpan={5} className="px-5 pt-4 pb-1">
                              <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Daily Log #{logIdx + 1}</span>
                            </td>
                          </tr>
                        );
                      }

                      log.data.employees.forEach((e, idx) => {
                        const empName = employees.find(emp => emp.id === e.employeeId)?.name || `Employee #${e.employeeId}`;
                        rows.push(
                          <tr key={`emp-${log.id}-${idx}`} className={`border-t border-slate-100 ${logIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                            <td className="px-5 py-2.5 text-slate-700">
                              <span className="font-medium">Labor — </span>{empName}
                              <span className="ml-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">{employees.find(emp => emp.id === e.employeeId)?.role}</span>
                            </td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs">{logDate}</td>
                            <td className="px-5 py-2.5 text-center font-mono font-medium">{e.hours}h</td>
                            <td className="px-5 py-2.5 text-right font-mono text-slate-600">${e.rate.toFixed(2)}/hr</td>
                            <td className="px-5 py-2.5 text-right font-mono font-bold text-slate-900">${(e.hours * e.rate).toFixed(2)}</td>
                          </tr>
                        );
                      });

                      log.data.equipment.forEach((e, idx) => {
                        const eqName = equipment.find(eq => eq.id === e.equipmentId)?.name || `Equipment #${e.equipmentId}`;
                        rows.push(
                          <tr key={`eq-${log.id}-${idx}`} className={`border-t border-slate-100 ${logIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                            <td className="px-5 py-2.5 text-slate-700"><span className="font-medium">Equipment — </span>{eqName}</td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs">{logDate}</td>
                            <td className="px-5 py-2.5 text-center font-mono font-medium">{e.hours}h</td>
                            <td className="px-5 py-2.5 text-right font-mono text-slate-600">${e.rate.toFixed(2)}/hr</td>
                            <td className="px-5 py-2.5 text-right font-mono font-bold text-slate-900">${(e.hours * e.rate).toFixed(2)}</td>
                          </tr>
                        );
                      });

                      log.data.materials.forEach((m, idx) => {
                        rows.push(
                          <tr key={`mat-${log.id}-${idx}`} className={`border-t border-slate-100 ${logIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                            <td className="px-5 py-2.5 text-slate-700"><span className="font-medium">Material — </span>{m.name}</td>
                            <td className="px-5 py-2.5 text-slate-500 text-xs">{logDate}</td>
                            <td className="px-5 py-2.5 text-center font-mono font-medium">{m.quantity} units</td>
                            <td className="px-5 py-2.5 text-right font-mono text-slate-600">${m.unitPrice.toFixed(2)}/unit</td>
                            <td className="px-5 py-2.5 text-right font-mono font-bold text-slate-900">${(m.quantity * m.unitPrice).toFixed(2)}</td>
                          </tr>
                        );
                      });

                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6 sm:mb-8">
              <div className="w-full sm:w-72 space-y-2 bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Labor Subtotal</span>
                  <span className="font-mono font-semibold text-slate-700">${laborTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Equipment Subtotal</span>
                  <span className="font-mono font-semibold text-slate-700">${equipmentTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Materials Subtotal</span>
                  <span className="font-mono font-semibold text-slate-700">${materialTotal.toFixed(2)}</span>
                </div>
                <div className="h-px bg-slate-200 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-base font-black uppercase tracking-tight text-slate-900">Total Due</span>
                  <span className="text-2xl font-black font-mono text-brand">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payment Terms</p>
                <p className="text-sm text-slate-600">{company.paymentTerms}</p>
                <p className="text-xs text-slate-400 mt-1">Please include invoice number <strong className="text-slate-600">{invoiceDetails.invoiceNumber}</strong> on all payments.</p>
              </div>
              <div className="md:text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Make checks payable to:</p>
                <p className="text-sm font-bold text-slate-900">{company.name}</p>
                <p className="text-xs text-slate-500">{company.address}, {company.city}</p>
                {company.email && <p className="text-xs text-slate-500">{company.email}</p>}
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Thank you for your business!</p>
            </div>
          </div>

          {/* Bottom Color Bar */}
          <div className="h-2 bg-brand rounded-b-lg print:rounded-none" />
        </div>
      </div>
      </div>
    </div>
  );
};

const Settings = ({ user }: { user: User }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [searchEmployees, setSearchEmployees] = useState('');
  const [searchEquipment, setSearchEquipment] = useState('');
  const [searchMaterials, setSearchMaterials] = useState('');

  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);

  // Company Settings
  const [company, setCompany] = useState<CompanySettings>(loadCompanySettings);
  const [companySaved, setCompanySaved] = useState(false);
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    const [empRes, eqRes, matRes, tempRes] = await Promise.all([
      supabase.from('employees').select('*'),
      supabase.from('equipment').select('*'),
      supabase.from('materials').select('*'),
      supabase.from('templates').select('*')
    ]);
    
    if (empRes.data) setEmployees(empRes.data);
    if (eqRes.data) setEquipment(eqRes.data);
    if (matRes.data) setMaterials(matRes.data);
    if (tempRes.data) setTemplates(tempRes.data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ name: '', role: '', hourly_rate: 0 });
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({ name: '', hourly_rate: 0 });
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({ name: '', unit_price: 0 });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.company_id) return; // guard: must have a company
    await supabase.from('employees').insert([{ ...newEmployee, company_id: user.company_id }]);
    setNewEmployee({ name: '', role: '', hourly_rate: 0 });
    setIsAddingEmployee(false);
    fetchAll();
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.company_id) return; // guard: must have a company
    await supabase.from('equipment').insert([{ ...newEquipment, company_id: user.company_id }]);
    setNewEquipment({ name: '', hourly_rate: 0 });
    setIsAddingEquipment(false);
    fetchAll();
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.company_id) return; // guard: must have a company
    await supabase.from('materials').insert([{ ...newMaterial, company_id: user.company_id }]);
    setNewMaterial({ name: '', unit_price: 0 });
    setIsAddingMaterial(false);
    fetchAll();
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    saveCompanySettings(company);
    setCompanySaved(true);
    setTimeout(() => setCompanySaved(false), 2500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Unsupported file type. Please upload a PNG, JPG, SVG, GIF, or WebP image.');
      e.target.value = '';
      return;
    }

    // Validate file size (max 2MB to stay within localStorage limits)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setLogoError('Image is too large. Please upload an image under 2 MB.');
      e.target.value = '';
      return;
    }

    setLogoError('');
    const reader = new FileReader();
    reader.onload = () => {
      setCompany(prev => ({ ...prev, logo: reader.result as string }));
    };
    reader.onerror = () => {
      setLogoError('Failed to read the image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(searchEmployees.toLowerCase()) || e.role?.toLowerCase().includes(searchEmployees.toLowerCase()));
  const filteredEquipment = equipment.filter(e => e.name.toLowerCase().includes(searchEquipment.toLowerCase()));
  const filteredMaterials = materials.filter(m => m.name.toLowerCase().includes(searchMaterials.toLowerCase()));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-16">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">System Settings</h2>
          <p className="text-slate-500 mt-1">Manage company info, employees, equipment, and materials.</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-600">System Online</span>
          </div>
        </div>
      </header>

      {/* Company Information */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 font-display">Company Information</h3>
            <p className="text-sm text-slate-500">This information appears on your invoices.</p>
          </div>
        </div>

        <form onSubmit={handleSaveCompany} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <p className="text-sm font-medium text-slate-600">Saved changes apply to all new invoices.</p>
            <button
              type="submit"
              className={`btn-primary flex items-center gap-2 text-sm py-2 transition-all ${companySaved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            >
              {companySaved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Company Info</>}
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Company Logo</label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
                  {company.logo ? (
                    <img src={company.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Building2 className="w-10 h-10 text-slate-300" />
                  )}
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Upload className="w-4 h-4" /> Upload Logo
                  </button>
                  {company.logo && (
                    <button
                      type="button"
                      onClick={() => setCompany(prev => ({ ...prev, logo: '' }))}
                      className="text-xs text-red-500 hover:underline block"
                    >
                      Remove logo
                    </button>
                  )}
                  <p className="text-xs text-slate-400">PNG, JPG, SVG, WebP. Max 2 MB. Recommended: 300×100px</p>
                  {logoError && <p className="text-xs text-red-500 font-medium">{logoError}</p>}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
              <input
                required
                className="input-field"
                placeholder="e.g. Acme Services LLC"
                value={company.name}
                onChange={e => setCompany({...company, name: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Website</label>
              <input
                className="input-field"
                placeholder="www.yourcompany.com"
                value={company.website}
                onChange={e => setCompany({...company, website: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Street Address</label>
              <input
                className="input-field"
                placeholder="123 Main Street"
                value={company.address}
                onChange={e => setCompany({...company, address: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">City, State, ZIP</label>
              <input
                className="input-field"
                placeholder="Springfield, ST 55555"
                value={company.city}
                onChange={e => setCompany({...company, city: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Phone</label>
              <input
                type="tel"
                className="input-field"
                placeholder="(555) 123-4567"
                value={company.phone}
                onChange={e => setCompany({...company, phone: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="billing@yourcompany.com"
                value={company.email}
                onChange={e => setCompany({...company, email: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Payment Terms (shown on invoice footer)</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="e.g. Payment is due within 30 days of invoice date."
                value={company.paymentTerms}
                onChange={e => setCompany({...company, paymentTerms: e.target.value})}
              />
            </div>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Employees */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-900 font-display">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-brand" />
              </div>
              Employees
            </h3>
            <button onClick={() => setIsAddingEmployee(true)} className="p-2 bg-brand text-white rounded-lg shadow-lg shadow-brand/20 hover:scale-105 transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search employees..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              value={searchEmployees}
              onChange={e => setSearchEmployees(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredEmployees.map(e => (
              <div key={e.id} className="card p-4 flex justify-between items-center group hover:border-brand/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                    {e.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{e.name}</p>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{e.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-slate-700">${e.hourly_rate}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">per hour</p>
                </div>
              </div>
            ))}
            {filteredEmployees.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-400 text-sm">No employees found</p>
              </div>
            )}
          </div>
        </section>

        {/* Equipment */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-900 font-display">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-orange-500" />
              </div>
              Equipment
            </h3>
            <button onClick={() => setIsAddingEquipment(true)} className="p-2 bg-orange-500 text-white rounded-lg shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search equipment..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              value={searchEquipment}
              onChange={e => setSearchEquipment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredEquipment.map(e => (
              <div key={e.id} className="card p-4 flex justify-between items-center group hover:border-orange-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-orange-400" />
                  </div>
                  <p className="font-bold text-slate-900">{e.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-slate-700">${e.hourly_rate}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">per hour</p>
                </div>
              </div>
            ))}
            {filteredEquipment.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-400 text-sm">No equipment found</p>
              </div>
            )}
          </div>
        </section>

        {/* Materials */}
        <section className="space-y-6 lg:col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-900 font-display">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-500" />
              </div>
              Materials Price List
            </h3>
            <button onClick={() => setIsAddingMaterial(true)} className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search materials..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              value={searchMaterials}
              onChange={e => setSearchMaterials(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map(m => (
              <div key={m.id} className="card p-4 flex justify-between items-center group hover:border-emerald-500/30 transition-all">
                <div>
                  <p className="font-bold text-slate-900">{m.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Material Item</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-emerald-600">${m.unit_price}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">per unit</p>
                </div>
              </div>
            ))}
            {filteredMaterials.length === 0 && (
              <div className="lg:col-span-3 py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-400 text-sm">No materials found</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modals for Adding */}
      <AnimatePresence>
        {isAddingEmployee && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold font-display">Add Employee</h3>
                <button onClick={() => setIsAddingEmployee(false)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Full Name</label>
                  <input required className="input-field" placeholder="e.g. John Doe" value={newEmployee.name ?? ''} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Role / Title</label>
                  <input required className="input-field" placeholder="e.g. Journeyman" value={newEmployee.role ?? ''} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Hourly Rate ($)</label>
                  <input type="number" step="0.01" required className="input-field" placeholder="0.00" value={newEmployee.hourly_rate ?? ''} onChange={e => setNewEmployee({...newEmployee, hourly_rate: Number(e.target.value)})} />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsAddingEmployee(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Save Employee</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingEquipment && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold font-display">Add Equipment</h3>
                <button onClick={() => setIsAddingEquipment(false)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleAddEquipment} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Equipment Name</label>
                  <input required className="input-field" placeholder="e.g. Bucket Truck #102" value={newEquipment.name ?? ''} onChange={e => setNewEquipment({...newEquipment, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Hourly Rate ($)</label>
                  <input type="number" step="0.01" required className="input-field" placeholder="0.00" value={newEquipment.hourly_rate ?? ''} onChange={e => setNewEquipment({...newEquipment, hourly_rate: Number(e.target.value)})} />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsAddingEquipment(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Save Equipment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingMaterial && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold font-display">Add Material</h3>
                <button onClick={() => setIsAddingMaterial(false)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleAddMaterial} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Material Name</label>
                  <input required className="input-field" placeholder="e.g. 2 inch PVC Conduit" value={newMaterial.name ?? ''} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Unit Price ($)</label>
                  <input type="number" step="0.01" required className="input-field" placeholder="0.00" value={newMaterial.unit_price ?? ''} onChange={e => setNewMaterial({...newMaterial, unit_price: Number(e.target.value)})} />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsAddingMaterial(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Save Material</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*');
    if (!error && data) {
      setUsers(data as User[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePromote = async (id: number) => {
    if (!confirm('Are you sure you want to promote this user to Admin? This action cannot be undone.')) return;
    
    const { error } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', id);
      
    if (!error) {
      fetchUsers();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-12">
        <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">User Management</h2>
        <p className="text-slate-500 mt-1">Manage company accounts and permissions.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading users...</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      u.role === 'admin' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.role === 'foreman' && (
                      <button 
                        onClick={() => handlePromote(u.id)}
                        className="text-xs font-bold text-brand hover:underline flex items-center gap-1 ml-auto"
                      >
                        <Plus className="w-3 h-3" /> Promote to Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [showCompanyReg, setShowCompanyReg] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount (equivalent to getSession),
    // so we only subscribe once here to avoid double-calling fetchProfile.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          fetchProfile(session.user.email!);
        } else {
          setAuthReady(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCompany(null);
        setShowCompanyReg(false);
        setAuthReady(true);
      }
      // TOKEN_REFRESHED and other events are intentionally ignored to prevent
      // the company-setup modal from re-appearing mid-session.
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (email: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!error && data) {
      const profile = data as User;
      setUser(profile);

      // Fetch company info if the user belongs to one
      if (profile.company_id) {
        setShowCompanyReg(false);
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', profile.company_id)
          .single();
        if (companyData) setCompany(companyData as Company);
      } else {
        // User has no company — show the registration modal
        setShowCompanyReg(true);
      }
    } else {
      // Fallback if profile not found
      setUser({
        id: 0,
        name: email.split('@')[0],
        email: email,
        role: 'foreman',
      });
      setShowCompanyReg(true);
    }
    setAuthReady(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCompanyRegistered = async (companyId: string) => {
    setShowCompanyReg(false);

    // Re-fetch the full profile from the database to confirm company_id was
    // persisted, then load the company record for the nav bar.
    const currentUser = user;
    if (currentUser?.email) {
      await fetchProfile(currentUser.email);
    } else {
      // Fallback: update state directly if email is unavailable
      setUser(prev => prev ? { ...prev, company_id: companyId } : prev);
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId)
        .single();
      if (companyData) setCompany(companyData as Company);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white font-display text-xl animate-pulse">Initializing...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <>
      {showCompanyReg && (
        <CompanyRegistration user={user} onComplete={handleCompanyRegistered} />
      )}
      <Layout
        activeTab={activeTab}
        setActiveTab={(t) => { setActiveTab(t); setSelectedJobId(null); }}
        user={user}
        companyName={company?.name || ''}
        onLogout={handleLogout}
      >
        {activeTab === 'jobs' && (
          selectedJobId ? (
            <JobDetails jobId={selectedJobId} onBack={() => setSelectedJobId(null)} user={user} />
          ) : (
            <Dashboard onSelectJob={setSelectedJobId} user={user} />
          )
        )}
        {activeTab === 'users' && user.role === 'admin' && <UserManagement />}
        {activeTab === 'settings' && user.role === 'admin' && <Settings user={user} />}
      </Layout>
    </>
  );
}
