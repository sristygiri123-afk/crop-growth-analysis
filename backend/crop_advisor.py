"""
Explainable crop advisor
========================
Ranks crops using soil NPK, temperature, location suitability, mandi
demand/price, and farmer growing cost. Scores are additive and each
factor is returned as a farmer-facing explanation (why this crop).

Market figures are a representative Indian mandi snapshot (₹/quintal)
so the system can run without an API key. Replace MARKET in this file
or POST overrides when live Agmarknet prices are available.
"""

from __future__ import annotations

from typing import Any

STATES = [
    "Andhra Pradesh",
    "Bihar",
    "Gujarat",
    "Haryana",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Tamil Nadu",
    "Telangana",
    "Uttar Pradesh",
    "West Bengal",
]

# Agro-climatic buckets used for location matching
ZONE_NORTH = {"Punjab", "Haryana", "Uttar Pradesh", "Bihar", "Rajasthan"}
ZONE_WEST = {"Maharashtra", "Gujarat", "Madhya Pradesh", "Rajasthan"}
ZONE_SOUTH = {"Tamil Nadu", "Karnataka", "Andhra Pradesh", "Telangana", "Kerala"}
ZONE_EAST = {"West Bengal", "Odisha", "Bihar"}
ZONE_CENTRAL = {"Madhya Pradesh", "Uttar Pradesh", "Maharashtra"}

