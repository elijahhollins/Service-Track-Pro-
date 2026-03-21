import React, { useState, useEffect } from 'react';
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
  Shield,
  Link as LinkIcon,
  ExternalLink,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Job, Employee, Equipment, Material, WorkLog, Template, WorkLogEntry, User, Invitation, Invoice, InvoiceSettings } from './types';
import { supabase } from './supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';

// --- Components ---

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      fetchInvitation(token);
    }
  }, []);

  const fetchInvitation = async (token: string) => {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      setError('Invalid or expired invitation link.');
    } else {
      setInvitation(data as Invitation);
      setIsSignUp(true);
      if (data.email) setEmail(data.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        // 1. Sign up to Supabase Auth first to get a UID
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Signup failed');

        const userId = authData.user.id;
        let companyId = invitation?.company_id;

        // 2. Create company if it's a new company invitation
        if (!companyId && (invitation?.role === 'admin' || !invitation)) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .insert([{ name: companyName }])
            .select()
            .single();

          if (companyError) throw companyError;
          companyId = companyData.id;
        }

        // 3. Create profile in public.users
        console.log('Attempting to create profile for:', userId, 'with role:', invitation?.role || 'admin', 'and companyId:', companyId);
        const { error: profileError } = await supabase
          .from('users')
          .insert([{ 
            id: userId,
            name: name || email.split('@')[0], 
            email, 
            password, 
            role: invitation?.role || 'admin',
            company_id: companyId || null
          }]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error(`Profile creation failed: ${profileError.message}`);
        }
        
        // 4. Mark invitation as used
        if (invitation) {
          await supabase
            .from('invitations')
            .update({ used_at: new Date().toISOString() })
            .eq('id', invitation.id);
        }

        setError('Account created! You can now sign in.');
        setIsSignUp(false);
        setInvitation(null);
        window.history.replaceState({}, document.title, window.location.pathname);
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
            setError('Profile not found. Please contact support.');
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
          <p className="text-slate-500">
            {invitation 
              ? `Accepting invitation as ${invitation.role}` 
              : isSignUp ? 'Create your company account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={`p-3 text-sm rounded-lg border ${error.includes('created') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              {error}
            </div>
          )}
          
          {isSignUp && (
            <>
              {(!invitation || (invitation.role === 'admin' && !invitation.company_id)) && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
                  <input 
                    type="text" 
                    required 
                    className="input-field" 
                    placeholder="Acme Services"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </div>
              )}
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
              readOnly={!!invitation?.email}
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
            {loading ? 'Processing...' : (isSignUp ? (invitation ? 'Join Now' : 'Create Company') : 'Sign In')}
          </button>
        </form>

        {!invitation && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-brand font-medium hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const Layout = ({ children, activeTab, setActiveTab, user, onLogout }: { children: React.ReactNode, activeTab: string, setActiveTab: (t: string) => void, user: User, onLogout: () => void }) => {
  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-400 flex flex-col border-r border-slate-800 overflow-y-auto shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-white font-bold text-lg tracking-tight font-display">Service Track Pro</h1>
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
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'users' ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Users</span>
              {activeTab === 'users' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />}
            </button>
          )}
          {(user.role === 'admin' || user.role === 'foreman') && (
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'settings' ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="font-medium">Settings</span>
              {activeTab === 'settings' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />}
            </button>
          )}
          {user.role === 'super_admin' && (
            <button 
              onClick={() => setActiveTab('super-admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'super-admin' ? 'bg-slate-800 text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Super Admin</span>
              {activeTab === 'super-admin' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />}
            </button>
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
      <main className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
        {children}
      </main>
    </div>
  );
};

const Dashboard = ({ onSelectJob, user }: { onSelectJob: (id: number) => void, user: User }) => {
  const getInitialJob = (): Partial<Job> => ({
    customer_name: '',
    job_name: '',
    job_number: '',
    address: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
    status: 'active',
    foreman_id: null,
    company_id: user.company_id
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [foremen, setForemen] = useState<User[]>([]);
  const [newJob, setNewJob] = useState<Partial<Job>>(getInitialJob());

  useEffect(() => {
    const fetchJobs = async () => {
      let query = supabase.from('jobs').select('*').eq('company_id', user.company_id).order('id', { ascending: false });
      
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
        .eq('company_id', user.company_id)
        .eq('role', 'foreman');
      if (!error && data) setForemen(data as User[]);
    };

    fetchJobs();
    if (user.role === 'admin') {
      fetchForemen();
    }
  }, [user]);

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const jobPayload = {
        ...newJob,
        company_id: user.company_id,
        end_date: newJob.end_date || null,
        foreman_id: newJob.foreman_id || null,
      };
      console.log('Creating job with payload:', jobPayload);
      const { data, error } = await supabase
        .from('jobs')
        .insert([jobPayload])
        .select()
        .single();
        
      if (error) {
        console.error('Error creating job:', error);
        alert(`Failed to create job: ${error.message}`);
        return;
      }

      if (data) {
        console.log('Job created successfully:', data);
        setJobs([data as Job, ...jobs]);
        setIsAdding(false);
        setNewJob(getInitialJob());
        onSelectJob(data.id);
      }
    } catch (err: any) {
      console.error('Unexpected error creating job:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteJob = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this job? All associated work logs will also be deleted.')) return;
    
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('company_id', user.company_id);
      
    if (!error) {
      setJobs(jobs.filter(j => j.id !== id));
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">#{job.job_number}</span>
                    {user.role === 'admin' && (
                      <button 
                        onClick={(e) => handleDeleteJob(e, job.id!)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Job"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
              className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-2xl font-bold font-display text-slate-900">New Project</h3>
                  <p className="text-slate-500 text-sm">Set up a new job to start tracking logs.</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleCreateJob} className="p-8 space-y-6 flex-1 overflow-y-auto min-h-0">
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
                        className="input-field"
                        value={newJob.foreman_id ?? ''}
                        onChange={e => setNewJob({...newJob, foreman_id: e.target.value || null})}
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
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)} 
                    className="btn-secondary flex-1 py-4"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary flex-1 py-4 text-lg shadow-xl shadow-brand/20 disabled:opacity-50"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Project'}
                  </button>
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [isViewingInvoice, setIsViewingInvoice] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);

  const fetchJob = async () => {
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('company_id', user.company_id)
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

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setInvoices(data);
    }
  };

  useEffect(() => {
    fetchJob();
    fetchInvoices();
    const fetchData = async () => {
      const [empRes, eqRes, matRes, tempRes, settingsRes] = await Promise.all([
        supabase.from('employees').select('*').eq('company_id', user.company_id),
        supabase.from('equipment').select('*').eq('company_id', user.company_id),
        supabase.from('materials').select('*').eq('company_id', user.company_id),
        supabase.from('templates').select('*').eq('company_id', user.company_id),
        supabase.from('invoice_settings').select('*').eq('company_id', user.company_id).maybeSingle(),
      ]);
      
      if (empRes.data) setEmployees(empRes.data);
      if (eqRes.data) setEquipment(eqRes.data);
      if (matRes.data) setMaterials(matRes.data);
      if (tempRes.data) setTemplates(tempRes.data);
      if (settingsRes.data) setInvoiceSettings(settingsRes.data);
    };
    fetchData();
  }, [jobId]);

  const handleDeleteLog = async (id: number) => {
    if (!confirm('Are you sure you want to delete this log?')) return;
    await supabase.from('work_logs').delete().eq('id', id);
    fetchJob();
  };

  const handleRepeatLog = async (log: WorkLog) => {
    const newLog = {
      job_id: jobId,
      date: new Date().toISOString().split('T')[0],
      notes: log.notes,
      data: log.data
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
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
                      <p className="text-xs text-slate-500 italic">{log.notes || 'No notes'}</p>
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

        <div className="space-y-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
            <FileText className="w-5 h-5 text-brand" />
            Saved Invoices
          </h3>
          
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                <p className="text-slate-400 text-sm">No invoices saved yet.</p>
              </div>
            ) : (
              invoices.map(invoice => (
                <div key={invoice.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{invoice.invoice_number}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      invoice.status === 'sent' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      'bg-slate-50 text-slate-600 border border-slate-100'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-lg font-black font-mono text-slate-900">${invoice.grand_total.toFixed(2)}</p>
                    <button 
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setIsViewingInvoice(true);
                      }}
                      className="p-2 text-slate-400 hover:text-brand hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingLog && (
          <WorkLogForm 
            jobId={jobId} 
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
            invoice={selectedInvoice || undefined}
            invoiceSettings={invoiceSettings}
            onClose={() => {
              setIsViewingInvoice(false);
              setSelectedInvoice(null);
            }} 
            onSave={() => {
              fetchInvoices();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const WorkLogForm = ({ jobId, employees, equipment, materials, templates, onClose, onSave }: { 
  jobId: number, 
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
  
  const [selectedEmployees, setSelectedEmployees] = useState<{ employeeId: number; hours: number; rate: number }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<{ equipmentId: number; hours: number; rate: number }[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<{ materialId?: number; name: string; quantity: number; unitPrice: number }[]>([]);

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

  const handleAddMaterial = (mat: Material) => {
    setSelectedMaterials([...selectedMaterials, { materialId: mat.id, name: mat.name, quantity: 1, unitPrice: mat.unit_price }]);
  };

  useEffect(() => {
    if (matchHours) {
      setSelectedEmployees(prev => prev.map(e => ({ ...e, hours: crewHours })));
      setSelectedEquipment(prev => prev.map(e => ({ ...e, hours: crewHours })));
    }
  }, [crewHours, matchHours]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const logData: WorkLogEntry = {
      employees: selectedEmployees,
      equipment: selectedEquipment,
      materials: selectedMaterials
    };
    
    const { error } = await supabase
      .from('work_logs')
      .insert([{ job_id: jobId, date, notes, data: logData }]);
      
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-8 space-y-10">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Notes / Description</label>
              <input className="input-field" placeholder="e.g. Completed trenching for main conduit run" value={notes} onChange={e => setNotes(e.target.value)} />
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
                    type="button" 
                    onClick={() => setIsMaterialMenuOpen(!isMaterialMenuOpen)}
                    className="text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 flex items-center gap-2 hover:bg-slate-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Material
                  </button>
                  <AnimatePresence>
                    {isMaterialMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsMaterialMenuOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-64 overflow-auto"
                        >
                          {materials.map(m => (
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

// ── PDF colour palette (module-level for reuse/performance) ───────────────
const PDF_COLORS = {
  navyDark  : [10, 20, 45]    as [number,number,number],
  navyMid   : [18, 32, 70]    as [number,number,number],
  gold      : [196, 150, 20]  as [number,number,number],
  goldLight : [230, 190, 70]  as [number,number,number],
  white     : [255, 255, 255] as [number,number,number],
  slate100  : [241, 245, 249] as [number,number,number],
  slate300  : [148, 163, 184] as [number,number,number],
  slate700  : [51, 65, 85]    as [number,number,number],
  slate900  : [15, 23, 42]    as [number,number,number],
};

const DEFAULT_INVOICE_SETTINGS: Omit<InvoiceSettings, 'id' | 'company_id'> = {
  company_name: 'Service Track Pro',
  company_address: '123 Service Way, Industrial Park, Springfield, ST 55555',
  company_phone: '(555) 123-4567',
  company_email: 'billing@servicetrackpro.com',
  logo_initials: 'STP',
  payment_terms: 'Payment due within 30 days. Checks payable to the company above. Late payments subject to 1.5% monthly finance charge.',
};

const InvoiceView = ({ job, employees, equipment, materials, onClose, onSave, invoice, invoiceSettings }: { 
  job: Job, 
  employees: Employee[], 
  equipment: Equipment[], 
  materials: Material[],
  onClose: () => void,
  onSave?: () => void,
  invoice?: Invoice,
  invoiceSettings?: InvoiceSettings | null,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const branding = invoiceSettings ?? DEFAULT_INVOICE_SETTINGS;
  
  // Use saved data if viewing a saved invoice, otherwise calculate from current logs
  const laborTotal = invoice ? invoice.labor_total : (job.logs?.reduce((acc, log) => acc + log.data.employees.reduce((lAcc, e) => lAcc + (e.hours * e.rate), 0), 0) || 0);
  const equipmentTotal = invoice ? invoice.equipment_total : (job.logs?.reduce((acc, log) => acc + log.data.equipment.reduce((eAcc, e) => eAcc + (e.hours * e.rate), 0), 0) || 0);
  const materialTotal = invoice ? invoice.material_total : (job.logs?.reduce((acc, log) => acc + log.data.materials.reduce((mAcc, m) => mAcc + (m.quantity * m.unitPrice), 0), 0) || 0);
  const grandTotal = invoice ? invoice.grand_total : (laborTotal + equipmentTotal + materialTotal);
  
  const displayLogs = invoice ? invoice.data.logs : job.logs;
  const invoiceNumber = invoice ? invoice.invoice_number : `INV-${job.job_number}-${Date.now().toString().slice(-4)}`;
  const invoiceDate = invoice ? new Date(invoice.date) : new Date();
  const dueDate = invoice ? new Date(invoice.due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const handleDownloadPDF = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();  // 297
    const margin = 14;
    const contentW = pageW - margin * 2;

    const { navyDark, navyMid, gold, goldLight, white, slate100, slate300, slate700, slate900 } = PDF_COLORS;

    // ── Helper: set fill ─────────────────────────────────────────────────
    const fill  = (c: [number,number,number]) => pdf.setFillColor(...c);
    const stroke= (c: [number,number,number]) => pdf.setDrawColor(...c);
    const text  = (c: [number,number,number]) => pdf.setTextColor(...c);

    // ════════════════════════════════════════════════════════════════════
    // HEADER BAND
    // ════════════════════════════════════════════════════════════════════
    fill(navyDark); pdf.rect(0, 0, pageW, 58, 'F');
    // gold accent stripe at very top
    fill(gold); pdf.rect(0, 0, pageW, 3, 'F');

    // Left – company logo box + name
    fill(gold);
    pdf.roundedRect(margin, 10, 14, 14, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    text(navyDark); pdf.setFontSize(9);
    pdf.text(branding.logo_initials.slice(0, 4), margin + 2.5, 19.5);

    text(white); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
    pdf.text(branding.company_name.toUpperCase(), margin + 18, 18);
    text(slate300); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal');
    pdf.text(branding.company_address, margin + 18, 24);
    pdf.text(`${branding.company_phone}  •  ${branding.company_email}`, margin + 18, 29.5);

    // Right – giant "INVOICE" label
    text(goldLight); pdf.setFontSize(38); pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', pageW - margin, 26, { align: 'right' });

    // Invoice meta under the big label
    text(white); pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold');
    pdf.text(`No: ${invoiceNumber}`, pageW - margin, 34, { align: 'right' });
    text(slate300); pdf.setFont('helvetica', 'normal');
    pdf.text(`Date:  ${invoiceDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW - margin, 40, { align: 'right' });
    pdf.text(`Due:   ${dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW - margin, 46, { align: 'right' });

    // gold bottom border of header
    fill(gold); pdf.rect(0, 58, pageW, 1.5, 'F');

    // ════════════════════════════════════════════════════════════════════
    // BILL-TO / PROJECT DETAIL CARDS
    // ════════════════════════════════════════════════════════════════════
    const cardTop = 65;
    const cardH   = 34;
    const cardW   = (contentW - 6) / 2;

    // Card 1 – Bill To
    fill(slate100); stroke(slate100); pdf.roundedRect(margin, cardTop, cardW, cardH, 2, 2, 'FD');
    fill(gold); pdf.roundedRect(margin, cardTop, 3, cardH, 1.5, 1.5, 'F');
    text(slate300); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text('BILL TO', margin + 7, cardTop + 8);
    text(slate900); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    pdf.text(job.customer_name || 'N/A', margin + 7, cardTop + 16);
    text(slate700); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    const addrLines = pdf.splitTextToSize(job.address || '', cardW - 10);
    const displayAddr = addrLines.length > 2
      ? [addrLines[0], addrLines[1].replace(/.$/, '…')]
      : addrLines.slice(0, 2);
    pdf.text(displayAddr, margin + 7, cardTop + 23);

    // Card 2 – Project
    const card2X = margin + cardW + 6;
    fill(slate100); stroke(slate100); pdf.roundedRect(card2X, cardTop, cardW, cardH, 2, 2, 'FD');
    fill(navyMid); pdf.roundedRect(card2X, cardTop, 3, cardH, 1.5, 1.5, 'F');
    text(slate300); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text('PROJECT DETAILS', card2X + 7, cardTop + 8);
    text(slate900); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    const projName = pdf.splitTextToSize(job.job_name || 'N/A', cardW - 10);
    pdf.text(projName[0], card2X + 7, cardTop + 16);
    text(slate700); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text(`Job #: ${job.job_number}`, card2X + 7, cardTop + 23);
    pdf.text(`Status: ${(job.status || '').toUpperCase()}`, card2X + 7, cardTop + 29);

    // ════════════════════════════════════════════════════════════════════
    // LINE ITEMS – one autoTable per daily log
    // ════════════════════════════════════════════════════════════════════
    let cursorY = cardTop + cardH + 8;

    (displayLogs || []).forEach((log: any, logIdx: number) => {
      const logDate = new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Section header
      if (cursorY > pageH - 60) { pdf.addPage(); cursorY = 18; }
      fill(navyMid); pdf.roundedRect(margin, cursorY, contentW, 10, 2, 2, 'F');
      text(goldLight); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
      pdf.text(`Daily Log — ${logDate}`, margin + 4, cursorY + 6.8);
      if (log.notes) {
        text(slate300); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7);
        const notesText = log.notes.length > 70 ? log.notes.slice(0, 69) + '…' : log.notes;
        pdf.text(notesText, pageW - margin - 2, cursorY + 6.8, { align: 'right' });
      }
      cursorY += 12;

      // Build rows
      const rows: (string | number)[][] = [];
      (log.data.employees || []).forEach((e: any) => {
        const empName = employees.find(emp => emp.id === e.employeeId)?.name || `Employee #${e.employeeId}`;
        rows.push([`Labor — ${empName}`, `${e.hours}h`, `$${Number(e.rate).toFixed(2)}`, `$${(e.hours * e.rate).toFixed(2)}`]);
      });
      (log.data.equipment || []).forEach((e: any) => {
        const eqName = equipment.find(eq => eq.id === e.equipmentId)?.name || `Equipment #${e.equipmentId}`;
        rows.push([`Equipment — ${eqName}`, `${e.hours}h`, `$${Number(e.rate).toFixed(2)}`, `$${(e.hours * e.rate).toFixed(2)}`]);
      });
      (log.data.materials || []).forEach((m: any) => {
        rows.push([`Material — ${m.name}`, `${m.quantity}`, `$${Number(m.unitPrice).toFixed(2)}`, `$${(m.quantity * m.unitPrice).toFixed(2)}`]);
      });

      if (rows.length === 0) {
        rows.push(['No items recorded', '', '', '']);
      }

      autoTable(pdf, {
        startY: cursorY,
        margin: { left: margin, right: margin },
        tableWidth: contentW,
        head: [['DESCRIPTION', 'QTY / HRS', 'UNIT RATE', 'AMOUNT']],
        body: rows,
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          textColor: slate700,
          cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
          lineColor: [220, 228, 240],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [229, 234, 245],
          textColor: slate900,
          fontStyle: 'bold',
          fontSize: 7,
          lineColor: [196, 150, 20],
          lineWidth: { bottom: 1 },
        },
        columnStyles: {
          0: { cellWidth: contentW * 0.52 },
          1: { cellWidth: contentW * 0.14, halign: 'center' },
          2: { cellWidth: contentW * 0.17, halign: 'right' },
          3: { cellWidth: contentW * 0.17, halign: 'right', fontStyle: 'bold', textColor: slate900 },
        },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        didDrawPage: (_data: any) => {
          // Redraw gold stripe on new pages
          fill(gold); pdf.rect(0, 0, pageW, 3, 'F');
        },
      });

      cursorY = (pdf as any).lastAutoTable.finalY + 6;
    });

    // ════════════════════════════════════════════════════════════════════
    // TOTALS SECTION
    // ════════════════════════════════════════════════════════════════════
    const totalsH = 52;
    if (cursorY + totalsH > pageH - 25) { pdf.addPage(); cursorY = 18; fill(gold); pdf.rect(0, 0, pageW, 3, 'F'); }

    cursorY += 4;
    // gold divider line
    stroke(gold); pdf.setLineWidth(0.8);
    pdf.line(margin, cursorY, pageW - margin, cursorY);
    cursorY += 6;

    const totalsX = pageW - margin - 75;
    const totalsLabelX = totalsX;
    const totalsValX = pageW - margin;

    const totals = [
      ['Labor Subtotal', `$${laborTotal.toFixed(2)}`],
      ['Equipment Subtotal', `$${equipmentTotal.toFixed(2)}`],
      ['Material Subtotal', `$${materialTotal.toFixed(2)}`],
    ];

    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    totals.forEach(([label, val]) => {
      text(slate700); pdf.text(label, totalsLabelX, cursorY);
      text(slate900); pdf.setFont('helvetica', 'bold');
      pdf.text(val, totalsValX, cursorY, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      cursorY += 8;
    });

    // Grand Total box
    cursorY += 2;
    fill(navyDark); pdf.roundedRect(totalsX - 4, cursorY - 5, 75 + 4, 16, 2, 2, 'F');
    fill(gold); pdf.roundedRect(totalsX - 4, cursorY - 5, 3.5, 16, 1, 1, 'F');
    text(white); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
    pdf.text('TOTAL DUE', totalsLabelX + 2, cursorY + 5);
    text(goldLight); pdf.setFontSize(13);
    pdf.text(`$${grandTotal.toFixed(2)}`, totalsValX, cursorY + 5.5, { align: 'right' });
    cursorY += 20;

    // ════════════════════════════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════════════════════════════
    const footerY = pageH - 22;
    stroke(slate300); pdf.setLineWidth(0.3);
    pdf.line(margin, footerY, pageW - margin, footerY);
    text(slate700); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
    pdf.text('THANK YOU FOR YOUR BUSINESS', pageW / 2, footerY + 6, { align: 'center' });
    text(slate300); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
    pdf.text(
      branding.payment_terms,
      pageW / 2, footerY + 12, { align: 'center', maxWidth: contentW }
    );
    // page number
    const pageCount = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      text(slate300); pdf.setFontSize(6.5);
      pdf.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 5, { align: 'right' });
    }

    pdf.save(`Invoice-${invoiceNumber}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSaveInvoice = async () => {
    setIsSaving(true);
    try {
      const invoiceData: Partial<Invoice> = {
        company_id: job.company_id,
        job_id: job.id,
        invoice_number: `INV-${job.job_number}-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
        labor_total: laborTotal,
        equipment_total: equipmentTotal,
        material_total: materialTotal,
        grand_total: grandTotal,
        data: {
          logs: job.logs,
          customer: job.customer_name,
          address: job.address,
          projectName: job.job_name
        }
      };

      const { error } = await supabase.from('invoices').insert([invoiceData]);
      if (error) throw error;
      
      alert('Invoice saved successfully!');
      if (onSave) onSave();
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-0 md:p-4 overflow-auto">
      <div className="w-full max-w-5xl min-h-screen md:min-h-0 py-0 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 px-6 md:px-0 text-white sticky top-0 md:relative z-10 py-4 md:py-0 bg-slate-900/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors md:hidden">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h3 className="text-xl md:text-2xl font-bold font-display">Invoice Preview</h3>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {!invoice && (
              <button 
                onClick={handleSaveInvoice} 
                disabled={isSaving}
                className="btn-secondary bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Check className="w-4 h-4 md:w-5 md:h-5" /> {isSaving ? 'Saving...' : 'Save to App'}
              </button>
            )}
            <button onClick={handleDownloadPDF} className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Download className="w-4 h-4 md:w-5 md:h-5" /> PDF
            </button>
            <button onClick={() => window.print()} className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 hidden md:flex">
              <Printer className="w-5 h-5" /> Print
            </button>
            <button onClick={onClose} className="btn-primary bg-white text-slate-900 hover:bg-slate-100 hidden md:flex">Close</button>
          </div>
        </div>

        <div className="bg-white p-6 md:p-16 rounded-none md:rounded-3xl shadow-2xl text-slate-900 print:shadow-none print:p-0" id="invoice-content">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start border-b-4 border-slate-900 pb-10 mb-12 gap-8">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20 text-white font-black text-sm">
                  {branding.logo_initials.slice(0, 4)}
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter font-display">{branding.company_name}</h1>
              </div>
              <div className="space-y-1 text-slate-500 text-sm md:text-base">
                <p className="font-bold text-slate-900">{branding.company_address}</p>
                <p>{branding.company_phone} • {branding.company_email}</p>
              </div>
            </div>
            <div className="text-left md:text-right w-full md:w-auto">
              <h2 className="text-6xl md:text-8xl font-black text-slate-100 uppercase mb-6 font-display leading-none">Invoice</h2>
              <div className="space-y-1">
                <p className="text-xl font-bold">Job #: {job.job_number}</p>
                <p className="text-slate-500 font-medium">Date: {invoiceDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-slate-500 font-medium">Due Date: {dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Bill To:</h4>
              <p className="text-2xl font-black text-slate-900 mb-2">{job.customer_name}</p>
              <p className="text-slate-600 leading-relaxed">{job.address}</p>
            </div>
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Project Details:</h4>
              <p className="text-2xl font-black text-slate-900 mb-2">{job.job_name}</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <p className="text-slate-600 font-medium uppercase text-xs tracking-wider">Status: {job.status}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-16 mb-16">
            {displayLogs?.map((log: any) => (
              <div key={log.id} className="relative">
                <div className="flex flex-col md:flex-row justify-between items-baseline mb-6 gap-2">
                  <h5 className="font-black text-xl text-slate-900">{new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — Daily Log</h5>
                  <p className="text-sm text-slate-400 font-medium italic">{log.notes}</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-100">
                        <th className="pb-4 font-bold uppercase text-[10px] tracking-widest text-slate-400">Description</th>
                        <th className="pb-4 font-bold uppercase text-[10px] tracking-widest text-slate-400 text-center">Qty/Hrs</th>
                        <th className="pb-4 font-bold uppercase text-[10px] tracking-widest text-slate-400 text-right">Rate</th>
                        <th className="pb-4 font-bold uppercase text-[10px] tracking-widest text-slate-400 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {log.data.employees.map((e, idx) => (
                        <tr key={`emp-${idx}`} className="group">
                          <td className="py-4 font-medium text-slate-700">Labor: {employees.find(emp => emp.id === e.employeeId)?.name}</td>
                          <td className="py-4 text-center font-mono text-slate-600">{e.hours}h</td>
                          <td className="py-4 text-right font-mono text-slate-600">${e.rate.toFixed(2)}</td>
                          <td className="py-4 text-right font-mono font-bold text-slate-900">${(e.hours * e.rate).toFixed(2)}</td>
                        </tr>
                      ))}
                      {log.data.equipment.map((e, idx) => (
                        <tr key={`eq-${idx}`} className="group">
                          <td className="py-4 font-medium text-slate-700">Equipment: {equipment.find(eq => eq.id === e.equipmentId)?.name}</td>
                          <td className="py-4 text-center font-mono text-slate-600">{e.hours}h</td>
                          <td className="py-4 text-right font-mono text-slate-600">${e.rate.toFixed(2)}</td>
                          <td className="py-4 text-right font-mono font-bold text-slate-900">${(e.hours * e.rate).toFixed(2)}</td>
                        </tr>
                      ))}
                      {log.data.materials.map((m, idx) => (
                        <tr key={`mat-${idx}`} className="group">
                          <td className="py-4 font-medium text-slate-700">Material: {m.name}</td>
                          <td className="py-4 text-center font-mono text-slate-600">{m.quantity}</td>
                          <td className="py-4 text-right font-mono text-slate-600">${m.unitPrice.toFixed(2)}</td>
                          <td className="py-4 text-right font-mono font-bold text-slate-900">${(m.quantity * m.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-12 border-t-4 border-slate-900">
            <div className="w-full md:w-80 space-y-4">
              <div className="flex justify-between text-base">
                <span className="text-slate-500 font-medium">Labor Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">${laborTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-slate-500 font-medium">Equipment Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">${equipmentTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-slate-500 font-medium">Material Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">${materialTotal.toFixed(2)}</span>
              </div>
              <div className="pt-6 border-t-2 border-slate-100 flex justify-between items-center">
                <span className="text-2xl font-black uppercase tracking-tighter text-slate-900">Total Due:</span>
                <span className="text-4xl font-black font-mono text-brand">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-32 pt-12 border-t border-slate-100 text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 mb-4">Thank you for your business</p>
            <div className="max-w-md mx-auto space-y-2">
              <p className="text-xs text-slate-400 leading-relaxed italic">{branding.payment_terms}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Settings = ({ user }: { user: User }) => {
  console.log('Settings component rendering for user:', user.email, 'role:', user.role, 'company_id:', user.company_id);
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
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingInvoiceSettings, setIsSavingInvoiceSettings] = useState(false);
  const [invoiceSettingsSaved, setInvoiceSettingsSaved] = useState(false);

  const [invoiceSettings, setInvoiceSettings] = useState<Omit<InvoiceSettings, 'id'>>({
    company_id: user.company_id!,
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    logo_initials: '',
    payment_terms: '',
  });

  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateEmployees, setTemplateEmployees] = useState<{ employeeId: number; hours: number; rate: number }[]>([]);
  const [templateEquipment, setTemplateEquipment] = useState<{ equipmentId: number; hours: number; rate: number }[]>([]);
  const [templateMaterials, setTemplateMaterials] = useState<{ materialId?: number; name: string; quantity: number; unitPrice: number }[]>([]);

  const fetchAll = async () => {
    console.log('Fetching all settings data for company:', user.company_id);
    const [empRes, eqRes, matRes, tempRes, invSettingsRes] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', user.company_id),
      supabase.from('equipment').select('*').eq('company_id', user.company_id),
      supabase.from('materials').select('*').eq('company_id', user.company_id),
      supabase.from('templates').select('*').eq('company_id', user.company_id),
      supabase.from('invoice_settings').select('*').eq('company_id', user.company_id).maybeSingle(),
    ]);
    
    if (empRes.error) console.error('Error fetching employees:', empRes.error);
    if (eqRes.error) console.error('Error fetching equipment:', eqRes.error);
    if (matRes.error) console.error('Error fetching materials:', matRes.error);
    if (tempRes.error) console.error('Error fetching templates:', tempRes.error);

    if (empRes.data) setEmployees(empRes.data);
    if (eqRes.data) setEquipment(eqRes.data);
    if (matRes.data) setMaterials(matRes.data);
    if (tempRes.data) setTemplates(tempRes.data);
    if (invSettingsRes.data) {
      setInvoiceSettings(invSettingsRes.data);
    } else {
      // Pre-fill with defaults so the form isn't blank
      setInvoiceSettings({
        company_id: user.company_id!,
        ...DEFAULT_INVOICE_SETTINGS,
      });
    }
  };

  useEffect(() => {
    fetchAll();
  }, [user.company_id]);

  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ name: '', role: '', hourly_rate: 0, company_id: user.company_id });
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({ name: '', hourly_rate: 0, company_id: user.company_id });
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({ name: '', unit_price: 0, company_id: user.company_id });

  const handleSaveInvoiceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.company_id) return;
    setIsSavingInvoiceSettings(true);
    try {
      const payload = invoiceSettings;
      const { error } = await supabase
        .from('invoice_settings')
        .upsert([payload], { onConflict: 'company_id' });
      if (error) throw error;
      setInvoiceSettingsSaved(true);
      setTimeout(() => setInvoiceSettingsSaved(false), 3000);
    } catch (err: any) {
      alert(`Failed to save invoice settings: ${err.message}`);
    } finally {
      setIsSavingInvoiceSettings(false);
    }
  };

  const [pendingEmployees, setPendingEmployees] = useState<Partial<Employee>[]>([]);
  const [pendingEquipment, setPendingEquipment] = useState<Partial<Equipment>[]>([]);
  const [pendingMaterials, setPendingMaterials] = useState<Partial<Material>[]>([]);

  const handleAddEmployeeToPending = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingEmployees(prev => [...prev, { ...newEmployee, company_id: user.company_id }]);
    setNewEmployee({ name: '', role: '', hourly_rate: 0, company_id: user.company_id });
  };

  const handleSaveAllEmployees = async () => {
    if (pendingEmployees.length === 0) { setIsAddingEmployee(false); return; }
    if (!user.company_id) {
      alert("Error: Your account is not associated with a company. Please contact support.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('employees').insert(pendingEmployees as Employee[]);
      if (error) {
        console.error('Error adding employees:', error);
        alert(`Failed to add employees: ${error.message}`);
        return;
      }
      setPendingEmployees([]);
      setNewEmployee({ name: '', role: '', hourly_rate: 0, company_id: user.company_id });
      setIsAddingEmployee(false);
      fetchAll();
    } catch (err: any) {
      console.error('Unexpected error adding employees:', err);
      alert(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEquipmentToPending = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingEquipment(prev => [...prev, { ...newEquipment, company_id: user.company_id }]);
    setNewEquipment({ name: '', hourly_rate: 0, company_id: user.company_id });
  };

  const handleSaveAllEquipment = async () => {
    if (pendingEquipment.length === 0) { setIsAddingEquipment(false); return; }
    if (!user.company_id) {
      alert("Error: Your account is not associated with a company. Please contact support.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('equipment').insert(pendingEquipment as Equipment[]);
      if (error) {
        console.error('Error adding equipment:', error);
        alert(`Failed to add equipment: ${error.message}`);
        return;
      }
      setPendingEquipment([]);
      setNewEquipment({ name: '', hourly_rate: 0, company_id: user.company_id });
      setIsAddingEquipment(false);
      fetchAll();
    } catch (err: any) {
      console.error('Unexpected error adding equipment:', err);
      alert(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMaterialToPending = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingMaterials(prev => [...prev, { ...newMaterial, company_id: user.company_id }]);
    setNewMaterial({ name: '', unit_price: 0, company_id: user.company_id });
  };

  const handleSaveAllMaterials = async () => {
    if (pendingMaterials.length === 0) { setIsAddingMaterial(false); return; }
    if (!user.company_id) {
      alert("Error: Your account is not associated with a company. Please contact support.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('materials').insert(pendingMaterials as Material[]);
      if (error) {
        console.error('Error adding materials:', error);
        alert(`Failed to add materials: ${error.message}`);
        return;
      }
      setPendingMaterials([]);
      setNewMaterial({ name: '', unit_price: 0, company_id: user.company_id });
      setIsAddingMaterial(false);
      fetchAll();
    } catch (err: any) {
      console.error('Unexpected error adding materials:', err);
      alert(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const parsed: Partial<Material>[] = [];

    try {
      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        if (result.errors.length > 0) {
          alert(`CSV parse error: ${result.errors[0].message}`);
          return;
        }
        const firstRow = result.data[0] ?? {};
        const nameKey = Object.keys(firstRow).find(k => /name/i.test(k));
        const priceKey = Object.keys(firstRow).find(k => /price|cost|rate|unit/i.test(k));
        if (!nameKey || !priceKey) {
          alert('Could not find required columns in the CSV.\nExpected a column matching "name" and a column matching "price", "cost", "rate", or "unit".');
          return;
        }
        for (const row of result.data) {
          const name = row[nameKey]?.trim();
          const unit_price = parseFloat(row[priceKey]);
          if (name && !isNaN(unit_price)) {
            parsed.push({ name, unit_price, company_id: user.company_id });
          }
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        const rows = await readXlsxFile(file);
        if (rows.length < 2) {
          alert('The spreadsheet appears to be empty or has no data rows.');
          return;
        }
        const headers = rows[0].map(h => String(h ?? '').toLowerCase().trim());
        const nameIdx = headers.findIndex(h => /name/.test(h));
        const priceIdx = headers.findIndex(h => /price|cost|rate|unit/.test(h));
        if (nameIdx === -1 || priceIdx === -1) {
          alert('Could not find required columns in the spreadsheet.\nExpected a column matching "name" and a column matching "price", "cost", "rate", or "unit".');
          return;
        }
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[nameIdx] ?? '').trim();
          const unit_price = parseFloat(String(row[priceIdx] ?? ''));
          if (name && !isNaN(unit_price)) {
            parsed.push({ name, unit_price, company_id: user.company_id });
          }
        }
      } else {
        alert('Unsupported file type. Please upload a .csv or .xlsx file.');
        return;
      }

      if (parsed.length === 0) {
        alert('No valid rows found in the file. Ensure the file has columns matching "name" and "price" (or cost/rate/unit) with at least one data row.');
        return;
      }

      setPendingMaterials(prev => [...prev, ...parsed]);
      setIsAddingMaterial(true);
    } catch (err: any) {
      console.error('Error importing spreadsheet:', err);
      alert(`Failed to import file: ${err.message || 'Unknown error'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    await supabase.from('employees').delete().eq('id', id).eq('company_id', user.company_id);
    fetchAll();
  };

  const handleDeleteEquipment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this equipment?')) return;
    await supabase.from('equipment').delete().eq('id', id).eq('company_id', user.company_id);
    fetchAll();
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    await supabase.from('materials').delete().eq('id', id).eq('company_id', user.company_id);
    fetchAll();
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.company_id) {
      alert("Error: Your account is not associated with a company. Please contact support.");
      return;
    }
    setIsSaving(true);
    try {
      const templateData: WorkLogEntry = {
        employees: templateEmployees,
        equipment: templateEquipment,
        materials: templateMaterials
      };
      const { error } = await supabase.from('templates').insert([{
        company_id: user.company_id,
        name: newTemplateName,
        data: templateData
      }]);
      if (error) {
        alert(`Failed to save template: ${error.message}`);
        return;
      }
      setNewTemplateName('');
      setTemplateEmployees([]);
      setTemplateEquipment([]);
      setTemplateMaterials([]);
      setIsAddingTemplate(false);
      fetchAll();
    } catch (err: any) {
      alert(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    const { error } = await supabase.from('templates').delete().eq('id', id).eq('company_id', user.company_id);
    if (error) {
      alert(`Failed to delete template: ${error.message}`);
      return;
    }
    fetchAll();
  };

  const handleAddTemplateEmployee = (id: number) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    setTemplateEmployees([...templateEmployees, { employeeId: id, hours: 8, rate: emp.hourly_rate }]);
  };

  const handleAddTemplateEquipment = (id: number) => {
    const eq = equipment.find(e => e.id === id);
    if (!eq) return;
    setTemplateEquipment([...templateEquipment, { equipmentId: id, hours: 8, rate: eq.hourly_rate }]);
  };

  const handleAddTemplateMaterial = (mat: Material) => {
    setTemplateMaterials([...templateMaterials, { materialId: mat.id, name: mat.name, quantity: 1, unitPrice: mat.unit_price }]);
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(searchEmployees.toLowerCase()) || e.role?.toLowerCase().includes(searchEmployees.toLowerCase()));
  const filteredEquipment = equipment.filter(e => e.name.toLowerCase().includes(searchEquipment.toLowerCase()));
  const filteredMaterials = materials.filter(m => m.name.toLowerCase().includes(searchMaterials.toLowerCase()));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-16">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">System Settings</h2>
          <p className="text-slate-500 mt-1">
            {user.role === 'admin'
              ? 'Manage your master lists for employees, equipment, materials, and daily log templates.'
              : 'Manage daily log templates for your crew.'}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-600">System Online</span>
          </div>
        </div>
      </header>

      {user.role === 'admin' && (
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
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="font-mono font-bold text-slate-700">${e.hourly_rate}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">per hour</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteEmployee(e.id!)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Employee"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="font-mono font-bold text-slate-700">${e.hourly_rate}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">per hour</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteEquipment(e.id!)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Equipment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                id="material-import-file"
                onChange={handleImportSpreadsheet}
              />
              <label
                htmlFor="material-import-file"
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 cursor-pointer transition-all"
                title="Import CSV or Excel"
              >
                <Upload className="w-5 h-5" />
              </label>
              <button onClick={() => setIsAddingMaterial(true)} className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all" title="Add material">
                <Plus className="w-5 h-5" />
              </button>
            </div>
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
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="font-mono font-bold text-emerald-600">${m.unit_price}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">per unit</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteMaterial(m.id!)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
      )}

      {/* Invoice Branding — admin only */}
      {user.role === 'admin' && (
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-900 font-display">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-500" />
            </div>
            Invoice Branding
          </h3>
        </div>
        <p className="text-sm text-slate-500">Customize the company details that appear on every PDF invoice.</p>

        <form onSubmit={handleSaveInvoiceSettings} className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
              <input
                className="input-field"
                placeholder="e.g. Apex Construction Co."
                value={invoiceSettings.company_name}
                onChange={e => setInvoiceSettings({ ...invoiceSettings, company_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Logo Initials (up to 4 chars)</label>
              <input
                className="input-field"
                maxLength={4}
                placeholder="e.g. ACC"
                value={invoiceSettings.logo_initials}
                onChange={e => setInvoiceSettings({ ...invoiceSettings, logo_initials: e.target.value.slice(0, 4) })}
              />
              <p className="text-[10px] text-slate-400 mt-1">Displayed in the logo box on the PDF header.</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Address</label>
              <input
                className="input-field"
                placeholder="e.g. 456 Builder Blvd, Suite 10, Denver, CO 80202"
                value={invoiceSettings.company_address}
                onChange={e => setInvoiceSettings({ ...invoiceSettings, company_address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Phone Number</label>
              <input
                className="input-field"
                placeholder="e.g. (720) 555-0100"
                value={invoiceSettings.company_phone}
                onChange={e => setInvoiceSettings({ ...invoiceSettings, company_phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Billing Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="e.g. billing@apexconstruction.com"
                value={invoiceSettings.company_email}
                onChange={e => setInvoiceSettings({ ...invoiceSettings, company_email: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Payment Terms (footer text)</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="e.g. Payment due within 30 days. Late payments subject to 1.5% monthly finance charge."
                value={invoiceSettings.payment_terms}
                onChange={e => setInvoiceSettings({ ...invoiceSettings, payment_terms: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={isSavingInvoiceSettings}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isSavingInvoiceSettings ? 'Saving…' : 'Save Invoice Settings'}
            </button>
            {invoiceSettingsSaved && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check className="w-4 h-4" /> Saved successfully
              </span>
            )}
          </div>
        </form>
      </section>
      )}

      {/* Templates — visible to admin and foreman */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-900 font-display">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-500" />
            </div>
            Daily Log Templates
          </h3>
          <button onClick={() => setIsAddingTemplate(true)} className="p-2 bg-violet-500 text-white rounded-lg shadow-lg shadow-violet-500/20 hover:scale-105 transition-all">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500">Templates let you quickly pre-fill crew, equipment, and materials when creating a daily log.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card p-5 group hover:border-violet-500/30 transition-all space-y-3">
              <div className="flex justify-between items-start">
                <p className="font-bold text-slate-900">{t.name}</p>
                <button
                  onClick={() => handleDeleteTemplate(t.id!)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                {t.data.employees.length > 0 && (
                  <p className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-slate-400" />
                    {t.data.employees.length} employee{t.data.employees.length !== 1 ? 's' : ''}
                  </p>
                )}
                {t.data.equipment.length > 0 && (
                  <p className="flex items-center gap-1.5">
                    <Truck className="w-3 h-3 text-slate-400" />
                    {t.data.equipment.length} equipment item{t.data.equipment.length !== 1 ? 's' : ''}
                  </p>
                )}
                {t.data.materials.length > 0 && (
                  <p className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-slate-400" />
                    {t.data.materials.length} material{t.data.materials.length !== 1 ? 's' : ''}
                  </p>
                )}
                {t.data.employees.length === 0 && t.data.equipment.length === 0 && t.data.materials.length === 0 && (
                  <p className="italic text-slate-400">Empty template</p>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3 py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <p className="text-slate-400 text-sm">No templates yet. Create one to speed up daily log entry.</p>
            </div>
          )}
        </div>
      </section>

      {/* Modals for Adding */}
      <AnimatePresence>
        {isAddingEmployee && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold font-display">Add Employees</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add multiple employees before saving.</p>
                </div>
                <button onClick={() => { setIsAddingEmployee(false); setPendingEmployees([]); setNewEmployee({ name: '', role: '', hourly_rate: 0, company_id: user.company_id }); }}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
                {pendingEmployees.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pending ({pendingEmployees.length})</label>
                    {pendingEmployees.map((emp, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{emp.name}</span>
                        <span className="text-slate-500 text-xs">{emp.role} · ${emp.hourly_rate}/hr</span>
                        <button type="button" onClick={() => setPendingEmployees(prev => prev.filter((_, i) => i !== idx))} className="ml-2 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddEmployeeToPending} className="space-y-4">
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
                  <button type="submit" className="btn-secondary w-full flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add to List
                  </button>
                </form>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button type="button" disabled={isSaving} onClick={() => { setIsAddingEmployee(false); setPendingEmployees([]); setNewEmployee({ name: '', role: '', hourly_rate: 0, company_id: user.company_id }); }} className="btn-secondary flex-1">Cancel</button>
                <button type="button" disabled={isSaving || pendingEmployees.length === 0} onClick={handleSaveAllEmployees} className="btn-primary flex-1">
                  {isSaving ? 'Saving...' : `Save ${pendingEmployees.length > 0 ? `(${pendingEmployees.length}) ` : ''}Employee${pendingEmployees.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingEquipment && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold font-display">Add Equipment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add multiple equipment items before saving.</p>
                </div>
                <button onClick={() => { setIsAddingEquipment(false); setPendingEquipment([]); setNewEquipment({ name: '', hourly_rate: 0, company_id: user.company_id }); }}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
                {pendingEquipment.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pending ({pendingEquipment.length})</label>
                    {pendingEquipment.map((eq, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{eq.name}</span>
                        <span className="text-slate-500 text-xs">${eq.hourly_rate}/hr</span>
                        <button type="button" onClick={() => setPendingEquipment(prev => prev.filter((_, i) => i !== idx))} className="ml-2 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddEquipmentToPending} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Equipment Name</label>
                    <input required className="input-field" placeholder="e.g. Bucket Truck #102" value={newEquipment.name ?? ''} onChange={e => setNewEquipment({...newEquipment, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Hourly Rate ($)</label>
                    <input type="number" step="0.01" required className="input-field" placeholder="0.00" value={newEquipment.hourly_rate ?? ''} onChange={e => setNewEquipment({...newEquipment, hourly_rate: Number(e.target.value)})} />
                  </div>
                  <button type="submit" className="btn-secondary w-full flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add to List
                  </button>
                </form>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button type="button" disabled={isSaving} onClick={() => { setIsAddingEquipment(false); setPendingEquipment([]); setNewEquipment({ name: '', hourly_rate: 0, company_id: user.company_id }); }} className="btn-secondary flex-1">Cancel</button>
                <button type="button" disabled={isSaving || pendingEquipment.length === 0} onClick={handleSaveAllEquipment} className="btn-primary flex-1">
                  {isSaving ? 'Saving...' : `Save ${pendingEquipment.length > 0 ? `(${pendingEquipment.length}) ` : ''}Item${pendingEquipment.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingMaterial && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold font-display">Add Materials</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add multiple materials before saving.</p>
                </div>
                <button onClick={() => { setIsAddingMaterial(false); setPendingMaterials([]); setNewMaterial({ name: '', unit_price: 0, company_id: user.company_id }); }}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
                {pendingMaterials.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pending ({pendingMaterials.length})</label>
                    {pendingMaterials.map((mat, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{mat.name}</span>
                        <span className="text-slate-500 text-xs">${mat.unit_price}/unit</span>
                        <button type="button" onClick={() => setPendingMaterials(prev => prev.filter((_, i) => i !== idx))} className="ml-2 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddMaterialToPending} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Material Name</label>
                    <input required className="input-field" placeholder="e.g. 2 inch PVC Conduit" value={newMaterial.name ?? ''} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Unit Price ($)</label>
                    <input type="number" step="0.01" required className="input-field" placeholder="0.00" value={newMaterial.unit_price ?? ''} onChange={e => setNewMaterial({...newMaterial, unit_price: Number(e.target.value)})} />
                  </div>
                  <button type="submit" className="btn-secondary w-full flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add to List
                  </button>
                </form>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button type="button" disabled={isSaving} onClick={() => { setIsAddingMaterial(false); setPendingMaterials([]); setNewMaterial({ name: '', unit_price: 0, company_id: user.company_id }); }} className="btn-secondary flex-1">Cancel</button>
                <button type="button" disabled={isSaving || pendingMaterials.length === 0} onClick={handleSaveAllMaterials} className="btn-primary flex-1">
                  {isSaving ? 'Saving...' : `Save ${pendingMaterials.length > 0 ? `(${pendingMaterials.length}) ` : ''}Material${pendingMaterials.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingTemplate && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold font-display">Create Daily Log Template</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Save a crew, equipment, and materials combination for quick reuse.</p>
                </div>
                <button onClick={() => setIsAddingTemplate(false)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSaveTemplate} className="p-6 space-y-6 overflow-y-auto min-h-0">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Template Name</label>
                  <input
                    required
                    className="input-field"
                    placeholder="e.g. Standard 4-Man Crew"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                  />
                </div>

                {/* Template Employees */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> Employees
                    </label>
                    <select
                      className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 outline-none"
                      onChange={e => { if (e.target.value) { handleAddTemplateEmployee(Number(e.target.value)); e.target.value = ''; } }}
                      value=""
                    >
                      <option value="" disabled>+ Add Employee</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    {templateEmployees.map((se, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1">
                          <p className="font-bold text-sm">{employees.find(e => e.id === se.employeeId)?.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{employees.find(e => e.id === se.employeeId)?.role}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            className="w-14 bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono"
                            value={se.hours}
                            onChange={e => {
                              const updated = [...templateEmployees];
                              updated[idx] = { ...updated[idx], hours: Number(e.target.value) };
                              setTemplateEmployees(updated);
                            }}
                          />
                          <span className="text-xs text-slate-400">hrs</span>
                        </div>
                        <button type="button" onClick={() => setTemplateEmployees(templateEmployees.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {templateEmployees.length === 0 && <p className="text-xs text-slate-400 italic">No employees added.</p>}
                  </div>
                </div>

                {/* Template Equipment */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Truck className="w-3 h-3" /> Equipment
                    </label>
                    <select
                      className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 outline-none"
                      onChange={e => { if (e.target.value) { handleAddTemplateEquipment(Number(e.target.value)); e.target.value = ''; } }}
                      value=""
                    >
                      <option value="" disabled>+ Add Equipment</option>
                      {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    {templateEquipment.map((se, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1">
                          <p className="font-bold text-sm">{equipment.find(e => e.id === se.equipmentId)?.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            className="w-14 bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono"
                            value={se.hours}
                            onChange={e => {
                              const updated = [...templateEquipment];
                              updated[idx] = { ...updated[idx], hours: Number(e.target.value) };
                              setTemplateEquipment(updated);
                            }}
                          />
                          <span className="text-xs text-slate-400">hrs</span>
                        </div>
                        <button type="button" onClick={() => setTemplateEquipment(templateEquipment.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {templateEquipment.length === 0 && <p className="text-xs text-slate-400 italic">No equipment added.</p>}
                  </div>
                </div>

                {/* Template Materials */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Package className="w-3 h-3" /> Materials
                    </label>
                    <select
                      className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 outline-none"
                      onChange={e => {
                        const mat = materials.find(m => String(m.id) === e.target.value);
                        if (mat) { handleAddTemplateMaterial(mat); e.target.value = ''; }
                      }}
                      value=""
                    >
                      <option value="" disabled>+ Add Material</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    {templateMaterials.map((sm, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1">
                          <p className="font-bold text-sm">{sm.name}</p>
                          <p className="text-[10px] text-slate-400">${sm.unitPrice} / unit</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            className="w-14 bg-white border border-slate-200 rounded px-2 py-1 text-sm text-center font-mono"
                            value={sm.quantity}
                            min={1}
                            onChange={e => {
                              const updated = [...templateMaterials];
                              updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                              setTemplateMaterials(updated);
                            }}
                          />
                          <span className="text-xs text-slate-400">qty</span>
                        </div>
                        <button type="button" onClick={() => setTemplateMaterials(templateMaterials.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {templateMaterials.length === 0 && <p className="text-xs text-slate-400 italic">No materials added.</p>}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="button" disabled={isSaving} onClick={() => setIsAddingTemplate(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={isSaving} className="btn-primary flex-1">
                    {isSaving ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UserManagement = ({ user }: { user: User }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'foreman'>('foreman');

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').eq('company_id', user.company_id);
    if (!error && data) {
      setUsers(data as User[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [user.company_id]);

  const generateInvite = async () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const { data, error } = await supabase
      .from('invitations')
      .insert([{
        company_id: user.company_id,
        role: inviteRole,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      }])
      .select()
      .single();

    if (!error && data) {
      const url = `${window.location.origin}/?token=${token}`;
      setInviteLink(url);
    }
  };

  const handlePromote = async (id: string) => {
    if (!confirm('Are you sure you want to promote this user to Admin? This action cannot be undone.')) return;
    
    const { error } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', id)
      .eq('company_id', user.company_id);
      
    if (!error) {
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (email === user.email) {
      alert("You cannot delete your own profile.");
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${email}? This action cannot be undone.`)) return;
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
      .eq('company_id', user.company_id);
      
    if (!error) {
      fetchUsers();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-12">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">User Management</h2>
          <p className="text-slate-500 mt-1">Manage company accounts and permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'foreman')}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="foreman">Foreman</option>
            <option value="admin">Admin</option>
          </select>
          <button 
            onClick={generateInvite}
            className="btn-primary flex items-center gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            Generate Invite
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Invitation Link Generated</p>
              <p className="text-sm text-slate-600 truncate font-mono">{inviteLink}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(inviteLink);
              alert('Link copied to clipboard!');
            }}
            className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
          >
            <Copy className="w-5 h-5" />
          </button>
        </div>
      )}

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
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'foreman' && (
                        <button 
                          onClick={() => handlePromote(u.id)}
                          className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Promote to Admin
                        </button>
                      )}
                      {u.email !== user.email && (
                        <button 
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [compRes, invRes] = await Promise.all([
      supabase.from('companies').select('*, users(count)').order('created_at', { ascending: false }),
      supabase.from('invitations').select('*').is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    ]);
    if (compRes.data) setCompanies(compRes.data);
    if (invRes.data) setInvites(invRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateCompanyInvite = async () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const { data, error } = await supabase
      .from('invitations')
      .insert([{
        company_id: null,
        role: 'admin',
        token,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }])
      .select()
      .single();

    if (!error && data) {
      const url = `${window.location.origin}/?token=${token}`;
      setInviteLink(url);
      fetchData();
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-start mb-12">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">Super Admin</h2>
          <p className="text-slate-500 mt-1">Manage global companies and invitations.</p>
        </div>
        <button 
          onClick={generateCompanyInvite}
          className="btn-primary flex items-center gap-2 shadow-lg shadow-brand/20"
        >
          <Plus className="w-5 h-5" />
          Create Company Invite
        </button>
      </div>

      {inviteLink && (
        <div className="mb-12 p-6 bg-brand/5 border border-brand/10 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-6 h-6 text-brand" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-brand uppercase tracking-widest mb-1">Company Invitation Link</p>
              <p className="text-lg text-slate-700 truncate font-mono">{inviteLink}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(inviteLink);
              alert('Link copied to clipboard!');
            }}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
          >
            <Copy className="w-6 h-6 text-slate-600" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-slate-400" />
            Registered Companies
          </h3>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Users</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{c.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {c.users?.[0]?.count || 0} users
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Pending Invites
          </h3>
          <div className="space-y-3">
            {invites.map(inv => (
              <div key={inv.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded border border-purple-100">
                    {inv.role}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Exp: {new Date(inv.expires_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mb-3">{window.location.origin}/?token={inv.token}</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?token=${inv.token}`);
                    alert('Link copied!');
                  }}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-3 h-3" /> Copy Link
                </button>
              </div>
            ))}
            {invites.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm italic">No active invitations</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompanySetup = ({ user, onComplete }: { user: User, onComplete: (companyId: string) => void }) => {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Starting company setup for user:', user.id);
      // Create company and link user via SECURITY DEFINER RPC (bypasses RLS)
      const { data: companyId, error: companyError } = await supabase
        .rpc('create_company', { company_name: companyName });

      if (companyError) {
        console.error('Company creation error:', companyError);
        throw companyError;
      }
      console.log('Company created successfully:', companyId);

      onComplete(companyId as string);
    } catch (err: any) {
      console.error('Full error object:', err);
      setError(err.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">Setup Your Company</h2>
        <p className="text-slate-500 mb-6">You need to create a company profile before you can start using Service Track Pro.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
            <input 
              type="text" 
              required 
              className="input-field" 
              placeholder="e.g. Acme Electrical Services"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-lg mt-4 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Company & Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setAuthReady(true);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
        setAuthReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (id: string, email: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setUser(data as User);
    } else {
      console.warn('Profile not found in database, using fallback:', error);
      // Fallback if profile not found
      setUser({
        id: id,
        name: email.split('@')[0],
        email: email,
        role: 'admin',
        company_id: null
      });
    }
    setAuthReady(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

  if (user.company_id === null && user.role === 'admin') {
    return <CompanySetup user={user} onComplete={(companyId) => setUser({ ...user, company_id: companyId })} />;
  }

  if (user.company_id === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-center">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">No Company Assigned</h2>
          <p className="text-slate-500 mb-8">Your account is not yet associated with a company. Please ask your administrator to invite you or assign you to a company.</p>
          <button onClick={handleLogout} className="btn-secondary w-full py-3">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedJobId(null); }} user={user} onLogout={handleLogout}>
      {activeTab === 'jobs' && (
        selectedJobId ? (
          <JobDetails jobId={selectedJobId} onBack={() => setSelectedJobId(null)} user={user} />
        ) : (
          <Dashboard onSelectJob={setSelectedJobId} user={user} />
        )
      )}
      {activeTab === 'users' && user.role === 'admin' && <UserManagement user={user} />}
      {activeTab === 'settings' && (user.role === 'admin' || user.role === 'foreman') && <Settings user={user} />}
      {activeTab === 'super-admin' && user.role === 'super_admin' && <SuperAdminDashboard />}
    </Layout>
  );
}
