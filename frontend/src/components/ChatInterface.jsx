import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/api';
import { Send, Bot, User, Loader2, Sparkles, Command, AlertCircle, StopCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Simple Typewriter Component
const Typewriter = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const indexRef = useRef(0);

    useEffect(() => {
        indexRef.current = 0;
        setDisplayedText('');

        const intervalId = setInterval(() => {
            if (indexRef.current < text.length) {
                setDisplayedText((prev) => prev + text.charAt(indexRef.current));
                indexRef.current += 1;
            } else {
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, 15); // Speed of typing

        return () => clearInterval(intervalId);
    }, [text]);

    return <div className="whitespace-pre-wrap leading-relaxed">{displayedText}</div>;
};

// Basic Markdown Formatter (Bold, Code Block)
const FormatText = ({ text }) => {
    if (!text) return null;

    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);

    return (
        <div className="space-y-2">
            {parts.map((part, i) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const code = part.slice(3, -3).replace(/^.*\n/, ''); // Remove language tag if present
                    return (
                        <div key={i} className="bg-black/30 rounded-lg p-3 font-mono text-xs overflow-x-auto border border-gray-200 my-2">
                            <pre>{code}</pre>
                        </div>
                    );
                }
                // Handle bold text
                const boldParts = part.split(/(\*\*.*?\*\*)/g);
                return (
                    <span key={i}>
                        {boldParts.map((subPart, j) => {
                            if (subPart.startsWith('**') && subPart.endsWith('**')) {
                                return <strong key={j} className="font-semibold text-blue-200">{subPart.slice(2, -2)}</strong>;
                            }
                            return subPart;
                        })}
                    </span>
                );
            })}
        </div>
    );
};

