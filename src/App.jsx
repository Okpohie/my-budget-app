import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
  Wallet, Receipt, Settings, Home, Plus, Trash2, CheckCircle2, 
  PlusCircle, TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle, RefreshCcw, 
  Calendar, ChevronRight, Target, BarChart3, Eye, EyeOff, History, 
  PenLine, Search, X, ShoppingCart, Utensils, Car, ShoppingBag, 
  PartyPopper, Heart, CircleDollarSign, MoreHorizontal, Save, Edit2, Filter, Lock,
  ChevronDown, ChevronUp, Sparkles, PieChart, Landmark, PiggyBank, Zap, Brain, ShieldCheck,
  TrendingUp as TrendUp, List, Check, AlertTriangle, Briefcase, Calculator
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// You can keep a static ID or use the auth user ID later
const appId = 'pro-budgeter-pro'; 

// --- GEMINI AI CONFIGURATION ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Helper: Sentence Case
const toSentenceCase = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Icon Mapping
const getCategoryIcon = (catName) => {
  const lower = catName.toLowerCase();
  if (lower.includes('grocer') || lower.includes('food')) return ShoppingCart;
  if (lower.includes('eat') || lower.includes('restaurant')) return Utensils;
  if (lower.includes('transport') || lower.includes('fuel') || lower.includes('car')) return Car;
  if (lower.includes('shop') || lower.includes('cloth')) return ShoppingBag;
  if (lower.includes('leisure') || lower.includes('event') || lower.includes('party')) return PartyPopper;
  if (lower.includes('health') || lower.includes('beauty') || lower.includes('gym')) return Heart;
  if (lower.includes('bill') || lower.includes('rent')) return Receipt;
  if (lower.includes('income') || lower.includes('salary')) return Wallet;
  if (lower.includes('saving') || lower.includes('invest') || lower.includes('fund')) return PiggyBank;
  if (lower.includes('emergency')) return ShieldCheck;
  return CircleDollarSign;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); 
  const [notification, setNotification] = useState(null);

  const today = new Date();
  const monthName = today.toLocaleString('default', { month: 'short' }).toUpperCase();
  const dayNum = today.getDate();

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      body { font-family: 'Plus Jakarta Sans', sans-serif; }
      input, select, textarea { font-size: 16px !important; }
      .glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
      .animate-float { animation: float 3s ease-in-out infinite; }
      .modal-overlay { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
          await signInAnonymously(auth);
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
      const currentYear = new Date().getFullYear();

      if (docSnap.exists()) {
        let existingData = docSnap.data();
        let needsUpdate = false;
        let updatedTransactions = [...(existingData.transactions || [])];

        // Ensure new fields exist
        if (!existingData.custom_goals) { existingData.custom_goals = []; needsUpdate = true; }
        if (existingData.emergency_deposits === undefined) { existingData.emergency_deposits = 0; needsUpdate = true; }

        // 1. ROLLOVER logic
        if (existingData.last_month && existingData.last_month !== currentMonthId) {
          const totalIncome = (existingData.income_sources || []).reduce((a, b) => a + b.amount, 0) || existingData.monthly_income || 0;
          const billsTotal = Object.values(existingData.bills || {}).reduce((a, b) => a + (typeof b === 'object' ? b.amount : b), 0);
          const effectivePrevious = totalIncome + (existingData.income_rollover || 0);
          
          const lastMonthTx = updatedTransactions.filter(t => {
            const d = new Date(t.timestamp);
            return d.getMonth() + 1 === existingData.last_month && t.category !== 'Income'; 
          });
          const totalSpentPrevious = lastMonthTx.reduce((a, b) => a + b.amount, 0);
          const totalUnspentRollover = effectivePrevious - billsTotal - totalSpentPrevious;

          const newAllocations = { ...existingData.allocations };
          Object.keys(existingData.allocations || {}).forEach(cat => {
            const catSpent = lastMonthTx.filter(t => t.category === cat).reduce((a, b) => a + b.amount, 0);
            const carryover = (existingData.allocations[cat] || 0) - catSpent;
            newAllocations[cat] = (existingData.base_allocations?.[cat] || 0) + carryover;
          });

          existingData = {
            ...existingData,
            income_rollover: totalUnspentRollover,
            allocations: newAllocations,
            spent: Object.keys(existingData.spent || {}).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
            last_month: currentMonthId,
          };
          needsUpdate = true;
        }

        // 2. AUTO-LOGGING
        const todayDate = new Date();
        const bills = existingData.bills || {};
        Object.entries(bills).forEach(([name, val]) => {
          const amount = typeof val === 'object' ? val.amount : val;
          const dayDue = typeof val === 'object' ? val.date : 1; 
          
          if (todayDate.getDate() >= dayDue) {
            const alreadyLogged = updatedTransactions.some(t => 
              t.category === 'Bills' && t.description === name && 
              new Date(t.timestamp).getMonth() === todayDate.getMonth() &&
              new Date(t.timestamp).getFullYear() === currentYear
            );

            if (!alreadyLogged) {
              const billDate = new Date(currentYear, currentMonthId - 1, dayDue);
              if (billDate > new Date()) billDate.setTime(new Date().getTime());
              updatedTransactions.unshift({
                id: `bill-${name}-${currentMonthId}-${currentYear}`,
                amount: amount, category: 'Bills', description: name, 
                timestamp: billDate.toISOString(), isSystem: true 
              });
              needsUpdate = true;
            }
          }
        });

        const incomeSources = existingData.income_sources || [];
        incomeSources.forEach(source => {
           const dayDue = source.date || 1; 
           if (todayDate.getDate() >= dayDue) {
              const alreadyLogged = updatedTransactions.some(t => 
                 t.category === 'Income' && t.description === source.name && 
                 new Date(t.timestamp).getMonth() === todayDate.getMonth() &&
                 new Date(t.timestamp).getFullYear() === currentYear
              );
              if (!alreadyLogged) {
                 const incomeDate = new Date(currentYear, currentMonthId - 1, dayDue);
                 if (incomeDate > new Date()) incomeDate.setTime(new Date().getTime());
                 updatedTransactions.unshift({
                    id: `inc-${source.id}-${currentMonthId}-${currentYear}`,
                    amount: source.amount, category: 'Income', description: source.name,
                    timestamp: incomeDate.toISOString(), isSystem: true, type: 'credit'
                 });
                 needsUpdate = true;
              }
           }
        });

        if (needsUpdate) {
          existingData.transactions = updatedTransactions;
          await updateDoc(docRef, existingData);
          setData(existingData);
        } else {
          setData(existingData);
        }
      } else {
        const defaultAllocs = { "Groceries": 350, "Eating Out": 150, "Transportation": 120, "Shopping": 100, "Leisure & Events": 100, "Health & Beauty": 50, "Miscellaneous": 50, "Investments": 200, "Emergency Fund": 100 };
        const janTx = [
          { id: 'inc-jan', amount: 2500, category: 'Income', description: 'Main Salary', timestamp: new Date(currentYear, 0, 1).toISOString(), type: 'credit' },
        ];
        const defaultData = {
          monthly_income: 2500, income_sources: [{ id: 'main', name: 'Main Salary', amount: 2500, date: 1 }], income_rollover: 0,
          bills: { "Rent": { amount: 800, date: 1 }, "Council Tax": { amount: 150, date: 5 } },
          categories: ["Groceries", "Eating Out", "Transportation", "Shopping", "Leisure & Events", "Health & Beauty", "Miscellaneous", "Investments", "Emergency Fund"],
          hidden_categories: [], base_allocations: defaultAllocs, allocations: defaultAllocs,      
          spent: { "Groceries": 0 }, transactions: janTx, last_month: currentMonthId,
          emergency_deposits: 0, custom_goals: []
        };
        setDoc(docRef, defaultData);
        setData(defaultData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const metrics = useMemo(() => {
    if (!data) return { effective: 0, bills: 0, allocatedRemaining: 0, freeCash: 0, totalSpent: 0, savingsSpent: 0, savingsAllocated: 0, totalAllocated: 0, totalIncome: 0, emergencySpent: 0, emergencyAllocated: 0, totalInvestedAllTime: 0, emergencyBalance: 0, realSpent: {}, unallocated: 0 };
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const today = new Date().getDate();

    const currentMonthTx = (data.transactions || []).filter(t => {
       const d = new Date(t.timestamp);
       return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const incomeTxSum = currentMonthTx.filter(t => t.category === 'Income').reduce((a, b) => a + b.amount, 0);

    let projectedIncome = 0;
    (data.income_sources || []).forEach(source => {
        const dayDue = source.date || 1;
        if (dayDue > today) projectedIncome += parseFloat(source.amount);
    });

    const totalIncome = incomeTxSum + projectedIncome;
    const effective = totalIncome + (data.income_rollover || 0);
    const billsTotal = Object.values(data.bills || {}).reduce((a, b) => a + (typeof b === 'object' ? b.amount : b), 0);
    const totalAllocated = Object.values(data.allocations || {}).reduce((a, b) => a + b, 0);
    
    // UPDATED LOGIC: Unallocated now includes Rollover from previous months
    // Formula: (Current Month Income + Rollover) - Bills - Allocations
    const unallocated = effective - billsTotal - totalAllocated;
    
    const realSpent = {};
    let savingsSpent = 0;
    let savingsAllocated = 0;
    let emergencySpent = 0;
    let emergencyAllocated = 0;
    let totalContributions = 0; 

    // Identify Goal Categories for logic checks
    const goalCategories = (data.custom_goals || []).map(g => g.name);

    currentMonthTx.forEach(tx => {
       if (tx.category === 'Income') return; 
       if (tx.category === 'Bills') return;
       
       // Handle Pot Withdrawals (Spending FROM Savings):
       const isGoalWithdrawal = goalCategories.includes(tx.category) && !tx.isContribution;
       const isEmergWithdrawal = tx.category === 'Emergency Fund' && !tx.isContribution;

       if (isGoalWithdrawal || isEmergWithdrawal) {
           return; 
       }

       if (tx.isContribution) {
           totalContributions += tx.amount;
       }

       realSpent[tx.category] = (realSpent[tx.category] || 0) + tx.amount;
    });

    const investKey = data.categories.includes("Investments") ? "Investments" : "Savings & Investments";
    savingsSpent = realSpent[investKey] || 0;
    savingsAllocated = data.allocations[investKey] || 0;

    // Emergency Fund Budget Tracking
    const emergencyContributions = currentMonthTx.filter(t => t.category === 'Emergency Fund' && t.isContribution).reduce((acc, t) => acc + t.amount, 0);
    emergencySpent = emergencyContributions; 
    emergencyAllocated = data.allocations["Emergency Fund"] || 0;

    const totalAllocatedSpent = Object.values(realSpent).reduce((a, b) => a + b, 0);
    
    // Total Actual Spending (Money leaving account = (Used Budget - Internal Transfers) + Bills)
    const totalSpent = (totalAllocatedSpent - totalContributions) + billsTotal;

    let overspendingAdjustment = 0;
    Object.keys(data.allocations || {}).forEach(cat => {
      let spent = realSpent[cat] || 0;
      if (cat === 'Emergency Fund') spent = emergencyContributions;
      const diff = spent - (data.allocations[cat] || 0);
      if (diff > 0) overspendingAdjustment += diff;
    });

    const freeCash = (effective - billsTotal - totalAllocated) - overspendingAdjustment;
    
    // Emergency Balance
    const allEmergencyWithdrawals = (data.transactions || []).filter(t => t.category === 'Emergency Fund' && !t.isContribution).reduce((acc, t) => acc + t.amount, 0);
    const emergencyBalance = (data.emergency_deposits || 0) - allEmergencyWithdrawals;

    const totalInvestedAllTime = (data.transactions || [])
        .filter(t => t.category === 'Investments' || t.category === 'Savings & Investments')
        .reduce((acc, t) => acc + t.amount, 0);

    return { effective, bills: billsTotal, allocatedRemaining: totalAllocated - totalAllocatedSpent, freeCash, totalSpent, savingsSpent, savingsAllocated, totalAllocated, totalAllocatedSpent, emergencySpent, emergencyAllocated, emergencyBalance, totalInvestedAllTime, realSpent, totalIncome, unallocated };
  }, [data]);

  const showNotify = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 3000);
  };

  const deleteTransaction = async (txId) => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    await updateDoc(docRef, { transactions: data.transactions.filter(t => t.id !== txId) });
    showNotify("Transaction removed");
  };

  const updateTransaction = async (newTx) => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const updatedTxList = data.transactions.map(t => t.id === newTx.id ? newTx : t);
    await updateDoc(docRef, { transactions: updatedTxList });
    showNotify("Transaction updated");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-32 max-w-xl mx-auto overflow-x-hidden">
      {/* Header */}
      <header className="px-6 pt-12 pb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Income Pot</h1>
            <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">£{metrics.effective.toLocaleString()}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${metrics.unallocated < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {metrics.unallocated >= 0 ? '+' : ''}£{metrics.unallocated.toLocaleString()} left
                </span>
            </div>
          </div>
          <div className="bg-white px-3 py-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[54px] animate-float">
            <span className="text-[10px] font-black text-blue-600 leading-none">{monthName}</span>
            <span className="text-xl font-black text-slate-800 leading-none mt-1">{dayNum}</span>
          </div>
        </div>

        {/* 2x2 Grid Header */}
        <div className="grid grid-cols-2 gap-3">
          {/* Top Left: Investments */}
          <div className="bg-emerald-600 rounded-[2rem] p-5 shadow-lg shadow-emerald-200 flex flex-col justify-between h-32 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
             <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white mb-2 backdrop-blur-sm"><Briefcase size={20}/></div>
             <div>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Total Invested</p>
                <p className="text-xl font-black text-white leading-none mb-2">£{metrics.totalInvestedAllTime.toLocaleString()}</p>
                <div className="flex items-center gap-1.5">
                    {metrics.totalInvestedAllTime > 0 ? (
                        <>
                            <div className="bg-yellow-400 p-0.5 rounded-full"><Target size={8} className="text-yellow-900"/></div>
                            <span className="text-[9px] font-bold text-white/90">
                                {metrics.totalInvestedAllTime >= 10000 ? '£10k Club 🏆' : metrics.totalInvestedAllTime >= 1000 ? '£1k Club 🌟' : 'Seedling 🌱'}
                            </span>
                        </>
                    ) : (
                        <span className="text-[9px] font-bold text-white/50">Start investing!</span>
                    )}
                </div>
             </div>
          </div>

          {/* Top Right: Fixed Bills */}
          <div className="bg-rose-50 rounded-[2rem] p-5 border border-rose-100 flex flex-col justify-between h-32">
             <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-rose-500 mb-2"><Receipt size={20}/></div>
             <div>
                <p className="text-[10px] font-bold text-rose-500/70 uppercase tracking-wider mb-1">Fixed Bills</p>
                <p className="text-lg font-black text-rose-800 leading-none">£{metrics.bills.toLocaleString()}</p>
             </div>
          </div>

          {/* Bottom Left: Emergency Fund Balance */}
          <div className="bg-amber-50 rounded-[2rem] p-5 border border-amber-100 flex flex-col justify-between h-32">
             <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 mb-2"><ShieldCheck size={20}/></div>
             <div>
                <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mb-1">Emerg. Balance</p>
                <p className="text-lg font-black text-amber-800 leading-none mb-1">£{metrics.emergencyBalance.toLocaleString()}</p>
                <div className="w-full h-1.5 bg-amber-200/50 rounded-full overflow-hidden mb-1">
                   <div className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(0, (metrics.emergencyBalance / (data?.emergency_target || 1)) * 100))}%` }}></div>
                </div>
                <div className="flex justify-between text-[8px] font-bold text-amber-600/60">
                    <span>Goal: £{(data?.emergency_target || 0).toLocaleString()}</span>
                    <span>£{Math.max(0, (data?.emergency_target || 0) - metrics.emergencyBalance).toLocaleString()} Left</span>
                </div>
             </div>
          </div>

          {/* Bottom Right: Remaining Budget */}
          <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex flex-col justify-between h-32">
             <div className="bg-indigo-50 w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 mb-2"><PieChart size={20}/></div>
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remaining</p>
                <p className="text-lg font-black text-slate-900 leading-none mb-2">£{metrics.allocatedRemaining.toLocaleString()}</p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                   <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(0, (metrics.allocatedRemaining / (metrics.totalAllocated || 1)) * 100))}%` }}></div>
                </div>
                <div className="flex justify-between text-[8px] font-bold text-slate-400">
                   <span>£{metrics.allocatedRemaining} left</span>
                   <span>£{metrics.totalAllocatedSpent} spent</span>
                </div>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6">
        {activeTab === 'home' && <HomeView data={data} metrics={metrics} onDeleteTx={deleteTransaction} />}
        {activeTab === 'daily' && <DailyLoggingView data={data} user={user} showNotify={showNotify} db={db} appId={appId} onDeleteTx={deleteTransaction} onUpdateTx={updateTransaction} metrics={metrics} />}
        {activeTab === 'planning' && <PlanningView data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />}
        {activeTab === 'settings' && <SettingsView data={data} user={user} showNotify={showNotify} db={db} appId={appId} />}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm glass border border-white/50 flex justify-around items-center p-2.5 z-50 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
        <NavButton active={activeTab === 'home'} icon={Home} onClick={() => setActiveTab('home')} />
        <NavButton active={activeTab === 'daily'} icon={Plus} isMain onClick={() => setActiveTab('daily')} />
        <NavButton active={activeTab === 'planning'} icon={Receipt} onClick={() => setActiveTab('planning')} />
        <NavButton active={activeTab === 'settings'} icon={Settings} onClick={() => setActiveTab('settings')} />
      </nav>

      {notification && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 ${notification.isError ? 'bg-rose-600' : 'bg-slate-900'} text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 z-[100] w-[85%]`}>
          <span className="font-bold text-sm">{notification.msg}</span>
        </div>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---

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
  const monthName = now.toLocaleString('default', { month: 'short' }).toUpperCase();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const monthProgress = (currentDay / daysInMonth) * 100;

  const displayCats = data?.categories.filter(c => !(data.hidden_categories || []).includes(c)) || [];

  // Calculate distinct allocations
  const expensesAllocated = Math.max(0, metrics.totalAllocated - metrics.savingsAllocated - metrics.emergencyAllocated);
  const unallocated = Math.max(0, metrics.unallocated);

  // Income Breakdown Data
  const incomeBreakdown = [
      { label: 'Fixed Bills', amount: metrics.bills, color: '#f43f5e', tailwind: 'bg-rose-500' },
      { label: 'Daily Expenses', amount: expensesAllocated, color: '#3b82f6', tailwind: 'bg-blue-500' },
      { label: 'Emergency Fund', amount: metrics.emergencyAllocated, color: '#f59e0b', tailwind: 'bg-amber-500' },
      { label: 'Investments', amount: metrics.savingsAllocated, color: '#10b981', tailwind: 'bg-emerald-500' },
      { label: 'Free Cash', amount: unallocated, color: '#cbd5e1', tailwind: 'bg-slate-300' }
  ];

  // Circular Chart Gradient Logic
  const chartGradient = useMemo(() => {
    // UPDATED: Use Effective Income (Total + Rollover) as base
    const total = metrics.effective || 1;
    let currentDeg = 0;
    
    const stops = incomeBreakdown.map((item) => {
        if (item.amount <= 0) return null;
        const start = currentDeg;
        const pct = (item.amount / total) * 100;
        currentDeg += pct;
        return `${item.color} ${start}% ${currentDeg}%`;
    }).filter(Boolean);

    if (stops.length === 0) return 'conic-gradient(#f1f5f9 0% 100%)'; 
    return `conic-gradient(${stops.join(', ')})`;
  }, [incomeBreakdown, metrics.effective]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. ADVANCED MONTHLY FLOW (Circular) */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                 <PieChart size={18} className="text-blue-600"/> Monthly Flow
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
                  {monthName}
              </span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 flex-shrink-0">
                  {/* Chart Ring */}
                  <div className="w-full h-full rounded-full shadow-inner" style={{ background: chartGradient }}></div>
                  
                  {/* Inner Content */}
                  <div className="absolute inset-3 bg-white rounded-full flex flex-col items-center justify-center shadow-lg border border-slate-50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total In</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tight">£{(metrics.effective || 0).toLocaleString()}</p>
                  </div>
              </div>

              {/* Detailed Legend */}
              <div className="flex-grow w-full space-y-3">
                  {incomeBreakdown.map((item) => (
                      <div key={item.label} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${item.tailwind} ring-2 ring-white shadow-sm`}></div>
                              <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{item.label}</span>
                          </div>
                          <div className="text-right">
                              <span className="text-xs font-black text-slate-900">£{item.amount.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 ml-1 font-medium">
                                  {((item.amount / (metrics.effective || 1)) * 100).toFixed(0)}%
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* 2. SAVING GOALS SUMMARY */}
      {(data.custom_goals || []).length > 0 && (
          <div>
              <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Goals</h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                  {data.custom_goals.map(goal => {
                      const current = goal.currentAmount || 0;
                      const target = goal.targetAmount || 1;
                      const pct = Math.min(100, (current / target) * 100);
                      
                      return (
                          <div key={goal.id} className="min-w-[160px] snap-start bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                              <div className="mb-3">
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Target size={16}/></div>
                                      <span className="text-[10px] font-bold text-slate-400">{pct.toFixed(0)}%</span>
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-sm truncate">{goal.name}</h4>
                                  <p className="text-[10px] text-slate-400 font-medium">{goal.targetDate || 'No date'}</p>
                              </div>
                              <div>
                                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                                      <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-600">£{current.toLocaleString()} <span className="text-slate-300">/ £{target.toLocaleString()}</span></p>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* 3. CATEGORY SPENDING (Refined Pacing) */}
      <div>
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Spending</h3>
        </div>
        <div className="space-y-3">
          {displayCats.map(cat => {
            const spent = metrics.realSpent?.[cat] || 0;
            const allocated = data.allocations[cat] || 0;
            const percent = Math.min(100, (spent / (allocated || 1)) * 100);
            const CatIcon = getCategoryIcon(cat);
            
            // Visual Status
            let statusColor = 'bg-blue-500';
            if (percent > 100) statusColor = 'bg-rose-500';
            else if (percent > 85) statusColor = 'bg-amber-500';
            else if (percent < monthProgress && allocated > 0) statusColor = 'bg-emerald-500'; // Under-spending vs time

            return (
              <div key={cat} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 mb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-slate-600 bg-slate-50`}>
                        <CatIcon size={18} />
                    </div>
                    <div className="flex-grow">
                        <div className="flex justify-between items-end mb-1">
                            <h4 className="font-bold text-slate-900 text-sm">{cat}</h4>
                            <span className={`text-xs font-black ${percent > 100 ? 'text-rose-500' : 'text-slate-700'}`}>
                                £{spent.toFixed(0)} <span className="text-slate-300 text-[10px]">/ £{allocated}</span>
                            </span>
                        </div>
                        <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            {/* Pacing Marker (Where you should be roughly) */}
                            {allocated > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300 z-10" style={{ left: `${monthProgress}%` }}></div>}
                            <div className={`h-full ${statusColor} rounded-full transition-all duration-700`} style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DailyLoggingView({ data, user, showNotify, db, appId, onDeleteTx, onUpdateTx, metrics }) {
  const [view, setView] = useState('log'); 

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Toggle Header */}
      <div className="flex p-1 bg-white border border-slate-100 rounded-2xl mb-6 shadow-sm mx-auto max-w-[90%]">
        <button onClick={() => setView('log')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'log' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
          <PenLine size={16} /> Log Expense
        </button>
        <button onClick={() => setView('history')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
          <History size={16} /> History
        </button>
      </div>
      {view === 'log' ? (
        <LogExpenseInterface data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />
      ) : (
        <TransactionHistoryInterface data={data} onDeleteTx={onDeleteTx} onUpdateTx={onUpdateTx} />
      )}
    </div>
  );
}

function LogExpenseInterface({ data, user, showNotify, db, appId, metrics }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const activeCategories = (data.categories || []).filter(c => !(data.hidden_categories || []).includes(c));

  const handleRecord = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || !category) return;

    // Check if category is a custom goal
    const customGoal = (data.custom_goals || []).find(g => g.name === category);

    // Constraint Logic
    if (category === 'Emergency Fund') {
        const currentBalance = metrics.emergencyBalance;
        if (val > currentBalance) {
            showNotify(`Insufficient Emergency Funds (£${currentBalance.toLocaleString()})`, true);
            return;
        }
    } else if (customGoal) {
        // For Saving Goals, limit to the amount in the pot (Withdrawal logic)
        const currentGoalBalance = customGoal.currentAmount || 0;
        if (val > currentGoalBalance) {
            showNotify(`Insufficient funds in ${category} goal (£${currentGoalBalance.toLocaleString()})`, true);
            return;
        }
    } else {
        // Standard Expense Budget Logic
        const allocated = data.allocations[category] || 0;
        const spent = metrics.realSpent?.[category] || 0;
        const remaining = allocated - spent;
        if (val > remaining) {
             showNotify(`Exceeds budget! Only £${remaining.toLocaleString()} left.`, true);
             return;
        }
    }

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const tx = { id: Math.random().toString(36).substr(2, 9), amount: val, category, description: description || category, timestamp: new Date(date).toISOString() };
    
    // Prepare updates
    let updates = { transactions: [tx, ...(data.transactions || [])] };

    // If withdrawing from a custom goal, we must also decrease the goal's balance in custom_goals
    if (customGoal) {
        const updatedGoals = data.custom_goals.map(g => {
            if (g.name === category) {
                return { ...g, currentAmount: Math.max(0, (g.currentAmount || 0) - val) };
            }
            return g;
        });
        updates.custom_goals = updatedGoals;
    }

    await updateDoc(docRef, updates);
    showNotify(`Logged £${val} to ${category}`);
    setAmount(''); setDescription(''); setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Category</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x">
             {activeCategories.map(cat => {
               const Icon = getCategoryIcon(cat);
               const isInvest = cat === 'Investments' || cat === 'Savings & Investments';
               const isEmergency = cat === 'Emergency Fund';
               
               // Check if category is a goal
               const customGoal = (data.custom_goals || []).find(g => g.name === cat);

               let remaining = 0;
               let label = "left";

               if (isEmergency) {
                   remaining = metrics.emergencyBalance;
                   label = "saved";
               } else if (customGoal) {
                   remaining = customGoal.currentAmount || 0;
                   label = "saved";
               } else {
                   const alloc = data.allocations[cat] || 0;
                   const spent = metrics.realSpent?.[cat] || 0;
                   remaining = Math.max(0, alloc - spent);
               }
               
               return (
                 <button key={cat} onClick={() => setCategory(cat)}
                    className={`flex-shrink-0 snap-start px-5 py-4 rounded-2xl flex flex-col items-center gap-2 min-w-[90px] transition-all border
                    ${category === cat ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
                    <Icon size={20} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight max-w-[80px] truncate">
                      {isInvest ? 'Investments' : cat}
                    </span>
                    <span className={`text-[9px] font-bold ${category === cat ? 'text-blue-200' : 'text-slate-400'}`}>
                        £{remaining.toLocaleString()} {label}
                    </span>
                 </button>
               );
             })}
          </div>
        </div>
        <div className="space-y-4 mb-8">
          <div className="relative">
             <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">£</span>
             <input type="number" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} 
               className="w-full bg-slate-50 p-6 pl-12 rounded-3xl text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500 transition-all placeholder:text-slate-200" placeholder="0.00" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <input type="text" value={description} onChange={e=>setDescription(e.target.value)} className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-semibold text-slate-700 outline-none focus:border-blue-500" placeholder="Description (opt)" />
             <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-semibold text-slate-700 outline-none focus:border-blue-500" />
          </div>
        </div>
        <button onClick={handleRecord} disabled={!amount || !category} className="w-full bg-slate-900 disabled:opacity-50 text-white font-bold py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all text-lg flex items-center justify-center gap-2">
          <CheckCircle2 size={20} /> Record Transaction
        </button>
      </div>
    </div>
  );
}

function TransactionHistoryInterface({ data, onDeleteTx, onUpdateTx }) {
  const [viewMode, setViewMode] = useState(new Date().getMonth()); // 0-11 for months, 'YTD', 'ALL'
  const [editingTx, setEditingTx] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const currentYear = new Date().getFullYear();
  const transactions = data.transactions || [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.timestamp);
      let inTimeRange = false;
      if (viewMode === 'ALL') inTimeRange = true;
      else if (viewMode === 'YTD') inTimeRange = d.getFullYear() === currentYear;
      else inTimeRange = d.getMonth() === viewMode && d.getFullYear() === currentYear;

      const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
      let matchesCategory = true;
      if (categoryFilter !== 'All') {
          if (categoryFilter === 'Recurring Bills') matchesCategory = t.category === 'Bills';
          else matchesCategory = t.category === categoryFilter;
      }
      return inTimeRange && matchesSearch && matchesCategory;
    }).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions, viewMode, search, categoryFilter]);

  const chartData = useMemo(() => {
    const isMonthlyView = typeof viewMode === 'number';
    const timeFilteredTx = transactions.filter(t => {
       const d = new Date(t.timestamp);
       if (viewMode === 'ALL') return true;
       if (viewMode === 'YTD') return d.getFullYear() === currentYear;
       return d.getMonth() === viewMode && d.getFullYear() === currentYear;
    });

    // Exclude internal transfers (goal deposits/emergency deposits) from the line chart
    const spendTx = timeFilteredTx.filter(t => t.category !== 'Income' && !t.isContribution); 
    const incomeTx = timeFilteredTx.filter(t => t.category === 'Income');

    let visibleSpend = [], visibleIncome = [], totalXPoints = 0, projection = [], isCurrentTimeframe = false, todayIndex = 0;

    if (isMonthlyView) {
        const daysInMonth = new Date(currentYear, viewMode + 1, 0).getDate();
        totalXPoints = daysInMonth;
        isCurrentTimeframe = viewMode === new Date().getMonth();
        const today = new Date().getDate();
        todayIndex = today;

        const s = new Array(daysInMonth + 1).fill(0);
        const i = new Array(daysInMonth + 1).fill(0);
        
        spendTx.forEach(t => s[new Date(t.timestamp).getDate()] += t.amount);
        incomeTx.forEach(t => i[new Date(t.timestamp).getDate()] += t.amount);
        
        let runS = 0, runI = 0;
        for(let d=1; d<=daysInMonth; d++) {
             runS += s[d]; runI += i[d];
             if (isCurrentTimeframe && d > today) break;
             visibleSpend.push(runS);
             visibleIncome.push(runI);
        }
        if (isCurrentTimeframe) {
            let cur = visibleSpend[visibleSpend.length-1] || 0;
            projection = new Array(daysInMonth).fill(null);
            projection[today-1] = cur;
            for(let d=today+1; d<=daysInMonth; d++) {
                 let dailyBill = 0;
                 Object.entries(data.bills||{}).forEach(([_, v]) => {
                     const amt = typeof v === 'object' ? v.amount : v;
                     const day = typeof v === 'object' ? v.date : 1;
                     if(day === d) dailyBill += amt;
                 });
                 cur += dailyBill;
                 projection[d-1] = cur;
            }
        }
    } else {
        const getMKey = (d) => `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
        let keys = [];
        if (viewMode === 'YTD') {
            for(let m=0; m<12; m++) keys.push(`${currentYear}-${String(m).padStart(2,'0')}`);
        } else {
            if (transactions.length > 0) {
                 const sorted = [...transactions].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
                 let start = new Date(sorted[0].timestamp); start.setDate(1); 
                 const end = new Date(); let cur = new Date(start);
                 while(cur <= end) { keys.push(getMKey(cur)); cur.setMonth(cur.getMonth() + 1); }
                 if (keys.length === 0) keys.push(getMKey(new Date()));
            } else { keys.push(getMKey(new Date())); }
        }
        totalXPoints = keys.length;
        const sMap = {}; const iMap = {}; keys.forEach(k => { sMap[k] = 0; iMap[k] = 0; });
        spendTx.forEach(t => { const k = getMKey(new Date(t.timestamp)); if(sMap[k] !== undefined) sMap[k] += t.amount; });
        incomeTx.forEach(t => { const k = getMKey(new Date(t.timestamp)); if(iMap[k] !== undefined) iMap[k] += t.amount; });
        
        let runS = 0, runI = 0, spendPoints = [], incomePoints = [];
        keys.forEach(k => { runS += sMap[k]; runI += iMap[k]; spendPoints.push(runS); incomePoints.push(runI); });

        if (viewMode === 'YTD') {
             const mIdx = new Date().getMonth();
             visibleSpend = spendPoints.slice(0, mIdx + 1); visibleIncome = incomePoints.slice(0, mIdx + 1); todayIndex = mIdx + 1;
        } else { visibleSpend = spendPoints; visibleIncome = incomePoints; todayIndex = keys.length; }
    }

    const currentTotalSpend = visibleSpend[visibleSpend.length - 1] || 0;
    const currentTotalIncome = visibleIncome[visibleIncome.length - 1] || 0;
    const net = currentTotalIncome - currentTotalSpend;

    return { visibleSpend, visibleIncome, spendProjections: projection, currentTotalSpend, currentTotalIncome, net, totalXPoints, isMonthlyView, isCurrentTimeframe, todayIndex };
  }, [transactions, viewMode, data.bills]);

  const generateScaledPath = (dataPoints, totalX, color, isDotted = false, maxVal) => {
     if (!dataPoints || dataPoints.length === 0) return null;
     const points = dataPoints.map((val, idx) => {
         if (val === null || val === undefined) return null;
         const x = totalX <= 1 ? 50 : (idx / (totalX - 1)) * 100;
         const y = maxVal === 0 ? 50 : 50 - ((val / maxVal) * 50);
         return `${x},${y}`;
     }).filter(p => p !== null).join(' ');
     return <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={isDotted ? "4 4" : ""} vectorEffect="non-scaling-stroke"/>;
  };

  const chartMax = Math.max(...chartData.visibleSpend, ...chartData.visibleIncome, 100) * 1.2;
  const spendY = chartMax === 0 ? 50 : 50 - ((chartData.currentTotalSpend / chartMax) * 50);
  const incomeY = chartMax === 0 ? 50 : 50 - ((chartData.currentTotalIncome / chartMax) * 50);

  return (
    <div className="space-y-6">
      {editingTx && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900">Edit Transaction</h3>
                <button onClick={() => setEditingTx(null)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button>
             </div>
             <div className="space-y-4 mb-6">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                   <input type="date" value={new Date(editingTx.timestamp).toISOString().split('T')[0]}
                     onChange={e => setEditingTx({...editingTx, timestamp: new Date(e.target.value).toISOString()})}
                     className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm border border-slate-100 outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</label>
                   <input type="number" value={editingTx.amount} 
                     onChange={e => setEditingTx({...editingTx, amount: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                     className="w-full bg-slate-50 p-3 rounded-xl font-bold text-lg border border-slate-100 outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                   <input type="text" value={editingTx.description} 
                     onChange={e => setEditingTx({...editingTx, description: e.target.value})}
                     className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm border border-slate-100 outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                   <select value={editingTx.category} 
                     onChange={e => setEditingTx({...editingTx, category: e.target.value})}
                     className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm border border-slate-100 outline-none">
                     {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                     <option value="Bills">Bills (System)</option>
                     <option value="Income">Income</option>
                   </select>
                </div>
             </div>
             <div className="flex gap-3">
                {/* Delete/Save Buttons */}
                <button onClick={() => { onDeleteTx(editingTx.id); setEditingTx(null); }} className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Trash2 size={16}/> Delete</button>
                <button onClick={() => { onUpdateTx({...editingTx, amount: Number(editingTx.amount) || 0}); setEditingTx(null); }} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200"><Save size={16}/> Save</button>
             </div>
          </div>
        </div>
      )}
      
      {/* Month/Time Selector */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide px-2">
        <button onClick={() => setViewMode('ALL')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${viewMode === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>All Time</button>
        <button onClick={() => setViewMode('YTD')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${viewMode === 'YTD' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>YTD</button>
        <div className="w-px h-6 bg-slate-200 mx-1 self-center"></div>
        {monthNames.map((m, idx) => {
           if (idx > new Date().getMonth() && currentYear === new Date().getFullYear()) return null;
           return (
             <button key={m} onClick={() => setViewMode(idx)}
               className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${viewMode === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>
               {m}
             </button>
           )
        })}
      </div>

      {/* CHART CARD */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
         <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                 {viewMode === 'ALL' ? 'Lifetime Net' : viewMode === 'YTD' ? 'YTD Net Flow' : 'Monthly Net'}
               </p>
               <h3 className={`text-2xl font-extrabold leading-tight ${chartData.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {chartData.net >= 0 ? '+' : ''}£{chartData.net.toLocaleString()}
               </h3>
               <div className="flex gap-4 mt-2">
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> In: £{chartData.currentTotalIncome.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Out: £{chartData.currentTotalSpend.toLocaleString()}</span>
               </div>
            </div>
         </div>
         <div className="h-32 w-full relative mb-4">
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
               {[0, 25, 50, 75, 100].map(p => <line key={p} x1="0" y1={50 - p/2} x2="100" y2={50 - p/2} stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2 2" />)}
               {generateScaledPath(chartData.visibleIncome, chartData.totalXPoints, "#10b981", false, chartMax)}
               {generateScaledPath(chartData.visibleSpend, chartData.totalXPoints, "#2563eb", false, chartMax)}
               {chartData.isMonthlyView && generateScaledPath(chartData.spendProjections, chartData.totalXPoints, "#2563eb", true, chartMax)}
               {(chartData.isCurrentTimeframe || !chartData.isMonthlyView) && chartData.visibleSpend.length > 0 && (
                 <>
                   <circle cx={(chartData.totalXPoints <= 1 ? 50 : ( (chartData.todayIndex - 1) / (chartData.totalXPoints - 1) ) * 100)} cy={spendY} r="2" fill="#2563eb" stroke="white" strokeWidth="1" />
                   <circle cx={(chartData.totalXPoints <= 1 ? 50 : ( (chartData.todayIndex - 1) / (chartData.totalXPoints - 1) ) * 100)} cy={incomeY} r="2" fill="#10b981" stroke="white" strokeWidth="1" />
                 </>
               )}
            </svg>
            <div className="flex justify-between text-[9px] font-bold text-slate-300 mt-2 uppercase tracking-wider">
               <span>{chartData.isMonthlyView ? 'Day 1' : (viewMode === 'ALL' ? 'Start' : 'Jan')}</span>
               <span>{chartData.isMonthlyView ? 'End' : (viewMode === 'ALL' ? 'End' : 'Dec')}</span>
            </div>
         </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-2">
           <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="w-full bg-white pl-8 pr-3 py-2 rounded-xl text-xs font-bold border border-slate-100 outline-none" />
           </div>
           <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl text-xs font-bold border border-slate-100 outline-none text-slate-600">
              <option value="All">All</option>
              <option value="Recurring Bills">Recurring</option>
              <option value="Income">Income</option>
              {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
        </div>
        
        <div className="flex justify-between items-center px-6 py-2 bg-slate-50/50 border-b border-slate-50">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</span>
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount</span>
        </div>

        <div className="divide-y divide-slate-50">
          {filteredTx.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs font-medium">No transactions.</div> : filteredTx.map(tx => {
              const Icon = getCategoryIcon(tx.category);
              const isEditable = !tx.isSystem && !tx.isContribution; // Prevent editing of goal deposits
              const isIncome = tx.category === 'Income';
              return (
                <div key={tx.id} onClick={() => isEditable && setEditingTx(tx)}
                  className={`p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group ${isEditable ? 'cursor-pointer active:scale-[0.98]' : 'opacity-80'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Icon size={18} /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{toSentenceCase(tx.description) || tx.category}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {tx.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-right min-w-[60px] ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>{isIncome ? '+' : '-'}£{tx.amount.toFixed(2)}</span>
                    {isEditable && <Edit2 size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"/>}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function PlanningView({ data, user, showNotify, db, appId, metrics }) {
  const [planView, setPlanView] = useState('savings'); 
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex p-1 bg-white border border-slate-100 rounded-2xl mb-6 shadow-sm mx-auto max-w-[95%]">
        <button onClick={() => setPlanView('savings')} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${planView === 'savings' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><PiggyBank size={14} /> Savings</button>
        <button onClick={() => setPlanView('recurring')} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${planView === 'recurring' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><RefreshCcw size={14} /> Recurring</button>
        <button onClick={() => setPlanView('budget')} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${planView === 'budget' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><Brain size={14} /> Budget</button>
      </div>
      {planView === 'recurring' && <RecurringView data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />}
      {planView === 'budget' && <BudgetSetupView data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />}
      {planView === 'savings' && <SavingsView data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />}
    </div>
  );
}

function SavingsView({ data, user, showNotify, db, appId, metrics }) {
  const [activeTab, setActiveTab] = useState('investments');

  return (
    <div className="space-y-6">
       <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('investments')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'investments' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>Investments</button>
          <button onClick={() => setActiveTab('emergency')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'emergency' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>Emergency Fund</button>
          <button onClick={() => setActiveTab('goals')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors ${activeTab === 'goals' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>Goals</button>
       </div>

       {activeTab === 'investments' && <InvestmentsSection data={data} />}
       {activeTab === 'emergency' && <EmergencyFundSection data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />}
       {activeTab === 'goals' && <SavingGoalsSection data={data} user={user} showNotify={showNotify} db={db} appId={appId} metrics={metrics} />}
    </div>
  );
}

function InvestmentsSection({ data }) {
  const [chartView, setChartView] = useState('ALL'); 
  
  const investTx = (data.transactions || []).filter(t => t.category === 'Investments' || t.category === 'Savings & Investments');
  const totalInvested = investTx.reduce((acc, t) => acc + t.amount, 0);

  // Breakdown by Description
  const breakdown = useMemo(() => {
     const map = {};
     investTx.forEach(t => {
        const desc = t.description || 'Unspecified';
        map[desc] = (map[desc] || 0) + t.amount;
     });
     return Object.entries(map).sort((a,b) => b[1] - a[1]);
  }, [investTx]);

  // Colorful Pie Chart Logic
  const pieGradient = useMemo(() => {
    let currentDeg = 0;
    if (totalInvested === 0) return 'conic-gradient(#f1f5f9 0% 100%)';
    
    // Colorful Palette
    const palette = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#84cc16'];

    return 'conic-gradient(' + breakdown.map((item, i) => {
        const start = currentDeg;
        const pct = (item[1] / totalInvested) * 100;
        currentDeg += pct;
        const color = palette[i % palette.length];
        return `${color} ${start}% ${currentDeg}%`;
    }).join(', ') + ')';
  }, [breakdown, totalInvested]);

  // Line Chart Logic
  const chartPoints = useMemo(() => {
     const tx = [...investTx].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
     if(tx.length === 0) return [];
     
     const currentYear = new Date().getFullYear();
     const filtered = chartView === 'YTD' ? tx.filter(t => new Date(t.timestamp).getFullYear() === currentYear) : tx;
     if(filtered.length === 0) return [];

     let running = 0;
     const points = filtered.map((t, idx) => {
        running += t.amount;
        return { val: running, idx, date: new Date(t.timestamp) };
     });
     
     // Add a start point if needed
     if (points.length === 1 && chartView === 'ALL') {
         points.unshift({ val: 0, idx: -1, date: new Date(points[0].date.getTime() - 86400000) });
     }
     return points;
  }, [investTx, chartView]);

  const maxVal = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].val * 1.1 : 100;

  const generatePath = (isFill = false) => {
     if(chartPoints.length === 0) return null;
     const total = chartPoints.length;
     
     const coords = chartPoints.map((pt, i) => {
         const x = total <= 1 ? 50 : (i / (total - 1)) * 100;
         const y = 50 - ((pt.val / maxVal) * 50);
         return `${x},${y}`;
     });

     if (isFill) {
         return `${coords.join(' ')} 100,50 0,50`;
     }
     return coords.join(' ');
  };

  return (
    <div className="space-y-6">
       {/* Improved Line Chart */}
       <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Portfolio Growth</p>
                  <h2 className="text-3xl font-black text-slate-900">£{totalInvested.toLocaleString()}</h2>
              </div>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={()=>setChartView('ALL')} className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${chartView==='ALL'?'bg-white shadow-sm text-emerald-600':'text-slate-400'}`}>All</button>
                <button onClick={()=>setChartView('YTD')} className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${chartView==='YTD'?'bg-white shadow-sm text-emerald-600':'text-slate-400'}`}>YTD</button>
              </div>
          </div>
          
          <div className="h-40 w-full relative">
             <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                 <defs>
                     <linearGradient id="investGradient" x1="0" x2="0" y1="0" y2="1">
                         <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                         <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                     </linearGradient>
                 </defs>
                 {[0, 25, 50].map(y => (
                     <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2 2" />
                 ))}
                 <polygon points={generatePath(true)} fill="url(#investGradient)" />
                 <polyline points={generatePath(false)} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                 {chartPoints.length > 0 && (
                     <circle cx={(chartPoints.length <= 1 ? 50 : 100)} cy={50 - ((chartPoints[chartPoints.length-1].val / maxVal) * 50)} r="3" fill="#059669" stroke="white" strokeWidth="2" />
                 )}
             </svg>
          </div>
       </div>

       {/* Colorful Pie Chart & Breakdown */}
       <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
          <div className="relative w-40 h-40 flex-shrink-0">
               <div className="w-full h-full rounded-full border-4 border-slate-50" style={{ background: pieGradient }}></div>
               <div className="absolute inset-0 m-8 bg-white rounded-full flex items-center justify-center flex-col shadow-sm">
                   <span className="text-[10px] text-slate-400 font-bold uppercase">Assets</span>
                   <span className="text-sm font-black text-slate-900">{breakdown.length}</span>
               </div>
          </div>

          <div className="flex-grow w-full space-y-3">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Allocation</h3>
             {breakdown.length === 0 ? <p className="text-xs text-slate-400 italic">No investments yet.</p> : breakdown.map(([name, amt], i) => {
                 const palette = ['bg-emerald-600', 'bg-blue-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-cyan-600', 'bg-pink-600', 'bg-lime-600'];
                 const colorClass = palette[i % palette.length];
                 const pct = ((amt/totalInvested)*100).toFixed(1);
                 return (
                    <div key={name} className="flex items-center justify-between group">
                       <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
                           <span className="text-xs font-bold text-slate-700">{toSentenceCase(name)}</span>
                       </div>
                       <div className="text-right">
                           <span className="text-xs font-black text-slate-900 block">£{amt.toLocaleString()}</span>
                           <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
                       </div>
                    </div>
                 )
             })}
          </div>
       </div>
    </div>
  )
}

function EmergencyFundSection({ data, user, showNotify, db, appId, metrics }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTarget, setEditTarget] = useState(data.emergency_target || 0);
    const [editDate, setEditDate] = useState(data.emergency_deadline || '');
    
    const [depositAmt, setDepositAmt] = useState('');
    const [aiSuggestion, setAiSuggestion] = useState(null); 
    const [aiLoading, setAiLoading] = useState(false);

    const goal = data.emergency_target || 0;
    const balance = metrics.emergencyBalance || 0;
    const remainingToGoal = Math.max(0, goal - balance);
    const progress = goal > 0 ? Math.min(100, (balance / goal) * 100) : 0;
    const isFullyFunded = balance >= goal && goal > 0;
    
    // Live Calculation Helper
    const calculateMonthlyNeed = (targetAmt, targetDate) => {
        if (!targetDate || !targetAmt) return 0;
        const end = new Date(targetDate);
        const now = new Date();
        const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
        const left = Math.max(0, targetAmt - balance);
        if (months <= 0) return left;
        return left / months;
    };

    const monthlyNeeded = useMemo(() => calculateMonthlyNeed(goal, data.emergency_deadline), [goal, data.emergency_deadline, balance]);
    const editMonthlyNeeded = useMemo(() => calculateMonthlyNeed(editTarget, editDate), [editTarget, editDate, balance]);

    const handleSaveEdit = async () => {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        await updateDoc(docRef, { emergency_target: parseFloat(editTarget), emergency_deadline: editDate });
        setIsEditing(false);
        showNotify("Emergency Plan Updated");
    };

    const handleDeposit = async () => {
        if(!depositAmt) return;
        const val = parseFloat(depositAmt);
        
        // Prevent deposit if fully funded
        if (isFullyFunded) {
            showNotify("Emergency Goal Reached!", true);
            return;
        }

        // Budget Constraint: Can't deposit more than remaining monthly allocation
        const allocated = metrics.emergencyAllocated || 0;
        const spent = metrics.emergencySpent || 0;
        const remainingBudget = Math.max(0, allocated - spent);

        if (val > remainingBudget) {
            showNotify(`Exceeds Monthly Budget! Only £${remainingBudget.toFixed(0)} left.`, true);
            return;
        }

        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        const tx = { 
            id: Math.random().toString(36).substr(2, 9), 
            amount: val, 
            category: 'Emergency Fund', 
            description: 'Manual Deposit', 
            timestamp: new Date().toISOString(),
            isContribution: true 
        };
        await updateDoc(docRef, { 
            emergency_deposits: (data.emergency_deposits || 0) + val,
            transactions: [tx, ...(data.transactions || [])]
        });
        showNotify(`Deposited £${val}`);
        setDepositAmt('');
    };

    const fillMax = () => {
        const allocated = metrics.emergencyAllocated || 0;
        const spent = metrics.emergencySpent || 0;
        const remaining = Math.max(0, allocated - spent);
        setDepositAmt(remaining.toString());
    };

    // --- AI LOGIC ---
    const runAiAnalysis = async () => {
        setAiLoading(true);
        const disposableIncome = (metrics.totalIncome || 0) - (metrics.bills || 0);
        
        const prompt = `
          Analyze emergency fund.
          Disposable Income: £${disposableIncome} (Total Income £${metrics.totalIncome} - Fixed Bills £${metrics.bills}).
          Note: User needs money for daily living from this disposable amount.
          
          Task:
          1. Suggest Target Amount (3-6 months coverage).
          2. Suggest Monthly Contribution (affordable amount from disposable, leaving room for daily expenses).
          3. Calculate Target Date based on that contribution.
          
          Return JSON ONLY: { "suggestedAmount": number, "deadline": "YYYY-MM-DD", "monthly": number, "reasoning": "string" }
        `;
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const result = await response.json();
            let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const start = text.indexOf('{'); const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) text = text.substring(start, end + 1);
            setAiSuggestion(JSON.parse(text));
        } catch(e) { console.error(e); showNotify("AI Analysis Failed", true); }
        setAiLoading(false);
    };

    // AI Editing Logic
    const updateAiField = (field, val) => {
        if (!aiSuggestion) return;
        const newSuggestion = { ...aiSuggestion, [field]: val };
        
        if (field === 'suggestedAmount') {
            newSuggestion.monthly = calculateMonthlyNeed(val, newSuggestion.deadline);
        } else if (field === 'deadline') {
            newSuggestion.monthly = calculateMonthlyNeed(newSuggestion.suggestedAmount, val);
        } else if (field === 'monthly') {
            const left = Math.max(0, newSuggestion.suggestedAmount - balance);
            const monthsNeeded = val > 0 ? Math.ceil(left / val) : 0;
            const d = new Date();
            d.setMonth(d.getMonth() + monthsNeeded);
            newSuggestion.deadline = d.toISOString().split('T')[0];
        }
        setAiSuggestion(newSuggestion);
    };

    const acceptAiSuggestion = async () => {
        if(!aiSuggestion) return;
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        await updateDoc(docRef, { emergency_target: parseFloat(aiSuggestion.suggestedAmount), emergency_deadline: aiSuggestion.deadline });
        setAiSuggestion(null);
        showNotify("AI Plan Accepted");
    };

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 rounded-[2.5rem] p-8 border border-amber-100 relative overflow-hidden group">
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-white text-amber-500 rounded-2xl shadow-sm"><ShieldCheck size={24}/></div>
                    <button onClick={()=>setIsEditing(!isEditing)} className="text-amber-400 hover:text-amber-600 bg-white p-2 rounded-xl transition-colors"><Edit2 size={16}/></button>
                 </div>
                 
                 {!isEditing ? (
                     <div className="mb-6">
                         <p className="text-xs font-bold text-amber-700/60 uppercase tracking-widest mb-1">Current Balance</p>
                         <h2 className="text-4xl font-black text-amber-900">£{balance.toLocaleString()}</h2>
                         
                         <div className="grid grid-cols-2 gap-3 mt-6">
                             <div className="bg-white/60 p-3 rounded-2xl">
                                 <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">Target</p>
                                 <p className="text-sm font-black text-amber-900">£{goal.toLocaleString()}</p>
                                 <p className="text-[9px] font-medium text-amber-700/60">{data.emergency_deadline || 'No date set'}</p>
                             </div>
                             <div className="bg-white/60 p-3 rounded-2xl">
                                 <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">Monthly Need</p>
                                 <p className="text-sm font-black text-amber-900">£{monthlyNeeded.toFixed(0)}</p>
                                 <p className="text-[9px] font-medium text-amber-700/60">to meet deadline</p>
                             </div>
                         </div>
                     </div>
                 ) : (
                     <div className="mb-6 space-y-3 bg-white/50 p-4 rounded-2xl">
                         <div>
                             <label className="text-[10px] font-bold text-amber-700 uppercase">Target Amount</label>
                             <input type="number" value={editTarget} onChange={e=>setEditTarget(e.target.value)} className="w-full bg-white p-2 rounded-lg font-bold text-amber-900 outline-none border border-amber-200"/>
                         </div>
                         <div>
                             <label className="text-[10px] font-bold text-amber-700 uppercase">Target Date</label>
                             <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} className="w-full bg-white p-2 rounded-lg font-bold text-amber-900 outline-none border border-amber-200"/>
                         </div>
                         <div className="text-[10px] font-bold text-amber-600 pt-1 flex items-center gap-1">
                             <Calculator size={12}/> Needs £{editMonthlyNeeded.toFixed(0)}/mo savings
                         </div>
                         <button onClick={handleSaveEdit} className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold text-xs">Save Changes</button>
                     </div>
                 )}

                 <div className="relative">
                    <div className="flex justify-between text-[10px] font-bold text-amber-800/60 mb-1.5 uppercase tracking-wide">
                        <span>{progress.toFixed(0)}% Ready</span>
                        <span>£{remainingToGoal.toLocaleString()} to go</span>
                    </div>
                    <div className="w-full h-4 bg-amber-200/50 rounded-full overflow-hidden relative">
                        <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                 </div>
            </div>

            <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3 ${isFullyFunded ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                 <div className="flex justify-between items-center px-1">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Allowance</span>
                     <span className="text-xs font-bold text-slate-700">£{Math.max(0, (metrics.emergencyAllocated || 0) - (metrics.emergencySpent || 0))} remaining</span>
                 </div>
                 <div className="flex gap-2">
                     <input type="number" placeholder={isFullyFunded ? "Goal Reached!" : "Amount"} value={depositAmt} onChange={e=>setDepositAmt(e.target.value)} disabled={isFullyFunded}
                        className="flex-grow bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 outline-none"/>
                     <button onClick={fillMax} className="bg-slate-100 text-slate-600 px-4 rounded-2xl font-bold text-[10px] uppercase tracking-wider hover:bg-slate-200 transition-colors">Max</button>
                 </div>
                 <button onClick={handleDeposit} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform">
                    {isFullyFunded ? "Goal Achieved" : "Deposit to Pot"}
                 </button>
            </div>

            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex gap-3 items-start">
                <AlertTriangle className="text-rose-500 flex-shrink-0" size={18}/>
                <p className="text-xs text-rose-700 leading-relaxed font-medium">
                    <b>Withdrawals:</b> To spend from this pot, go to "Log Expense" and select "Emergency Fund". Your balance is capped at £{balance.toLocaleString()}.
                </p>
            </div>

            {!aiSuggestion ? (
                <button onClick={runAiAnalysis} disabled={aiLoading} className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-2">
                    {aiLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div> : <Brain size={16}/>}
                    Suggest Goal with AI
                </button>
            ) : (
                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex gap-2 items-center mb-3">
                        <Sparkles className="text-indigo-500" size={18}/>
                        <h4 className="font-bold text-indigo-900 text-sm">AI Suggestion</h4>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                        <div className="bg-white/50 p-3 rounded-xl border border-indigo-100">
                            <label className="text-[9px] font-bold text-indigo-400 uppercase block mb-1">Target Amount</label>
                            <input type="number" value={aiSuggestion.suggestedAmount} onChange={(e) => updateAiField('suggestedAmount', e.target.value)} 
                                className="w-full bg-transparent font-black text-indigo-900 outline-none border-b border-indigo-200 focus:border-indigo-500 text-sm" />
                        </div>
                        <div className="bg-white/50 p-3 rounded-xl border border-indigo-100">
                            <label className="text-[9px] font-bold text-indigo-400 uppercase block mb-1">Target Date</label>
                            <input type="date" value={aiSuggestion.deadline} onChange={(e) => updateAiField('deadline', e.target.value)} 
                                className="w-full bg-transparent font-black text-indigo-900 outline-none border-b border-indigo-200 focus:border-indigo-500 text-sm" />
                        </div>
                        <div className="bg-white/50 p-3 rounded-xl border border-indigo-100">
                            <label className="text-[9px] font-bold text-indigo-400 uppercase block mb-1">Monthly Contribution</label>
                            <input type="number" value={Math.round(aiSuggestion.monthly)} onChange={(e) => updateAiField('monthly', e.target.value)} 
                                className="w-full bg-transparent font-black text-indigo-900 outline-none border-b border-indigo-200 focus:border-indigo-500 text-sm" />
                        </div>
                        <p className="text-xs text-indigo-700/80 italic leading-relaxed px-1">"{aiSuggestion.reasoning}"</p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={acceptAiSuggestion} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs">Accept Plan</button>
                        <button onClick={()=>setAiSuggestion(null)} className="flex-1 bg-white text-indigo-600 py-3 rounded-xl font-bold text-xs">Decline</button>
                    </div>
                </div>
            )}
        </div>
    )
}

function SavingGoalsSection({ data, user, showNotify, db, appId, metrics }) {
    const [isCreating, setIsCreating] = useState(false);
    const [newGoal, setNewGoal] = useState({ name: '', target: '', date: '' });
    
    // For handling edits on existing goals
    const [editGoalId, setEditGoalId] = useState(null);
    const [editState, setEditState] = useState({ target: '', date: '' });
    const [depositState, setDepositState] = useState({});

    const createGoal = async () => {
        if(!newGoal.name || !newGoal.target) return;
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        
        const goalObj = {
            id: Math.random().toString(36).substr(2, 9),
            name: newGoal.name,
            targetAmount: parseFloat(newGoal.target),
            targetDate: newGoal.date,
            currentAmount: 0 // Initialize persistent balance
        };
        
        // Add goal to custom_goals AND add as a Category with 0 allocation
        const newCats = [...(data.categories || []), newGoal.name];
        const newAlloc = { ...data.allocations, [newGoal.name]: 0 };
        const newBase = { ...data.base_allocations, [newGoal.name]: 0 };

        await updateDoc(docRef, { 
            custom_goals: [...(data.custom_goals || []), goalObj],
            categories: newCats,
            allocations: newAlloc,
            base_allocations: newBase
        });
        
        setIsCreating(false); 
        setNewGoal({ name: '', target: '', date: '' });
        showNotify("Goal Created & Added to Budget");
    };

    const deleteGoal = async (id, name) => {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        // Remove from custom_goals AND categories
        const newGoals = (data.custom_goals || []).filter(g => g.id !== id);
        const newCats = (data.categories || []).filter(c => c !== name);
        
        await updateDoc(docRef, { custom_goals: newGoals, categories: newCats });
        showNotify("Goal Deleted");
    };

    const handleUpdateGoal = async (id) => {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        const updatedGoals = data.custom_goals.map(g => {
            if (g.id === id) {
                return { ...g, targetAmount: parseFloat(editState.target), targetDate: editState.date };
            }
            return g;
        });
        await updateDoc(docRef, { custom_goals: updatedGoals });
        setEditGoalId(null);
        showNotify("Goal Updated");
    };

    const handleDeposit = async (goalName, id) => {
        const val = parseFloat(depositState[id]);
        if (!val) return;

        // BUDGET CONSTRAINT CHECK
        const allocated = data.allocations[goalName] || 0;
        const spent = metrics.realSpent?.[goalName] || 0;
        const remainingBudget = Math.max(0, allocated - spent);

        if (val > remainingBudget) {
            showNotify(`Exceeds Monthly Allocation! Only £${remainingBudget.toFixed(0)} left in budget.`, true);
            return;
        }

        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
        
        // 1. Log transaction with isContribution: true (counts for budget pacing, excluded from total spend)
        const tx = { 
            id: Math.random().toString(36).substr(2, 9), 
            amount: val, 
            category: goalName, 
            description: 'Goal Deposit', 
            timestamp: new Date().toISOString(),
            isContribution: true
        };

        // 2. Update persistent goal balance
        const updatedGoals = data.custom_goals.map(g => {
            if (g.id === id) {
                return { ...g, currentAmount: (g.currentAmount || 0) + val };
            }
            return g;
        });

        await updateDoc(docRef, { 
            transactions: [tx, ...(data.transactions || [])],
            custom_goals: updatedGoals
        });
        
        setDepositState({ ...depositState, [id]: '' });
        showNotify(`Deposited £${val} to ${goalName}`);
    };

    return (
        <div className="space-y-6">
            {!isCreating ? (
                <button onClick={()=>setIsCreating(true)} className="w-full py-4 bg-slate-900 text-white rounded-[2rem] font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                    <PlusCircle size={20}/> Create New Goal
                </button>
            ) : (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl animate-in zoom-in-95">
                    <h3 className="font-black text-slate-900 mb-4">New Saving Goal</h3>
                    <div className="space-y-3 mb-4">
                        <input placeholder="Goal Name (e.g. New Laptop)" value={newGoal.name} onChange={e=>setNewGoal({...newGoal, name: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm outline-none"/>
                        <input type="number" placeholder="Target Amount" value={newGoal.target} onChange={e=>setNewGoal({...newGoal, target: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm outline-none"/>
                        <input type="date" value={newGoal.date} onChange={e=>setNewGoal({...newGoal, date: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm outline-none text-slate-500"/>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={createGoal} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-xs">Create</button>
                        <button onClick={()=>setIsCreating(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs">Cancel</button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {(data.custom_goals || []).map(g => {
                    const currentAmount = g.currentAmount || 0;
                    const progress = Math.min(100, (currentAmount / g.targetAmount) * 100);
                    const remaining = Math.max(0, g.targetAmount - currentAmount);
                    const isDone = progress >= 100;
                    const isEditingThis = editGoalId === g.id;

                    // Calculate monthly need for this specific goal
                    let monthlyNeed = 0;
                    if (g.targetDate) {
                        const end = new Date(g.targetDate);
                        const now = new Date();
                        const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
                        if (months > 0) monthlyNeed = remaining / months;
                        else monthlyNeed = remaining; // Due now/past due
                    }

                    // Budget Logic for Max Button
                    const allocated = data.allocations[g.name] || 0;
                    const spent = metrics.realSpent?.[g.name] || 0;
                    const remainingBudget = Math.max(0, allocated - spent);

                    return (
                        <div key={g.id} className="bg-blue-50 rounded-[2.5rem] p-8 border border-blue-100 relative overflow-hidden group">
                             {/* Header / Toolbar */}
                             <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-white text-blue-500 rounded-2xl shadow-sm"><Target size={24}/></div>
                                <div className="flex gap-2">
                                    <button onClick={()=>{
                                        if(isEditingThis) setIsEditing(null);
                                        else { setEditGoalId(g.id); setEditState({ target: g.targetAmount, date: g.targetDate }); }
                                    }} className="text-blue-400 hover:text-blue-600 bg-white p-2 rounded-xl transition-colors"><Edit2 size={16}/></button>
                                    <button onClick={()=>deleteGoal(g.id, g.name)} className="text-rose-400 hover:text-rose-600 bg-white p-2 rounded-xl transition-colors"><Trash2 size={16}/></button>
                                </div>
                             </div>

                             {isEditingThis ? (
                                <div className="mb-6 space-y-3 bg-white/50 p-4 rounded-2xl">
                                     <div>
                                         <label className="text-[10px] font-bold text-blue-700 uppercase">Target Amount</label>
                                         <input type="number" value={editState.target} onChange={e=>setEditState({...editState, target: e.target.value})} className="w-full bg-white p-2 rounded-lg font-bold text-blue-900 outline-none border border-blue-200"/>
                                     </div>
                                     <div>
                                         <label className="text-[10px] font-bold text-blue-700 uppercase">Target Date</label>
                                         <input type="date" value={editState.date} onChange={e=>setEditState({...editState, date: e.target.value})} className="w-full bg-white p-2 rounded-lg font-bold text-blue-900 outline-none border border-blue-200"/>
                                     </div>
                                     <button onClick={()=>handleUpdateGoal(g.id)} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-xs">Save Changes</button>
                                </div>
                             ) : (
                                <div className="mb-6">
                                     <div className="flex justify-between items-baseline mb-1">
                                        <h4 className="text-lg font-black text-blue-900">{g.name}</h4>
                                        {isDone && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">Done</span>}
                                     </div>
                                     <h2 className="text-4xl font-black text-blue-900">£{currentAmount.toLocaleString()}</h2>
                                     
                                     <div className="grid grid-cols-2 gap-3 mt-6">
                                         <div className="bg-white/60 p-3 rounded-2xl">
                                             <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">Target</p>
                                             <p className="text-sm font-black text-blue-900">£{g.targetAmount.toLocaleString()}</p>
                                             <p className="text-[9px] font-medium text-blue-700/60">{g.targetDate || 'No date'}</p>
                                         </div>
                                         <div className="bg-white/60 p-3 rounded-2xl">
                                             <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">Monthly Need</p>
                                             <p className="text-sm font-black text-blue-900">{monthlyNeed > 0 ? `£${monthlyNeed.toFixed(0)}` : '-'}</p>
                                             <p className="text-[9px] font-medium text-blue-700/60">to meet deadline</p>
                                         </div>
                                     </div>
                                </div>
                             )}

                             {/* Progress Bar */}
                             <div className="relative mb-6">
                                <div className="flex justify-between text-[10px] font-bold text-blue-800/60 mb-1.5 uppercase tracking-wide">
                                    <span>{progress.toFixed(0)}%</span>
                                    <span>£{remaining.toLocaleString()} left</span>
                                </div>
                                <div className="w-full h-4 bg-blue-200/50 rounded-full overflow-hidden relative">
                                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                </div>
                             </div>

                             {/* Deposit Interface */}
                             {!isDone && (
                                <div className="bg-white p-4 rounded-2xl border border-blue-100 flex flex-col gap-2">
                                    <div className="flex justify-between px-1">
                                        <span className="text-[10px] font-bold text-blue-300 uppercase">Budget</span>
                                        <span className="text-[10px] font-black text-blue-600">£{remainingBudget.toFixed(0)} avail</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="Add funds..." value={depositState[g.id] || ''} 
                                            onChange={e=>setDepositState({...depositState, [g.id]: e.target.value})}
                                            className="flex-grow bg-slate-50 px-3 py-2 rounded-xl text-sm font-bold border border-slate-100 outline-none"/>
                                        <button onClick={()=>setDepositState({...depositState, [g.id]: remainingBudget.toString()})} className="bg-slate-100 text-slate-500 px-3 rounded-xl font-bold text-[10px] uppercase">Max</button>
                                        <button onClick={()=>handleDeposit(g.name, g.id)} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider">Add</button>
                                    </div>
                                </div>
                             )}
                        </div>
                    )
                })}
                {(data.custom_goals || []).length === 0 && !isCreating && (
                    <div className="text-center p-8 text-slate-400 text-sm font-medium">No active goals. Create one to start saving!</div>
                )}
            </div>
        </div>
    )
}

function RecurringView({ data, user, showNotify, db, appId, metrics }) {
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [day, setDay] = useState(1);
  const [type, setType] = useState('bill');
  const [incomeFrequency, setIncomeFrequency] = useState('recurring');
  const [editingItem, setEditingItem] = useState(null);

  // Unallocated must respect stricter logic: Effective Income - Bills - Allocations
  // We use `metrics.unallocated` which already calculates this correctly including rollover
  const unallocated = metrics.unallocated;

  const add = async () => {
    if (!name || !amt) return;
    const val = parseFloat(amt);
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    
    if (type === 'bill') {
       // STRICT RULE: Can't add bill if it exceeds unallocated amount
       // We use metrics.unallocated which reflects real-time available cash
       if (val > unallocated + 0.01) {
           showNotify(`Cannot add bill. Only £${unallocated.toFixed(2)} available.`, true);
           return;
       }

       await updateDoc(docRef, { bills: { ...(data.bills || {}), [name]: { amount: val, date: parseInt(day) } } });
       showNotify("Added Recurring Bill");
    } else {
       if (incomeFrequency === 'recurring') {
           const newIncome = [...(data.income_sources || []), { id: Math.random().toString(36).substr(2, 5), name, amount: val, date: parseInt(day) }];
           await updateDoc(docRef, { income_sources: newIncome });
           showNotify("Added Recurring Income");
       } else {
           const tx = { id: Math.random().toString(36).substr(2, 9), amount: val, category: 'Income', description: name, timestamp: new Date().toISOString(), isSystem: false, type: 'credit' };
           await updateDoc(docRef, { transactions: [tx, ...(data.transactions || [])] });
           showNotify("One-Time Income Logged");
       }
    }
    setName(''); setAmt('');
  };

  const updateItem = async () => {
    // ... existing updateItem logic ...
    // BUT we add the strict check here too
    if (!editingItem) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    if (editingItem.type === 'income') {
         // ... existing income update logic ...
         const newIncome = data.income_sources.map(s => s.id === editingItem.id ? editingItem : s);
         // ...
         // (Simulated for brevity as only bill logic requested)
         const newTransactions = data.transactions.map(tx => {
            if (tx.isSystem && tx.description === editingItem.originalName && tx.category === 'Income') {
                // ...
                 return { ...tx, description: editingItem.name, amount: parseFloat(editingItem.amount) };
            }
            return tx;
        });
        await updateDoc(docRef, { income_sources: newIncome, transactions: newTransactions });

    } else {
        // STRICT RULE FOR EDITING BILLS
        const newVal = parseFloat(editingItem.amount);
        const oldVal = data.bills[editingItem.originalName]?.amount || 0;
        const diff = newVal - oldVal;

        if (diff > unallocated + 0.01) {
            showNotify(`Cannot increase bill. Only £${unallocated.toFixed(2)} available.`, true);
            return;
        }

        const newBills = { ...data.bills };
        if (editingItem.originalName !== editingItem.name) delete newBills[editingItem.originalName];
        newBills[editingItem.name] = { amount: newVal, date: parseInt(editingItem.date) };
        
        const newTransactions = data.transactions.map(tx => {
            if (tx.isSystem && tx.description === editingItem.originalName && tx.category === 'Bills') {
                 // Update ongoing transactions for this month if they exist
                 const d = new Date(tx.timestamp);
                 if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                    return { ...tx, description: editingItem.name, amount: newVal };
                 }
            }
            return tx;
        });
        await updateDoc(docRef, { bills: newBills, transactions: newTransactions });
    }
    setEditingItem(null);
    showNotify("Item Updated");
  };

  const deleteItem = async () => {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      if (editingItem.type === 'income') {
          const newIncome = data.income_sources.filter(s => s.id !== editingItem.id);
          const newTransactions = data.transactions.filter(tx => {
             if (tx.isSystem && tx.description === editingItem.name && tx.category === 'Income') {
                 const d = new Date(tx.timestamp);
                 return !(d.getMonth() === currentMonth && d.getFullYear() === currentYear);
             }
             return true;
          });
          await updateDoc(docRef, { income_sources: newIncome, transactions: newTransactions });
      } else {
          const newBills = { ...data.bills };
          delete newBills[editingItem.name];
          const newTransactions = data.transactions.filter(tx => {
             if (tx.isSystem && tx.description === editingItem.name && tx.category === 'Bills') {
                 const d = new Date(tx.timestamp);
                 return !(d.getMonth() === currentMonth && d.getFullYear() === currentYear);
             }
             return true;
          });
          await updateDoc(docRef, { bills: newBills, transactions: newTransactions });
      }
      setEditingItem(null);
      showNotify("Item Deleted");
  };

  return (
    <div className="space-y-6">
      {/* RESTORED RECURRING EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-slate-900">Edit {editingItem.type === 'income' ? 'Income' : 'Bill'}</h3>
                 <button onClick={() => setEditingItem(null)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button>
              </div>
              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</label>
                    <input type="text" value={editingItem.name} onChange={e=>setEditingItem({...editingItem, name: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm border border-slate-100 outline-none"/>
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</label>
                    <input type="number" value={editingItem.amount} onChange={e=>setEditingItem({...editingItem, amount: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-lg border border-slate-100 outline-none"/>
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Day (1-31)</label>
                    <select value={editingItem.date} onChange={e=>setEditingItem({...editingItem, date: parseInt(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-bold text-sm border border-slate-100 outline-none">
                       {[...Array(31)].map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                    </select>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={deleteItem} className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Trash2 size={16}/> Delete</button>
                 <button onClick={updateItem} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg"><Save size={16}/> Update</button>
              </div>
           </div>
        </div>
      )}

      {/* Add New Section */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex gap-2 mb-6 bg-slate-50 p-1 rounded-xl">
           <button onClick={()=>setType('bill')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'bill' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Bill</button>
           <button onClick={()=>setType('income')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Income</button>
        </div>
        {type === 'income' && (
            <div className="flex gap-4 mb-4 px-2">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" className="hidden" checked={incomeFrequency === 'recurring'} onChange={() => setIncomeFrequency('recurring')} /><span className={`text-xs font-bold ${incomeFrequency === 'recurring' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" className="hidden" checked={incomeFrequency === 'one-off'} onChange={() => setIncomeFrequency('one-off')} /><span className={`text-xs font-bold ${incomeFrequency === 'one-off' ? 'text-slate-900' : 'text-slate-400'}`}>One-Time</span></label>
            </div>
        )}
        <div className="space-y-3 mb-6">
           <div className="flex gap-2">
             <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} className="flex-grow bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 outline-none text-sm" />
             {incomeFrequency === 'recurring' && <select value={day} onChange={e=>setDay(e.target.value)} className="bg-slate-50 p-4 rounded-2xl font-bold border border-slate-100 outline-none text-sm w-20 text-center">{[...Array(31)].map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}</select>}
           </div>
           <input type="number" placeholder="0.00" value={amt} onChange={e=>setAmt(e.target.value)} className="w-full bg-slate-50 p-4 pl-10 rounded-2xl font-black border border-slate-100 outline-none" />
        </div>
        {type === 'bill' && (
             <div className="text-[10px] text-slate-400 font-bold mb-4 flex justify-between px-2">
                <span>Available to allocate:</span>
                <span className={unallocated < 0 ? 'text-rose-500' : 'text-emerald-500'}>£{Math.max(0, unallocated).toLocaleString()}</span>
             </div>
        )}
        <button onClick={add} className={`w-full text-white font-bold py-4 rounded-2xl text-xs uppercase tracking-widest ${type === 'income' ? 'bg-emerald-600' : 'bg-slate-900'}`}>
           {type === 'income' ? (incomeFrequency === 'recurring' ? 'Add Recurring Income' : 'Log One-Time Income') : 'Add Recurring Bill'}
        </button>
      </div>
      
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Recurring Income</h4>
            <div className="space-y-2">{(data.income_sources || []).map(inc => <div key={inc.id} onClick={() => setEditingItem({...inc, originalName: inc.name, type: 'income'})} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 cursor-pointer hover:border-emerald-200"><div><p className="text-sm font-bold text-slate-900">{inc.name}</p></div><div className="flex items-center gap-3"><span className="font-black text-emerald-600">+£{inc.amount}</span><Edit2 size={14} className="text-slate-300"/></div></div>)}</div>
         </div>
         <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Recurring Bills</h4>
            <div className="space-y-2">{Object.entries(data.bills || {}).map(([k, v]) => <div key={k} onClick={() => setEditingItem({name: k, originalName: k, amount: v.amount, date: v.date, type: 'bill'})} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 cursor-pointer hover:border-blue-200"><div><p className="text-sm font-bold text-slate-900">{k}</p></div><div className="flex items-center gap-3"><span className="font-black text-slate-900">£{v.amount}</span><Edit2 size={14} className="text-slate-300"/></div></div>)}</div>
         </div>
      </div>
    </div>
  );
}

function BudgetSetupView({ data, user, showNotify, db, appId, metrics }) {
  const [newCatName, setNewCatName] = useState('');
  const [isCatExpanded, setIsCatExpanded] = useState(false);
  const [showSmartBudget, setShowSmartBudget] = useState(false);
  const [aiProposal, setAiProposal] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const activeCategories = (data.categories || []).filter(c => !(data.hidden_categories || []).includes(c));
  const hiddenCategories = data.hidden_categories || [];

  // Default categories that cannot be deleted
  const DEFAULT_CATEGORIES = ["Groceries", "Eating Out", "Transportation", "Shopping", "Leisure & Events", "Health & Beauty", "Miscellaneous", "Investments", "Emergency Fund"];

  // Calculate total allocated
  const totalBaseAllocated = Object.values(data.base_allocations || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const disposableIncome = (metrics.totalIncome || 0) - (metrics.bills || 0);
  const remainingToAllocate = disposableIncome - totalBaseAllocated;

  const saveAllocation = async (cat, val) => {
    const amount = parseFloat(val) || 0;
    const currentAllocation = data.base_allocations?.[cat] || 0;
    
    // Strict Budget Rule Check
    const proposedTotal = (totalBaseAllocated - currentAllocation) + amount;
    if (proposedTotal > disposableIncome + 0.01) { // 0.01 float tolerance
        showNotify(`Exceeds Total Income! Max allocatable: £${(disposableIncome - (totalBaseAllocated - currentAllocation)).toFixed(0)}`, true);
        return;
    }

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const rollover = (data.allocations?.[cat] || 0) - currentAllocation;
    await updateDoc(docRef, { 
      base_allocations: { ...data.base_allocations, [cat]: amount },
      allocations: { ...data.allocations, [cat]: amount + rollover } 
    });
    showNotify("Saved");
  };

  const checkRequirements = () => {
    if (metrics.totalIncome <= 0 || metrics.bills <= 0) {
        setShowWarning(true);
    } else {
        generateBudgetWithGemini();
    }
  };

  const generateBudgetWithGemini = async () => {
    setShowWarning(false);
    setAiLoading(true);
    // Only send active (visible) categories to AI
    const prompt = `
      Act as a financial advisor. I need a budget.
      My Total Income: £${metrics.totalIncome}
      My Fixed Bills: ${JSON.stringify(data.bills)} (Total: £${metrics.bills})
      My Categories: ${JSON.stringify(activeCategories)}

      RULES:
      1. Calculate Disposable Income = Total Income - Fixed Bills.
      2. Apply 50/30/20 rule to Disposable Income:
         - Needs (50%): Essential daily living (Groceries, Transport, Health) + Emergency Fund.
         - Wants (30%): Eating Out, Shopping, Leisure.
         - Savings (20%): Strictly for "Savings & Investments".
      3. If Disposable is negative, warn me.

      RETURN ONLY A JSON OBJECT with this structure (no markdown):
      {
        "allocations": { "Category Name": number },
        "advice": "Short string explanation",
        "health_score": number
      }
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const result = await response.json();
      let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
          text = text.substring(start, end + 1);
      } else {
          throw new Error("Invalid JSON response");
      }
      
      const proposal = JSON.parse(text);
      setAiProposal(proposal);
      setShowSmartBudget(true);
    } catch (e) {
      console.error(e);
      showNotify("AI Generation Failed", true);
    }
    setAiLoading(false);
  };

  const handleProposalChange = (cat, val) => {
     setAiProposal({
       ...aiProposal,
       allocations: { ...aiProposal.allocations, [cat]: parseFloat(val) || 0 }
     });
  };

  const applyProposal = async () => {
    if (!aiProposal) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    
    // Ensure all proposed categories exist
    const newCats = [...data.categories];
    Object.keys(aiProposal.allocations).forEach(c => {
       if (!newCats.includes(c)) newCats.push(c);
    });

    const newAllocations = { ...data.allocations, ...aiProposal.allocations };
    const newBase = { ...data.base_allocations, ...aiProposal.allocations };
    
    await updateDoc(docRef, { categories: newCats, allocations: newAllocations, base_allocations: newBase });
    setAiProposal(null);
    setShowSmartBudget(false);
    showNotify("Budget Applied!");
  };

  // Category Management
  const toggleCategoryVisibility = async (catName) => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    let newHidden = [...hiddenCategories];
    if (newHidden.includes(catName)) {
      newHidden = newHidden.filter(c => c !== catName);
    } else {
      newHidden.push(catName);
    }
    await updateDoc(docRef, { hidden_categories: newHidden });
    showNotify(newHidden.includes(catName) ? "Category Hidden" : "Category Restored");
  };

  const deleteCategory = async (catName) => {
     // Prevent deleting default categories
     if (DEFAULT_CATEGORIES.includes(catName)) {
        showNotify("Cannot delete default category", true);
        return;
     }

     const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
     const newCats = data.categories.filter(c => c !== catName);
     await updateDoc(docRef, { categories: newCats });
     showNotify("Category Deleted");
  };

  const addNewCategory = async () => {
    if (!newCatName) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    await updateDoc(docRef, { 
        categories: [...(data.categories || []), newCatName],
        base_allocations: {...data.base_allocations, [newCatName]: 0},
        allocations: {...data.allocations, [newCatName]: 0}, 
    });
    setNewCatName('');
    showNotify("Category Added");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* PRE-WARNING MODAL */}
      {showWarning && (
         <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
               <h3 className="text-lg font-black text-slate-900 mb-2">Missing Financial Data</h3>
               <p className="text-sm text-slate-500 mb-6">
                  You haven't added sufficient Income or Recurring Bills yet. The AI suggestion might be inaccurate.
               </p>
               <div className="flex gap-2">
                  <button onClick={generateBudgetWithGemini} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm">Go Ahead</button>
                  <button onClick={() => setShowWarning(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancel</button>
               </div>
            </div>
         </div>
      )}

      {/* SMART BUDGET GENERATOR */}
      <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <Sparkles size={20} className="text-yellow-300" />
               <h3 className="font-black text-lg">Smart Budget AI</h3>
            </div>
            {!showSmartBudget ? (
               <>
                <p className="text-sm opacity-90 mb-6 leading-relaxed">
                   Based on your income of <b>£{metrics.totalIncome}</b> and fixed bills of <b>£{metrics.bills}</b>, we can auto-generate a 50/30/20 plan for you.
                </p>
                <button onClick={checkRequirements} disabled={aiLoading} className="w-full bg-white text-blue-600 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2">
                   {aiLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div> : <Sparkles size={16}/>}
                   {aiLoading ? 'Analyzing Finances...' : 'Generate Proposal'}
                </button>
               </>
            ) : (
               <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                     <p className="text-xs italic opacity-90 leading-relaxed">"{aiProposal.advice}"</p>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                     {Object.entries(aiProposal.allocations).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center text-xs bg-white/5 p-2 rounded-lg">
                           <span>{k}</span>
                           <input type="number" value={v} onChange={(e) => handleProposalChange(k, e.target.value)} className="w-16 bg-white/20 text-white font-bold p-1 rounded text-right outline-none" />
                        </div>
                     ))}
                  </div>
                  <div className="flex gap-2">
                     <button onClick={applyProposal} className="flex-1 bg-white text-blue-600 py-3 rounded-xl font-bold text-sm shadow-lg">Accept Plan</button>
                     <button onClick={() => setShowSmartBudget(false)} className="flex-1 bg-blue-700 text-white py-3 rounded-xl font-bold text-sm">Cancel</button>
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* ALLOCATIONS */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Budget Allocations</label>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${remainingToAllocate < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {remainingToAllocate >= 0 ? `£${remainingToAllocate} Left` : `Over by £${Math.abs(remainingToAllocate)}`}
            </span>
        </div>
        
        <div className="space-y-4">
          {activeCategories.map(cat => (
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
      </div>

      {/* RESTORED MANAGE CATEGORIES (Collapsed) */}
      <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
         <button onClick={() => setIsCatExpanded(!isCatExpanded)} className="w-full flex justify-between items-center">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Manage Categories</span>
            {isCatExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
         </button>
         
         {isCatExpanded && (
            <div className="mt-6 pt-6 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
               <div className="flex gap-2 mb-4">
                  <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="New Category Name" 
                    className="flex-grow bg-white px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 outline-none" />
                  <button onClick={addNewCategory} className="bg-slate-900 text-white w-12 rounded-xl flex items-center justify-center"><Plus size={20}/></button>
               </div>

               <div className="space-y-2 mb-6">
                  {activeCategories.map(cat => (
                    <div key={cat} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                       <span className="text-sm font-bold text-slate-700 pl-2">{cat}</span>
                       <div className="flex gap-2">
                          <button onClick={() => toggleCategoryVisibility(cat)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Eye size={16}/></button>
                          {!DEFAULT_CATEGORIES.includes(cat) && (
                              <button onClick={() => deleteCategory(cat)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-50 rounded-lg"><Trash2 size={16}/></button>
                          )}
                       </div>
                    </div>
                  ))}
               </div>

               {hiddenCategories.length > 0 && (
                 <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-2">Hidden</p>
                    {hiddenCategories.map(cat => (
                      <div key={cat} className="flex items-center justify-between p-3 bg-slate-100 border border-dashed border-slate-200 rounded-xl opacity-75">
                         <span className="text-sm font-bold text-slate-500 pl-2">{cat}</span>
                         <button onClick={() => toggleCategoryVisibility(cat)} className="p-2 text-slate-400 hover:text-blue-600 bg-white rounded-lg"><EyeOff size={16}/></button>
                      </div>
                    ))}
                 </div>
               )}
            </div>
         )}
      </div>
    </div>
  );
}

function SettingsView({ data, user, showNotify, db, appId }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const handleFullReset = async () => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budgetData');
    const z = {}; data.categories.forEach(c => { z[c] = 0; });
    await updateDoc(docRef, { monthly_income: 0, income_sources: [], income_rollover: 0, base_allocations: z, allocations: z, spent: z, transactions: [], bills: {} });
    setConfirmReset(false); showNotify("All Data Wiped", true);
  };
  return (
    <div className="space-y-6 pt-6">
       <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xl font-extrabold text-slate-900">Settings</h3>
          <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between"><span className="text-sm font-bold text-slate-700">App Version</span><span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full">v2.1 AI</span></div>
       </div>
       <div className="bg-rose-50 rounded-[2rem] p-8 border border-rose-100 flex flex-col items-center">
        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">Danger Zone</p>
        {!confirmReset ? <button onClick={() => setConfirmReset(true)} className="text-rose-600 font-bold text-sm">Wipe All Data</button> : <div className="flex gap-4"><button onClick={handleFullReset} className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase">Confirm</button><button onClick={() => setConfirmReset(false)} className="bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase">Cancel</button></div>}
      </div>
    </div>
  );
}