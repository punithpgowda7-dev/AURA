"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Lock, LogOut, Ban, Users, Activity, CheckCircle, Sparkles, Shield } from "lucide-react";

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

  const forceLogoutUser = async (email: string) => {
    if (confirm(`Are you sure you want to log out ${email}? An automated email will be sent to them.`)) {
      await updateDoc(doc(db, "users", email), { forceLogout: true });
      fetch('/api/admin-action', { method: 'POST', body: JSON.stringify({ email, action: 'logout' }) });
    }
  };

  const toggleBanUser = async (user: UserData) => {
    if (user.isBanned) {
      if (confirm(`Restore access for ${user.email}? Their previous data will remain wiped.`)) {
        await updateDoc(doc(db, "users", user.email), { isBanned: false, forceLogout: false });
      }
    } else {
      if (confirm(`⚠️ WARNING: Permanently BAN ${user.email}? This wipes their chats and sends them a notification email.`)) {
        await updateDoc(doc(db, "users", user.email), {
          isBanned: true,
          chats: [],
          globalContext: "",
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
      <div className="h-screen flex items-center justify-center aura-bg-dark font-sans relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl animate-mesh-shift" />
          <div className="absolute bottom-1/3 right-1/3 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl animate-mesh-shift" style={{ animationDelay: "3s" }} />
        </div>
        <motion.form
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onSubmit={handleLogin}
          className="glass-card-dark p-10 rounded-3xl shadow-2xl max-w-sm w-full flex flex-col items-center mx-4 relative z-10"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          >
            <Shield size={52} className="text-purple-400 mb-6 drop-shadow-[0_0_16px_rgba(168,85,247,0.5)]" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2 text-[#f0f0f5] tracking-tight">Admin Override</h1>
          <p className="text-sm opacity-40 mb-8 uppercase tracking-[0.15em]">AURA Control Panel</p>
          <input
            type="password"
            placeholder="Master Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full p-4 rounded-2xl input-dark text-white text-center tracking-[0.3em] font-mono mb-4"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full btn-primary text-white font-bold py-4 rounded-2xl tracking-widest uppercase"
          >
            Access System
          </motion.button>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen aura-bg-dark text-[#f0f0f5] font-sans p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-600 to-cyan-500">
              <Users className="text-white" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text-subtle">AURA Admin Control</h1>
                <Sparkles size={16} className="text-[#a8c7fa] animate-pulse-glow" />
              </div>
              <p className="text-sm opacity-40 font-medium mt-0.5">System Override & Monitoring</p>
            </div>
          </div>
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 px-4 py-2 rounded-xl font-medium text-sm"
          >
            <Activity size={16} />
            <span>Live Data Active</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card-dark rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 w-16 text-center">SL No</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60">Name</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 min-w-[220px]">E-Mail</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 w-32">Elapsed Time</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 w-40">Logged On</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 w-36">Status</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 text-center w-28">Action 1</th>
                  <th className="p-4 font-semibold text-xs uppercase tracking-wider opacity-60 text-center w-28">Action 2</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr><td colSpan={8} className="p-12 text-center opacity-40">Connecting to live database...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="p-12 text-center opacity-40">No users found.</td></tr>
                ) : (
                  users.map((user, index) => (
                    <motion.tr
                      key={user.email}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                    >
                      <td className="p-4 text-sm font-medium text-center opacity-60">{index + 1}.</td>
                      <td className="p-4 text-sm font-semibold">{user.name}</td>
                      <td className="p-4 text-sm opacity-70 break-all font-mono text-xs">{user.email}</td>
                      <td className={`p-4 text-sm font-mono font-semibold ${user.isLoggedOut || user.isBanned ? "opacity-40" : "text-cyan-400"}`}>
                        {formatElapsedTime(user.elapsedSeconds)}
                      </td>
                      <td className="p-4 text-sm opacity-60">{formatDateTime(user.lastLogin)}</td>
                      <td className="p-4 text-sm font-medium">
                        {user.isBanned ? (
                          <div className="flex items-center gap-2 text-red-400 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-red-500" />Banned
                          </div>
                        ) : user.isLoggedOut ? (
                          <div className="flex items-center gap-2 opacity-50 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-gray-500" />Offline
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-400 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />Active
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => forceLogoutUser(user.email)}
                          disabled={user.isBanned || user.isLoggedOut}
                          className="flex items-center justify-center gap-1 w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-semibold py-2 rounded-xl border border-yellow-500/25 disabled:opacity-30 transition-all duration-200 text-xs"
                        >
                          <LogOut size={13} /> Log Out
                        </motion.button>
                      </td>
                      <td className="p-4 text-center">
                        {user.isBanned ? (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => toggleBanUser(user)}
                            className="flex items-center justify-center gap-1 w-full bg-green-500/10 hover:bg-green-500/20 text-green-400 font-semibold py-2 rounded-xl border border-green-500/25 transition-all duration-200 text-xs"
                          >
                            <CheckCircle size={13} /> UNBAN
                          </motion.button>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => toggleBanUser(user)}
                            className="flex items-center justify-center gap-1 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold py-2 rounded-xl border border-red-500/25 transition-all duration-200 text-xs"
                          >
                            <Ban size={13} /> BAN
                          </motion.button>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
