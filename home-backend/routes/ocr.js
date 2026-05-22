/**
 * home-backend/routes/ocr.js
 *
 * Proxy routes for the OCR pipeline.
 * All 3 routes are protected by verifyToken middleware.
 *
 * Routes:
 *   POST /api/ocr/scan      — multipart file → Python OCR
 *   POST /api/ocr/extract   — JSON OCR text → Python LLM extraction
 *   POST /api/ocr/feedback  — JSON corrections → Python + save to MongoDB
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = require('node-fetch');

const verifyToken  = require('../middleware/verifyToken');
const OcrFeedback  = require('../models/OcrFeedback');

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';

const ALLOWED_LANGUAGES = new Set(['ar', 'en', 'mixed']);

// Multer — memory storage, 10 MB limit (spec requirement)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});


// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

async function proxyFileToAgent(path, fileBuffer, originalname, mimetype, extraFields = {}, timeoutMs = 60000) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), timeoutMs);

    const form = new FormData();
    form.append('file', fileBuffer, {
        filename:    originalname,
        contentType: mimetype || 'application/octet-stream',
    });

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
//  POST /api/ocr/scan
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/scan',
    verifyToken,
    upload.single('file'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ detail: 'File is required' });
        }

        const languageHint = req.body.language_hint || 'auto';

        try {
            const { ok, status, data } = await proxyFileToAgent(
                '/api/ocr/scan',
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                { language_hint: languageHint }
            );
            return res.status(ok ? 200 : status).json(data);
        } catch (err) {
            if (err.name === 'AbortError') {
                return res.status(504).json({ detail: 'OCR scan timed out' });
            }
            // Multer file size errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ detail: 'File too large (max 10MB)' });
            }
            console.error('[ocr/scan]', err.message);
            return res.status(500).json({ detail: 'Failed to reach AI service' });
        }
    }
);


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ocr/extract
// ─────────────────────────────────────────────────────────────────────────────
router.post('/extract', verifyToken, async (req, res) => {
    const { rawText, structuredOcr, language, fileType } = req.body;

    if (!rawText) {
        return res.status(400).json({ detail: 'rawText field is required' });
    }

    try {
        const { ok, status, data } = await proxyJsonToAgent('/api/ocr/extract', {
            rawText,
            structuredOcr: structuredOcr || null,
            language:      language || 'auto',
            fileType:      fileType  || 'image',
        });
        return res.status(ok ? 200 : status).json(data);
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ detail: 'Extraction timed out' });
        }
        console.error('[ocr/extract]', err.message);
        return res.status(500).json({ detail: 'Failed to reach AI service' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ocr/feedback
// ─────────────────────────────────────────────────────────────────────────────
router.post('/feedback', verifyToken, async (req, res) => {
    const {
        originalRawText,
        originalExtraction,
        correctedExtraction,
        language,
        fileType,
        correctedFields,
        ocrConfidence,
        extractionConfidence,
        transactionId,
        finalCategory,
        finalCategoryGroup,
        finalType,
    } = req.body;

    if (!originalRawText || !originalExtraction || !correctedExtraction || !language || !fileType) {
        return res.status(400).json({ detail: 'Missing required feedback fields' });
    }

    try {
        // Forward to Python for logging
        await proxyJsonToAgent('/api/ocr/feedback', {
            originalRawText,
            originalExtraction,
            correctedExtraction,
            language,
            fileType,
            correctedFields: correctedFields || [],
        }).catch(() => {});

        // Save to MongoDB
        const feedback = await OcrFeedback.create({
            userId:               req.userId,
            fileType:             ['image', 'pdf', 'text'].includes(fileType) ? fileType : 'image',
            language:             ALLOWED_LANGUAGES.has(language) ? language : 'en',
            originalRawText,
            originalExtraction:   originalExtraction  || {},
            correctedExtraction:  correctedExtraction || {},
            correctedFields:      correctedFields || [],
            hadCorrection:        !!(correctedFields && correctedFields.length > 0),
            ocrConfidence:        ocrConfidence        || null,
            extractionConfidence: extractionConfidence || null,
            transactionId:        transactionId        || null,
            finalCategory:        finalCategory        || null,
            finalCategoryGroup:   finalCategoryGroup   || null,
            finalType:            finalType            || null,
        });

        return res.status(200).json({
            message:    'Feedback saved. Thank you for helping improve the system.',
            feedbackId: feedback._id.toString(),
        });
    } catch (err) {
        console.error('[ocr/feedback]', err.message);
        return res.status(500).json({ detail: 'Failed to save feedback' });
    }
});


module.exports = router;
