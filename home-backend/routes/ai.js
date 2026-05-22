const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';

// ─── helper: forward a request to the Python AI agent ────────────────────────
async function proxyToAgent(path, body, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${AI_AGENT_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeout);
        return { ok: response.ok, status: response.status, data: await response.json() };
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// ─── POST /api/ai/chat ── financial advisor chat ──────────────────────────────
router.post('/chat', verifyToken, async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message is required.' });
    }

    const accessToken = req.headers.authorization?.split(' ')[1];

    try {
        const { ok, status, data } = await proxyToAgent('/api/ai/chat', {
            message: message.trim(),
            accessToken,
            userId: req.userId,   // forwarded from JWT — enables per-user chat memory
        });

        if (!ok) return res.status(status).json(data);
        return res.json(data);

    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'AI agent took too long. Please try again.' });
        }
        return res.status(503).json({
            error: 'AI agent is unavailable. Please try again later.',
            detail: err.message
        });
    }
});

// ─── POST /api/ai/categorize ── transaction auto-categorizer ──────────────────
//
//  Request body: { "text": "كافيه لاتيه 45 جنيه" }
//  Response:     { type, categoryGroup, category, confidence,
//                  detectedAmount, detectedCurrency, suggestedDescription, language }
//
//  No accessToken needed — categorization is stateless / not user-specific.
//  Auth is still required so random clients can't abuse the endpoint.
router.post('/categorize', verifyToken, async (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'text is required.' });
    }

    try {
        const { ok, status, data } = await proxyToAgent(
            '/api/ai/categorize',
            { text: text.trim() },
            15000 // shorter timeout — categorization is fast
        );

        if (!ok) return res.status(status).json(data);
        return res.json(data);

    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Categorization timed out. Please try again.' });
        }
        return res.status(503).json({
            error: 'AI agent is unavailable. Please try again later.',
            detail: err.message
        });
    }
});

module.exports = router;
