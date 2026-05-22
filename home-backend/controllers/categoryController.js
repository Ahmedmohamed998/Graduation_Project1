const Category = require('../models/Category');

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/categories
//  Returns system categories + the user's own custom categories
//  Query params: ?type=expense | income | both
// ─────────────────────────────────────────────────────────────────────────────
exports.getCategories = async (req, res) => {
    try {
        const { type } = req.query;

        const filter = {
            isActive: true,
            $or: [
                { isSystem: true,  userId: null },
                { isSystem: false, userId: req.userId }
            ]
        };

        if (type && ['expense', 'income', 'both'].includes(type)) {
            filter.type = { $in: [type, 'both'] };
        }

        const categories = await Category.find(filter).sort({ isSystem: -1, name: 1 });

        const system = categories.filter(c => c.isSystem);
        const custom = categories.filter(c => !c.isSystem);

        return res.json({
            total: categories.length,
            system: system.length,
            custom: custom.length,
            categories
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch categories', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/categories/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            isActive: true,
            $or: [{ isSystem: true }, { userId: req.userId }]
        });

        if (!category) return res.status(404).json({ error: 'Category not found' });

        return res.json(category);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch category', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/categories
//  Create a custom category for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
exports.createCategory = async (req, res) => {
    try {
        const { name, icon, color, type, subcategories } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }
        if (!type || !['expense', 'income', 'both'].includes(type)) {
            return res.status(400).json({ error: 'type must be expense, income, or both' });
        }

        // Check for duplicate name (system OR user-own)
        const exists = await Category.findOne({
            name: name.trim(),
            $or: [{ isSystem: true }, { userId: req.userId }]
        });
        if (exists) {
            return res.status(409).json({ error: `A category named "${name.trim()}" already exists` });
        }

        const category = await Category.create({
            userId: req.userId,
            name: name.trim(),
            icon: icon || '📂',
            color: color || '#6366f1',
            type,
            subcategories: (subcategories || []).map(s =>
                typeof s === 'string' ? { name: s } : { name: s.name, icon: s.icon || '📌' }
            ),
            isSystem: false
        });

        return res.status(201).json({
            message: 'Custom category created successfully',
            category
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'A category with this name already exists' });
        }
        return res.status(500).json({ error: 'Failed to create category', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/categories/:id
//  Update a user's own custom category (cannot edit system categories)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            userId: req.userId,
            isSystem: false
        });

        if (!category) {
            return res.status(404).json({ error: 'Custom category not found or you cannot edit system categories' });
        }

        const { name, icon, color, type } = req.body;

        if (name)  category.name  = name.trim();
        if (icon)  category.icon  = icon;
        if (color) category.color = color;
        if (type && ['expense', 'income', 'both'].includes(type)) {
            category.type = type;
        }

        await category.save();

        return res.json({
            message: 'Category updated successfully',
            category
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update category', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/categories/:id
//  Soft-delete a user's own custom category
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            userId: req.userId,
            isSystem: false
        });

        if (!category) {
            return res.status(404).json({ error: 'Custom category not found or system categories cannot be deleted' });
        }

        category.isActive = false;
        await category.save();

        return res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete category', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/categories/:id/subcategories
//  Add a subcategory to any category the user owns  (or to a system one → clone it first)
// ─────────────────────────────────────────────────────────────────────────────
exports.addSubcategory = async (req, res) => {
    try {
        const { name, icon } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Subcategory name is required' });
        }

        // Allow adding to user's own custom categories only
        const category = await Category.findOne({
            _id: req.params.id,
            userId: req.userId,
            isSystem: false,
            isActive: true
        });

        if (!category) {
            return res.status(404).json({
                error: 'Category not found. You can only add subcategories to your own custom categories. To extend a system category, clone it first via POST /api/categories/:id/clone'
            });
        }

        const already = category.subcategories.find(
            s => s.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (already) {
            return res.status(409).json({ error: `Subcategory "${name.trim()}" already exists` });
        }

        category.subcategories.push({ name: name.trim(), icon: icon || '📌' });
        await category.save();

        return res.status(201).json({
            message: 'Subcategory added successfully',
            subcategories: category.subcategories
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to add subcategory', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/categories/:id/subcategories/:subId
//  Remove a subcategory from user's own category
// ─────────────────────────────────────────────────────────────────────────────
exports.removeSubcategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            userId: req.userId,
            isSystem: false,
            isActive: true
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found or cannot edit system categories' });
        }

        const subIndex = category.subcategories.findIndex(
            s => s._id.toString() === req.params.subId
        );

        if (subIndex === -1) {
            return res.status(404).json({ error: 'Subcategory not found' });
        }

        category.subcategories.splice(subIndex, 1);
        await category.save();

        return res.json({
            message: 'Subcategory removed successfully',
            subcategories: category.subcategories
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to remove subcategory', detail: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/categories/:id/clone
//  Clone a system category into the user's own list so they can customise it
// ─────────────────────────────────────────────────────────────────────────────
exports.cloneSystemCategory = async (req, res) => {
    try {
        const source = await Category.findOne({
            _id: req.params.id,
            isSystem: true,
            isActive: true
        });

        if (!source) {
            return res.status(404).json({ error: 'System category not found' });
        }

        const newName = (req.body.name || `${source.name} (custom)`).trim();

        const exists = await Category.findOne({ name: newName, userId: req.userId });
        if (exists) {
            return res.status(409).json({ error: `You already have a category named "${newName}"` });
        }

        const cloned = await Category.create({
            userId: req.userId,
            name: newName,
            icon:  req.body.icon  || source.icon,
            color: req.body.color || source.color,
            type:  source.type,
            subcategories: source.subcategories.map(s => ({ name: s.name, icon: s.icon })),
            isSystem: false
        });

        return res.status(201).json({
            message: `System category "${source.name}" cloned successfully. You can now customise it.`,
            category: cloned
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to clone category', detail: err.message });
    }
};
