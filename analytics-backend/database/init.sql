-- TextDiff+ Analytics Database Schema
-- 创建数据库和用户（如果不存在）

-- 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    anonymized_ip VARCHAR(45) NOT NULL,
    user_agent TEXT,
    country VARCHAR(2),
    city VARCHAR(100),
    referrer TEXT,
    landing_page TEXT NOT NULL,
    exit_page TEXT,
    page_views INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    bounced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 仪表板配置表
CREATE TABLE IF NOT EXISTS dashboard_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    config_name VARCHAR(100) NOT NULL,
    widgets JSONB NOT NULL DEFAULT '[]',
    refresh_interval INTEGER DEFAULT 30,
    alert_settings JSONB DEFAULT '{}',
    theme VARCHAR(20) DEFAULT 'light',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 报警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    condition_type VARCHAR(20) NOT NULL, -- 'greater_than', 'less_than', 'equals'
    threshold_value DECIMAL(10,2) NOT NULL,
    time_window INTEGER DEFAULT 300, -- 秒
    notification_channels JSONB DEFAULT '[]', -- ['email', 'sms', 'webhook']
    recipients JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 报警历史表
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'acknowledged'
    acknowledged_by INTEGER REFERENCES admin_users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 报告生成记录表
CREATE TABLE IF NOT EXISTS report_generations (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(100) NOT NULL,
    report_type VARCHAR(20) NOT NULL, -- 'pdf', 'csv', 'json'
    parameters JSONB NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
    generated_by INTEGER REFERENCES admin_users(id),
    share_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_start_time ON user_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_user_sessions_anonymized_ip ON user_sessions(anonymized_ip);
CREATE INDEX IF NOT EXISTS idx_user_sessions_country ON user_sessions(country);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_report_generations_created_at ON report_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_report_generations_share_token ON report_generations(share_token);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建更新时间触发器
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_configs_updated_at BEFORE UPDATE ON dashboard_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_generations_updated_at BEFORE UPDATE ON report_generations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO admin_users (username, email, password_hash) 
VALUES ('admin', 'admin@textdiff.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (username) DO NOTHING;

-- 用户同意记录表
CREATE TABLE IF NOT EXISTS user_consents (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_version VARCHAR(20) DEFAULT '1.0',
    user_agent_hash VARCHAR(64),
    ip_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 数据删除日志表
CREATE TABLE IF NOT EXISTS data_deletion_logs (
    id SERIAL PRIMARY KEY,
    deletion_id VARCHAR(255) UNIQUE NOT NULL,
    identifier_hash VARCHAR(64) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL, -- 'session', 'ip', 'user'
    records_deleted INTEGER DEFAULT 0,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'completed', 'failed'
);

-- 隐私审计日志表
CREATE TABLE IF NOT EXISTS privacy_audit_logs (
    id SERIAL PRIMARY KEY,
    audit_type VARCHAR(50) NOT NULL,
    audit_results JSONB NOT NULL,
    compliance_status BOOLEAN DEFAULT TRUE,
    issues_found INTEGER DEFAULT 0,
    performed_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_consents_session_id ON user_consents(session_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_created_at ON user_consents(created_at);
CREATE INDEX IF NOT EXISTS idx_data_deletion_logs_deletion_id ON data_deletion_logs(deletion_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_logs_requested_at ON data_deletion_logs(requested_at);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_logs_created_at ON privacy_audit_logs(created_at);

-- 为隐私相关表创建更新时间触发器
CREATE TRIGGER update_user_consents_updated_at BEFORE UPDATE ON user_consents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('data_retention_days', '90', '数据保留天数'),
('max_sessions_per_ip', '100', '每个IP最大会话数'),
('alert_cooldown_minutes', '15', '报警冷却时间（分钟）'),
('report_max_size_mb', '50', '报告文件最大大小（MB）'),
('privacy_consent_required', 'true', '是否需要用户同意'),
('anonymization_enabled', 'true', '是否启用数据匿名化'),
('data_deletion_auto_approve', 'false', '是否自动批准数据删除请求')
ON CONFLICT (config_key) DO NOTHING;