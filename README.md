# 高校科研/教学数据自动汇总系统

> 中国人民大学 2025秋 数据库系统概论 大作业

一个帮助高校行政人员自动化处理数据收集工作的全栈Web应用，支持科研成果统计、教学工作量核对等场景。

## 📋 项目概述

本系统通过邮件自动分发任务模板，自动抓取教师回复的邮件附件，并提供一键合并汇总功能，极大地提高了工作效率。

### 核心功能

| 功能模块 | 描述 |
|---------|------|
| **任务管理** | 创建数据收集任务，上传Excel模板，自定义邮件通知 |
| **邮件自动化** | 自动群发通知邮件，支持针对未回复教师的一键催办 |
| **智能回执** | 通过IMAP协议自动扫描邮箱，识别教师回复并下载附件 |
| **数据汇总** | 一键合并所有教师提交的Excel文件，生成总表 |
| **AI 助手** | 集成LLM（如DeepSeek），支持自然语言查询数据库和生成邮件内容 |

---

## 🛠️ 技术栈

### 后端

- **框架**: FastAPI
- **数据库**: SQLite (可切换至 MySQL/PostgreSQL)
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic
- **LLM集成**: OpenAI API (兼容 DeepSeek)
- **数据处理**: Pandas, OpenPyXL

### 前端

- **框架**: React 19 + Vite
- **样式**: TailwindCSS 4
- **图标**: Lucide React
- **动画**: Framer Motion
- **HTTP客户端**: Axios

---

## 📁 项目结构

```text
RUC_DB_Proj/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── main.py            # FastAPI 应用入口
│   │   ├── database.py        # 数据库连接配置
│   │   ├── models.py          # SQLAlchemy 数据模型
│   │   ├── schemas.py         # Pydantic 数据模式
│   │   ├── crud.py            # 数据库 CRUD 操作
│   │   ├── routers/           # API 路由模块
│   │   │   ├── teachers.py    # 教师管理 API
│   │   │   ├── tasks.py       # 任务管理 API
│   │   │   ├── actions.py     # 邮件/合并操作 API
│   │   │   ├── stats.py       # 统计数据 API
│   │   │   ├── chat.py        # AI 对话 API
│   │   │   └── config.py      # 系统配置 API
│   │   └── services/          # 业务逻辑服务
│   ├── mock_email_server/     # 模拟邮件服务器 (开发测试用)
│   ├── migrate_db.py          # 数据库迁移脚本
│   └── requirements.txt       # Python 依赖
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── App.jsx            # 应用主组件
│   │   ├── main.jsx           # 入口文件
│   │   └── components/        # React 组件
│   │       ├── Dashboard.jsx      # 仪表盘
│   │       ├── TeacherManager.jsx # 教师管理
│   │       ├── TaskManager.jsx    # 任务管理
│   │       ├── ChatInterface.jsx  # AI 助手
│   │       └── Settings.jsx       # 系统设置
│   ├── package.json
│   └── vite.config.js
│
└── docs/                       # 文档
    └── er_and_user_manual.md  # ER图与用户手册
```

---

## 🗄️ 数据模型

系统采用关系型数据库设计，包含以下核心实体：

```text
┌─────────────┐       ┌─────────────────┐       ┌───────────────────┐
│ Departments │───1:N─│    Teachers     │───1:N─│  TaskSubmissions  │
│    (院系)    │       │     (教师)      │       │    (任务提交)      │
└─────────────┘       └─────────────────┘       └───────────────────┘
                                                         │
                                                        N:1
                                                         │
                                               ┌─────────────────┐
                                               │ CollectionTasks │
                                               │    (收集任务)    │
                                               └─────────────────┘
```

**主要实体**:
- **Departments**: 院系信息
- **Teachers**: 教师信息 (姓名、邮箱、职称、所属院系)
- **CollectionTasks**: 数据收集任务 (模板、邮件内容、截止日期)
- **TaskSubmissions**: 任务提交记录 (状态追踪、附件管理)
- **ActivityLog / SystemLog**: 系统日志