CROPS: list[dict[str, Any]] = [
    {
        "id": "rice",
        "name": "Rice (Paddy)",
        "season": "Kharif",
        "n": (70, 90, 110),
        "p": (30, 45, 60),
        "k": (30, 45, 60),
        "temp_c": (20, 27, 35),
        "zones": ZONE_EAST | ZONE_SOUTH | {"Punjab", "Haryana", "Uttar Pradesh"},
        "yield_qtl_acre": 22,
        "default_cost_acre": 28000,
        "price_qtl": 2200,
        "demand": 82,
        "notes": "Staple grain with steady mandi offtake in rice-growing belts.",
    },
    {
        "id": "wheat",
        "name": "Wheat",
        "season": "Rabi",
        "n": (50, 80, 110),
        "p": (30, 50, 70),
        "k": (25, 40, 60),
        "temp_c": (10, 18, 25),
        "zones": ZONE_NORTH | ZONE_CENTRAL,
        "yield_qtl_acre": 18,
        "default_cost_acre": 22000,
        "price_qtl": 2400,
        "demand": 80,
        "notes": "Strong rabi demand in north and central India.",
    },
    {
        "id": "maize",
        "name": "Maize",
        "season": "Kharif / Rabi",
        "n": (70, 90, 120),
        "p": (35, 50, 70),
        "k": (30, 45, 70),
        "temp_c": (18, 26, 32),
        "zones": ZONE_WEST | ZONE_EAST | ZONE_SOUTH | {"Bihar", "Uttar Pradesh"},
        "yield_qtl_acre": 25,
        "default_cost_acre": 20000,
        "price_qtl": 2100,
        "demand": 74,
        "notes": "Feed and industrial demand keeps maize moving in mandis.",
    },
    {
        "id": "cotton",
        "name": "Cotton",
        "season": "Kharif",
        "n": (80, 110, 140),
        "p": (35, 50, 70),
        "k": (40, 55, 80),
        "temp_c": (21, 30, 38),
        "zones": {"Maharashtra", "Gujarat", "Telangana", "Andhra Pradesh", "Haryana", "Punjab", "Rajasthan"},
        "yield_qtl_acre": 8,
        "default_cost_acre": 32000,
        "price_qtl": 6800,
        "demand": 71,
        "notes": "Fibre crop; mill demand is high but input cost is also high.",
    },
    {
        "id": "sugarcane",
        "name": "Sugarcane",
        "season": "Annual",
        "n": (100, 140, 180),
        "p": (40, 60, 90),
        "k": (50, 80, 120),
        "temp_c": (20, 30, 38),
        "zones": {"Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "Andhra Pradesh", "Haryana", "Punjab"},
        "yield_qtl_acre": 280,
        "default_cost_acre": 55000,
        "price_qtl": 340,
        "demand": 68,
        "notes": "Mill-linked crop. High biomass yield, long duration, high cash outlay.",
    },
    {
        "id": "soybean",
        "name": "Soybean",
        "season": "Kharif",
        "n": (20, 40, 60),
        "p": (40, 60, 80),
        "k": (20, 40, 60),
        "temp_c": (20, 27, 33),
        "zones": {"Madhya Pradesh", "Maharashtra", "Rajasthan"},
        "yield_qtl_acre": 10,
        "default_cost_acre": 18000,
        "price_qtl": 4300,
        "demand": 77,
        "notes": "Oilseed with strong processor demand in central India.",
    },
    {
        "id": "mustard",
        "name": "Mustard",
        "season": "Rabi",
        "n": (40, 70, 100),
        "p": (25, 40, 60),
        "k": (15, 30, 50),
        "temp_c": (10, 18, 25),
        "zones": {"Rajasthan", "Haryana", "Madhya Pradesh", "Uttar Pradesh", "Gujarat"},
        "yield_qtl_acre": 8,
        "default_cost_acre": 15000,
        "price_qtl": 5500,
        "demand": 73,
        "notes": "Oilseed that sells well in rabi mandis of north-west India.",
    },
    {
        "id": "chickpea",
        "name": "Chickpea (Gram)",
        "season": "Rabi",
        "n": (15, 30, 50),
        "p": (30, 50, 70),
        "k": (15, 30, 50),
        "temp_c": (15, 22, 28),
        "zones": {"Madhya Pradesh", "Maharashtra", "Rajasthan", "Uttar Pradesh", "Karnataka"},
        "yield_qtl_acre": 8,
        "default_cost_acre": 16000,
        "price_qtl": 5200,
        "demand": 79,
        "notes": "Pulse with consistently high kitchen and mill demand.",
    },
    {
        "id": "groundnut",
        "name": "Groundnut",
        "season": "Kharif",
        "n": (15, 30, 50),
        "p": (30, 50, 70),
        "k": (25, 40, 60),
        "temp_c": (22, 28, 35),
        "zones": {"Gujarat", "Andhra Pradesh", "Tamil Nadu", "Karnataka", "Rajasthan"},
        "yield_qtl_acre": 12,
        "default_cost_acre": 21000,
        "price_qtl": 5800,
        "demand": 75,
        "notes": "Oilseed/snack crop with strong Gujarat and south India offtake.",
    },
    {
        "id": "potato",
        "name": "Potato",
        "season": "Rabi",
        "n": (80, 120, 160),
        "p": (40, 70, 100),
        "k": (80, 120, 160),
        "temp_c": (10, 18, 24),
        "zones": {"Uttar Pradesh", "West Bengal", "Bihar", "Punjab", "Gujarat"},
        "yield_qtl_acre": 90,
        "default_cost_acre": 45000,
        "price_qtl": 1200,
        "demand": 88,
        "notes": "Very high mandi volume; prices swing, but demand stays strong.",
    },
    {
        "id": "onion",
        "name": "Onion",
        "season": "Rabi / Kharif",
        "n": (50, 80, 110),
        "p": (30, 50, 70),
        "k": (40, 70, 100),
        "temp_c": (13, 25, 32),
        "zones": {"Maharashtra", "Karnataka", "Gujarat", "Madhya Pradesh", "Rajasthan", "Andhra Pradesh"},
        "yield_qtl_acre": 80,
        "default_cost_acre": 40000,
        "price_qtl": 1800,
        "demand": 92,
        "notes": "Among the fastest-selling vegetables in Indian mandis.",
    },
    {
        "id": "tomato",
        "name": "Tomato",
        "season": "Year-round (with care)",
        "n": (70, 100, 140),
        "p": (40, 60, 90),
        "k": (50, 80, 120),
        "temp_c": (18, 26, 32),
        "zones": ZONE_SOUTH | ZONE_WEST | {"Uttar Pradesh", "Bihar", "West Bengal"},
        "yield_qtl_acre": 100,
        "default_cost_acre": 48000,
        "price_qtl": 1600,
        "demand": 90,
        "notes": "High daily demand in urban markets; price is volatile.",
    },
    {
        "id": "chilli",
        "name": "Chilli",
        "season": "Kharif / Rabi",
        "n": (60, 90, 120),
        "p": (30, 50, 70),
        "k": (40, 70, 100),
        "temp_c": (20, 28, 35),
        "zones": {"Andhra Pradesh", "Telangana", "Karnataka", "Madhya Pradesh", "Rajasthan"},
        "yield_qtl_acre": 12,
        "default_cost_acre": 35000,
        "price_qtl": 9000,
        "demand": 81,
        "notes": "Spice crop with export and domestic mill demand.",
    },
    {
        "id": "bajra",
        "name": "Pearl Millet (Bajra)",
        "season": "Kharif",
        "n": (30, 50, 80),
        "p": (15, 30, 50),
        "k": (15, 25, 45),
        "temp_c": (25, 32, 40),
        "zones": {"Rajasthan", "Gujarat", "Haryana", "Uttar Pradesh", "Maharashtra"},
        "yield_qtl_acre": 10,
        "default_cost_acre": 12000,
        "price_qtl": 2300,
        "demand": 62,
        "notes": "Low-cost millet suited to hot, dry belts; demand is moderate.",
    },
    {
        "id": "banana",
        "name": "Banana",
        "season": "Annual",
        "n": (150, 200, 260),
        "p": (40, 60, 90),
        "k": (200, 280, 360),
        "temp_c": (22, 28, 35),
        "zones": {"Tamil Nadu", "Maharashtra", "Gujarat", "Andhra Pradesh", "Kerala", "Karnataka", "Bihar"},
        "yield_qtl_acre": 180,
        "default_cost_acre": 70000,
        "price_qtl": 1200,
        "demand": 84,
        "notes": "Continuous market offtake, but high potassium and cash need.",
    },
]


def _tri_score(value: float, low: float, opt: float, high: float) -> float:
    """0–100 triangular membership around the crop optimum."""
    if value <= low or value >= high:
        # still give a small score if nearby, zero if far
        span = max(high - low, 1.0)
        dist = low - value if value < low else value - high
        return max(0.0, 25.0 * (1.0 - dist / span))
    if value == opt:
        return 100.0
    if value < opt:
        return 50.0 + 50.0 * (value - low) / max(opt - low, 1e-6)
    return 50.0 + 50.0 * (high - value) / max(high - opt, 1e-6)


def _demand_label(score: float) -> str:
    if score >= 85:
        return "Very high selling"
    if score >= 75:
        return "High selling"
    if score >= 65:
        return "Steady selling"
    return "Moderate selling"


def _npk_why(nutrient: str, value: float, low: float, opt: float, high: float, score: float) -> str:
    unit = "kg/ha"
    if score >= 75:
        return (
            f"{nutrient} is {value:.0f} {unit}, close to this crop's preferred "
            f"level of about {opt:.0f} {unit} (fit {low:.0f}–{high:.0f})."
        )
    if score >= 45:
        return (
            f"{nutrient} is {value:.0f} {unit}. This crop prefers about {opt:.0f} {unit}. "
            "It can still grow, but fertiliser planning would help."
        )
    return (
        f"{nutrient} is {value:.0f} {unit}, which is a poor match for this crop "
        f"(preferred about {opt:.0f} {unit}, range {low:.0f}–{high:.0f})."
    )


def _temp_why(temp: float, low: float, opt: float, high: float, score: float) -> str:
    if score >= 75:
        return f"Temperature {temp:.1f}°C suits this crop (comfortable around {opt:.0f}°C)."
    if score >= 45:
        return (
            f"Temperature {temp:.1f}°C is workable but not ideal "
            f"(this crop likes about {low:.0f}–{high:.0f}°C)."
        )
    return (
        f"Temperature {temp:.1f}°C is outside the good window "
        f"({low:.0f}–{high:.0f}°C) for this crop."
    )


def recommend(
    n: float,
    p: float,
    k: float,
    temperature_c: float,
    location: str,
    land_acres: float = 1.0,
    farmer_expense_total: float | None = None,
    farmer_expense_per_acre: float | None = None,
) -> dict[str, Any]:
    location = (location or "").strip()
    if location not in STATES:
        raise ValueError(f"Unknown location '{location}'. Choose an Indian state from the list.")
    if land_acres <= 0:
        raise ValueError("Land area must be greater than 0 acres.")

    ranked: list[dict[str, Any]] = []

    for crop in CROPS:
        n_s = _tri_score(n, *crop["n"])
        p_s = _tri_score(p, *crop["p"])
        k_s = _tri_score(k, *crop["k"])
        t_s = _tri_score(temperature_c, *crop["temp_c"])
        loc_ok = location in crop["zones"]
        loc_s = 100.0 if loc_ok else 28.0
        soil_s = (n_s + p_s + k_s) / 3.0
        agronomic = 0.45 * soil_s + 0.30 * t_s + 0.25 * loc_s

        demand_s = float(crop["demand"])
        cost_acre = crop["default_cost_acre"]
        if farmer_expense_per_acre is not None:
            cost_acre = float(farmer_expense_per_acre)
        elif farmer_expense_total is not None:
            cost_acre = float(farmer_expense_total) / land_acres

        revenue_acre = crop["yield_qtl_acre"] * crop["price_qtl"]
        profit_acre = revenue_acre - cost_acre
        ranked.append(
            {
                "crop": crop,
                "scores": {
                    "nitrogen": round(n_s, 1),
                    "phosphorus": round(p_s, 1),
                    "potassium": round(k_s, 1),
                    "soil": round(soil_s, 1),
                    "temperature": round(t_s, 1),
                    "location": round(loc_s, 1),
                    "agronomic": round(agronomic, 1),
                    "market_demand": round(demand_s, 1),
                },
                "cost_acre": round(cost_acre, 2),
                "revenue_acre": round(revenue_acre, 2),
                "profit_acre": round(profit_acre, 2),
                "location_match": loc_ok,
            }
        )

    max_profit = max(item["profit_acre"] for item in ranked)
    min_profit = min(item["profit_acre"] for item in ranked)
    span = max(max_profit - min_profit, 1.0)

    for item in ranked:
        # Relative profit among candidates, clipped 0–100
        profit_s = 100.0 * (item["profit_acre"] - min_profit) / span
        if item["profit_acre"] < 0:
            profit_s = min(profit_s, 25.0)
        item["scores"]["profit"] = round(profit_s, 1)

        agr = item["scores"]["agronomic"]
        dem = item["scores"]["market_demand"]
        prf = item["scores"]["profit"]

        # Market + money are the decision drivers; agronomy is a gate.
        # Poor agronomy is penalised so a hot-selling crop is not forced
        # onto soil/climate that cannot grow it.
        overall = 0.30 * agr + 0.35 * dem + 0.35 * prf
        if agr < 40:
            overall *= 0.55
        elif agr < 55:
            overall *= 0.82
        item["scores"]["overall"] = round(overall, 1)

        crop = item["crop"]
        why = [
            _npk_why("Nitrogen (N)", n, *crop["n"], item["scores"]["nitrogen"]),
            _npk_why("Phosphorus (P)", p, *crop["p"], item["scores"]["phosphorus"]),
            _npk_why("Potassium (K)", k, *crop["k"], item["scores"]["potassium"]),
            _temp_why(temperature_c, *crop["temp_c"], item["scores"]["temperature"]),
        ]
        if item["location_match"]:
            why.append(
                f"{crop['name']} is commonly grown in {location}, so climate and "
                "local know-how generally support it."
            )
        else:
            why.append(
                f"{location} is not a typical belt for {crop['name']}. "
                "Yield and market access may be weaker than in its core regions."
            )
        why.append(
            f"Mandi demand is {_demand_label(dem).lower()} "
            f"(demand score {dem:.0f}/100). {crop['notes']}"
        )
        why.append(
            f"At about ₹{crop['price_qtl']:,.0f} per quintal and ~{crop['yield_qtl_acre']} "
            f"quintals/acre, expected sales are ₹{item['revenue_acre']:,.0f}/acre. "
            f"After growing cost of ₹{item['cost_acre']:,.0f}/acre, estimated profit is "
            f"₹{item['profit_acre']:,.0f}/acre"
            + (
                f" (₹{item['profit_acre'] * land_acres:,.0f} on {land_acres:g} acres)."
                if land_acres != 1
                else "."
            )
        )
        item["why"] = why
        item["demand_label"] = _demand_label(dem)
        item["viable"] = agr >= 40 and item["profit_acre"] > 0

    ranked.sort(key=lambda x: x["scores"]["overall"], reverse=True)

    def public_row(item: dict[str, Any], include_why: bool = True) -> dict[str, Any]:
        crop = item["crop"]
        row = {
            "id": crop["id"],
            "name": crop["name"],
            "season": crop["season"],
            "overall_score": item["scores"]["overall"],
            "factor_scores": item["scores"],
            "demand_label": item["demand_label"],
            "mandi_price_qtl": crop["price_qtl"],
            "expected_yield_qtl_acre": crop["yield_qtl_acre"],
            "expected_revenue_acre": item["revenue_acre"],
            "growing_cost_acre": item["cost_acre"],
            "expected_profit_acre": item["profit_acre"],
            "expected_profit_total": round(item["profit_acre"] * land_acres, 2),
            "location_match": item["location_match"],
            "viable": item["viable"],
        }
        if include_why:
            row["why"] = item["why"]
            row["decision_summary"] = (
                f"Choose {crop['name']} because mandi demand is {item['demand_label'].lower()} "
                f"and estimated profit is ₹{item['profit_acre']:,.0f} per acre after your expenses, "
                f"while soil NPK and {temperature_c:.1f}°C in {location} "
                + ("are a good growing match." if item["viable"] else "are only a partial match — treat this as a cautious option.")
            )
        return row

    best = ranked[0]
    alternatives = [public_row(item, include_why=False) for item in ranked[1:6]]

    return {
        "ok": True,
        "inputs": {
            "n": n,
            "p": p,
            "k": k,
            "temperature_c": temperature_c,
            "location": location,
            "land_acres": land_acres,
        },
        "method": {
            "weights": {
                "agronomic_soil_temp_location": 0.30,
                "market_demand": 0.35,
                "profit_after_expenses": 0.35,
            },
            "note": (
                "Overall score mixes growing fit with mandi demand and profit after cost. "
                "Crops with weak soil/climate fit are penalised even if they sell well. "
                "Prices are a representative mandi snapshot, not a live feed."
            ),
        },
        "recommendation": public_row(best, include_why=True),
        "alternatives": alternatives,
        "all_ranked": [public_row(item, include_why=False) for item in ranked],
    }


def meta() -> dict[str, Any]:
    return {
        "locations": STATES,
        "crops": [
            {
                "id": c["id"],
                "name": c["name"],
                "season": c["season"],
                "mandi_price_qtl": c["price_qtl"],
                "demand": c["demand"],
                "demand_label": _demand_label(c["demand"]),
                "default_cost_acre": c["default_cost_acre"],
            }
            for c in sorted(CROPS, key=lambda x: -x["demand"])
        ],
    }
