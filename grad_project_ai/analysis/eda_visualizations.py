"""
analysis/eda_visualizations.py
Generates the 10 user-facing charts from synthetic data.

Run: python analysis/eda_visualizations.py
Output: analysis/charts/*.png
"""

import json, os
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.ticker as mticker
import numpy as np
from pathlib import Path
from collections import defaultdict
from datetime import datetime

Path("analysis/charts").mkdir(parents=True, exist_ok=True)
DATA = Path("data")

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "figure.dpi": 120,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

PALETTE = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
           "#06b6d4","#f97316","#84cc16","#ec4899","#6366f1"]


# ── Load data ──────────────────────────────────────────────────────────────────
def load():
    def rd(f): return json.loads((DATA/f).read_text("utf-8"))
    tx   = pd.DataFrame(rd("transactions.json"))
    vf   = pd.DataFrame(rd("voice_feedback.json"))
    of   = pd.DataFrame(rd("ocr_feedback.json"))
    bud  = pd.DataFrame(rd("budgets.json"))
    goals= pd.DataFrame(rd("savings_goals.json"))
    return tx, vf, of, bud, goals


def save(fig, name):
    p = f"analysis/charts/{name}.png"
    fig.savefig(p, bbox_inches="tight")
    plt.close(fig)
    print(f"  [OK] {p}")


# ── 1. Cash Flow Summary Card ──────────────────────────────────────────────────
def chart1_cashflow(tx):
    """Chart 1 — Cash Flow Card (total income vs expense, all users)."""
    inc = tx[tx["type"]=="income"]["amount"].sum()
    exp = tx[tx["type"]=="expense"]["amount"].sum()
    net = inc - exp

    fig, ax = plt.subplots(figsize=(6, 3.5))
    ax.axis("off")
    ax.set_title("Chart 1 — Cash Flow Summary", fontsize=13, fontweight="bold", pad=12)

    data = [("Total Income",  inc, "#10b981"),
            ("Total Expense", exp, "#ef4444"),
            ("Net Savings",   net, "#3b82f6")]

    for i, (label, val, col) in enumerate(data):
        ax.add_patch(mpatches.FancyBboxPatch((0.05+i*0.32, 0.15), 0.28, 0.65,
                     boxstyle="round,pad=0.02", linewidth=0, color=col, alpha=0.12, transform=ax.transAxes))
        ax.text(0.19+i*0.32, 0.58, f"{val/1e6:.1f}M EGP",
                ha="center", va="center", fontsize=12, fontweight="bold", color=col, transform=ax.transAxes)
        ax.text(0.19+i*0.32, 0.34, label,
                ha="center", va="center", fontsize=8.5, color="#374151", transform=ax.transAxes)

    save(fig, "01_cashflow_card")


# ── 2. Income vs Expense by Month ─────────────────────────────────────────────
def chart2_income_expense(tx):
    """Chart 2 — Grouped bar: monthly income vs expense + net line."""
    tx["month"] = pd.to_datetime([d["$date"] for d in tx["date"]]).to_period("M")
    monthly = tx.groupby(["month","type"])["amount"].sum().unstack(fill_value=0)
    monthly = monthly.tail(6)

    labels  = [str(m) for m in monthly.index]
    inc_    = monthly.get("income", pd.Series(0, index=monthly.index)).values / 1000
    exp_    = monthly.get("expense", pd.Series(0, index=monthly.index)).values / 1000
    net_    = inc_ - exp_

    x  = np.arange(len(labels))
    w  = 0.35
    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.bar(x - w/2, inc_, w, label="Income",  color="#10b981", alpha=0.85)
    ax.bar(x + w/2, exp_, w, label="Expense", color="#ef4444", alpha=0.85)
    ax2 = ax.twinx()
    ax2.plot(x, net_, "o--", color="#3b82f6", linewidth=2, label="Net Savings (K EGP)")
    ax2.set_ylabel("Net Savings (K EGP)", color="#3b82f6")
    ax2.tick_params(axis="y", labelcolor="#3b82f6")
    ax.set_xticks(x); ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_ylabel("Amount (K EGP)"); ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v,_: f"{v:.0f}K"))
    ax.legend(loc="upper left"); ax.set_title("Chart 2 — Monthly Income vs Expense", fontweight="bold")
    save(fig, "02_income_vs_expense")


# ── 3. Spending by Category — Donut ───────────────────────────────────────────
def chart3_donut(tx):
    """Chart 3 — Donut chart of top spending categories."""
    top = (tx[tx["type"]=="expense"]
           .groupby("category")["amount"].sum()
           .sort_values(ascending=False).head(8))

    fig, ax = plt.subplots(figsize=(7, 5))
    wedges, texts, autotexts = ax.pie(
        top.values, labels=None, autopct="%1.1f%%",
        colors=PALETTE[:len(top)], startangle=90,
        wedgeprops={"width": 0.5, "edgecolor": "white", "linewidth": 2},
        pctdistance=0.78)
    for at in autotexts: at.set_fontsize(8)
    ax.legend(wedges, top.index, loc="lower right", fontsize=8, framealpha=0.6)
    ax.set_title("Chart 3 — Spending by Category", fontweight="bold")
    save(fig, "03_category_donut")