---

## 🚀 快速开始

### 环境要求

- **Python**: 3.10+
- **Node.js**: 18+
- **邮件服务**: SMTP/IMAP (推荐 QQ邮箱或企业邮)

### 1. 后端部署

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量 (复制 .env.example 为 .env 并填写)
# 必填项:
#   DATABASE_URL=sqlite:///./sql_app.db
#   SMTP_SERVER, SMTP_PORT, EMAIL_USER, EMAIL_PASSWORD
#   IMAP_HOST, IMAP_PORT
# 可选项:
#   LLM_PROVIDER=deepseek
#   LLM_API_KEY=sk-xxxxxx

# 初始化数据库
python migrate_db.py

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端 API 文档: `http://localhost:8000/docs`

### 2. 前端部署

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev -- --host 0.0.0.0
```

访问地址: `http://localhost:5173`

---

## 📖 使用说明

### 仪表盘 (Dashboard)

- 查看教师总数、进行中任务、待回复数及整体完成率
- 实时显示系统关键操作日志

### 教师管理 (Teacher Management)

- 手动添加教师或批量导入 Excel/CSV 文件
- 文件格式要求: 需包含 `name`, `email`, `department` 列

### 任务管理 (Task Management)

1. **创建任务**: 填写名称、截止日期，上传 Excel 模板
2. **发送邮件**: 群发通知邮件给选定教师
3. **催办功能**: 一键提醒未回复教师
4. **检查回复**: 自动扫描 IMAP 邮箱，匹配教师回复并下载附件
5. **合并附件**: 将所有回复的 Excel 合并为总表

### AI 助手 (Chat Interface)

- 自然语言查询数据库 (如 "哪个院系回复率最高?")
- 辅助生成邮件文案

---

## 📝 API 端点

| 模块 | 端点 | 描述 |
|------|------|------|
| 教师 | `GET/POST /teachers` | 教师列表/创建 |
| 教师 | `POST /teachers/batch_import` | 批量导入 |
| 任务 | `GET/POST /tasks` | 任务列表/创建 |
| 任务 | `GET /tasks/{id}/submissions` | 获取提交记录 |
| 操作 | `POST /actions/send_emails` | 发送邮件 |
| 操作 | `POST /actions/check_replies` | 检查回复 |
| 操作 | `POST /actions/merge_attachments` | 合并附件 |
| 统计 | `GET /stats` | 获取统计数据 |
| AI | `POST /chat` | AI 对话 |

完整 API 文档请访问 `/docs` (Swagger UI)

---

## 🔧 配置说明

### 环境变量 (.env)

```ini
# 数据库
DATABASE_URL=sqlite:///./sql_app.db

# 邮件服务 (必须配置以使用核心功能)
SMTP_SERVER=smtp.qq.com
SMTP_PORT=465
EMAIL_USER=your_email@qq.com
EMAIL_PASSWORD=your_auth_code  # 邮箱授权码，非登录密码
IMAP_HOST=imap.qq.com
IMAP_PORT=993

# LLM 配置 (可选)
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-xxxxxx
```

---

## ❓ 常见问题

**Q: 为什么"检查回复"找不到邮件？**
> 1. 教师回复的邮件主题必须包含任务名称
> 2. 教师必须使用系统登记的邮箱回复
> 3. 检查 `.env` 中 IMAP 配置是否正确

**Q: 合并附件失败怎么办？**
> 确保教师回复的附件是有效的 Excel 文件，损坏文件会导致合并中断

**Q: 如何切换数据库？**
> 修改 `DATABASE_URL` 环境变量，支持 SQLite/MySQL/PostgreSQL

---

## 📄 License

MIT License

---

## 👥 贡献者

中国人民大学 数据库系统概论 2025秋 大作业项目
