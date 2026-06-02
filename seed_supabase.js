require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const initialUsers = [
    { name: 'Varshith', role: 'CEO', department: 'Leadership', employee_id: 'THR-26-LD-001', password: 'Varshith@001' },
    { name: 'Dharshan S', role: 'COO', department: 'Leadership', employee_id: 'THR-26-LD-002', password: 'Dharshan@002' },
    { name: 'Brundavanam Bose', role: 'Project Manager & Overall Execution Lead', department: 'Leadership', employee_id: 'THR-26-LD-003', password: 'Brunda@003' },
    { name: 'Rahav', role: 'Product Manager', department: 'Product Development', employee_id: 'THR-26-PD-003', password: 'Rahav@011' },
    { name: 'Hari', role: 'Career Research Analyst', department: 'Research', employee_id: 'THR-26-RS-004', password: 'Hariharan@012' },
    { name: 'Prakathesh', role: 'Tech Support Lead & Frontend Developer', department: 'Frontend Engineering', employee_id: 'THR-26-FE-005', password: 'Prakathesh@006' },
    { name: 'Nabeela', role: 'Backend Developer', department: 'Backend Engineering', employee_id: 'THR-26-BE-006', password: 'Nabeela@009' },
    { name: 'Keerthana', role: 'AI/ML Developer', department: 'Artificial Intelligence', employee_id: 'THR-26-AI-007', password: 'Keerthana@010' },
    { name: 'Mogesh', role: 'Data Intelligence Analyst', department: 'Data Analytics', employee_id: 'THR-26-DA-008', password: 'Mogesh@013' },
    { name: 'Kanmani', role: 'Supporting Growth Manager & QA Tester', department: 'Quality Assurance', employee_id: 'THR-26-QA-009', password: 'Kanmani@008' },
    { name: 'Mukunthan', role: 'Tech Lead & UI/UX Designer', department: 'UX/UI Design', employee_id: 'THR-26-UX-010', password: 'Mukunthan@005' },
    { name: 'Akash', role: 'Growth Manager & Social Media Manager', department: 'Marketing', employee_id: 'THR-26-MK-011', password: 'Akash@007' },
    { name: 'Navasri', role: 'Content & Communication Manager', department: 'Content Team', employee_id: 'THR-26-CT-012', password: 'Navasri@017' },
    { name: 'Arpit', role: 'Business Developer', department: 'Business Development', employee_id: 'THR-26-BD-013', password: 'Arpit@016' },
    { name: 'Supriya', role: 'Investor Relations Manager', department: 'Investor Relations', employee_id: 'THR-26-IR-014', password: 'Supriya@014' },
    { name: 'Lohidharani', role: 'HR Admin', department: 'Community Management', employee_id: 'THR-26-CM-015', password: 'Lohi@004' },
    { name: 'Nishanthini', role: 'Events & Webinar Coordinator', department: 'Events', employee_id: 'THR-26-EV-016', password: 'Nishanthini@018' },
    { name: 'Samuel', role: 'Junior Full Stack Developer', department: 'Legal Affairs', employee_id: 'THR-26-LA-018', password: 'Samuel@014' },
    { name: 'Vaishali', role: 'Operations Monitoring Manager', department: 'Administration', employee_id: 'THR-26-OM-021', password: 'Vaishali@021' },
    { name: 'System Admin', role: 'Master Administrative Access', department: 'Leadership', employee_id: 'THR-26-SA-020', password: 'Admin@2026' }
];

async function seedUsers() {
    console.log("Starting to seed users into Supabase...");
    
    // First, optional: delete existing users to prevent duplicates if you already tried to add them manually
    await supabase.from('users').delete().neq('id', 0);
    console.log("Cleared existing users.");

    // Hash passwords and insert
    const usersToInsert = initialUsers.map(user => ({
        name: user.name,
        role: user.role,
        department: user.department,
        employee_id: user.employee_id,
        // HASH THE PASSWORD EXACTLY LIKE THE SERVER EXPECTS
        password: bcrypt.hashSync(user.password, 8) 
    }));

    const { data, error } = await supabase.from('users').insert(usersToInsert);

    if (error) {
        console.error("Error inserting users:", error);
    } else {
        console.log(`Successfully seeded ${usersToInsert.length} users with hashed passwords!`);
    }
}

seedUsers();
