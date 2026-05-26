"use client";
import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Lock, LogOut, Ban, Users, Activity, CheckCircle } from "lucide-react";

// Exact same secure config as your main page
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

type UserData = {
  email: string;
  name: string;
  lastLogin: string;
  elapsedSeconds: number;
  isBanned?: boolean;
  isLoggedOut?: boolean;
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);

  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);

    const unsubscribe = onSnapshot(collection(db, "users"), (querySnapshot) => {
      const fetchedUsers: UserData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUsers.push({
          email: doc.id,
          name: data.name || "Unknown",
          lastLogin: data.lastLogin || "",
          elapsedSeconds: data.elapsedSeconds || 0,
          isBanned: data.isBanned || false,
          isLoggedOut: data.isLoggedOut || false,
        });
      });
      fetchedUsers.sort((a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime());
      setUsers(fetchedUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const ticker = setInterval(() => {
      setUsers((prevUsers) => 
        prevUsers.map((user) => ({
          ...user,
          elapsedSeconds: (user.isBanned || user.isLoggedOut) ? user.elapsedSeconds : user.elapsedSeconds + 1
        }))
      );
    }, 1000);
    return () => clearInterval(ticker);
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect Password.");
      setPasswordInput("");
    }
  };

  // AUTOMATED EMAIL + FORCE LOGOUT
  const forceLogoutUser = async (email: string) => {
    if (confirm(`Are you sure you want to log out ${email}? An automated email will be sent to them.`)) {
      await updateDoc(doc(db, "users", email), { forceLogout: true });
      fetch('/api/admin-action', { method: 'POST', body: JSON.stringify({ email, action: 'logout' }) });
    }
  };

  // AUTOMATED EMAIL + REVERSIBLE BAN WITH DATA WIPE
  const toggleBanUser = async (user: UserData) => {
    if (user.isBanned) {
      // UNBAN
      if (confirm(`Restore access for ${user.email}? Their previous data will remain wiped.`)) {
        await updateDoc(doc(db, "users", user.email), { isBanned: false, forceLogout: false });
      }
    } else {
      // BAN
      if (confirm(`⚠️ WARNING: Permanently BAN ${user.email}? This wipes their chats and sends them a notification email.`)) {
        await updateDoc(doc(db, "users", user.email), { 
          isBanned: true, 
          chats: [], // Wipes their history forever
          globalContext: "", // Wipes global memory
          forceLogout: true 
        });
        fetch('/api/admin-action', { method: 'POST', body: JSON.stringify({ email: user.email, action: 'ban' }) });
      }
    }
  };

  const formatElapsedTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}:${month}:${year}, ${hours}:${minutes}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-2xl shadow-2xl max-w-sm w-full flex flex-col items-center">
          <Lock size={48} className="text-blue-600 mb-6" />
          <h1 className="text-2xl font-bold mb-6 text-gray-800 tracking-tight">Admin Override</h1>
          <input 
            type="password" 
            placeholder="Master Password" 
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full p-4 rounded-xl border border-gray-300 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest"
          />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors">
            ACCESS SYSTEM
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-gray-800 font-sans p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">AURA Admin Control</h1>
              <p className="text-sm text-gray-500 font-medium">System Override & Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg font-medium shadow-sm">
            <Activity size={18} className="animate-pulse" />
            <span>Live Data Active</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#4472c4] text-white">
                <th className="p-4 font-semibold text-sm border-r border-white/20 w-16 text-center">SL No</th>
                <th className="p-4 font-semibold text-sm border-r border-white/20">NAME</th>
                <th className="p-4 font-semibold text-sm border-r border-white/20 min-w-[250px]">E-MAIL</th>
                <th className="p-4 font-semibold text-sm border-r border-white/20 w-32">Elapsed Time</th>
                <th className="p-4 font-semibold text-sm border-r border-white/20 w-40">LOGGED ON</th>
                <th className="p-4 font-semibold text-sm border-r border-white/20 w-40">ACTIVE STATUS</th>
                <th className="p-4 font-semibold text-sm border-r border-white/20 text-center w-28">Action 1</th>
                <th className="p-4 font-semibold text-sm text-center w-28">Action 2</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Connecting to live database...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No users found.</td></tr>
              ) : (
                users.map((user, index) => {
                  const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-[#e9eef5]';
                  return (
                    <tr key={user.email} className={`${rowBg} hover:bg-[#d6e0f0] transition-colors`}>
                      <td className="p-4 text-sm font-medium border-r border-gray-300 text-center">{index + 1}.</td>
                      <td className="p-4 text-sm font-bold border-r border-gray-300">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{user.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm border-r border-gray-300 text-gray-700 break-all">{user.email}</td>
                      <td className={`p-4 text-sm font-mono border-r border-gray-300 font-semibold ${user.isLoggedOut || user.isBanned ? 'text-gray-500' : 'text-blue-700'}`}>
                        {formatElapsedTime(user.elapsedSeconds)}
                      </td>
                      <td className="p-4 text-sm border-r border-gray-300 text-gray-700">
                        {formatDateTime(user.lastLogin)}
                      </td>
                      <td className="p-4 text-sm border-r border-gray-300 font-medium">
                        {user.isBanned ? (
                          <div className="flex items-center gap-2 text-red-600 font-bold">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>Banned
                          </div>
                        ) : user.isLoggedOut ? (
                          <div className="flex items-center gap-2 text-gray-500 font-bold">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>Offline
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600 font-bold">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>Active
                          </div>
                        )}
                      </td>
                      <td className="p-4 border-r border-gray-300 text-center">
                        <button 
                          onClick={() => forceLogoutUser(user.email)}
                          disabled={user.isBanned || user.isLoggedOut}
                          className="flex items-center justify-center gap-1 w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold py-2 rounded border border-yellow-300 disabled:opacity-50 transition-colors text-xs"
                        >
                          <LogOut size={14} /> Log Out
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        {user.isBanned ? (
                          <button 
                            onClick={() => toggleBanUser(user)}
                            className="flex items-center justify-center gap-1 w-full bg-green-100 hover:bg-green-200 text-green-700 font-bold py-2 rounded border border-green-300 transition-colors text-xs"
                          >
                            <CheckCircle size={14} /> UNBAN
                          </button>
                        ) : (
                          <button 
                            onClick={() => toggleBanUser(user)}
                            className="flex items-center justify-center gap-1 w-full bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 rounded border border-red-300 transition-colors text-xs"
                          >
                            <Ban size={14} /> BAN
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}