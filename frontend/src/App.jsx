import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import TeacherManager from './components/TeacherManager';
import TaskManager from './components/TaskManager';
import Settings from './components/Settings';
import { LayoutDashboard, MessageSquare, Settings as SettingsIcon, Users, Database, LogOut, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const SidebarItem = ({ item }) => (
    <button
      key={item.id}
      onClick={() => setActiveTab(item.id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
        activeTab === item.id
          ? "bg-blue-50 text-blue-700 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <item.icon className={cn("w-5 h-5 transition-colors",
        activeTab === item.id ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
      )} />
      {item.label}
      {activeTab === item.id && (
        <motion.div
          layoutId="active-pill"
          className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </button>
  );

  const sidebarNavItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "仪表盘" },
    { id: "tasks", icon: Database, label: "任务管理" },
    { id: "teachers", icon: Users, label: "教师管理" },
    { id: "chat", icon: MessageSquare, label: "智能助手" },
    { id: "settings", icon: SettingsIcon, label: "系统设置" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              智能办公助手
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {sidebarNavItems.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
              管
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">管理员</p>
              <p className="text-xs text-slate-500 truncate">admin@example.com</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-xl z-10 shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">
            {sidebarNavItems.find(i => i.id === activeTab)?.label || '仪表盘'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 p-[1px]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-bold text-blue-600">
                管
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-8 relative">
          {/* Background Gradients */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-[120px]" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full relative z-0"
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'tasks' && <TaskManager />}
              {activeTab === 'chat' && (
                <div className="h-full max-w-4xl mx-auto glass-panel rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white">
                  <ChatInterface />
                </div>
              )}
              {activeTab === 'teachers' && <TeacherManager />}
              {activeTab === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