# ── 4. Budget Progress Bars ───────────────────────────────────────────────────
def chart4_budgets(bud):
    """Chart 4 — Horizontal progress bars per budget category."""
    sample = bud.groupby("category").agg(
        spent=("spentAmount", "mean"), limit=("limitAmount", "mean")
    ).reset_index().sort_values("spent", ascending=True).tail(8)

    fig, ax = plt.subplots(figsize=(8, 4.5))
    ys = np.arange(len(sample))
    for i, row in enumerate(sample.itertuples()):
        pct = min(row.spent / row.limit, 1.20)
        col = "#ef4444" if pct >= 1.0 else "#f59e0b" if pct >= 0.80 else "#10b981"
        ax.barh(i, row.limit, color="#e5e7eb", height=0.5)
        ax.barh(i, min(row.spent, row.limit), color=col, height=0.5, alpha=0.85)
        ax.text(row.limit * 1.01, i, f"{pct*100:.0f}%", va="center", fontsize=8)

    ax.set_yticks(ys); ax.set_yticklabels(sample["category"], fontsize=9)
    ax.set_xlabel("Amount (EGP)"); ax.set_title("Chart 4 — Budget Progress Bars", fontweight="bold")
    legend_patches = [
        mpatches.Patch(color="#10b981", label="Safe (<80%)"),
        mpatches.Patch(color="#f59e0b", label="Warning (80-99%)"),
        mpatches.Patch(color="#ef4444", label="Exceeded (≥100%)"),
    ]
    ax.legend(handles=legend_patches, fontsize=8, loc="lower right")
    save(fig, "04_budget_progress")


# ── 5. Savings Goals — Circular Progress ─────────────────────────────────────
def chart5_savings_goals(goals):
    """Chart 5 — Mini donut per savings goal."""
    goals["progress"] = goals["savedAmount"] / goals["targetAmount"]
    sample = goals.sample(min(6, len(goals)), random_state=1).reset_index(drop=True)

    fig, axes = plt.subplots(2, 3, figsize=(10, 5))
    fig.suptitle("Chart 5 — Savings Goals Progress", fontweight="bold")
    axes = axes.flatten()

    for i, ax in enumerate(axes):
        if i >= len(sample):
            ax.axis("off"); continue
        row  = sample.iloc[i]
        prog = min(row["progress"], 1.0)
        col  = "#10b981" if prog >= 0.5 else "#f59e0b" if prog >= 0.2 else "#ef4444"
        ax.pie([prog, 1-prog], colors=[col, "#e5e7eb"], startangle=90,
               wedgeprops={"width": 0.4, "edgecolor": "white"})
        ax.text(0, 0, f"{prog*100:.0f}%", ha="center", va="center",
                fontsize=12, fontweight="bold", color=col)
        ax.set_title(row["name"], fontsize=8, pad=3)

    save(fig, "05_savings_goals")


# ── 6. Entry Method Distribution ─────────────────────────────────────────────
def chart6_entry_methods(tx):
    """Chart 6 — Pie: manual vs voice vs OCR transaction count."""
    counts = tx["entryMethod"].value_counts()
    labels = counts.index.tolist()
    colors = {"manual": "#64748b", "voice": "#10b981", "ocr": "#3b82f6"}
    cols   = [colors.get(l, "#9ca3af") for l in labels]

    fig, ax = plt.subplots(figsize=(6, 4.5))
    wedges, texts, auto = ax.pie(counts.values, labels=labels, autopct="%1.1f%%",
                                  colors=cols, startangle=90,
                                  wedgeprops={"edgecolor": "white", "linewidth": 2})
    for at in auto: at.set_fontsize(9)
    ax.set_title("Chart 6 — Transaction Entry Methods", fontweight="bold")
    save(fig, "06_entry_methods")


# ── 7. Savings Rate Trend — Area Chart ───────────────────────────────────────
def chart7_savings_rate(tx):
    """Chart 7 — Area chart of monthly savings rate over 12 months."""
    tx["month"] = pd.to_datetime([d["$date"] for d in tx["date"]]).to_period("M")
    monthly = tx.groupby(["month","type"])["amount"].sum().unstack(fill_value=0)
    monthly["savings_rate"] = ((monthly.get("income",0) - monthly.get("expense",0))
                               / monthly.get("income",1).replace(0,1)) * 100
    monthly = monthly.tail(12)

    fig, ax = plt.subplots(figsize=(9, 4))
    x = np.arange(len(monthly))
    ax.fill_between(x, monthly["savings_rate"], alpha=0.25, color="#10b981")
    ax.plot(x, monthly["savings_rate"], color="#10b981", linewidth=2.5, marker="o", markersize=4)
    ax.axhline(20, linestyle="--", color="#f59e0b", linewidth=1.5, label="20% target")
    ax.set_xticks(x)
    ax.set_xticklabels([str(m) for m in monthly.index], rotation=35, ha="right", fontsize=8)
    ax.set_ylabel("Savings Rate (%)"); ax.legend()
    ax.set_title("Chart 7 — Monthly Savings Rate Trend", fontweight="bold")
    save(fig, "07_savings_rate_trend")


