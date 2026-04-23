"""
Train delay prediction model using LightGBM.
"""
import os
import sys
import pickle
import json

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, mean_absolute_error,
)

# Add parent dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


FEATURE_COLUMNS = [
    "distance_km", "cargo_type_encoded", "cargo_weight_kg",
    "transport_mode_encoded", "priority_encoded",
    "carrier_reliability", "weather_risk", "traffic_congestion",
    "temperature", "hour_of_day", "day_of_week", "month",
]


def train_delay_model(data_path=None, output_dir=None):
    """Train a LightGBM model for delay prediction."""
    try:
        import lightgbm as lgb
    except ImportError:
        print("LightGBM not installed. Using sklearn GradientBoosting as fallback.")
        lgb = None

    if data_path is None:
        data_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "synthetic_shipments.csv"
        )

    if output_dir is None:
        output_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "serving", "model_artifacts"
        )

    os.makedirs(output_dir, exist_ok=True)

    # Load data
    print(f"Loading data from {data_path}")
    df = pd.read_csv(data_path)
    print(f"Dataset shape: {df.shape}")

    X = df[FEATURE_COLUMNS].values
    y_class = df["is_delayed"].values
    y_prob = df["delay_probability"].values

    # Split
    X_train, X_test, y_train, y_test, yp_train, yp_test = train_test_split(
        X, y_class, y_prob, test_size=0.2, random_state=42
    )

    if lgb is not None:
        # LightGBM classifier
        print("Training LightGBM classifier...")
        clf = lgb.LGBMClassifier(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            num_leaves=31,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbose=-1,
        )
        clf.fit(X_train, y_train)

        # LightGBM regressor (for probability)
        print("Training LightGBM regressor...")
        reg = lgb.LGBMRegressor(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            num_leaves=31,
            random_state=42,
            verbose=-1,
        )
        reg.fit(X_train, yp_train)
    else:
        from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor

        print("Training GradientBoosting classifier...")
        clf = GradientBoostingClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.05, random_state=42
        )
        clf.fit(X_train, y_train)

        print("Training GradientBoosting regressor...")
        reg = GradientBoostingRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05, random_state=42
        )
        reg.fit(X_train, yp_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    y_pred_proba = reg.predict(X_test)

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall": round(recall_score(y_test, y_pred), 4),
        "f1": round(f1_score(y_test, y_pred), 4),
        "auc_roc": round(roc_auc_score(y_test, clf.predict_proba(X_test)[:, 1]), 4),
        "mae_probability": round(mean_absolute_error(yp_test, y_pred_proba), 4),
        "samples_train": len(X_train),
        "samples_test": len(X_test),
    }

    print("\n=== Model Metrics ===")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # Save models
    clf_path = os.path.join(output_dir, "delay_classifier.pkl")
    reg_path = os.path.join(output_dir, "delay_regressor.pkl")
    meta_path = os.path.join(output_dir, "model_metadata.json")

    with open(clf_path, "wb") as f:
        pickle.dump(clf, f)
    with open(reg_path, "wb") as f:
        pickle.dump(reg, f)

    metadata = {
        "model_version": "v1.0",
        "features": FEATURE_COLUMNS,
        "metrics": metrics,
        "framework": "lightgbm" if lgb else "sklearn",
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nModels saved to {output_dir}")
    return metrics


if __name__ == "__main__":
    # First generate data if not exists
    data_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "synthetic_shipments.csv"
    )
    if not os.path.exists(data_file):
        from data.generate_synthetic import generate_dataset
        generate_dataset(num_samples=10000)

    train_delay_model()
