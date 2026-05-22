"""
analysis/ml_models.py
Trains 3 ML models on synthetic data:
  1. Spending Predictor  — ARIMA per category (forecasts next 3 months)
  2. Budget Overrun      — Random Forest classifier
  3. Category Classifier — TF-IDF + Logistic Regression (improves on GPT baseline)

Run:  python analysis/ml_models.py
Out:  analysis/models/*.pkl + analysis/models/metrics.json
"""

import json, pickle
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

Path("analysis/models").mkdir(parents=True, exist_ok=True)
DATA = Path("data")


# ── helpers ───────────────────────────────────────────────────────────────────

def load_transactions():
    raw = json.loads((DATA / "transactions.json").read_text("utf-8"))
    df  = pd.DataFrame(raw)
    df["date"]   = pd.to_datetime([d["$date"] for d in df["date"]])
    df["userId"] = [u["$oid"] for u in df["userId"]]
    return df


def load_feedback():
    vf = pd.DataFrame(json.loads((DATA / "voice_feedback.json").read_text("utf-8")))
    of = pd.DataFrame(json.loads((DATA / "ocr_feedback.json").read_text("utf-8")))
    return vf, of


def save_model(obj, name):
    p = f"analysis/models/{name}.pkl"
    with open(p, "wb") as f:
        pickle.dump(obj, f)
    print(f"  [OK] Saved {p}")


def save_metrics(metrics: dict):
    p = "analysis/models/metrics.json"
    with open(p, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  [OK] Saved {p}")


# ═════════════════════════════════════════════════════════════════════════════
#  MODEL 1 — Spending Predictor (ARIMA per top category)
# ═════════════════════════════════════════════════════════════════════════════

def train_spending_predictor(tx: pd.DataFrame) -> dict:
    """
    Train one ARIMA(2,1,2) model per top-8 expense category.
    Returns dict: {category: model}
    Falls back to statsmodels ARIMA; if not installed uses simple moving avg.
    """
    print("\n[1/3] Training Spending Predictor (ARIMA)...")

    try:
        from statsmodels.tsa.arima.model import ARIMA
        use_arima = True
    except ImportError:
        use_arima = False
        print("      [WARN] statsmodels not found -- using 3-month moving average fallback")

    expenses   = tx[tx["type"] == "expense"].copy()
    expenses["month"] = expenses["date"].dt.to_period("M")
    top_cats   = expenses.groupby("category")["amount"].sum().nlargest(8).index.tolist()

    models = {}
    cat_metrics = {}

    for cat in top_cats:
        monthly = (expenses[expenses["category"] == cat]
                   .groupby("month")["amount"].sum()
                   .sort_index())

        if len(monthly) < 6:
            continue

        train = monthly.iloc[:-2]
        test  = monthly.iloc[-2:]

        fitted = None
        if use_arima:
            for order in [(1,1,1),(0,1,1),(1,1,0),(1,0,0)]:
                try:
                    fitted = ARIMA(train.values, order=order).fit()
                    break
                except Exception:
                    fitted = None

        if fitted is not None:
            forecast = fitted.forecast(steps=2)
            mae  = float(np.mean(np.abs(forecast - test.values)))
            mape = float(np.mean(np.abs((forecast - test.values) / (test.values + 1))) * 100)
            models[cat] = fitted
            cat_metrics[cat] = {"type": "arima", "mae": round(mae, 2), "mape": round(mape, 2)}
        else:
            # Fallback: 3-month moving average
            ma_vals = train.values[-3:].tolist()
            models[cat] = {"type": "ma3", "values": ma_vals}
            pred  = float(np.mean(ma_vals))
            mae   = float(np.mean(np.abs(pred - test.values)))
            cat_metrics[cat] = {"type": "ma3", "mae": round(mae, 2), "mape": None}

        print(f"      {cat:30s}  MAE={cat_metrics[cat]['mae']:,.0f} EGP  [{cat_metrics[cat]['type']}]")

    save_model({"models": models, "categories": top_cats}, "spending_predictor")
    return cat_metrics


# ═════════════════════════════════════════════════════════════════════════════
#  MODEL 2 — Budget Overrun Classifier (Random Forest)
# ═════════════════════════════════════════════════════════════════════════════

def train_budget_overrun(tx: pd.DataFrame) -> dict:
    """
    Features built from transaction history per user-category-month.
    Label: did the user exceed budget that month?
    """
    print("\n[2/3] Training Budget Overrun Classifier (Random Forest)...")

    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import cross_val_score
        from sklearn.metrics import classification_report
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        print("      [WARN] scikit-learn not installed -- skipping this model")
        print("         pip install scikit-learn")
        return {}

    expenses = tx[tx["type"] == "expense"].copy()
    expenses["month"] = expenses["date"].dt.to_period("M")

    # Build feature rows per user per category per month
    rows = []
    grouped = expenses.groupby(["userId", "category", "month"])

    monthly_agg = grouped["amount"].agg(["sum", "count", "std"]).reset_index()
    monthly_agg.columns = ["userId", "category", "month", "total", "count", "std"]
    monthly_agg["std"]  = monthly_agg["std"].fillna(0)

    # Simulate budget limits (80th-percentile spend = intended limit)
    cat_limits = expenses.groupby("category")["amount"].quantile(0.80).to_dict()

    for _, row in monthly_agg.iterrows():
        limit     = cat_limits.get(row["category"], row["total"])
        exceeded  = int(row["total"] > limit)
        pct_spent = row["total"] / (limit or 1)
        days_gone = 20   # simulated mid-month snapshot
        days_left = 10

        rows.append({
            "pct_spent":       pct_spent,
            "days_gone":       days_gone,
            "days_left":       days_left,
            "avg_daily_spend": row["total"] / max(days_gone, 1),
            "std_amount":      row["std"],
            "tx_count":        row["count"],
            "exceeded":        exceeded,
        })

    df_feat = pd.DataFrame(rows)
    X = df_feat[["pct_spent","days_gone","days_left","avg_daily_spend","std_amount","tx_count"]]
    y = df_feat["exceeded"]

    scaler = StandardScaler()
    X_s    = scaler.fit_transform(X)

    clf = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42,
                                  class_weight="balanced")

    # 5-fold cross-validated recall (optimise for recall — don't miss overruns)
    scores = cross_val_score(clf, X_s, y, cv=5, scoring="recall")
    clf.fit(X_s, y)

    recall   = round(float(scores.mean()), 3)
    feat_imp = dict(zip(X.columns, clf.feature_importances_.round(3)))

    print(f"      CV Recall: {recall:.1%}")
    print(f"      Feature importance: {feat_imp}")

    save_model({"model": clf, "scaler": scaler, "features": list(X.columns)},
               "budget_overrun_classifier")

    return {"cv_recall": recall, "feature_importance": feat_imp}