const ChatInterface = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: '您好！我是智能助手，可以帮助您管理教师数据、发送邮件并合并 Excel 文件，请告诉我您的需求。', isTyping: false }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        // Reset height
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            const res = await axios.post(`${API_BASE}/chat/`, { query: userMsg.content });
            const data = res.data;

            let assistantMsg = { role: 'assistant', ...data, isTyping: true };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，执行过程中出现问题。', isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleActionConfirm = async (action, msgIdx) => {
        try {
            let endpoint = '';
            let payload = {};

            if (action.action === 'execute_sql') {
                endpoint = `${API_BASE}/actions/execute_sql`;
                payload = { sql: action.sql };
            } else if (action.action === 'send_email') {
                endpoint = `${API_BASE}/actions/send_email`;
                payload = action.params;
            } else if (action.action === 'merge_excel') {
                endpoint = `${API_BASE}/actions/merge_excel`;
                payload = action.params;
            }

            if (endpoint) {
                setMessages(prev => [...prev, { role: 'assistant', content: '正在执行操作...', isTyping: true }]);
                const res = await axios.post(endpoint, payload);
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: `操作完成：${res.data.message}`, isTyping: true }
                ]);
            }
        } catch (error) {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `操作失败：${error.response?.data?.detail || error.message}`, isError: true, isTyping: true }
            ]);
        }
    };

    const renderMessage = (msg, idx) => {
        const isUser = msg.role === 'user';
        const isLast = idx === messages.length - 1;

        return (
            <div
                key={idx}
                className={cn(
                    "w-full py-6 border-b border-slate-100",
                    isUser ? "bg-white" : "bg-slate-50/50"
                )}
            >
                <div className="max-w-3xl mx-auto px-4 flex gap-6">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                        isUser ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                    )}>
                        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="font-medium text-sm text-slate-900 mb-1">
                            {isUser ? '我' : '智能助手'}
                        </div>

                        <div className="text-slate-700 text-sm leading-relaxed">
                            {msg.isTyping && isLast && !isUser ? (
                                <Typewriter
                                    text={msg.content || ''}
                                    onComplete={() => {
                                        const newMessages = [...messages];
                                        newMessages[idx].isTyping = false;
                                        setMessages(newMessages);
                                    }}
                                />
                            ) : (
                                <FormatText text={msg.content} />
                            )}
                        </div>

                        {/* Data View (Table) */}
                        {msg.type === 'data_view' && msg.data && !msg.isTyping && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="p-2 bg-slate-50 border-b border-slate-200 text-xs font-mono text-slate-500">
                                    {msg.sql}
                                </div>
                                <div className="overflow-x-auto max-h-60 custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr>
                                                {Object.keys(msg.data[0] || {}).map(key => (
                                                    <th key={key} className="p-3 font-semibold text-slate-600">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {msg.data.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    {Object.values(row).map((val, j) => (
                                                        <td key={j} className="p-3 text-slate-600">{String(val)}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Confirmation Card */}
                        {msg.type === 'confirmation' && !msg.isTyping && (
                            <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md shadow-sm">
                                <div className="flex items-center gap-2 mb-2 text-amber-700">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="font-semibold text-xs">请确认操作</span>
                                </div>
                                <div className="bg-white border border-amber-100 rounded-lg p-3 mb-3 text-xs font-mono text-slate-600 overflow-x-auto">
                                    {msg.sql || JSON.stringify(msg.action, null, 2)}
                                </div>
                                <div className="text-xs text-amber-600 mb-4">{msg.message}</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleActionConfirm(msg, idx)}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                                    >
                                        确认执行
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Email Draft Preview */}
                        {msg.type === 'email_draft' && !msg.isTyping && (
                            <div className="mt-3 bg-white border border-blue-100 rounded-xl overflow-hidden max-w-xl shadow-sm ring-1 ring-blue-50">
                                <div className="p-3 border-b border-blue-100 bg-blue-50/50 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-blue-700">邮件草稿</span>
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                        {msg.recipients_count} 位收件人
                                    </span>
                                </div>

                                {msg.isEditing ? (
                                    <div className="p-3 space-y-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">主题</label>
                                            <input
                                                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                value={msg.subject}
                                                onChange={(e) => {
                                                    const newMessages = [...messages];
                                                    newMessages[idx].subject = e.target.value;
                                                    setMessages(newMessages);
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">正文</label>
                                            <textarea
                                                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[150px] transition-all"
                                                value={msg.body}
                                                onChange={(e) => {
                                                    const newMessages = [...messages];
                                                    newMessages[idx].body = e.target.value;
                                                    setMessages(newMessages);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">主题</label>
                                            <div className="text-sm text-slate-900 font-medium mt-0.5">{msg.subject}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">正文</label>
                                            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg mt-1 border border-slate-100">
                                                {msg.body}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="p-3 border-t border-blue-50 bg-slate-50/30 flex gap-2">
                                    <button
                                        onClick={() => {
                                            const action = {
                                                action: 'send_email',
                                                params: {
                                                    subject: msg.subject,
                                                    body: msg.body,
                                                }
                                            };
                                            handleActionConfirm(action, idx);
                                        }}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <Send className="w-3 h-3" />
                                        发送邮件
                                    </button>
                                    <button
                                        onClick={() => {
                                            const newMessages = [...messages];
                                            newMessages[idx].isEditing = !newMessages[idx].isEditing;
                                            setMessages(newMessages);
                                        }}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-xs font-medium transition-colors border shadow-sm",
                                            msg.isEditing
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                        )}
                                    >
                                        {msg.isEditing ? '完成编辑' : '编辑草稿'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/80 backdrop-blur-md shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">智能助手</h2>
                        <p className="text-xs text-slate-500">本地模型驱动</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 basis-0 bg-slate-50/30" ref={scrollRef}>
                {messages.map(renderMessage)}

                {loading && (
                    <div className="w-full py-6 bg-slate-50/50 border-b border-slate-100">
                        <div className="max-w-3xl mx-auto px-4 flex gap-6">
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex items-center gap-1 pt-2">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="w-2 h-2 rounded-full bg-slate-400"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                    className="w-2 h-2 rounded-full bg-slate-400"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                    className="w-2 h-2 rounded-full bg-slate-400"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white shrink-0 border-t border-slate-200">
                <div className="max-w-3xl mx-auto relative">
                    <div className="relative flex items-end bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="请输入需求，例如分析数据、发送邮件或管理任务..."
                            className="w-full bg-transparent border-none py-4 px-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 resize-none max-h-48 custom-scrollbar"
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="m-2 p-2.5 bg-blue-600 rounded-xl text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-sm"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-3 flex items-center justify-center gap-1.5">
                        <Command className="w-3 h-3" />
                        <span>AI 可能会出错，请自行核实重要信息。</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
