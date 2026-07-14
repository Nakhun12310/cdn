const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming request bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory databases (Use a real database like MongoDB or PostgreSQL in production)
const scriptDatabase = new Map();
const activeLicenses = new Set(['PREMIUM-DEV-1234', 'TRIAL-KEY-5678']);

/**
 * Basic Lua Minifier/Obfuscator Logic
 * Simplifies whitespace and renames standard variables to obscure intent.
 */
function simpleLuaObfuscate(script) {
    if (!script) return '';
    
    // Remove single-line comments
    let processed = script.replace(/--.*$/gm, '');
    
    // Reduce multiple spaces and newlines
    processed = processed.replace(/\s+/g, ' ').trim();
    
    // Wrap in an anonymous execution block for scope isolation
    return `(function(...) ${processed} end)(...)`;
}

// API: Protect a newly submitted script
app.post('/api/protect', (req, res) => {
    const { scriptSource } = req.body;
    
    if (!scriptSource) {
        return res.status(400).json({ error: 'No script content provided.' });
    }

    // Generate a unique ID for this specific script version
    const scriptId = crypto.randomBytes(16).toString('hex');
    
    // Process and store the script securely on the server
    const protectedCode = simpleLuaObfuscate(scriptSource);
    scriptDatabase.set(scriptId, protectedCode);

    // Generate the standard execution loader string
    const host = req.get('host');
    const protocol = req.protocol;
    const loaderStr = `local k = "YOUR_KEY_HERE" loadstring(game:HttpGet("${protocol}://${host}/api/load?id=${scriptId}&key=" .. k))()`;

    res.json({
        success: true,
        scriptId: scriptId,
        loader: loaderStr
    });
});

// API: Endpoint hit by the Lua environment executor
app.get('/api/load', (req, res) => {
    const { id, key } = req.query;

    // Validate the script existence
    if (!scriptDatabase.has(id)) {
        return res.status(404).send('-- Error: Script configuration not found.');
    }

    // Validate the license key passed by the executor
    if (!activeLicenses.has(key)) {
        return res.status(403).send('-- Error: Access Denied. Invalid or expired license key.');
    }

    // Deliver the raw processed code directly to the loadstring compiler
    res.setHeader('Content-Type', 'text/plain');
    res.send(scriptDatabase.get(id));
});

app.listen(PORT, () => {
    console.log(`LunarisX Server running at http://localhost:${PORT}`);
});
