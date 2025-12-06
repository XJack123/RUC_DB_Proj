import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/api';
import { Upload, Download, Plus, Trash2, Search, FileSpreadsheet, User, Loader2, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const TeacherManager = () => {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        try {
            const res = await axios.get(`${API_BASE}/teachers/`);
            setTeachers(res.data);
        } catch (error) {
            console.error("Failed to fetch teachers", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            await axios.post(`${API_BASE}/teachers/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchTeachers();
            alert("导入成功！");
        } catch (error) {
            alert("导入失败：" + (error.response?.data?.detail || error.message));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExport = async () => {
        try {
            const res = await axios.get(`${API_BASE}/teachers/export`);
            // Convert JSON to CSV
            const items = res.data;
            const replacer = (key, value) => value === null ? '' : value;
            const header = Object.keys(items[0]);
            const csv = [
                header.join(','),
                ...items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
            ].join('\r\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'teachers_export.csv';
            a.click();
        } catch (error) {
            console.error("Export failed", error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("确定要删除该教师吗？")) return;
        try {
            await axios.delete(`${API_BASE}/teachers/${id}`);
            setTeachers(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.department && t.department.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const [showAddModal, setShowAddModal] = useState(false);
    const [newTeacher, setNewTeacher] = useState({ name: '', email: '', title: '', department_name: '' });

    const handleEditTeacher = (teacher) => {
        setNewTeacher({
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            title: teacher.title || '',
            department_name: teacher.department?.name || '',
            is_active: teacher.is_active
        });
        setShowAddModal(true);
    };

    const handleSaveTeacher = async () => {
        if (!newTeacher.name || !newTeacher.email) {
            alert("请填写姓名和邮箱");
            return;
        }
        try {
            if (newTeacher.id) {
                // Update existing
                await axios.put(`${API_BASE}/teachers/${newTeacher.id}`, newTeacher);
            } else {
                // Create new
                await axios.post(`${API_BASE}/teachers/`, newTeacher);
            }
            setShowAddModal(false);
            setNewTeacher({ name: '', email: '', title: '', department_name: '' });
            fetchTeachers();
        } catch (error) {
            alert("保存教师失败：" + (error.response?.data?.detail || error.message));
        }
    };

    const toggleStatus = async (teacher) => {
        try {
            await axios.put(`${API_BASE}/teachers/${teacher.id}`, {
                is_active: teacher.is_active === 1 ? 0 : 1
            });
            fetchTeachers();
        } catch (error) {
            console.error("Failed to toggle status", error);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="搜索教师..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64 transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".csv,.xlsx,.xls"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors shadow-sm"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        导入
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        导出
                    </button>
                    <button
                        onClick={() => {
                            setNewTeacher({ name: '', email: '', title: '', department_name: '' });
                            setShowAddModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium text-white transition-colors shadow-sm shadow-blue-600/20"
                    >
                        <Plus className="w-4 h-4" />
                        新增教师
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-y-auto h-full custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">姓名</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">院系</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">邮箱</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">职称</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <AnimatePresence>
                                {filteredTeachers.map((teacher) => (
                                    <motion.tr
                                        key={teacher.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="group hover:bg-slate-50 transition-colors"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xs">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-slate-900">{teacher.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">{teacher.department?.name || '-'}</td>
                                        <td className="p-4 text-sm text-slate-600">{teacher.email}</td>
                                        <td className="p-4 text-sm text-slate-600">{teacher.title || '-'}</td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => toggleStatus(teacher)}
                                                className={cn("flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
                                                    teacher.is_active === 1
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                                )}
                                            >
                                                {teacher.is_active === 1 ? '启用' : '停用'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEditTeacher(teacher)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(teacher.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                            {filteredTeachers.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        暂无教师，请导入或新增。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Teacher Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">{newTeacher.id ? '编辑教师' : '新增教师'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">姓名</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    value={newTeacher.name}
                                    onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">邮箱</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    value={newTeacher.email}
                                    onChange={e => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">院系</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    value={newTeacher.department_name}
                                    onChange={e => setNewTeacher({ ...newTeacher, department_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">职称</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    value={newTeacher.title}
                                    onChange={e => setNewTeacher({ ...newTeacher, title: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveTeacher}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-blue-600/20"
                            >
                                {newTeacher.id ? '保存修改' : '新增教师'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherManager;
