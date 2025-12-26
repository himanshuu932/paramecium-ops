const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const QUESTION_ID = process.env.QUESTION_ID || 'level1_ssti';
const MAIN_BACKEND_URL = 'https://buggit-backend-yy8i.onrender.com/api/store-result';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Helper function to send result to main backend (backend-to-backend)
async function sendToMainBackend(teamcode, questionId) {
    try {
        const response = await fetch(MAIN_BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamcode, questionId })
        });

        const result = await response.json();
        console.log("[BACKEND-SYNC] Stored in Main Backend:", result);
        return { success: true, result };
    } catch (error) {
        console.error("[BACKEND-SYNC] Error contacting main backend:", error.message);
        return { success: false, error: error.message };
    }
}

// --- ROUTES ---

// 1. Printer Preview (VULNERABLE)
app.post('/preview', (req, res) => {
    const templateText = req.body.template_text || '';

    // MISDIRECTION: Fake Security Checks
    if (templateText.includes("'") || templateText.includes('"')) {
        return res.status(500).send("Error: SQL Syntax Error near line 1. Please check your quotes.");
    }

    if (templateText.includes("<script") || templateText.includes("javascript:")) {
        return res.status(403).send("Error: Cross-Site Scripting (XSS) Monitor has blocked this request.");
    }

    try {
        // VULNERABILITY: Unsafe EJS rendering of user input
        const renderOptions = {
            client: true,
            strict: false,
            localsName: 'data',
            _with: false
        };

        const fullTemplate = `<div class="label-preview">${templateText}</div>`;
        const rendered = ejs.render(fullTemplate, {}, renderOptions);

        res.send(rendered);

    } catch (err) {
        res.status(500).send("Error: Template Rendering Failed. " + err.message);
    }
});

// 2. Verification (WIN CONDITION)
app.post('/verify', async (req, res) => {
    const userCode = req.body.code;
    const teamcode = req.body.teamcode || '382045158047';
    const serverCode = process.env.CODEWORD;

    if (userCode === serverCode) {
        // Backend-to-backend call to main server
        const syncResult = await sendToMainBackend(teamcode, QUESTION_ID);
        console.log("Sync result:", syncResult);

        res.json({
            success: true,
            message: "SYSTEM_ULOCKED. WELCOME, WHITE_HAT.",
            flag: "BUG_FOUND{template_injection_in_env_files}",
            redirect: "https://bug-hunt-manager-tau.vercel.app/dashboard",
            backendSync: syncResult
        });
    } else {
        res.json({
            success: false,
            message: "Access Denied. Invalid Codeword."
        });
    }
});

// 3. Ping Endpoint (Keep Render alive)
app.get('/ping', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// 4. Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`Paramecium Level 1 running on port ${PORT}`);
    console.log(`Question ID: ${QUESTION_ID}`);
    console.log(`Main Backend: ${MAIN_BACKEND_URL}`);
    console.log(`Ping endpoint: /ping`);

    // Self-ping every 10 minutes to keep Render alive
    const PING_INTERVAL = 10 * 60 * 1000;
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        fetch(`${url}/ping`)
            .then(res => res.json())
            .then(data => console.log(`[KEEP-ALIVE] Pinged at ${data.timestamp}`))
            .catch(err => console.log(`[KEEP-ALIVE] Ping failed: ${err.message}`));
    }, PING_INTERVAL);
    console.log(`[KEEP-ALIVE] Self-ping enabled every 10 minutes`);
});
