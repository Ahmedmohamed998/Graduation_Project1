const Category = require('../models/Category');

// ─────────────────────────────────────────────────────────────────────────────
//  System default categories  (seeded once, never deleted by users)
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_CATEGORIES = [
    // ── EXPENSE GROUPS ────────────────────────────────────────────────────────
    {
        name: 'Housing', icon: '🏠', color: '#f59e0b', type: 'expense',
        subcategories: [
            { name: 'Rent/Mortgage',   icon: '🏡' },
            { name: 'Home Maintenance', icon: '🔧' },
            { name: 'Utilities',        icon: '💡' },
            { name: 'Internet & Phone', icon: '📶' },
            { name: 'Home Insurance',   icon: '🛡️' }
        ]
    },
    {
        name: 'Transportation', icon: '🚗', color: '#3b82f6', type: 'expense',
        subcategories: [
            { name: 'Fuel/Gas',                          icon: '⛽' },
            { name: 'Car Maintenance/Insurance/Payments', icon: '🔩' },
            { name: 'Public Transport/Uber/Taxi',         icon: '🚕' },
            { name: 'Parking',                           icon: '🅿️' }
        ]
    },
    {
        name: 'Food & Dining', icon: '🍽️', color: '#ef4444', type: 'expense',
        subcategories: [
            { name: 'Groceries',            icon: '🛒' },
            { name: 'Restaurants/Dining Out', icon: '🍴' },
            { name: 'Coffee/Snacks/Fast Food', icon: '☕' }
        ]
    },
    {
        name: 'Healthcare & Medicine', icon: '🏥', color: '#10b981', type: 'expense',
        subcategories: [
            { name: 'Doctor/Hospital',       icon: '👨‍⚕️' },
            { name: 'Pharmacy/Medicine',     icon: '💊' },
            { name: 'Health Insurance',      icon: '🩺' },
            { name: 'Vitamins/Supplements',  icon: '🧪' }
        ]
    },
    {
        name: 'Entertainment & Joy', icon: '🎮', color: '#8b5cf6', type: 'expense',
        subcategories: [
            { name: 'Movies/Streaming', icon: '🎬' },
            { name: 'Hobbies/Sports',   icon: '⚽' },
            { name: 'Concerts/Events',  icon: '🎵' },
            { name: 'Gaming',           icon: '🕹️' }
        ]
    },
    {
        name: 'Shopping', icon: '🛍️', color: '#ec4899', type: 'expense',
        subcategories: [
            { name: 'Clothing',            icon: '👕' },
            { name: 'Electronics',         icon: '📱' },
            { name: 'Home Decor/Furniture', icon: '🛋️' }
        ]
    },
    {
        name: 'Personal Care', icon: '💆', color: '#f472b6', type: 'expense',
        subcategories: [
            { name: 'Haircuts/Salon', icon: '💇' },
            { name: 'Cosmetics',      icon: '💄' },
            { name: 'Gym/Fitness',    icon: '🏋️' }
        ]
    },
    {
        name: 'Travel & Vacation', icon: '✈️', color: '#06b6d4', type: 'expense',
        subcategories: [
            { name: 'Flights',     icon: '🛫' },
            { name: 'Hotels',      icon: '🏨' },
            { name: 'Local Trips', icon: '🗺️' }
        ]
    },
    {
        name: 'Education', icon: '📚', color: '#f97316', type: 'expense',
        subcategories: [
            { name: 'Courses',     icon: '🎓' },
            { name: 'Books',       icon: '📖' },
            { name: 'School Fees', icon: '🏫' }
        ]
    },
    {
        name: 'Gifts & Donations', icon: '🎁', color: '#84cc16', type: 'expense',
        subcategories: [
            { name: 'Gifts',   icon: '🎀' },
            { name: 'Charity', icon: '❤️' }
        ]
    },
    {
        name: 'Subscriptions', icon: '🔁', color: '#6366f1', type: 'expense',
        subcategories: [
            { name: 'Streaming',      icon: '📺' },
            { name: 'Apps',           icon: '📲' },
            { name: 'Gym memberships', icon: '🏟️' }
        ]
    },
    {
        name: 'Debt Repayment', icon: '💳', color: '#ef4444', type: 'expense',
        subcategories: [
            { name: 'Credit Card Payments', icon: '💳' },
            { name: 'Loan Installments',    icon: '🏦' }
        ]
    },
    {
        name: 'Miscellaneous', icon: '📦', color: '#9ca3af', type: 'expense',
        subcategories: [
            { name: 'Bank Fees', icon: '🏦' },
            { name: 'Pet Care',  icon: '🐾' },
            { name: 'Childcare', icon: '👶' },
            { name: 'Other',     icon: '📌' }
        ]
    },

    // ── INCOME GROUPS ─────────────────────────────────────────────────────────
    {
        name: 'Salary / Wages', icon: '💼', color: '#22c55e', type: 'income',
        subcategories: []
    },
    {
        name: 'Freelance / Side Hustle', icon: '💻', color: '#16a34a', type: 'income',
        subcategories: []
    },
    {
        name: 'Business Income', icon: '🏢', color: '#15803d', type: 'income',
        subcategories: []
    },
    {
        name: 'Investments / Dividends', icon: '📈', color: '#166534', type: 'income',
        subcategories: []
    },
    {
        name: 'Bonuses / Commissions', icon: '🎯', color: '#4ade80', type: 'income',
        subcategories: []
    },
    {
        name: 'Gifts / Refunds', icon: '🎁', color: '#86efac', type: 'income',
        subcategories: []
    },
    {
        name: 'Rental Income', icon: '🏘️', color: '#bbf7d0', type: 'income',
        subcategories: []
    },
    {
        name: 'Other Income', icon: '💰', color: '#dcfce7', type: 'income',
        subcategories: []
    }
];

// ─────────────────────────────────────────────────────────────────────────────
//  Seed function — called once at server startup
// ─────────────────────────────────────────────────────────────────────────────
async function seedSystemCategories() {
    try {
        const existingCount = await Category.countDocuments({ isSystem: true });
        if (existingCount > 0) return; // already seeded

        const docs = SYSTEM_CATEGORIES.map(cat => ({ ...cat, isSystem: true, userId: null }));
        await Category.insertMany(docs);
        console.log(`✅ Seeded ${docs.length} system categories`);
    } catch (err) {
        console.error('❌ Failed to seed categories:', err.message);
    }
}

module.exports = { seedSystemCategories, SYSTEM_CATEGORIES };
