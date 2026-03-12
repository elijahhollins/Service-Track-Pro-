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
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Job, Employee, Equipment, Material, WorkLog, Template, WorkLogEntry, User } from './types';
import { supabase } from './supabase';

// --- Components ---

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        // 1. Sign up to Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Create profile in public.users
          const { error: profileError } = await supabase
            .from('users')
            .insert([{ 
              name: name || email.split('@')[0], 
              email, 
              password, // Storing for legacy reasons as per your SQL, but Auth handles it
              role: 'foreman' 
            }]);

          if (profileError) console.error('Profile creation error:', profileError);
          
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

const Layout = ({ children, activeTab, setActiveTab, user, onLogout }: { children: React.ReactNode, activeTab: string, setActiveTab: (t: string) => void, user: User, onLogout: () => void }) => {
  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-400 flex flex-col border-r border-slate-800 flex-shrink-0 overflow-y-auto">
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
    const { data, error } = await supabase
      .from('jobs')
      .insert([newJob])
      .select()
      .single();
      
    if (!error && data) {
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
            onClose={() => setIsViewingInvoice(false)} 
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

const InvoiceView = ({ job, employees, equipment, materials, onClose }: { 
  job: Job, 
  employees: Employee[], 
  equipment: Equipment[], 
  materials: Material[],
  onClose: () => void 
}) => {
  const laborTotal = job.logs?.reduce((acc, log) => acc + log.data.employees.reduce((lAcc, e) => lAcc + (e.hours * e.rate), 0), 0) || 0;
  const equipmentTotal = job.logs?.reduce((acc, log) => acc + log.data.equipment.reduce((eAcc, e) => eAcc + (e.hours * e.rate), 0), 0) || 0;
  const materialTotal = job.logs?.reduce((acc, log) => acc + log.data.materials.reduce((mAcc, m) => mAcc + (m.quantity * m.unitPrice), 0), 0) || 0;
  const grandTotal = laborTotal + equipmentTotal + materialTotal;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-8 text-white">
          <h3 className="text-2xl font-bold font-display">Invoice Preview</h3>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Printer className="w-5 h-5" /> Print
            </button>
            <button onClick={onClose} className="btn-primary bg-white text-slate-900 hover:bg-slate-100">Close</button>
          </div>
        </div>

        <div className="bg-white p-12 rounded-lg shadow-2xl text-slate-900 print:shadow-none print:p-0" id="invoice">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tighter font-display">Service Track Pro</h1>
              </div>
              <p className="text-sm text-slate-500">123 Service Way, Industrial Park</p>
              <p className="text-sm text-slate-500">Springfield, ST 55555</p>
              <p className="text-sm text-slate-500">(555) 123-4567 • billing@servicetrackpro.com</p>
            </div>
            <div className="text-right">
              <h2 className="text-5xl font-black text-slate-200 uppercase mb-4 font-display">Invoice</h2>
              <p className="font-bold">Job #: {job.job_number}</p>
              <p className="text-slate-500">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-12 mb-12">
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To:</h4>
              <p className="text-xl font-bold">{job.customer_name}</p>
              <p className="text-slate-600">{job.address}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Project:</h4>
              <p className="text-xl font-bold">{job.job_name}</p>
              <p className="text-slate-600">Status: {job.status}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-12 mb-12">
            {job.logs?.map(log => (
              <div key={log.id} className="border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h5 className="font-bold text-lg">{new Date(log.date).toLocaleDateString()} - Daily Log</h5>
                  <p className="text-xs text-slate-400 italic">{log.notes}</p>
                </div>
                
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      <th className="pb-2 font-bold uppercase text-[10px] tracking-widest text-slate-400">Description</th>
                      <th className="pb-2 font-bold uppercase text-[10px] tracking-widest text-slate-400 text-center">Qty/Hrs</th>
                      <th className="pb-2 font-bold uppercase text-[10px] tracking-widest text-slate-400 text-right">Rate</th>
                      <th className="pb-2 font-bold uppercase text-[10px] tracking-widest text-slate-400 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {log.data.employees.map((e, idx) => (
                      <tr key={`emp-${idx}`}>
                        <td className="py-2">Labor: {employees.find(emp => emp.id === e.employeeId)?.name}</td>
                        <td className="py-2 text-center font-mono">{e.hours}h</td>
                        <td className="py-2 text-right font-mono">${e.rate.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono">${(e.hours * e.rate).toFixed(2)}</td>
                      </tr>
                    ))}
                    {log.data.equipment.map((e, idx) => (
                      <tr key={`eq-${idx}`}>
                        <td className="py-2">Equipment: {equipment.find(eq => eq.id === e.equipmentId)?.name}</td>
                        <td className="py-2 text-center font-mono">{e.hours}h</td>
                        <td className="py-2 text-right font-mono">${e.rate.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono">${(e.hours * e.rate).toFixed(2)}</td>
                      </tr>
                    ))}
                    {log.data.materials.map((m, idx) => (
                      <tr key={`mat-${idx}`}>
                        <td className="py-2">Material: {m.name}</td>
                        <td className="py-2 text-center font-mono">{m.quantity}</td>
                        <td className="py-2 text-right font-mono">${m.unitPrice.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono">${(m.quantity * m.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-12 border-t-2 border-slate-900">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Labor Total:</span>
                <span className="font-mono font-bold">${laborTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Equipment Total:</span>
                <span className="font-mono font-bold">${equipmentTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Material Total:</span>
                <span className="font-mono font-bold">${materialTotal.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-lg font-black uppercase tracking-tighter">Grand Total:</span>
                <span className="text-2xl font-black font-mono">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-24 pt-12 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Thank you for your business</p>
            <p className="text-[10px] text-slate-300 mt-2 italic">Payment is due within 30 days. Please include job number on all correspondence.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Settings = () => {
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
    await supabase.from('employees').insert([newEmployee]);
    setNewEmployee({ name: '', role: '', hourly_rate: 0 });
    setIsAddingEmployee(false);
    fetchAll();
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('equipment').insert([newEquipment]);
    setNewEquipment({ name: '', hourly_rate: 0 });
    setIsAddingEquipment(false);
    fetchAll();
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('materials').insert([newMaterial]);
    setNewMaterial({ name: '', unit_price: 0 });
    setIsAddingMaterial(false);
    fetchAll();
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(searchEmployees.toLowerCase()) || e.role?.toLowerCase().includes(searchEmployees.toLowerCase()));
  const filteredEquipment = equipment.filter(e => e.name.toLowerCase().includes(searchEquipment.toLowerCase()));
  const filteredMaterials = materials.filter(m => m.name.toLowerCase().includes(searchMaterials.toLowerCase()));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-16">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">System Settings</h2>
          <p className="text-slate-500 mt-1">Manage your master lists for employees, equipment, and materials.</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-600">System Online</span>
          </div>
        </div>
      </header>

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
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.email!);
      } else {
        setAuthReady(true);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.email!);
      } else {
        setUser(null);
        setAuthReady(true);
      }
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
      setUser(data as User);
    } else {
      // Fallback if profile not found
      setUser({
        id: 0,
        name: email.split('@')[0],
        email: email,
        role: 'foreman'
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

  return (
    <Layout activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedJobId(null); }} user={user} onLogout={handleLogout}>
      {activeTab === 'jobs' && (
        selectedJobId ? (
          <JobDetails jobId={selectedJobId} onBack={() => setSelectedJobId(null)} user={user} />
        ) : (
          <Dashboard onSelectJob={setSelectedJobId} user={user} />
        )
      )}
      {activeTab === 'users' && user.role === 'admin' && <UserManagement />}
      {activeTab === 'settings' && user.role === 'admin' && <Settings />}
    </Layout>
  );
}
