import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Plus, Calendar, Clock, CheckCircle, AlertCircle, Search, ArrowRight, Loader2, Sparkles, Users, Mail, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { API_BASE } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const TASK_STATUS_LABELS = {
    active: '进行中',
    completed: '已完成',
    pending: '待开始',
};

const SUBMISSION_STATUS_LABELS = {
    replied: '已回复',
    pending: '待回复',
    reminded: '已催办',
};

const TaskManager = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Enhanced New Task State
    const [newTask, setNewTask] = useState({
        name: '',
        description: '',
        deadline: '',
        email_subject: '',
        email_body: '',
        teacher_ids: [],
        file: null
    });

    const [teachers, setTeachers] = useState([]);
    const [creating, setCreating] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(null); // 'description', 'email_subject', 'email_body'

    

    useEffect(() => {
        fetchTasks();
        fetchTeachers();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await axios.get(`${API_BASE}/tasks/`);
            setTasks(res.data);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            const res = await axios.get(`${API_BASE}/teachers/`);
            setTeachers(res.data);
        } catch (error) {
            console.error("Failed to fetch teachers", error);
        }
    };

    const handleCreateTask = async () => {
        if (!newTask.name || !newTask.deadline) {
            alert("请填写任务名称和截止时间。");
            return;
        }
        setCreating(true);
        try {
            const formData = new FormData();
            formData.append('name', newTask.name);
            formData.append('description', newTask.description || '');
            formData.append('deadline', newTask.deadline);
            formData.append('email_subject', newTask.email_subject || '');
            formData.append('email_body', newTask.email_body || '');
            newTask.teacher_ids.forEach(id => formData.append('teacher_ids', id));
            if (newTask.file) {
                formData.append('file', newTask.file);
            }

            if (isEditing && selectedTask) {
                await axios.put(`${API_BASE}/tasks/${selectedTask.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                // Refresh to get updated data
                fetchTasks();
                setSelectedTask(null); // Close detail view or refresh it? Let's close modal and refresh list.
            } else {
                await axios.post(`${API_BASE}/tasks/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                fetchTasks();
            }
            setShowModal(false);
            setNewTask({ name: '', description: '', deadline: '', email_subject: '', email_body: '', teacher_ids: [], file: null });
            setIsEditing(false);
        } catch (error) {
            alert(`保存任务失败：${error.response?.data?.detail || error.message}`);
        } finally {
            setCreating(false);
        }
    };

    const handleEditTask = () => {
        if (!selectedTask) return;
        
        // Extract teacher IDs from submissions
        const currentTeacherIds = selectedTask.submissions ? selectedTask.submissions.map(s => s.teacher_id) : [];

        setNewTask({
            name: selectedTask.name,
            description: selectedTask.description || '',
            deadline: selectedTask.deadline ? selectedTask.deadline.slice(0, 16) : '', // Format for datetime-local
            email_subject: selectedTask.email_subject || '',
            email_body: selectedTask.email_body || '',
            teacher_ids: currentTeacherIds,
            template_path: selectedTask.template_path // Store existing path to display
        });
        setIsEditing(true);
        setShowModal(true);
    };

    // AI Generation Logic
    const handleAiInput = async (field, value) => {
        // Update state first
        setNewTask(prev => ({ ...prev, [field]: value }));

        // Check for slash command
        if (value.startsWith('/')) {
            const prompt = value.substring(1); // Remove slash
            if (prompt.length > 3) { // Debounce slightly or wait for enter? Let's use Enter key for explicit trigger or a button
                // Actually, let's just show a hint or button, or trigger on Enter if it's a textarea?
                // For simplicity, let's detect "Enter" in the input handlers instead.
            }
        }
    };

    const triggerAiGeneration = async (field, prompt) => {
        setAiGenerating(field);
        try {
            const res = await axios.post(`${API_BASE}/chat/generate`, { prompt: `Generate ${field.replace('_', ' ')} for: ${prompt}` });
            const generatedText = res.data.content;
            setNewTask(prev => ({ ...prev, [field]: generatedText }));
        } catch (error) {
            console.error("AI Generation failed", error);
        } finally {
            setAiGenerating(null);
        }
    };

    const handleKeyDown = (e, field) => {
        if (e.key === 'Enter' && newTask[field].startsWith('/')) {
            e.preventDefault();
            const prompt = newTask[field].substring(1);
            triggerAiGeneration(field, prompt);
        }
    };

    const handleRemindAll = async () => {
        if (!selectedTask) return;
        try {
            const res = await axios.post(`${API_BASE}/tasks/${selectedTask.id}/remind`);
            alert(res.data.message);
        } catch (error) {
            console.error("Failed to send reminders", error);
            alert("发送提醒失败");
        }
    };

    const handleCheckReplies = async () => {
        if (!selectedTask) return;
        try {
            await axios.post(`${API_BASE}/actions/check_replies`, {
                task_id: selectedTask.id,
                task_name: selectedTask.name
            });
            alert("检查完成，已更新回复状态");
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error("Failed to check replies", error);
            alert("检查回复失败");
        }
    };

    const handleMergeAttachments = async () => {
        if (!selectedTask) return;
        try {
            const res = await axios.post(`${API_BASE}/actions/merge_excel`, {
                task_id: selectedTask.id,
                output_filename: `${selectedTask.name}_merged.xlsx`
            });
            alert(res.data.message);
            
            if (res.data.download_url) {
                const link = document.createElement('a');
                link.href = `${API_BASE}${res.data.download_url}`;
                link.download = `${selectedTask.name}_merged.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            const msg = error.response?.data?.detail || error.message;
            alert(`合并失败：${msg}`);
        }
    };

    const handleDeleteTask = async () => {
        if (!selectedTask) return;
        if (!confirm("确定要删除该任务吗？此操作无法撤回。")) return;

        try {
            await axios.delete(`${API_BASE}/tasks/${selectedTask.id}`);
            setSelectedTask(null);
            fetchTasks();
        } catch (error) {
            console.error("Failed to delete task", error);
            alert("删除任务失败");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 p-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">任务管理</h2>
                    <p className="text-muted-foreground mt-1">创建并追踪数据汇总任务。</p>
                </div>
                {!selectedTask && (
                    <button
                        onClick={() => {
                            setIsEditing(false);
                            setNewTask({ name: '', description: '', deadline: '', email_subject: '', email_body: '', teacher_ids: [] });
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        新建任务
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <AnimatePresence mode="wait">
                {selectedTask ? (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="h-full flex flex-col space-y-6"
                    >
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                            >
                                <ArrowRight className="w-5 h-5 rotate-180" />
                            </button>
                            <button
                                onClick={handleEditTask}
                                className="p-2 hover:bg-blue-500/10 rounded-lg transition-colors text-gray-600 hover:text-blue-400 ml-2"
                                title="编辑任务"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleDeleteTask}
                                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-600 hover:text-red-400 ml-auto"
                                title="删除任务"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedTask.name}</h2>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", getStatusColor(selectedTask.status))}>
                                        {TASK_STATUS_LABELS[selectedTask.status] || selectedTask.status}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>截止：{new Date(selectedTask.deadline).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel rounded-2xl border border-gray-200 flex-1 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-gray-200 bg-white/5 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-900">提交记录</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCheckReplies}
                                        className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        检查回复
                                    </button>
                                    <button
                                        onClick={handleMergeAttachments}
                                        className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <FileSpreadsheet className="w-3 h-3" />
                                        合并附件
                                    </button>
                                    <button
                                        onClick={handleRemindAll}
                                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                    >
                                        提醒全部未回复
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 custom-scrollbar p-4">
                                <TaskSubmissionsList taskId={selectedTask.id} key={`${selectedTask.id}-${refreshKey}`} />
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {tasks.map((task, i) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => setSelectedTask(task)}
                                className="glass-panel p-6 rounded-2xl border border-gray-200 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight className="w-5 h-5 text-blue-400" />
                                </div>

                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <FileSpreadsheet className="w-5 h-5" />
                                    </div>
                                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", getStatusColor(task.status))}>
                                        {TASK_STATUS_LABELS[task.status] || task.status}
                                    </span>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-400 transition-colors">{task.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{task.description || "暂无描述。"}</p>

                                <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{new Date(task.deadline).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">{isEditing ? '编辑任务' : '新建任务'}</h3>
                            <p className="text-sm text-muted-foreground mt-1">配置任务信息、收件人以及邮件模板。</p>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">任务名称</label>
                                    <input
                                        className="w-full px-3 py-2 rounded-lg bg-black/20 border border-gray-200 text-gray-900 focus:border-blue-500 outline-none"
                                        value={newTask.name}
                                        onChange={e => setNewTask({ ...newTask, name: e.target.value })}
                                        placeholder="例如：2024 年度汇总"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">截止时间</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-3 py-2 rounded-lg bg-black/20 border border-gray-200 text-gray-900 focus:border-blue-500 outline-none"
                                        value={newTask.deadline}
                                        onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-gray-600 mb-1">模板文件（可选）</label>
                                    {newTask.template_path && !newTask.file && (
                                        <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                            <FileSpreadsheet className="w-3 h-3" />
                                            当前文件：{newTask.template_path.split('/').pop()}
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        className="w-full px-3 py-2 rounded-lg bg-black/20 border border-gray-200 text-gray-900 focus:border-blue-500 outline-none"
                                        onChange={e => setNewTask({ ...newTask, file: e.target.files[0] })}
                                    />
                                </div>
                            </div>

                            {/* Description with AI */}
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="block text-sm text-gray-600">任务说明</label>
                                    <span className="text-xs text-blue-400 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        输入 / 可使用 AI 生成
                                    </span>
                                </div>
                                <div className="relative">
                                    <textarea
                                        className="w-full px-3 py-2 rounded-lg bg-black/20 border border-gray-200 text-gray-900 focus:border-blue-500 outline-none min-h-[80px]"
                                        value={newTask.description}
                                        onChange={e => handleAiInput('description', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, 'description')}
                                        placeholder="请输入任务说明..."
                                    />
                                    {aiGenerating === 'description' && (
                                        <div className="absolute right-3 bottom-3">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Email Template */}
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-400" />
                                    邮件模板
                                </h4>
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">邮件主题</label>
                                    <div className="relative">
                                        <input
                                            className="w-full px-3 py-2 rounded-lg bg-black/20 border border-gray-200 text-gray-900 focus:border-blue-500 outline-none"
                                            value={newTask.email_subject}
                                            onChange={e => handleAiInput('email_subject', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, 'email_subject')}
                                            placeholder="请输入主题（输入 / 调用 AI）"
                                        />
                                        {aiGenerating === 'email_subject' && (
                                            <div className="absolute right-3 top-2.5">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">邮件正文</label>
                                    <div className="relative">
                                        <textarea
                                            className="w-full px-3 py-2 rounded-lg bg-black/20 border border-gray-200 text-gray-900 focus:border-blue-500 outline-none min-h-[120px]"
                                            value={newTask.email_body}
                                            onChange={e => handleAiInput('email_body', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, 'email_body')}
                                            placeholder="请输入正文内容（输入 / 调用 AI）"
                                        />
                                        {aiGenerating === 'email_body' && (
                                            <div className="absolute right-3 bottom-3">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Teacher Selection */}
                            <div className="space-y-2 pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-400" />
                                    收件人
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar bg-black/20 p-3 rounded-lg border border-gray-200">
                                    {teachers.map(teacher => (
                                        <label key={teacher.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                            <input
                                                type="checkbox"
                                                checked={newTask.teacher_ids.includes(teacher.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setNewTask(prev => ({ ...prev, teacher_ids: [...prev.teacher_ids, teacher.id] }));
                                                    } else {
                                                        setNewTask(prev => ({ ...prev, teacher_ids: prev.teacher_ids.filter(id => id !== teacher.id) }));
                                                    }
                                                }}
                                                className="rounded border-white/20 bg-white/5 text-blue-600 focus:ring-0"
                                            />
                                            <span className="truncate">{teacher.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="text-xs text-gray-600 text-right">
                                    已选择 {newTask.teacher_ids.length} 位教师
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-white rounded-b-2xl">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateTask}
                                disabled={creating}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                {creating ? '保存中...' : (isEditing ? '保存修改' : '创建任务')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

const TaskSubmissionsList = ({ taskId }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const res = await axios.get(`${API_BASE}/tasks/${taskId}/submissions`);
                setSubmissions(res.data);
            } catch (error) {
                console.error("Failed to fetch submissions", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubmissions();
        fetchSubmissions();
    }, [taskId]);

    const handleMarkReplied = async (subId) => {
        try {
            await axios.put(`${API_BASE}/tasks/submissions/${subId}`, { status: 'replied' });
            setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'replied', reply_received_at: new Date().toISOString() } : s));
        } catch (error) {
                console.error("Failed to update submission", error);
                alert("更新状态失败");
        }
    };
            if (loading) return <div className="p-4 text-center text-gray-600">正在加载提交记录...</div>;

    return (
        <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-white/5 sticky top-0">
                <tr>
                    <th className="px-4 py-3">教师</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">上次催办时间</th>
                    <th className="px-4 py-3">回复内容</th>
                    <th className="px-4 py-3 text-right">操作</th>
                </tr>
            </thead>
            <tbody>
                {submissions.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-600">暂无提交记录。</td>
                    </tr>
                ) : (
                    submissions.map((sub) => (
                        <tr key={sub.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-100 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">
                                {sub.teacher ? (
                                    <div className="flex flex-col">
                                        <span>{sub.teacher.name}</span>
                                        <span className="text-xs text-gray-500">{sub.teacher.email}</span>
                                    </div>
                                ) : (
                                    `ID: ${sub.teacher_id}`
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <span className={cn(
                                    "px-2 py-1 rounded text-xs border",
                                    sub.status === 'replied' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        sub.status === 'pending' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                )}>
                                    {SUBMISSION_STATUS_LABELS[sub.status] || sub.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                                {sub.last_reminded_at ? new Date(sub.last_reminded_at).toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={sub.content}>
                                {sub.content || '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {sub.status !== 'replied' && (
                                    <button
                                        onClick={() => handleMarkReplied(sub.id)}
                                        className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-500/20 transition-colors"
                                    >
                                        标记为已回复
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
};

export default TaskManager;
