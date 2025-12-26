const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- ROUTES ---

// 1. Printer Preview (VULNERABLE)
app.post('/preview', (req, res) => {
    const templateText = req.body.template_text || '';

    // MISDIRECTION: Fake Security Checks
    // 1. Fake SQL Injection Block
    if (templateText.includes("'") || templateText.includes('"')) {
        return res.status(500).send("Error: SQL Syntax Error near line 1. Please check your quotes.");
    }

    // 2. Fake XSS Block
    if (templateText.includes("<script") || templateText.includes("javascript:")) {
        return res.status(403).send("Error: Cross-Site Scripting (XSS) Monitor has blocked this request.");
    }

    try {
        // VULNERABILITY: Unsafe EJS rendering of user input
        // Users can inject EJS tags like <%= process.env.CODEWORD %>
        const renderOptions = {
            client: true,
            strict: false,
            localsName: 'data',
            _with: false // Often helps facilitate exploits in some EJS versions, though default works too
        };

        // We wrap the input in a basic layout, but the user controls the middle
        const fullTemplate = `<div class="label-preview">${templateText}</div>`;
        const rendered = ejs.render(fullTemplate, {}, renderOptions);

        res.send(rendered);

    } catch (err) {
        // If they mess up the EJS syntax, give a generic error to keep them guessing
        // or reveal the stack trace if we want to be generous (let's be medium difficulty: generic error)
        res.status(500).send("Error: Template Rendering Failed. " + err.message);
    }
});

// 2. Verification (WIN CONDITION)
app.post('/verify', (req, res) => {
    const userCode = req.body.code;
    const serverCode = process.env.CODEWORD;

    if (userCode === serverCode) {
        res.json({
            success: true,
            message: "SYSTEM_ULOCKED. WELCOME, WHITE_HAT.",
            flag: "bug found{template_injection_in_env_files}"
        });
    } else {
        res.json({
            success: false,
            message: "Access Denied. Invalid Codeword."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Corporate Printer Service running on http://localhost:${PORT}`);
    console.log(`Keep this window open to see server logs.`);
});
