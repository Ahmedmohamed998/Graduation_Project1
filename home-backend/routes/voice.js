/**
 * home-backend/routes/voice.js
 *
 * Proxy routes for the Voice pipeline.
 * All 3 routes are protected by verifyToken middleware.
 *
 * Routes:
 *   POST /api/voice/transcribe  — multipart audio → Python STT
 *   POST /api/voice/extract     — JSON transcript → Python LLM extraction
 *   POST /api/voice/feedback    — JSON corrections → Python + save to MongoDB
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = require('node-fetch');

const verifyToken    = require('../middleware/verifyToken');
const VoiceFeedback  = require('../models/VoiceFeedback');

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';

// Multer — memory storage so the file is never written to disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },  // 25 MB hard limit for audio
});

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forward a JSON body to the Python AI agent.
 */
async function proxyJsonToAgent(path, body, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${AI_AGENT_URL}${path}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
            signal:  controller.signal,
        });
        clearTimeout(timeout);
        return { ok: response.ok, status: response.status, data: await response.json() };
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Forward a multipart/form-data file to the Python AI agent.
 */
async function proxyMultipartToAgent(path, fileBuffer, originalname, mimetype, extraFields = {}, timeoutMs = 60000) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), timeoutMs);

    const form = new FormData();
    form.append('audio', fileBuffer, {
        filename:    originalname,
        contentType: mimetype || 'application/octet-stream',
    });

    // Append any extra form fields (e.g. language_hint)
    for (const [key, value] of Object.entries(extraFields)) {
        form.append(key, String(value));
    }

    try {
        const response = await fetch(`${AI_AGENT_URL}${path}`, {
            method:  'POST',
            headers: form.getHeaders(),
            body:    form,
            signal:  controller.signal,
        });
        clearTimeout(timeout);
        return { ok: response.ok, status: response.status, data: await response.json() };
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/voice/transcribe
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/transcribe',
    verifyToken,
    upload.single('audio'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ detail: 'Audio file is required' });
        }

        const languageHint = req.body.language_hint || 'auto';

        try {
            const { ok, status, data } = await proxyMultipartToAgent(
                '/api/voice/transcribe',
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                { language_hint: languageHint }
            );

            return res.status(ok ? 200 : status).json(data);
        } catch (err) {
            if (err.name === 'AbortError') {
                return res.status(504).json({ detail: 'Transcription timed out' });
            }
            console.error('[voice/transcribe]', err.message);
            return res.status(500).json({ detail: 'Failed to reach AI service' });
        }
    }
);


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/voice/extract
// ─────────────────────────────────────────────────────────────────────────────
router.post('/extract', verifyToken, async (req, res) => {
    const { transcript, language } = req.body;

    if (!transcript) {
        return res.status(400).json({ detail: 'transcript field is required' });
    }

    try {
        const { ok, status, data } = await proxyJsonToAgent('/api/voice/extract', {
            transcript,
            language: language || 'ar',
        });
        return res.status(ok ? 200 : status).json(data);
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ detail: 'Extraction timed out' });
        }
        console.error('[voice/extract]', err.message);
        return res.status(500).json({ detail: 'Failed to reach AI service' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/voice/feedback
//  Forward to Python for logging, then save to MongoDB with userId from JWT
// ─────────────────────────────────────────────────────────────────────────────
router.post('/feedback', verifyToken, async (req, res) => {
    const {
        originalTranscript,
        originalExtraction,
        correctedExtraction,
        language,
        correctedFields,
        transcriptionConfidence,
        extractionConfidence,
        transactionId,
        finalCategory,
        finalCategoryGroup,
        finalType,
    } = req.body;

    if (!originalTranscript || !originalExtraction || !correctedExtraction || !language) {
        return res.status(400).json({ detail: 'Missing required feedback fields' });
    }

    try {
        // Forward to Python AI agent for logging/future ML
        await proxyJsonToAgent('/api/voice/feedback', {
            originalTranscript,
            originalExtraction,
            correctedExtraction,
            language,
            correctedFields: correctedFields || [],
        }).catch(() => {});  // Don't block save if Python is down

        // Save to MongoDB — userId always comes from the JWT
        const feedback = await VoiceFeedback.create({
            userId:                  req.userId,
            originalTranscript,
            language:                language in { ar: 1, en: 1, mixed: 1 } ? language : 'en',
            originalExtraction:      originalExtraction || {},
            correctedExtraction:     correctedExtraction || {},
            correctedFields:         correctedFields || [],
            hadCorrection:           !!(correctedFields && correctedFields.length > 0),
            transcriptionConfidence: transcriptionConfidence || null,
            extractionConfidence:    extractionConfidence || null,
            transactionId:           transactionId || null,
            finalCategory:           finalCategory || null,
            finalCategoryGroup:      finalCategoryGroup || null,
            finalType:               finalType || null,
        });

        return res.status(200).json({
            message:    'Feedback saved. Thank you for helping improve the system.',
            feedbackId: feedback._id.toString(),
        });
    } catch (err) {
        console.error('[voice/feedback]', err.message);
        return res.status(500).json({ detail: 'Failed to save feedback' });
    }
});


module.exports = router;
