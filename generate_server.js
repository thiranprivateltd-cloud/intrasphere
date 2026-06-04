const fs = require('fs');

const code = `const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const supabase = require('./database');
const webpush = require('web-push');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 4000;

const JWT_SECRET = process.env.JWT_SECRET || 'intrasphere-super-secret-key';
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFL8eI5RoAlJI';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '_r1-L8QpWqT6bUjE6Gf-_zYvR4pZ6B_wLw-Qf2_mXxw';

webpush.setVapidDetails('mailto:admin@intrasphere.com', publicVapidKey, privateVapidKey);

app.use(helmet());
app.use(cors({ origin: ['https://intrasphere.vercel.app', 'http://localhost:4000'] }));
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests." } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: "Too many login attempts." } });
app.use('/api/', apiLimiter);

const publicPath = path.resolve(__dirname, 'public');
const rootPath = __dirname;
const fs_module = require('fs');
const servePath = fs_module.existsSync(publicPath) ? publicPath : rootPath;

if (servePath === rootPath) {
    app.get('/js/main.js', (req, res) => res.sendFile(path.join(rootPath, 'main.js')));
    app.get('/css/style.css', (req, res) => res.sendFile(path.join(rootPath, 'style.css')));
}
app.use(express.static(servePath));

async function notifyUsers(supabase, userIds, title, body, url = '/') {
    let query = supabase.from('users').select('push_subscription').not('push_subscription', 'is', null);
    if (userIds && userIds.length > 0) query = query.in('id', userIds);
    const { data: rows, error } = await query;
    if (error || !rows) return;
    const payload = JSON.stringify({ title, body, icon: '/icons/intrasphere-logo.png', url });
    rows.forEach(row => {
        try {
            const sub = JSON.parse(row.push_subscription);
            webpush.sendNotification(sub, payload).catch(e => console.error("Push Error", e));
        } catch(e) {}
    });
}

async function writeAuditLog(userId, role, action, moduleName, recordId, oldData = null, newData = null, ipAddress = null) {
    try {
        const { data: user } = await supabase.from('users').select('name').eq('id', userId).single();
        await supabase.from('audit_logs').insert([{
            user_id: userId,
            username: user ? user.name : 'Unknown',
            role: role,
            action: action,
            module: moduleName,
            record_id: recordId,
            old_data: oldData ? JSON.stringify(oldData) : null,
            new_data: newData ? JSON.stringify(newData) : null,
            ip_address: ipAddress
        }]);
    } catch(e) { console.error("Audit log failed:", e); }
}

const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ auth: false, message: 'No token provided.' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(500).json({ auth: false, message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        req.userDept = decoded.department;
        req.userRole = decoded.role;
        next();
    });
};

const adminRoles = ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'];

app.post('/api/login', loginLimiter, async (req, res) => {
    const { employee_id, password } = req.body;
    const { data: user, error } = await supabase.from('users').select('*').eq('employee_id', employee_id).single();
    if (error || !user) return res.status(401).json({ error: "Invalid credentials" });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, department: user.department, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: 86400 });
    res.status(200).json({ auth: true, token, user: { name: user.name, employee_id: user.employee_id, department: user.department, role: user.role } });
});

app.get('/api/profile', verifyToken, async (req, res) => {
    const { data: user, error } = await supabase.from('users').select('id, name, role, department, employee_id').eq('id', req.userId).single();
    if (error || !user) return res.status(500).json({ error: "User not found" });
    res.status(200).json(user);
});

app.post('/api/subscribe', verifyToken, async (req, res) => {
    const subscription = req.body;
    await supabase.from('users').update({ push_subscription: JSON.stringify(subscription) }).eq('id', req.userId);
    res.status(201).json({});
});

app.get('/api/dashboard', verifyToken, async (req, res) => {
    const [{ count: activeCirculars }, { count: upcomingMeetings }, { count: pendingTasks }, { count: recentNotices }] = await Promise.all([
        supabase.from('circulars').select('*', { count: 'exact', head: true }),
        supabase.from('meetings').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'Completed'),
        supabase.from('notices').select('*', { count: 'exact', head: true }).eq('status', 'Active')
    ]);
    res.status(200).json({ activeCirculars, upcomingMeetings, pendingTasks, recentNotices });
});

app.get('/api/profile/analytics', verifyToken, async (req, res) => {
    const [{ count: total_tasks }, { count: completed_tasks }, { count: active_notices }, { count: days_present }] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', req.userId),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', req.userId).eq('status', 'Completed'),
        supabase.from('notices').select('*', { count: 'exact', head: true }).eq('issued_to', req.userId),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('user_id', req.userId)
    ]);
    res.status(200).json({ total_tasks, completed_tasks, active_notices, days_present });
});

app.get('/api/users', verifyToken, async (req, res) => {
    const { data: rows, error } = await supabase.from('users').select('id, name, department, role');
    if (error) return res.status(500).json({ error: "Database error" });
    res.json(rows);
});

// CIRCULARS
const circularSchema = z.object({ title: z.string().min(1), content: z.string(), category: z.string(), priority: z.string() });

app.get('/api/circulars', verifyToken, async (req, res) => {
    const { data: rows, error } = await supabase.from('circulars').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows);
});

app.post('/api/circulars', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const { title, content, category, priority } = circularSchema.parse(req.body);
        const { data, error } = await supabase.from('circulars').insert([{ title, content, category, priority, created_by: req.userId }]).select().single();
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'CREATE', 'Circulars', data.id, null, data, req.ip);
        notifyUsers(supabase, null, \`New Circular: \${title}\`, content.substring(0, 50) + "...");
        res.json(data);
    } catch(e) { res.status(400).json({ error: e.message || "Failed to save circular" }); }
});

app.put('/api/circulars/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = circularSchema.parse(req.body);
        const { data: oldData } = await supabase.from('circulars').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('circulars').update(parsed).eq('id', req.params.id);
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Circulars', req.params.id, oldData, parsed, req.ip);
        res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/circulars/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { data: oldData } = await supabase.from('circulars').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('circulars').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'DELETE', 'Circulars', req.params.id, oldData, null, req.ip);
    res.json({ success: true });
});

// ANNOUNCEMENTS
const announcementSchema = z.object({ title: z.string().min(1), content: z.string(), type: z.string().optional() });

app.get('/api/announcements', verifyToken, async (req, res) => {
    const { data: rows, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows || []);
});

app.post('/api/announcements', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const { title, content, type } = announcementSchema.parse(req.body);
        const { data, error } = await supabase.from('announcements').insert([{ title, content, type: type||'Internal', created_by: req.userId }]).select().single();
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'CREATE', 'Announcements', data.id, null, data, req.ip);
        notifyUsers(supabase, null, \`Announcement: \${title}\`, content.substring(0, 50) + "...");
        res.json(data);
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/announcements/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = announcementSchema.parse(req.body);
        const { data: oldData } = await supabase.from('announcements').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('announcements').update(parsed).eq('id', req.params.id);
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Announcements', req.params.id, oldData, parsed, req.ip);
        res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/announcements/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { data: oldData } = await supabase.from('announcements').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('announcements').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'DELETE', 'Announcements', req.params.id, oldData, null, req.ip);
    res.json({ success: true });
});

// TASKS
const taskSchema = z.object({ title: z.string().min(1), description: z.string().optional(), assigned_to: z.string().or(z.number()), deadline: z.string().optional(), priority: z.string().optional(), status: z.string().optional() });

app.get('/api/tasks', verifyToken, async (req, res) => {
    let query = supabase.from('tasks').select('*, users:assigned_to(name)').order('deadline', { ascending: true });
    if (!adminRoles.includes(req.userRole)) query = query.eq('assigned_to', req.userId);
    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows.map(r => ({...r, assigned_name: r.users?.name, users: undefined})));
});

app.post('/api/tasks', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = taskSchema.parse(req.body);
        const { data, error } = await supabase.from('tasks').insert([{ ...parsed, created_by: req.userId, status: 'Pending' }]).select().single();
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'CREATE', 'Tasks', data.id, null, data, req.ip);
        notifyUsers(supabase, [parsed.assigned_to], \`New Task Assigned\`, \`You have a new task: \${parsed.title}\`);
        res.json(data);
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/tasks/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = taskSchema.parse(req.body);
        const { data: oldData } = await supabase.from('tasks').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('tasks').update(parsed).eq('id', req.params.id);
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Tasks', req.params.id, oldData, parsed, req.ip);
        res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { data: oldData } = await supabase.from('tasks').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'DELETE', 'Tasks', req.params.id, oldData, null, req.ip);
    res.json({ success: true });
});

app.put('/api/tasks/:id/status', verifyToken, async (req, res) => {
    const { status } = req.body;
    const { data: task } = await supabase.from('tasks').select('*').eq('id', req.params.id).single();
    if (!adminRoles.includes(req.userRole) && task.assigned_to !== req.userId) return res.status(403).json({ error: "Unauthorized." });
    
    const { error } = await supabase.from('tasks').update({ status }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Tasks', req.params.id, task, { status }, req.ip);
    res.json({ success: true, status });
});

// MEETINGS
const meetingSchema = z.object({ title: z.string().min(1), agenda: z.string().optional(), datetime: z.string().optional(), meeting_link: z.string().optional() });

app.get('/api/meetings', verifyToken, async (req, res) => {
    const { data: rows, error } = await supabase.from('meetings').select('*').order('datetime', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows || []);
});

app.post('/api/meetings', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = meetingSchema.parse(req.body);
        const { data, error } = await supabase.from('meetings').insert([{ ...parsed, created_by: req.userId }]).select().single();
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'CREATE', 'Meetings', data.id, null, data, req.ip);
        notifyUsers(supabase, null, \`Meeting Scheduled: \${parsed.title}\`, \`Scheduled for \${new Date(parsed.datetime).toLocaleString()}\`);
        res.json(data);
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/meetings/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = meetingSchema.parse(req.body);
        const { data: oldData } = await supabase.from('meetings').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('meetings').update(parsed).eq('id', req.params.id);
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Meetings', req.params.id, oldData, parsed, req.ip);
        res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/meetings/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { data: oldData } = await supabase.from('meetings').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('meetings').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'DELETE', 'Meetings', req.params.id, oldData, null, req.ip);
    res.json({ success: true });
});

// ATTENDANCE
const attendanceSchema = z.object({ user_id: z.string().or(z.number()), date: z.string().optional(), status: z.string(), remarks: z.string().optional() });

app.get('/api/attendance', verifyToken, async (req, res) => {
    let query = supabase.from('attendance').select('*, users:user_id(name)').order('date', { ascending: false });
    if (!adminRoles.includes(req.userRole)) query = query.eq('user_id', req.userId);
    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows.map(r => ({...r, name: r.users?.name, users: undefined})));
});

app.post('/api/attendance', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = attendanceSchema.parse(req.body);
        const date = parsed.date || new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase.from('attendance').select('id').eq('user_id', parsed.user_id).eq('date', date).single();
        if (existing) return res.status(400).json({ error: "Attendance already marked." });
        
        const { data, error } = await supabase.from('attendance').insert([{ user_id: parsed.user_id, date, status: parsed.status, remarks: parsed.remarks, check_in_time: new Date().toISOString() }]).select().single();
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'CREATE', 'Attendance', data.id, null, data, req.ip);
        res.json(data);
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/attendance/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = attendanceSchema.parse(req.body);
        const { data: oldData } = await supabase.from('attendance').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('attendance').update(parsed).eq('id', req.params.id);
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Attendance', req.params.id, oldData, parsed, req.ip);
        res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/attendance/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { data: oldData } = await supabase.from('attendance').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('attendance').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'DELETE', 'Attendance', req.params.id, oldData, null, req.ip);
    res.json({ success: true });
});

// NOTICES
const noticeSchema = z.object({ title: z.string().min(1), content: z.string(), issued_to: z.string().or(z.number()) });

app.get('/api/notices', verifyToken, async (req, res) => {
    let query = supabase.from('notices').select('*, users:issued_to(name)').order('created_at', { ascending: false });
    if (!adminRoles.includes(req.userRole)) query = query.eq('issued_to', req.userId);
    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows.map(r => ({...r, issued_to_name: r.users?.name, users: undefined})));
});

app.post('/api/notices', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = noticeSchema.parse(req.body);
        const refNum = \`NT-\${new Date().toISOString().split('T')[0].replace(/-/g, '')}-\${Math.floor(1000 + Math.random() * 9000)}\`;
        const { data, error } = await supabase.from('notices').insert([{ reference_number: refNum, title: parsed.title, content: parsed.content, issued_to: parsed.issued_to, created_by: req.userId, status: 'Active' }]).select().single();
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'CREATE', 'Notices', data.id, null, data, req.ip);
        notifyUsers(supabase, [parsed.issued_to], \`Official Notice Issued\`, \`Ref: \${refNum} - \${parsed.title}\`);
        res.json(data);
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/notices/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    try {
        const parsed = noticeSchema.parse(req.body);
        const { data: oldData } = await supabase.from('notices').select('*').eq('id', req.params.id).single();
        const { error } = await supabase.from('notices').update(parsed).eq('id', req.params.id);
        if (error) throw error;
        await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Notices', req.params.id, oldData, parsed, req.ip);
        res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/notices/:id', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { data: oldData } = await supabase.from('notices').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('notices').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'DELETE', 'Notices', req.params.id, oldData, null, req.ip);
    res.json({ success: true });
});

app.put('/api/notices/:id/status', verifyToken, async (req, res) => {
    if (!adminRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    const { status } = req.body;
    const { data: oldData } = await supabase.from('notices').select('*').eq('id', req.params.id).single();
    const { error } = await supabase.from('notices').update({ status }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Notices', req.params.id, oldData, { status }, req.ip);
    res.json({ success: true, status });
});

app.put('/api/notices/:id/response', verifyToken, async (req, res) => {
    const { response } = req.body;
    const { data: oldData } = await supabase.from('notices').select('*').eq('id', req.params.id).single();
    const { data, error } = await supabase.from('notices').update({ employee_response: response, status: 'Pending Review' }).eq('id', req.params.id).eq('issued_to', req.userId).select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(403).json({ error: "Unauthorized." });
    await writeAuditLog(req.userId, req.userRole, 'UPDATE', 'Notices', req.params.id, oldData, { employee_response: response, status: 'Pending Review' }, req.ip);
    res.json({ success: true });
});

app.get('*', (req, res) => {
    const indexPath = path.resolve(servePath, 'index.html');
    if (!fs_module.existsSync(indexPath)) return res.status(404).send("Frontend files missing.");
    res.sendFile(indexPath);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(\`INTRASPHERE System Online: Port \${PORT}\`);
    });
}
module.exports = app;
`;

fs.writeFileSync('server.js', code);