# ── 8. Spending Heatmap — Calendar ───────────────────────────────────────────
def chart8_heatmap(tx):
    """Chart 8 — Calendar-style heatmap: daily expense totals."""
    exp = tx[tx["type"]=="expense"].copy()
    exp["day"] = pd.to_datetime([d["$date"] for d in exp["date"]]).date
    daily = exp.groupby("day")["amount"].sum()

    # Build 2D grid: weeks × days
    dates = pd.date_range(daily.index.min(), daily.index.max())
    vals  = np.array([daily.get(d.date(), 0) for d in dates])
    # Pad to full weeks
    pad  = dates[0].weekday()
    vals = np.concatenate([np.zeros(pad), vals])
    n_weeks = int(np.ceil(len(vals)/7))
    vals = np.concatenate([vals, np.zeros(n_weeks*7 - len(vals))])
    grid = vals.reshape(n_weeks, 7)

    fig, ax = plt.subplots(figsize=(14, 4))
    im = ax.imshow(grid.T, aspect="auto", cmap="Greens", vmin=0)
    ax.set_yticks(range(7)); ax.set_yticklabels(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], fontsize=8)
    ax.set_xticks([]); fig.colorbar(im, ax=ax, label="EGP Spent")
    ax.set_title("Chart 8 — Daily Spending Heatmap", fontweight="bold")
    save(fig, "08_spending_heatmap")


# ── 9. Budget Alert Summary ───────────────────────────────────────────────────
def chart9_budget_alerts(bud):
    """Chart 9 — Bar chart showing budget utilization with alert coloring."""
    bud["pct"] = (bud["spentAmount"] / bud["limitAmount"] * 100).clip(upper=130)
    avg = bud.groupby("category")["pct"].mean().sort_values(ascending=False).head(8)

    colors = ["#ef4444" if v>=100 else "#f59e0b" if v>=80 else "#10b981" for v in avg.values]
    fig, ax = plt.subplots(figsize=(8, 4.5))
    bars = ax.bar(avg.index, avg.values, color=colors, alpha=0.85)
    ax.axhline(80,  linestyle="--", color="#f59e0b", linewidth=1.2, label="Warning 80%")
    ax.axhline(100, linestyle="--", color="#ef4444", linewidth=1.2, label="Exceeded 100%")
    ax.set_ylabel("Avg Budget Utilization (%)"); ax.set_ylim(0, 135)
    ax.set_xticklabels(avg.index, rotation=30, ha="right", fontsize=8)
    ax.legend(fontsize=8); ax.set_title("Chart 9 — Budget Alert Summary", fontweight="bold")
    save(fig, "09_budget_alerts")


# ── 10. Payment Method Distribution ──────────────────────────────────────────
def chart10_payment_methods(tx):
    """Chart 10 — Horizontal bar: amount spent per payment method."""
    pm = (tx[tx["type"]=="expense"]
          .groupby("paymentMethod")["amount"].sum()
          .sort_values())

    labels_map = {"cash":"Cash","credit_card":"Credit Card","debit_card":"Debit Card",
                  "mobile_wallet":"Mobile Wallet","bank_transfer":"Bank Transfer"}
    labels = [labels_map.get(l, l) for l in pm.index]

    fig, ax = plt.subplots(figsize=(7, 4))
    bars = ax.barh(labels, pm.values / 1e3, color=PALETTE[:len(pm)], alpha=0.85)
    ax.set_xlabel("Total Spending (K EGP)")
    ax.bar_label(bars, fmt="%.0fK", padding=4, fontsize=8)
    ax.set_title("Chart 10 — Payment Method Distribution", fontweight="bold")
    save(fig, "10_payment_methods")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("\n[INFO] Loading data...")
    tx, vf, of, bud, goals = load()

    # Normalise nested $date fields to strings for grouping
    print("[INFO] Generating 10 charts...\n")
    chart1_cashflow(tx)
    chart2_income_expense(tx)
    chart3_donut(tx)
    chart4_budgets(bud)
    chart5_savings_goals(goals)
    chart6_entry_methods(tx)
    chart7_savings_rate(tx)
    chart8_heatmap(tx)
    chart9_budget_alerts(bud)
    chart10_payment_methods(tx)
    print("\n[DONE] All 10 charts saved to analysis/charts/\n")


if __name__ == "__main__":
    main()
