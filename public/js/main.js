document.addEventListener('DOMContentLoaded', () => {
    // Clock setup
    const updateClocks = () => {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const currentDateEl = document.getElementById('current-date');
        const currentTimeEl = document.getElementById('current-time');
        const headerClockEl = document.getElementById('header-clock');
        if(currentDateEl) currentDateEl.textContent = dateString;
        if(currentTimeEl) currentTimeEl.textContent = timeString;
        if(headerClockEl) headerClockEl.textContent = timeString;
    };
    setInterval(updateClocks, 1000);
    updateClocks();
    // Elements
    const loginView = document.getElementById('login-view');
    const portalView = document.getElementById('portal-view');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    // Check if already logged in
    const token = localStorage.getItem('intrasphere_token');
    const userStr = localStorage.getItem('intrasphere_user');
    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            initPortal(user);
        } catch (e) {
            console.error("Session restore failed", e);
            localStorage.clear();
        }
    }
    // Login Logic
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeIdEl = document.getElementById('employee-id');
            const passwordEl = document.getElementById('password');
            const departmentEl = document.getElementById('department-select');
            
            if(!employeeIdEl || !passwordEl || !departmentEl) return;
            const employeeId = employeeIdEl.value;
            const password = passwordEl.value;
            const department = departmentEl.value;
            
            if(loginError) loginError.textContent = "";
            const btn = loginForm.querySelector('button[type="submit"]');
            if(btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, password: password })
                });
                const data = await response.json();
                if (response.ok) {
                    if (data.user.department !== department && department !== 'Leadership') {
                        if(loginError) loginError.textContent = "Department mismatch for this Employee ID.";
                        if(btn) btn.innerHTML = 'Access Workspace <i class="fa-solid fa-arrow-right"></i>';
                        return;
                    }
                    localStorage.setItem('intrasphere_token', data.token);
                    localStorage.setItem('intrasphere_user', JSON.stringify(data.user));
                    initPortal(data.user);
                } else {
                    if(loginError) loginError.textContent = data.error || "Authentication failed.";
                    if(btn) btn.innerHTML = 'Access Workspace <i class="fa-solid fa-arrow-right"></i>';
                }
            } catch (err) {
                console.error("Login Error:", err);
                if(loginError) loginError.textContent = "System error. Could not connect to internal server.";
                if(btn) btn.innerHTML = 'Access Workspace <i class="fa-solid fa-arrow-right"></i>';
            }
        });
    }
    // Initialize Portal After Login
    
    function updateFormPermissions() {
        const userRole = JSON.parse(localStorage.getItem('intrasphere_user') || '{}').role;
        const allowedRoles = {
            'circular-form': ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'],
            'announcement-form': ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'],
            'task-form': ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'],
            'meeting-form': ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'],
            'attendance-form': ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'],
            'notice-form': ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin']
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
        setupForm('attendance-form', '/api/attendance', 'Attendance marked successfully!', fetchAttendance);
        setupForm('notice-form', '/api/notices', 'Notice issued successfully!', fetchNotices);
    }
    const escapeHTML = (str) => {
        if (!str || typeof str !== 'string') return str || '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    };
    // --- CRUD Edit/Delete Logic ---
    const editModal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('close-modal');
    const editForm = document.getElementById('edit-form');
    
    if(closeBtn) closeBtn.onclick = () => editModal.style.display = 'none';
    
    window.openEditModal = (id, type, title, content) => {
    window.openEditModal = (id, type, dataEncoded) => {
        const data = JSON.parse(decodeURIComponent(dataEncoded));
        document.getElementById('edit-id').value = id;
        document.getElementById('edit-type').value = type;
        document.getElementById('edit-title').value = title;
        if(content) {
            document.getElementById('edit-content').value = content;
        
        ['edit-title-group', 'edit-content-group', 'edit-category-group', 'edit-priority-group', 'edit-assignee-group', 'edit-deadline-group', 'edit-status-group', 'edit-link-group'].forEach(gid => {
            const el = document.getElementById(gid);
            if(el) el.style.display = 'none';
        });
        if(type === 'announcements' || type === 'notices') {
            document.getElementById('edit-title-group').style.display = 'block';
            document.getElementById('edit-content-group').style.display = 'block';
        } else {
            document.getElementById('edit-content').value = '';
            document.getElementById('edit-content-group').style.display = 'none';
            document.getElementById('edit-title').value = data.title || '';
            document.getElementById('edit-content').value = data.content || '';
        } else if(type === 'circulars') {
            document.getElementById('edit-title-group').style.display = 'block';
            document.getElementById('edit-content-group').style.display = 'block';
            document.getElementById('edit-category-group').style.display = 'block';
            document.getElementById('edit-priority-group').style.display = 'block';
            document.getElementById('edit-title').value = data.title || '';
            document.getElementById('edit-content').value = data.content || '';
            document.getElementById('edit-category').value = data.category || '';
            document.getElementById('edit-priority').value = data.priority || '';
        } else if(type === 'tasks') {
            document.getElementById('edit-title-group').style.display = 'block';
            document.getElementById('edit-content-group').style.display = 'block';
            document.getElementById('edit-assignee-group').style.display = 'block';
            document.getElementById('edit-deadline-group').style.display = 'block';
            document.getElementById('edit-priority-group').style.display = 'block';
            document.getElementById('edit-status-group').style.display = 'block';
            document.getElementById('edit-title').value = data.title || '';
            document.getElementById('edit-content').value = data.description || '';
            document.getElementById('edit-assignee').value = data.assigned_to || '';
            if(data.deadline) document.getElementById('edit-deadline').value = new Date(new Date(data.deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('edit-priority').value = data.priority || '';
            document.getElementById('edit-status').value = data.status || '';
        } else if(type === 'meetings') {
            document.getElementById('edit-title-group').style.display = 'block';
            document.getElementById('edit-content-group').style.display = 'block';
            document.getElementById('edit-deadline-group').style.display = 'block';
            document.getElementById('edit-link-group').style.display = 'block';
            document.getElementById('edit-title').value = data.title || '';
            document.getElementById('edit-content').value = data.agenda || '';
            if(data.datetime) document.getElementById('edit-deadline').value = new Date(new Date(data.datetime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('edit-link').value = data.meeting_link || '';
        } else if(type === 'attendance') {
            document.getElementById('edit-assignee-group').style.display = 'block';
            document.getElementById('edit-deadline-group').style.display = 'block';
            document.getElementById('edit-status-group').style.display = 'block';
            document.getElementById('edit-content-group').style.display = 'block';
            document.getElementById('edit-assignee').value = data.user_id || '';
            if(data.date) document.getElementById('edit-deadline').value = data.date + 'T00:00';
            document.getElementById('edit-status').value = data.status || '';
            document.getElementById('edit-content').value = data.remarks || '';
        }
        editModal.style.display = 'flex';
    };
    
    window.deleteItem = async (id, type) => {
        if(confirm('Are you sure you want to delete this item?')) {
            const res = await apiRequest('/api/' + type + '/' + id, 'DELETE');
            if(res) {
                showToast('Deleted successfully!', 'success');
                alert('Deleted successfully!');
                if(type === 'circulars') fetchCirculars();
                if(type === 'announcements') fetchAnnouncements();
                if(type === 'tasks') fetchTasks();
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
            const payload = {};
            if(type === 'announcements' || type === 'notices') {
                payload.title = document.getElementById('edit-title').value;
                payload.content = document.getElementById('edit-content').value;
            } else if(type === 'circulars') {
                payload.title = document.getElementById('edit-title').value;
                payload.content = document.getElementById('edit-content').value;
                payload.category = document.getElementById('edit-category').value;
                payload.priority = document.getElementById('edit-priority').value;
            } else if(type === 'tasks') {
                payload.title = document.getElementById('edit-title').value;
                payload.description = document.getElementById('edit-content').value;
                payload.assigned_to = document.getElementById('edit-assignee').value;
                payload.deadline = document.getElementById('edit-deadline').value;
                payload.priority = document.getElementById('edit-priority').value;
                payload.status = document.getElementById('edit-status').value;
            } else if(type === 'meetings') {
                payload.title = document.getElementById('edit-title').value;
                payload.agenda = document.getElementById('edit-content').value;
                payload.datetime = document.getElementById('edit-deadline').value;
                payload.meeting_link = document.getElementById('edit-link').value;
            } else if(type === 'attendance') {
                payload.user_id = document.getElementById('edit-assignee').value;
                payload.date = document.getElementById('edit-deadline').value.split('T')[0];
                payload.status = document.getElementById('edit-status').value;
                payload.remarks = document.getElementById('edit-content').value;
            }
            
            const res = await apiRequest('/api/' + type + '/' + id, 'PUT', payload);
            if(res) {
                showToast('Updated successfully!', 'success');
                alert('Updated successfully!');
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
    function generateActionButtons(id, type, data) {
        const userRole = JSON.parse(localStorage.getItem('intrasphere_user') || '{}').role;
        const canManage = ['CEO', 'COO', 'Project Manager & Overall Execution Lead', 'HR Admin'].includes(userRole);
        if(!canManage) return '';
        
        const dataEncoded = encodeURIComponent(JSON.stringify(data));
        return `
            <div style="margin-top: 5px;">
                <button onclick="openEditModal(${id}, '${type}', '${title.replace(/'/g, "\'")}', '${(content || '').replace(/'/g, "\'").replace(/\n/g, " ")}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.8rem; margin-right:10px;"><i class="fa-solid fa-edit"></i> Edit</button>
                <button onclick="openEditModal(${id}, '${type}', '${dataEncoded}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.8rem; margin-right:10px;"><i class="fa-solid fa-edit"></i> Edit</button>
                <button onclick="deleteItem(${id}, '${type}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        `;
    }
    function initPortal(user) {
        updateFormPermissions();
        // Switch Views
        if(loginView) loginView.classList.remove('active-view');
        if(portalView) portalView.classList.add('active-view');
        // Set Theme
        document.body.setAttribute('data-theme', user.department);
        // Populate User Info
        const userNameEl = document.getElementById('user-name');
        const userRoleEl = document.getElementById('user-role');
        const userDeptBadgeEl = document.getElementById('user-dept-badge');
        const welcomeMessageEl = document.getElementById('welcome-message');
        if(userNameEl) userNameEl.textContent = user.name;
        if(userRoleEl) userRoleEl.textContent = user.role;
        if(userDeptBadgeEl) userDeptBadgeEl.textContent = user.department;
        if(welcomeMessageEl) welcomeMessageEl.textContent = `Welcome back, ${user.name.split(' ')[0]}`;
        // Fetch Initial Data
        fetchDashboardStats();
        fetchUsers();
        fetchCirculars();
        fetchAnnouncements();
        fetchTasks();
        fetchMeetings();
        fetchAttendance();
        fetchNotices();
        // Push Notifications Registration
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.register('/sw.js').then(async (registration) => {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFL8eI5RoAlJI';
                    
                    const urlBase64ToUint8Array = (base64String) => {
                        const padding = '='.repeat((4 - base64String.length % 4) % 4);
                        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
                        const rawData = window.atob(base64);
                        const outputArray = new Uint8Array(rawData.length);
                        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
                        return outputArray;
                    };
                    try {
                        const subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                        });
                        await fetch('/api/subscribe', {
                            method: 'POST',
                            headers: headers(),
                            body: JSON.stringify(subscription)
                        });
                    } catch(e) {
                        console.warn("Push subscription failed", e);
                    }
                }
            }).catch(console.error);
        }
    }
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('intrasphere_token');
            localStorage.removeItem('intrasphere_user');
            window.location.reload();
        });
    }
    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-links li');
    const modules = document.querySelectorAll('.module');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            modules.forEach(m => m.classList.remove('active-module'));
            const targetModule = document.getElementById(targetId);
            if(targetModule) targetModule.classList.add('active-module');
        });
    });
    // Helper for headers
    function headers() {
        return {
            'Content-Type': 'application/json',
            'x-access-token': localStorage.getItem('intrasphere_token')
        };
    }
    // API calls with improved error handling and feedback
    async function apiPost(url, payload, successMsg) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                if (successMsg) alert(successMsg);
                return data;
            } else {
                alert("Operation failed: " + (data.error || "Unknown error"));
                return null;
            }
        } catch (e) {
            console.error("API POST Error:", e);
            alert("Connection error. Please try again.");
            return null;
        }
    }
    async function apiGet(url) {
        try {
            const res = await fetch(url, { headers: headers() });
            if (res.ok) return await res.json();
            return null;
        } catch (e) {
            console.error("API GET Error:", e);
            return null;
        }
    }
    async function apiRequest(url, method, payload = null) {
        try {
            const options = { method: method, headers: headers() };
            if (payload) options.body = JSON.stringify(payload);
            const res = await fetch(url, options);
            if (res.ok) return await res.json();
            const data = await res.json();
            alert("Error: " + (data.error || "Action failed"));
            return null;
        } catch (e) {
            console.error("API Error:", e);
            alert("Connection error.");
            return null;
        }
    }
    // Fetch Dashboard Stats and Render Charts
    async function fetchDashboardStats() {
        const data = await apiGet('/api/dashboard');
        if (data) {
            if(document.getElementById('stat-circulars')) document.getElementById('stat-circulars').textContent = data.activeCirculars || 0;
            if(document.getElementById('stat-meetings')) document.getElementById('stat-meetings').textContent = data.upcomingMeetings || 0;
            if(document.getElementById('stat-tasks')) document.getElementById('stat-tasks').textContent = data.pendingTasks || 0;
            if(document.getElementById('stat-notices')) document.getElementById('stat-notices').textContent = data.recentNotices || 0;
            
            const profData = await fetchProfileAnalytics();
            renderCharts(data, profData);
        }
    }
    async function fetchProfileAnalytics() {
        const userStr = localStorage.getItem('intrasphere_user');
        if(!userStr) return null;
        const user = JSON.parse(userStr);
        
        if(document.getElementById('prof-name')) document.getElementById('prof-name').textContent = user.name;
        if(document.getElementById('prof-role')) document.getElementById('prof-role').textContent = user.role;
        if(document.getElementById('prof-dept')) document.getElementById('prof-dept').textContent = user.department;
        if(document.getElementById('prof-id')) document.getElementById('prof-id').textContent = user.employee_id;
        const data = await apiGet('/api/profile/analytics');
        if (data) {
            if(document.getElementById('prof-stat-tasks')) document.getElementById('prof-stat-tasks').textContent = data.completed_tasks || 0;
            const attRate = Math.min(100, Math.round(((data.days_present || 0) / 22) * 100));
            if(document.getElementById('prof-stat-att')) document.getElementById('prof-stat-att').textContent = `${attRate}%`;
            if(document.getElementById('prof-stat-notices')) document.getElementById('prof-stat-notices').textContent = data.active_notices || 0;
            return data;
        }
        return null;
    }
    async function fetchUsers() {
        const users = await apiGet('/api/users');
        if (users) {
            const selects = ['task-assignee', 'att-user', 'notice-user'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    let html = '<option value="" disabled selected>Select...</option>';
                    users.forEach(u => {
                        html += `<option value="${u.id}">${u.name} (${u.role} - ${u.department})</option>`;
                    });
                    el.innerHTML = html;
                }
            });
        }
    }
    // Forms handling
    
    function setupForm(formId, url, successMsg, callback) {
        const form = document.getElementById(formId);
        if (form) {
            /* Handled dynamically by updateFormPermissions */
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('button');
                const originalBtnText = btn ? btn.innerHTML : "Submit";
                if (btn) btn.innerHTML = "Processing...";
                const formData = new FormData(form);
                const payload = {};
                
                // Custom mapping for specific forms
                if (formId === 'circular-form') {
                    payload.title = document.getElementById('circ-title').value;
                    payload.content = document.getElementById('circ-content').value;
                    payload.category = document.getElementById('circ-category').value;
                    payload.priority = document.getElementById('circ-priority').value;
                    payload.departments = document.getElementById('circ-depts').value;
                } else if (formId === 'announcement-form') {
                    payload.title = document.getElementById('ann-title').value;
                    payload.content = document.getElementById('ann-content').value;
                    payload.type = document.getElementById('ann-type').value;
                } else if (formId === 'task-form') {
                    payload.title = document.getElementById('task-title').value;
                    payload.description = document.getElementById('task-desc').value;
                    payload.deadline = document.getElementById('task-deadline').value;
                    payload.assigned_to = document.getElementById('task-assignee').value;
                } else if (formId === 'meeting-form') {
                    payload.title = document.getElementById('meet-title').value;
                    payload.agenda = document.getElementById('meet-agenda').value;
                    payload.datetime = document.getElementById('meet-datetime').value;
                    payload.departments = document.getElementById('meet-depts').value;
                    payload.meeting_link = document.getElementById('meet-link').value;
                } else if (formId === 'attendance-form') {
                    payload.status = document.getElementById('att-status').value;
                    payload.target_user_id = document.getElementById('att-user').value;
                    payload.target_date = document.getElementById('att-date').value;
                } else if (formId === 'notice-form') {
                    payload.title = document.getElementById('notice-title').value;
                    payload.content = document.getElementById('notice-content').value;
                    payload.issued_to = document.getElementById('notice-user').value;
                }
                const result = await apiPost(url, payload, successMsg);
                if (btn) btn.innerHTML = originalBtnText;
                if (result) {
                    form.reset();
                    if (callback) callback();
                    fetchDashboardStats(); // Refresh stats
                }
            });
        }
    };
    
    // List fetching logic
    async function fetchCirculars() {
        const list = document.getElementById('circulars-list');
        if(!list) return;
        const data = await apiGet('/api/circulars');
        if (data) {
            list.innerHTML = data.length === 0 ? '<li>No active circulars.</li>' : data.map(c => `
                <li style="display:flex; flex-direction:column; gap:5px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${c.title}</strong>${generateActionButtons(c.id, 'circulars', c.title, c.content)}
                        <strong>${escapeHTML(c.title)}</strong>${generateActionButtons(c.id, 'circulars', c)}
                        <span class="tag tag-internal">${c.priority}</span>
                    </div>
                    <p style="color:var(--text-muted); font-size:0.8rem;">${c.content}</p>
                    <p style="color:var(--text-muted); font-size:0.8rem;">${escapeHTML(c.content)}</p>
                    <small style="color:var(--primary);">${new Date(c.created_at).toLocaleString()}</small>
                </li>
            `).join('');
            const html = data.length === 0 ? '<li>No active announcements.</li>' : data.map(a => `
                <li style="margin-bottom:10px;">
                    <span class="tag ${a.type === 'Emergency' ? 'tag-emergency' : 'tag-internal'}">${a.type}</span> 
                    <strong>${a.title}</strong>${generateActionButtons(a.id, 'announcements', a.title, a.content)}
                    <p style="font-size:0.8rem; margin-top:5px; color:var(--text-muted);">${a.content}</p>
                    <strong>${escapeHTML(a.title)}</strong>${generateActionButtons(a.id, 'announcements', a)}
                    <p style="font-size:0.8rem; margin-top:5px; color:var(--text-muted);">${escapeHTML(a.content)}</p>
                </li>
            `).join('');
            if(list) list.innerHTML = html;
            if(dashList) dashList.innerHTML = html;
        }
    }
    async function fetchTasks() {
        const list = document.getElementById('tasks-list');
        if(!list) return;
        const data = await apiGet('/api/tasks');
        if (data) {
            const userStr = localStorage.getItem('intrasphere_user');
            if(!userStr) return;
            const userRole = JSON.parse(userStr).role;
            const canUpdateTask = ['CEO', 'COO', 'Project Manager & Overall Execution Lead'].includes(userRole);
            
            list.innerHTML = data.length === 0 ? '<li>No tasks found.</li>' : data.map(t => `
                <li style="display:flex; flex-direction:column; gap:5px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${t.title}</strong>${generateActionButtons(t.id, 'tasks', t.title, t.description)}
                        <strong>${escapeHTML(t.title)}</strong>${generateActionButtons(t.id, 'tasks', t)}
                        <div>
                            <span class="tag tag-internal">${t.status}</span>
                            ${canUpdateTask ? `<button class="btn-primary toggle-task" data-id="${t.id}" data-status="${t.status === 'Completed' ? 'Pending' : 'Completed'}" style="padding: 4px 8px; font-size: 0.7rem; margin-left: 10px;">Mark ${t.status === 'Completed' ? 'Pending' : 'Completed'}</button>` : ''}
            list.innerHTML = data.length === 0 ? '<li>No upcoming meetings.</li>' : data.map(m => `
                <li style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${m.title}</strong>${generateActionButtons(m.id, 'meetings', m.title, m.agenda)}
                        <strong>${escapeHTML(m.title)}</strong>${generateActionButtons(m.id, 'meetings', m)}
                        <p style="color:var(--text-muted); font-size:0.8rem;">${new Date(m.datetime).toLocaleString()}</p>
                    </div>
                    ${m.meeting_link ? `<a href="${m.meeting_link}" target="_blank" class="btn-primary" style="padding: 6px 12px; font-size:0.8rem; text-decoration:none; border-radius:6px; display:inline-block;"><i class="fa-solid fa-video"></i> Join Now</a>` : ''}
                </li>
            `).join('');
        }
    }
    async function fetchAttendance() {
        const list = document.getElementById('attendance-list');
        if(!list) return;
        const data = await apiGet('/api/attendance');
        if (data) {
            list.innerHTML = data.length === 0 ? '<li>No attendance records.</li>' : data.map(a => `
                <li style="display:flex; justify-content:space-between;">
                    <span>${a.name}</span>
                    <span><span class="tag ${a.status === 'Present' ? 'tag-internal' : 'tag-emergency'}">${a.status}</span> ${a.date}</span>
                    <span>${escapeHTML(a.name)}</span>
                    <span style="display:flex; align-items:center; gap:10px;"><span class="tag ${a.status === 'Present' ? 'tag-internal' : 'tag-emergency'}">${a.status}</span> ${a.date} ${generateActionButtons(a.id, 'attendance', a)}</span>
                </li>
            `).join('');
        }
                <li style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong>${n.title}</strong>${generateActionButtons(n.id, 'notices', n.title, n.content)} <span style="color:var(--text-muted); font-size:0.75rem;">(${n.reference_number})</span>
                            <p style="color:var(--text-muted); font-size:0.8rem; margin-top:2px;">${n.content}</p>
                            <small style="color:var(--danger); display:block; margin-top:2px;">Issued to: ${n.issued_to_name}</small>
                            <strong>${escapeHTML(n.title)}</strong>${generateActionButtons(n.id, 'notices', n)} <span style="color:var(--text-muted); font-size:0.75rem;">(${escapeHTML(n.reference_number)})</span>
                            <p style="color:var(--text-muted); font-size:0.8rem; margin-top:2px;">${escapeHTML(n.content)}</p>
                            <small style="color:var(--danger); display:block; margin-top:2px;">Issued to: ${escapeHTML(n.issued_to_name)}</small>
                        </div>
                        <span class="tag tag-emergency">${n.status}</span>
                    </div>
                    
                    ${n.employee_response ? `
                        <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; margin-top: 5px; font-size: 0.8rem;">
                            <strong>Employee Response:</strong> ${n.employee_response}
                        </div>
                    ` : ''}
                    <div style="margin-top: 5px; display:flex; gap: 10px; align-items:center;">
                        ${canManage ? `
                            <select class="notice-status-select" data-id="${n.id}" style="padding:4px; font-size:0.8rem; background: rgba(0,0,0,0.2); border:1px solid var(--border); color:var(--text-main);">
                                <option value="Active" ${n.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="Pending Review" ${n.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
                                <option value="Resolved" ${n.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                <option value="Escalated" ${n.status === 'Escalated' ? 'selected' : ''}>Escalated</option>
                            </select>
                        ` : `
                            ${(!n.employee_response && n.status === 'Active') ? `
                                <div style="display:flex; gap:5px; width:100%;">
                                    <input type="text" id="resp-${n.id}" placeholder="Type your response..." style="flex:1; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.2); border:1px solid var(--border); color:var(--text-main);">
                                    <button class="btn-primary submit-resp" data-id="${n.id}" style="padding:4px 8px; font-size:0.8rem;">Submit</button>
                                </div>
                            ` : ''}
                        `}
                    </div>
                </li>
            `).join('');
            document.querySelectorAll('.notice-status-select').forEach(sel => {
                sel.addEventListener('change', async (e) => {
                    await fetch(`/api/notices/${e.target.dataset.id}/status`, {
                        method: 'PUT',
                        headers: headers(),
                        body: JSON.stringify({ status: e.target.value })
                    });
                    fetchNotices();
                });
            });
            document.querySelectorAll('.submit-resp').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    const respEl = document.getElementById(`resp-${id}`);
                    const resp = respEl ? respEl.value : "";
                    if(!resp) return;
                    const res = await fetch(`/api/notices/${id}/response`, {
                        method: 'PUT',
                        headers: headers(),
                        body: JSON.stringify({ response: resp })
                    });
                    if(res.ok) fetchNotices();
                });
            });
        }
    }
    // --- Phase 4: Charts ---
    let activityChartInstance = null;
    let performanceChartInstance = null;
    function renderCharts(dashData, profData) {
        if (typeof Chart === 'undefined') return;
        Chart.defaults.color = '#9CA3AF';
        Chart.defaults.font.family = "'Inter', sans-serif";
        const actCtx = document.getElementById('activityChart');
        if(actCtx) {
            if(activityChartInstance) activityChartInstance.destroy();
            activityChartInstance = new Chart(actCtx, {
                type: 'bar',
                data: {
                    labels: ['Circulars', 'Meetings', 'Tasks', 'Notices'],
                    datasets: [{
                        label: 'Active Items',
                        data: [dashData.activeCirculars || 0, dashData.upcomingMeetings || 0, dashData.pendingTasks || 0, dashData.recentNotices || 0],
                        backgroundColor: [
                            'rgba(56, 189, 248, 0.6)',
                            'rgba(167, 139, 250, 0.6)',
                            'rgba(52, 211, 153, 0.6)',
                            'rgba(251, 191, 36, 0.6)'
                        ],
                        borderColor: [
                            'rgba(56, 189, 248, 1)',
                            'rgba(167, 139, 250, 1)',
                            'rgba(52, 211, 153, 1)',
                            'rgba(251, 191, 36, 1)'
                        ],
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
                }
            });
        }
        const perfCtx = document.getElementById('performanceChart');
        if(perfCtx && profData) {
            if(performanceChartInstance) performanceChartInstance.destroy();
            const completed = profData.completed_tasks || 0;
            const pending = (profData.total_tasks || 0) - completed;
            performanceChartInstance = new Chart(perfCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Completed Tasks', 'Pending Tasks'],
                    datasets: [{
                        data: [completed, pending],
                        backgroundColor: ['rgba(52, 211, 153, 0.8)', 'rgba(255,255,255,0.1)'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    },
                    cutout: '75%'
                }
            });
        }
    }
});
