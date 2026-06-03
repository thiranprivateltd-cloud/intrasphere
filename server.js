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