# ═════════════════════════════════════════════════════════════════════════════
#  MODEL 3 — Category Classifier (TF-IDF + Logistic Regression)
# ═════════════════════════════════════════════════════════════════════════════

def train_category_classifier(vf: pd.DataFrame, of: pd.DataFrame) -> dict:
    """
    Trains on corrected feedback labels to improve over the GPT-4 baseline (75%).
    Input text: description / raw transcript.
    Output:     category label.
    """
    print("\n[3/3] Training Category Classifier (TF-IDF + LogReg)...")

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.model_selection import cross_val_score
    except ImportError:
        print("      ⚠  scikit-learn not installed — skipping")
        return {}

    # Build training set from feedback
    rows = []

    if len(vf):
        for _, r in vf.iterrows():
            cat = (r.get("correctedExtraction") or {}).get("category")
            txt = r.get("originalTranscript", "")
            if cat and txt:
                rows.append({"text": str(txt), "category": str(cat)})

    if len(of):
        for _, r in of.iterrows():
            cat = (r.get("correctedExtraction") or {}).get("category")
            txt = r.get("originalRawText", "")
            if cat and txt:
                rows.append({"text": str(txt), "category": str(cat)})

    if len(rows) < 50:
        print("      ⚠  Not enough labeled feedback data — skipping")
        return {}

    df    = pd.DataFrame(rows)
    X, y  = df["text"], df["category"]

    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4),
                                   max_features=8000, sublinear_tf=True)),
        ("clf",   LogisticRegression(max_iter=500, C=3.0, random_state=42,
                                      multi_class="auto"))
    ])

    scores  = cross_val_score(pipe, X, y, cv=5, scoring="accuracy")
    pipe.fit(X, y)

    accuracy = round(float(scores.mean()), 3)
    print(f"      CV Accuracy: {accuracy:.1%}  (GPT-4 baseline ~= 75%)")

    save_model(pipe, "category_classifier")
    return {"cv_accuracy": accuracy, "n_samples": len(rows),
            "n_classes": df["category"].nunique()}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n[*] Loading data...")
    tx      = load_transactions()
    vf, of  = load_feedback()

    metrics = {}
    metrics["spending_predictor"]      = train_spending_predictor(tx)
    metrics["budget_overrun"]          = train_budget_overrun(tx)
    metrics["category_classifier"]     = train_category_classifier(vf, of)
    metrics["trained_at"]              = datetime.utcnow().isoformat()

    save_metrics(metrics)
    print("\n[DONE] All models trained and saved to analysis/models/")
    print("       Install missing packages:  pip install statsmodels scikit-learn\n")


if __name__ == "__main__":
    main()
