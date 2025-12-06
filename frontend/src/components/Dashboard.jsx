import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, FileSpreadsheet, Mail, RefreshCw, TrendingUp, Clock, AlertCircle, Send, Bell, GitMerge, Activity, CheckCircle2, FileText, Zap, ArrowUpRight, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { API_BASE } from '../lib/api';

const Dashboard = () => {
    const [teachers, setTeachers] = useState([]);
    const [newTeacher, setNewTeacher] = useState({ name: '', email: '', title: '', department_name: '' });
    const [stats, setStats] = useState({
        total_teachers: 0,
        active_tasks: 0,
        pending_replies: 0,
        emails_sent: 0,
        completion_rate: 0
    });
    const [tasks, setTasks] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [departmentStats, setDepartmentStats] = useState([]);

    

    const fetchData = async () => {
        setLoading(true);
        try {
            const teachersRes = await axios.get(`${API_BASE}/teachers/`);
            setTeachers(teachersRes.data);

            // Calculate department stats
            const deptCounts = {};
            teachersRes.data.forEach(t => {
                const dept = t.department?.name || '未知部门';
                deptCounts[dept] = (deptCounts[dept] || 0) + 1;
            });
            setDepartmentStats(Object.entries(deptCounts).map(([name, count]) => ({ name, count })));

            try {
                const statsRes = await axios.get(`${API_BASE}/stats/`);
                setStats(statsRes.data);
            } catch (e) {
                console.error("Failed to fetch stats", e);
            }

            try {
                const activityRes = await axios.get(`${API_BASE}/stats/activity`);
                setActivity(activityRes.data);
            } catch (e) {
                console.error("Failed to fetch activity", e);
            }

            try {
                const tasksRes = await axios.get(`${API_BASE}/tasks/`);
                setTasks(tasksRes.data);
            } catch (e) {
                console.error("Failed to fetch tasks", e);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const activeTask = tasks[0];
    const recentActivity = activity; // Alias for compatibility

    useEffect(() => {
        fetchData();
    }, []);

    const sendSummary = async () => {
        if (!activeTask) {
            setActionMessage('当前没有可用的任务。');
            return;
        }
        setActionLoading(true);
        setActionMessage('');
        try {
            await axios.post(`${API_BASE}/actions/send_email`, {
                task_id: activeTask.id,
                subject: `${activeTask.name} - 汇总通知`,
                body: '附件为本次汇总表，请填写后回复(邮件标题保持 xxx汇总)',
                attachment_path: activeTask.template_path || 'storage/summary_template.xlsx'
            });
            setActionMessage('汇总邮件已发送给所有教师。');
            fetchData();
        } catch (error) {
            setActionMessage(`发送失败：${error.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const checkAndRemind = async () => {
        if (!activeTask) {
            setActionMessage('当前没有可检查的任务。');
            return;
        }
        setActionLoading(true);
        setActionMessage('');
        try {
            const res = await axios.post(`${API_BASE}/actions/check_replies`, {
                task_id: activeTask.id,
                task_name: activeTask.name,
                reminder_subject: `${activeTask.name} - 汇总催办`,
                reminder_body: '尚未收到您的汇总，请尽快回复并保持邮件标题含“汇总”'
            });
            setActionMessage(`已收集：${res.data.received}，未收集：${res.data.missing}，已催办：${res.data.reminders_sent}`);
            fetchData();
        } catch (error) {
            setActionMessage(`检查失败：${error.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const mergeAttachments = async () => {
        if (!activeTask) {
            setActionMessage('当前没有可合并的任务。');
            return;
        }
        setActionLoading(true);
        setActionMessage('');
        try {
            const res = await axios.post(`${API_BASE}/actions/merge_excel`, {
                task_id: activeTask.id,
                output_filename: 'merged_output.xlsx'
            });
            setActionMessage(res.data.message);
        } catch (error) {
            const msg = error.response?.data?.detail || error.message;
            setActionMessage(`合并失败：${msg}`);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">仪表盘</h2>
                    <p className="text-slate-500 mt-1">数据汇总任务概览</p>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 transition-all shadow-sm"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '教师总数', value: stats.total_teachers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: '进行中任务', value: stats.active_tasks, icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
                    { label: '待回复数量', value: stats.pending_replies, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: '完成率', value: `${stats.completion_rate}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                ].map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn("p-3 rounded-xl", stat.bg)}>
                                <stat.icon className={cn("w-6 h-6", stat.color)} />
                            </div>
                            {index === 3 && (
                                <span className={cn("text-xs font-medium px-2 py-1 rounded-full",
                                    stats.completion_rate >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                    {stats.completion_rate >= 80 ? '良好' : '一般'}
                                </span>
                            )}
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</h3>
                        <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Feed */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        最新动态
                    </h3>
                    <div className="space-y-6">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((activity, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className="mt-1 relative">
                                        <div className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-50 group-hover:ring-blue-100 transition-all" />
                                        {i !== recentActivity.length - 1 && (
                                            <div className="absolute top-3 left-1 w-0.5 h-full bg-slate-100" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-900 font-medium">{activity.action}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{activity.details}</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            {new Date(activity.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-slate-400">
                                暂无最新动态
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        快速操作
                    </h3>
                    <div className="space-y-3">
                        <button
                            onClick={sendSummary}
                            disabled={actionLoading || !activeTask}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600 group-hover:text-blue-700">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">发送汇总邮件</span>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        </button>
                        <button
                            onClick={checkAndRemind}
                            disabled={actionLoading || !activeTask}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-purple-600 group-hover:text-purple-700">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">检查并催办</span>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        </button>
                        <button
                            onClick={mergeAttachments}
                            disabled={actionLoading || !activeTask}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600 group-hover:text-emerald-700">
                                    <FileSpreadsheet className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">合并附件</span>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        </button>
                    </div>
                    {actionMessage && (
                        <div className="mt-4 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                            {actionMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* Department Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-indigo-600" />
                    院系分布
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {departmentStats.map((dept, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                                {dept.name}
                            </p>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-bold text-slate-900">{dept.count}</span>
                                <span className="text-xs text-slate-400 mb-1">人</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
