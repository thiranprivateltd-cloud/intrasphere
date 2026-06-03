require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const users = [
    {name: 'Varshith', employee_id: 'THR-26-LD-001', password: 'Varshith@001', department: 'Leadership', role: 'CEO'},
    {name: 'Dharshan', employee_id: 'THR-26-LD-002', password: 'Dharshan@002', department: 'Leadership', role: 'COO'},
    {name: 'Brundavanam Bose', employee_id: 'THR-26-LD-003', password: 'Brunda@003', department: 'Leadership', role: 'Project Manager & Overall Execution Lead'},
    {name: 'Rahav', employee_id: 'THR-26-PD-003', password: 'Rahav@004', department: 'Research & Development', role: 'Researcher'},
    {name: 'Hari Haran', employee_id: 'THR-26-RS-004', password: 'Hariharan@005', department: 'Research & Development', role: 'Researcher'},
    {name: 'Lohidharani', employee_id: 'THR-26-CM-015', password: 'Lohi@006', department: 'Administration & Operations', role: 'HR Admin'},
    {name: 'Mukunthan', employee_id: 'THR-26-UX-010', password: 'Mukunthan@007', department: 'Technology', role: 'UX Designer'},
    {name: 'Prakathesh', employee_id: 'THR-26-FE-005', password: 'Prakathesh@008', department: 'Technology', role: 'Frontend Developer'},
    {name: 'Nabeela', employee_id: 'THR-26-BE-006', password: 'Nabeela@009', department: 'Technology', role: 'Backend Developer'},
    {name: 'Keerthana', employee_id: 'THR-26-AI-007', password: 'Keerthana@010', department: 'Technology', role: 'AI Engineer'},
    {name: 'Samuel', employee_id: 'THR-26-FS-018', password: 'Sam@011', department: 'Technology', role: 'Full Stack Developer'},
    {name: 'Mogesh', employee_id: 'THR-26-DA-008', password: 'Mogesh@012', department: 'Technology', role: 'Data Analyst'},
    {name: 'HariPrasad', employee_id: 'THR-26-IE-019', password: 'Hariprasad@013', department: 'Technology', role: 'IT Engineer'},
    {name: 'Akash', employee_id: 'THR-26-MK-011', password: 'Akash@014', department: 'Growth & Business', role: 'Marketing Executive'},
    {name: 'Arpit', employee_id: 'THR-26-BD-013', password: 'Arpit@015', department: 'Administration & Operations', role: 'Business Development'},
    {name: 'Kanmani', employee_id: 'THR-26-QA-014', password: 'Kanmani@016', department: 'Growth & Business', role: 'QA Analyst'},
    {name: 'Navasri', employee_id: 'THR-26-CT-012', password: 'Navasri@017', department: 'Administration & Operations', role: 'Content Creator'},
    {name: 'Vaishali', employee_id: 'THR-26-OP-020', password: 'Vaishali@018', department: 'Administration & Operations', role: 'Operations Manager'},
    {name: 'Nishanthini', employee_id: 'THR-26-EV-016', password: 'Nishanthini@019', department: 'Administration & Operations', role: 'Event Coordinator'},
    {name: 'Sasi', employee_id: 'THR-26-LA-020', password: 'Sasi@020', department: 'Leadership', role: 'Executive Assistant'}
];

async function run() {
    console.log('Deleting all existing users...');
    const { error: delErr } = await supabase.from('users').delete().neq('id', 0); // Hack to delete all if no RLS, or we can just fetch and delete
    if (delErr) {
        console.error('Failed to delete users directly, fetching first...');
        const { data: allUsers } = await supabase.from('users').select('id');
        for (let u of allUsers) {
            await supabase.from('users').delete().eq('id', u.id);
        }
    }
    
    console.log('Inserting 20 final users...');
    const { error: insErr } = await supabase.from('users').insert(users);
    if (insErr) {
        console.error('Insert error:', insErr);
    } else {
        console.log('Database successfully updated!');
    }
}
run();
