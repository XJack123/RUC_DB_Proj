import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/api';
import { Save, Server, Mail, Key, Loader2 } from 'lucide-react';

const Settings = () => {
    const [config, setConfig] = useState({
        llm_provider: 'deepseek',
        api_key: 'sk-********************',
        smtp_server: 'smtp.qq.com',
        smtp_port: '465',
        email_user: '28582@qq.com',
        email_password: '****************'
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${API_BASE}/settings/`);
            if (Object.keys(res.data).length > 0) {
                setConfig(prev => ({ ...prev, ...res.data }));
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/settings/`, { settings: config });
            alert("设置保存成功！");
        } catch (error) {
            alert("保存失败，请稍后重试。");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 p-6 overflow-y-auto custom-scrollbar">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">系统设置</h2>
                <p className="text-slate-500 mt-1">配置智能服务与邮件参数。</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* AI Configuration */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                            <Server className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">智能服务配置</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">大模型提供商</label>
                            <select
                                name="llm_provider"
                                value={config.llm_provider}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="deepseek">DeepSeek</option>
                                <option value="openai">OpenAI</option>
                                <option value="mock">模拟模式</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">API 密钥</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    name="api_key"
                                    value={config.api_key}
                                    onChange={handleChange}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Email Configuration */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Mail className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">邮件服务</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">SMTP 服务器</label>
                                <input
                                    name="smtp_server"
                                    value={config.smtp_server}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">端口</label>
                                <input
                                    name="smtp_port"
                                    value={config.smtp_port}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱账号</label>
                            <input
                                name="email_user"
                                value={config.email_user}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱密码 / 授权码</label>
                            <input
                                type="password"
                                name="email_password"
                                value={config.email_password}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    保存设置
                </button>
            </div>
        </div>
    );
};

export default Settings;
