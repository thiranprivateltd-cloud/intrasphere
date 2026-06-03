const fetch = require('node-fetch'); // we'll use node fetch or built in fetch

async function run() {
    const loginRes = await fetch('https://intrasphere-thiran.vercel.app/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: 'THR-26-LD-001', password: 'Varshith@001' })
    });
    
    const loginData = await loginRes.json();
    console.log("Token:", loginData.token ? "Success" : "Failed");
    
    if (!loginData.token) return;

    const res = await fetch('https://intrasphere-thiran.vercel.app/api/circulars', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': loginData.token
        },
        body: JSON.stringify({
            title: 'Notice issuance for non attending meeting',
            content: 'Those who are not attending the meeting without any prior information will be issued with warning notice letter. Each can get maximum of 7 notices',
            category: 'Operational',
            priority: 'High',
            departments: 'Technology, Leadership, Research & Development, Administration & Operations'
        })
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
}

run();
