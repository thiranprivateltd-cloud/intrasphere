const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');
const modalHTML = `
<!-- Edit Modal -->
<div id="edit-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center;">
    <div class="glass-card" style="width: 90%; max-width: 500px; padding: 2rem; position: relative;">
        <button id="close-modal" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
        <h3 id="edit-modal-title">Edit Item</h3>
        <form id="edit-form">
            <input type="hidden" id="edit-id">
            <input type="hidden" id="edit-type">
            <div class="input-group">
                <label>Title</label>
                <input type="text" id="edit-title" required>
            </div>
            <div class="input-group" id="edit-content-group">
                <label>Content</label>
                <textarea id="edit-content" rows="4" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 8px; color: var(--text-main);"></textarea>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Save Changes</button>
        </form>
    </div>
</div>
`;
// Insert modal right before </body>
if (!code.includes('id="edit-modal"')) {
    code = code.replace('</body>', modalHTML + '\n</body>');
}
const outPath = 'C:\\\\Users\\\\gsvar\\\\.gemini\\\\antigravity\\\\brain\\\\4b0ee267-f616-439f-88dd-2d7e551aefa6\\\\index.html';
fs.writeFileSync(outPath, code);
console.log('index.html updated!');
const fs = require('fs');
let code = fs.readFileSync('public/js/main.js', 'utf8');
const adminRoleString = "['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin']";
const crudLogic = `
    // --- CRUD Edit/Delete Logic ---
    const editModal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('close-modal');
    const editForm = document.getElementById('edit-form');
    
    if(closeBtn) closeBtn.onclick = () => editModal.style.display = 'none';
    
    window.openEditModal = (id, type, title, content) => {
        document.getElementById('edit-id').value = id;
        document.getElementById('edit-type').value = type;
        document.getElementById('edit-title').value = title;
        if(content) {
            document.getElementById('edit-content').value = content;
            document.getElementById('edit-content-group').style.display = 'block';
        } else {
            document.getElementById('edit-content').value = '';
            document.getElementById('edit-content-group').style.display = 'none';
        }
        editModal.style.display = 'flex';
    };
    
    window.deleteItem = async (id, type) => {
        if(confirm('Are you sure you want to delete this item?')) {
            const res = await apiRequest('/api/' + type + '/' + id, 'DELETE');
            if(res) {
                showToast('Deleted successfully!', 'success');
                if(type === 'circulars') fetchCirculars();
                if(type === 'announcements') fetchAnnouncements();
                if(type === 'tasks') fetchTasks();
                if(type === 'meetings') fetchMeetings();
                if(type === 'attendance') fetchAttendance();
                if(type === 'notices') fetchNotices();
            }
        }
    };
    
    if(editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const type = document.getElementById('edit-type').value;
            const title = document.getElementById('edit-title').value;
            const content = document.getElementById('edit-content').value;
            
            const payload = { title };
            if (content) payload.content = content;
            // Also map content to description/agenda if needed for tasks/meetings
            if (type === 'tasks') payload.description = content;
            if (type === 'meetings') payload.agenda = content;
            
            const res = await apiRequest('/api/' + type + '/' + id, 'PUT', payload);
            if(res) {
                showToast('Updated successfully!', 'success');
                editModal.style.display = 'none';
                if(type === 'circulars') fetchCirculars();
                if(type === 'announcements') fetchAnnouncements();
                if(type === 'tasks') fetchTasks();
                if(type === 'meetings') fetchMeetings();
                if(type === 'attendance') fetchAttendance();
                if(type === 'notices') fetchNotices();
            }
        };
    }
    
    function generateActionButtons(id, type, title, content) {
        const userRole = JSON.parse(localStorage.getItem('intrasphere_user') || '{}').role;
        const canManage = ${adminRoleString}.includes(userRole);
        if(!canManage) return '';
        
        return \`
            <div style="margin-top: 5px;">
                <button onclick="openEditModal(\${id}, '\${type}', '\${title.replace(/'/g, "\\'")}', '\${(content || '').replace(/'/g, "\\'").replace(/\\n/g, " ")}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.8rem; margin-right:10px;"><i class="fa-solid fa-edit"></i> Edit</button>
                <button onclick="deleteItem(\${id}, '\${type}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        \`;
    }
`;
// Remove original setupForm declarations since we make it dynamic
code = code.replace(/const setupForm = [\s\S]*?if \(formId === 'attendance-form'\) form\.style\.display = 'block';\s+\}/, `
    const setupForm = (formId, url, successMsg, callback) => {
        const form = document.getElementById(formId);
        if (form) {
            /* Handled dynamically by updateFormPermissions */
`);
// Add the update permissions logic and CRUD inside initPortal
code = code.replace('function initPortal(user) {', `
    function updateFormPermissions() {
        const userRole = JSON.parse(localStorage.getItem('intrasphere_user') || '{}').role;
        const allowedRoles = {
            'circular-form': ${adminRoleString},
            'announcement-form': ${adminRoleString},
            'task-form': ${adminRoleString},
            'meeting-form': ${adminRoleString},
            'attendance-form': ${adminRoleString},
            'notice-form': ${adminRoleString}
        };
        Object.keys(allowedRoles).forEach(formId => {
            const form = document.getElementById(formId);
            if(form) {
                const canAccess = allowedRoles[formId].includes(userRole);
                let msgId = formId.split('-')[0] + '-unauth-msg';
                if (formId === 'circular-form') msgId = 'circ-unauth-msg';
                if (formId === 'announcement-form') msgId = 'ann-unauth-msg';
                if (formId === 'meeting-form') msgId = 'meet-unauth-msg';
                if (formId === 'attendance-form') msgId = 'att-unauth-msg';
                const msgEl = document.getElementById(msgId);
                if (!canAccess) {
                    form.style.display = 'none';
                    if (msgEl) msgEl.style.display = 'block';
                } else {
                    form.style.display = 'block';
                    if (msgEl) msgEl.style.display = 'none';
                }
            }
        });
        
        // Ensure setupForm hooks are re-initialized or bound
        setupForm('circular-form', '/api/circulars', 'Circular published successfully!', fetchCirculars);
        setupForm('announcement-form', '/api/announcements', 'Announcement broadcasted!', fetchAnnouncements);
        setupForm('task-form', '/api/tasks', 'Task assigned successfully!', fetchTasks);
        setupForm('meeting-form', '/api/meetings', 'Meeting scheduled successfully!', fetchMeetings);
        setupForm('attendance-form', '/api/attendance', 'Attendance marked!', fetchAttendance);
        setupForm('notice-form', '/api/notices', 'Notice issued successfully!', fetchNotices);
    }
${crudLogic}
    function initPortal(user) {
        updateFormPermissions();
`);
// Remove old global setupForm calls
const setupRegex = /setupForm\('circular-form'[\s\S]*?fetchNotices\);/g;
code = code.replace(setupRegex, '');
// Inject action buttons into HTML map generators
code = code.replace(/<strong>\$\{c\.title\}<\/strong>/, `<strong>\${c.title}</strong>\${generateActionButtons(c.id, 'circulars', c.title, c.content)}`);
code = code.replace(/<strong>\$\{a\.title\}<\/strong>/, `<strong>\${a.title}</strong>\${generateActionButtons(a.id, 'announcements', a.title, a.content)}`);
code = code.replace(/<strong>\$\{t\.title\}<\/strong>/, `<strong>\${t.title}</strong>\${generateActionButtons(t.id, 'tasks', t.title, t.description)}`);
code = code.replace(/<strong>\$\{m\.title\}<\/strong>/, `<strong>\${m.title}</strong>\${generateActionButtons(m.id, 'meetings', m.title, m.agenda)}`);
code = code.replace(/<strong>\$\{n\.title\}<\/strong>/, `<strong>\${n.title}</strong>\${generateActionButtons(n.id, 'notices', n.title, n.content)}`);
// Save updated main.js
const outPath = 'C:\\\\Users\\\\gsvar\\\\.gemini\\\\antigravity\\\\brain\\\\4b0ee267-f616-439f-88dd-2d7e551aefa6\\\\main.js';
fs.writeFileSync(outPath, code);
console.log('main.js updated!');
const fs = require('fs');
const path = require('path');
let code = fs.readFileSync('server.js', 'utf8');
// Standardize permissions
const adminRoleString = "['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin']";
code = code.replace(/const allowedRoles = \[.*?\];/g, `const allowedRoles = ${adminRoleString};`);
code = code.replace(/const adminRoles = \[.*?\];/g, `const adminRoles = ${adminRoleString};`);
// Function to inject DELETE and PUT routes after POST routes
function injectRoutes(code, moduleName, tableName) {
    const postRouteRegex = new RegExp(`app\\.post\\('/api/${moduleName}',.*?res\\.json\\(data\\);\\s*\\}\\);`, 's');
    const match = code.match(postRouteRegex);
    
    if (match) {
        const routes = `
app.put('/api/${moduleName}/:id', verifyToken, async (req, res) => {
    const allowedRoles = ${adminRoleString};
    if (!allowedRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    
    const { error } = await supabase.from('${tableName}').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});
app.delete('/api/${moduleName}/:id', verifyToken, async (req, res) => {
    const allowedRoles = ${adminRoleString};
    if (!allowedRoles.includes(req.userRole)) return res.status(403).json({ error: "Unauthorized." });
    
    const { error } = await supabase.from('${tableName}').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});
`;
        code = code.replace(match[0], match[0] + '\n' + routes);
    }
    return code;
}
code = injectRoutes(code, 'circulars', 'circulars');
code = injectRoutes(code, 'announcements', 'announcements');
code = injectRoutes(code, 'tasks', 'tasks');
code = injectRoutes(code, 'meetings', 'meetings');
code = injectRoutes(code, 'attendance', 'attendance');
code = injectRoutes(code, 'notices', 'notices');
const outPath = 'C:\\\\Users\\\\gsvar\\\\.gemini\\\\antigravity\\\\brain\\\\4b0ee267-f616-439f-88dd-2d7e551aefa6\\\\server.js';
fs.writeFileSync(outPath, code);
console.log('Server updated!');
