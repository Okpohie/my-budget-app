import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
  Wallet, 
  Receipt, 
  Settings, 
  Home, 
  Plus, 
  Trash2, 
  CheckCircle2,
  PlusCircle,
  TrendingUp,
  ArrowRightLeft,
  AlertCircle,
  RefreshCcw,
  Calendar,
  ChevronRight,
  Target
} from 'lucide-react';

// --- Firebase Configuration ---
// FOR GITHUB HOSTING: Replace the lines below with your actual Firebase config object.
// Example: const firebaseConfig = { apiKey: "...", authDomain: "...", ... };
const firebaseConfig = {
  apiKey: "AIzaSyC3oc6S4DpGtNXE5miBQPgmZ2s8ayS_A4Y",
  authDomain: "smart-budgeter-7687f.firebaseapp.com",
  projectId: "smart-budgeter-7687f",
  storageBucket: "smart-budgeter-7687f.firebasestorage.app",
  messagingSenderId: "32367125535",
  appId: "1:32367125535:web:3cef6dcb8fb246fc94612a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use the environment app ID if available, otherwise default
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pro-budgeter-pro';

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); 
  const [notification, setNotification] = useState(null);

  // Get current date for the badge
  const today = new Date();
  const monthName = today.toLocaleString('default', { month: 'short' }).toUpperCase();
  const dayNum = today.getDate();

  useEffect(() => {
    // Styles for premium feel and mobile optimization
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      body { font-family: 'Plus Jakarta Sans', sans-serif; }
      input, select, textarea { font-size: 16px !important; }
      .glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-5px); }
        100% { transform: translateY(0px); }
      }
      .animate-float { animation: float 3s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      const currentMonthId = new Date().getMonth() + 1;

      if (docSnap.exists()) {
        const existingData = docSnap.data();
        if (existingData.last_month && existingData.last_month !== currentMonthId) {
          // Automatic Rollover Logic
          const billsTotal = Object.values(existingData.bills || {}).reduce((a, b) => a + b, 0);
          const effectivePrevious = (existingData.monthly_income || 0) + (existingData.income_rollover || 0);
          const totalSpentPrevious = Object.values(existingData.spent || {}).reduce((a, b) => a + b, 0);
          const totalUnspentRollover = effectivePrevious - billsTotal - totalSpentPrevious;

          const newAllocations = { ...existingData.allocations };
          Object.keys(existingData.allocations || {}).forEach(cat => {
            const carryover = (existingData.allocations[cat] || 0) - (existingData.spent?.[cat] || 0);
            newAllocations[cat] = (existingData.base_allocations?.[cat] || 0) + carryover;
          });

          const newData = {
            ...existingData,
            income_rollover: totalUnspentRollover,
            allocations: newAllocations, 
            spent: Object.keys(existingData.spent || {}).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
            last_month: currentMonthId,
            transactions: []
          };
          await updateDoc(docRef, newData);
          setData(newData);
        } else {
          setData(existingData);
        }
      } else {
        const defaultAllocs = { "Food": 300, "Fuel": 150, "Leisure": 100 };
        const defaultData = {
          monthly_income: 2000,
          income_rollover: 0,
          bills: { "Rent": 800, "Council Tax": 150 },
          categories: ["Food", "Fuel", "Leisure"],
          base_allocations: defaultAllocs,
          allocations: defaultAllocs,     
          spent: { "Food": 0, "Fuel": 0, "Leisure": 0 },
          transactions: [],
          last_month: currentMonthId
        };
        setDoc(docRef, defaultData);
        setData(defaultData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const metrics = useMemo(() => {
    if (!data) return { effective: 0, bills: 0, allocatedRemaining: 0, freeCash: 0, totalSpent: 0 };
    const effective = (data.monthly_income || 0) + (data.income_rollover || 0);
    const billsTotal = Object.values(data.bills || {}).reduce((a, b) => a + b, 0);
    const totalAllocated = Object.values(data.allocations || {}).reduce((a, b) => a + b, 0);
    const categorySpent = Object.values(data.spent || {}).reduce((a, b) => a + b, 0);
    
    let overspendingAdjustment = 0;
    Object.keys(data.allocations || {}).forEach(cat => {
      const diff = (data.spent?.[cat] || 0) - (data.allocations[cat] || 0);
      if (diff > 0) overspendingAdjustment += diff;
    });

    const freeCash = (effective - billsTotal - totalAllocated) - overspendingAdjustment;
    return { 
      effective, 
      bills: billsTotal, 
      allocatedRemaining: totalAllocated - categorySpent, 
      freeCash,
      totalSpent: categorySpent + billsTotal
    };
  }, [data]);

  const showNotify = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 3000);
  };

  const deleteTransaction = async (txId) => {
    const tx = data.transactions.find(t => t.id === txId);
    if (!tx) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const newSpent = { ...data.spent, [tx.category]: Math.max(0, data.spent[tx.category] - tx.amount) };
    await updateDoc(docRef, { 
      transactions: data.transactions.filter(t => t.id !== txId),
      spent: newSpent
    });
    showNotify("Transaction removed");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-blue-600"></div>
        <span className="text-slate-400 font-medium text-sm">Organizing your finances...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-32 max-w-xl mx-auto overflow-x-hidden">
      {/* Dynamic Header */}
      <header className="px-6 pt-12 pb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Overview</h1>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">£{metrics.freeCash.toLocaleString(undefined, { minimumFractionDigits: 0 })} <span className="text-slate-400 text-lg font-semibold tracking-tight">unused bal</span></p>
          </div>
          {/* Dynamic Month/Day Badge */}
          <div className="bg-white px-3 py-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[54px] animate-float">
            <span className="text-[10px] font-black text-blue-600 leading-none">{monthName}</span>
            <span className="text-xl font-black text-slate-800 leading-none mt-1">{dayNum}</span>
          </div>
        </div>

        {/* Bento Grid Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-600 rounded-[2rem] p-5 text-white shadow-xl shadow-blue-200 flex flex-col justify-between aspect-square md:aspect-auto">
            <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Income Pot</p>
              <p className="text-2xl font-black leading-none">£{metrics.effective.toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-rows-2 gap-3">
            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="bg-rose-50 w-10 h-10 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fixed Bills</p>
                <p className="text-lg font-extrabold">£{metrics.bills.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flexible Pot Remaining</p>
                <p className="text-lg font-extrabold">£{metrics.allocatedRemaining.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-6">
        {activeTab === 'home' && <HomeView data={data} metrics={metrics} onDeleteTx={deleteTransaction} />}
        {activeTab === 'daily' && <DailyLoggingView data={data} user={user} showNotify={showNotify} />}
        {activeTab === 'bills' && <BillsView data={data} user={user} showNotify={showNotify} />}
        {activeTab === 'monthly' && <SetupView data={data} user={user} showNotify={showNotify} />}
      </main>

      {/* Floating Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm glass border border-white/50 flex justify-around items-center p-2.5 z-50 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
        <NavButton active={activeTab === 'home'} icon={Home} onClick={() => setActiveTab('home')} />
        <NavButton active={activeTab === 'daily'} icon={Plus} isMain onClick={() => setActiveTab('daily')} />
        <NavButton active={activeTab === 'bills'} icon={Receipt} onClick={() => setActiveTab('bills')} />
        <NavButton active={activeTab === 'monthly'} icon={Settings} onClick={() => setActiveTab('monthly')} />
      </nav>

      {notification && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 ${notification.isError ? 'bg-rose-600' : 'bg-slate-900'} text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 z-[100] w-[85%]`}>
          <span className="font-bold text-sm">{notification.msg}</span>
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon: Icon, onClick, isMain }) {
  if (isMain) return (
    <button onClick={onClick} className="bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-200 active:scale-90 transition-transform -translate-y-2">
      <Icon className="w-6 h-6" strokeWidth={3} />
    </button>
  );
  return (
    <button onClick={onClick} className={`p-4 transition-all ${active ? 'text-blue-600' : 'text-slate-400 opacity-60'}`}>
      <Icon className="w-6 h-6" strokeWidth={2.5} />
    </button>
  );
}

function HomeView({ data, metrics, onDeleteTx }) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  const getDailyTarget = (cat) => {
    const allocation = data?.allocations?.[cat] || 0;
    const spent = data?.spent?.[cat] || 0;
    const target = ((allocation / daysInMonth) * currentDay) - spent;
    return { value: target, status: target >= 0 ? 'good' : 'over' };
  };

  return (
    <div className="space-y-8">
      {/* Category Performance Cards */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pacing Alerts</h3>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Day {currentDay} of {daysInMonth}</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {data?.categories.map(cat => {
            const target = getDailyTarget(cat);
            const percent = Math.min(100, ((data.spent[cat] || 0) / (data.allocations[cat] || 1)) * 100);
            return (
              <div key={cat} className="bg-white p-4 rounded-[1.75rem] border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-50" />
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                      strokeDasharray={126} strokeDashoffset={126 - (126 * percent) / 100}
                      className={`${percent > 100 ? 'text-rose-500' : percent > 85 ? 'text-amber-500' : 'text-blue-600'} transition-all duration-700`} 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] font-black text-slate-400">{Math.round(percent)}%</span>
                  </div>
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 uppercase truncate">{cat}</h4>
                  <p className="text-[10px] text-slate-400 font-bold">Spent £{data.spent[cat].toFixed(0)} / £{data.allocations[cat].toFixed(0)}</p>
                </div>
                <div className={`text-right ${target.status === 'good' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  <p className="text-[10px] font-black uppercase leading-none mb-1">Target</p>
                  <p className="text-sm font-extrabold leading-none">{target.value >= 0 ? '+' : ''}£{target.value.toFixed(0)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modern Transaction List */}
      <div className="pb-10">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-3.5 h-3.5" /> Recent Transactions
        </h3>
        <div className="space-y-2">
          {(!data.transactions || data.transactions.length === 0) ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl py-10 flex flex-col items-center">
              <p className="text-slate-300 font-bold text-sm">Quiet month so far...</p>
            </div>
          ) : (
            data.transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="group flex items-center justify-between p-4 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-50 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-blue-600 text-xs uppercase">
                    {tx.category.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-800 uppercase">{tx.category}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-slate-900">-£{tx.amount.toFixed(2)}</span>
                  <button onClick={() => onDeleteTx(tx.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all">
                    <Trash2 size={16}/>
                  </button>
                  <ChevronRight size={14} className="text-slate-300 group-hover:hidden" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DailyLoggingView({ data, user, showNotify }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(data?.categories[0] || "");

  const handleRecord = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const newSpent = { ...data.spent, [category]: (data.spent[category] || 0) + val };
    const tx = { id: Math.random().toString(36).substr(2, 9), amount: val, category, timestamp: new Date().toISOString() };
    await updateDoc(docRef, { spent: newSpent, transactions: [tx, ...(data.transactions || [])].slice(0, 100) });
    showNotify(`Logged £${val}`);
    setAmount('');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
        <h3 className="text-xl font-extrabold text-slate-900 mb-6">Record Expense</h3>
        
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
          {data.categories.map(cat => (
            <button key={cat} onClick={()=>setCategory(cat)} 
              className={`px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all 
              ${category === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="relative mb-8">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-200">£</span>
          <input type="number" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} 
            className="w-full bg-slate-50 p-8 pl-12 rounded-3xl text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500 transition-all placeholder:text-slate-200" 
            placeholder="0.00" autoFocus />
        </div>

        <button onClick={handleRecord} disabled={!amount}
          className="w-full bg-blue-600 disabled:opacity-50 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-blue-100 active:scale-95 transition-all text-lg uppercase tracking-widest">
          Finish Transaction
        </button>
      </div>
    </div>
  );
}

function BillsView({ data, user, showNotify }) {
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');

  const add = async () => {
    if (!name || !amt) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    await updateDoc(docRef, { bills: { ...(data.bills || {}), [name]: parseFloat(amt) } });
    setName(''); setAmt(''); showNotify("Added recurring bill");
  };

  const removeBill = async (k) => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const updated = { ...data.bills }; delete updated[k];
    await updateDoc(docRef, { bills: updated });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
        <h3 className="text-xl font-extrabold mb-6">Fixed Outgoings</h3>
        <div className="space-y-3 mb-6">
           <input placeholder="Service name (e.g. Rent)" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 outline-none focus:border-blue-500" />
           <div className="relative">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">£</span>
             <input type="number" placeholder="0.00" value={amt} onChange={e=>setAmt(e.target.value)} className="w-full bg-slate-50 p-4 pl-10 rounded-2xl font-black border border-slate-100 outline-none focus:border-blue-500" />
           </div>
        </div>
        <button onClick={add} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest">Add recurring</button>
      </div>
      
      <div className="space-y-3">
        {Object.entries(data.bills || {}).map(([k, v]) => (
          <div key={k} className="bg-white p-5 rounded-3xl flex justify-between items-center border border-slate-100">
            <div>
              <p className="text-sm font-black text-slate-800 uppercase leading-none mb-1">{k}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Direct Debit</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-extrabold text-slate-900">£{v.toLocaleString()}</span>
              <button onClick={() => removeBill(k)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupView({ data, user, showNotify }) {
  const [income, setIncome] = useState(data.monthly_income);
  const [newCat, setNewCat] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const saveIncome = async (v) => {
    const val = parseFloat(v) || 0;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    await updateDoc(docRef, { monthly_income: val });
    showNotify("Income updated");
  };

  const saveAllocation = async (cat, val) => {
    const amount = parseFloat(val) || 0;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const rollover = (data.allocations?.[cat] || 0) - (data.base_allocations?.[cat] || 0);
    await updateDoc(docRef, { 
      base_allocations: { ...data.base_allocations, [cat]: amount },
      allocations: { ...data.allocations, [cat]: amount + rollover } 
    });
    showNotify("Saved");
  };

  const handleFullReset = async () => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const z = {}; data.categories.forEach(c => { z[c] = 0; });
    await updateDoc(docRef, { monthly_income: 0, income_rollover: 0, base_allocations: z, allocations: z, spent: z, transactions: [] });
    setConfirmReset(false);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Base Monthly Salary</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">£</span>
            <input type="number" value={income} onChange={e => setIncome(e.target.value)} onBlur={e => saveIncome(e.target.value)}
              className="w-full bg-slate-50 p-5 pl-10 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-blue-500 transition-all" />
          </div>
        </div>
        
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Standard Goal Allocations</label>
          {data.categories.map(cat => (
            <div key={cat} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
              <span className="text-xs font-black text-slate-600 uppercase">{cat}</span>
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">£</span>
                 <input type="number" value={data.base_allocations[cat] || 0} 
                   onChange={e => saveAllocation(cat, e.target.value)}
                   className="w-24 text-right bg-white p-3 pl-6 rounded-xl font-black text-sm outline-none shadow-sm" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input value={newCat} onChange={e=>setNewCat(e.target.value)} className="flex-grow bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100" placeholder="New category..." />
          <button onClick={async () => {
            if(!newCat) return;
            const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
            await updateDoc(docRef, { 
              categories: [...data.categories, newCat], 
              base_allocations: {...data.base_allocations, [newCat]: 0},
              allocations: {...data.allocations, [newCat]: 0}, 
              spent: {...data.spent, [newCat]: 0} 
            });
            setNewCat("");
          }} className="bg-slate-900 text-white p-4 rounded-2xl shrink-0"><PlusCircle /></button>
        </div>
      </div>

      <div className="bg-rose-50 rounded-[2rem] p-8 border border-rose-100 flex flex-col items-center">
        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">Danger Zone</p>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="text-rose-600 font-bold text-sm">Wipe All Data</button>
        ) : (
          <div className="flex gap-4">
            <button onClick={handleFullReset} className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase">Confirm</button>
            <button onClick={() => setConfirmReset(false)} className="bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}