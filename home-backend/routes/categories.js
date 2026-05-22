const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const c = require('../controllers/categoryController');

// All routes require auth
router.use(verifyToken);

// ── List & single ──────────────────────────────────────────────────────────
// GET  /api/categories          → all system + user custom categories
// GET  /api/categories/:id      → single category
router.get('/',    c.getCategories);
router.get('/:id', c.getCategory);

// ── User custom categories ─────────────────────────────────────────────────
// POST   /api/categories            → create custom category
// PUT    /api/categories/:id        → update custom category
// DELETE /api/categories/:id        → soft-delete custom category
router.post('/',    c.createCategory);
router.put('/:id',  c.updateCategory);
router.delete('/:id', c.deleteCategory);

// ── Subcategory management ─────────────────────────────────────────────────
// POST   /api/categories/:id/subcategories          → add subcategory
// DELETE /api/categories/:id/subcategories/:subId   → remove subcategory
router.post('/:id/subcategories',             c.addSubcategory);
router.delete('/:id/subcategories/:subId',    c.removeSubcategory);

// ── Clone system category ──────────────────────────────────────────────────
// POST   /api/categories/:id/clone  → copy a system category to edit it
router.post('/:id/clone', c.cloneSystemCategory);

module.exports = router;
