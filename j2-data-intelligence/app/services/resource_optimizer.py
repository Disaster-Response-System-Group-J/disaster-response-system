from typing import List, Dict, Any
import os
import json

try:
    import openai
except Exception:
    openai = None


def _compute_totals(resources: List[Dict[str, Any]]) -> Dict[str, float]:
    totals = {
        "hospital_bed_capacity": 0.0,
        "emergency_shelters": 0.0,
        "ambulance_count": 0.0,
        "food_stock_tons": 0.0,
        "clean_water_capacity_liters": 0.0,
        "power_grid_resilience": 0.0,
    }
    for r in resources:
        for k in totals.keys():
            v = r.get(k)
            if v is None or v == "":
                continue
            try:
                totals[k] += float(v)
            except Exception:
                continue
    return totals


def heuristic_allocate(considerations: List[Dict[str, Any]], resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Simple proportional allocator as a safe fallback.

    Allocates each resource proportionally to the consideration_score.
    """
    totals = _compute_totals(resources)
    total_score = sum(max(0.0, float(c.get("consideration_score", 0.0))) for c in considerations)
    if total_score == 0:
        # evenly distribute if no risk
        n = max(1, len(considerations))
        per_share = {k: totals[k] / n for k in totals}
        return [dict(division=c.get("division"), **per_share) for c in considerations]

    allocations = []
    for c in considerations:
        score = max(0.0, float(c.get("consideration_score", 0.0)))
        frac = score / total_score
        alloc = {k: (totals[k] * frac) for k in totals}
        alloc["division"] = c.get("division")
        allocations.append(alloc)

    return allocations


def build_prompt(considerations: List[Dict[str, Any]], resources: List[Dict[str, Any]]) -> str:
    totals = _compute_totals(resources)
    prompt = {
        "instructions": (
            "You are a resource optimization assistant. Given a list of divisions with a single-\n"
            "numeric 'consideration_score' (higher means more urgent) and the total available resources, \n"
            "suggest a redistribution of the available totals across divisions. Return a JSON array of objects\n"
            "with keys: division, hospital_bed_capacity, emergency_shelters, ambulance_count, food_stock_tons,\n"
            "clean_water_capacity_liters, power_grid_resilience. Do not exceed the provided totals.\n"
            "Prefer integer values where counts are discrete (beds, shelters, ambulances).\n"
        ),
        "totals": totals,
        "divisions": [{"division": c.get("division"), "consideration_score": c.get("consideration_score")} for c in considerations],
        "response_format": "JSON array"
    }
    return json.dumps(prompt, indent=2)


def optimize_with_llm(considerations: List[Dict[str, Any]], resources: List[Dict[str, Any]], use_llm: bool = True, model: str = "gpt-4") -> List[Dict[str, Any]]:
    """Try to get allocation from LLM; fall back to heuristic if not available or parsing fails."""
    if not use_llm or openai is None or os.getenv("OPENAI_API_KEY") is None:
        return heuristic_allocate(considerations, resources)

    openai.api_key = os.getenv("OPENAI_API_KEY")
    prompt = build_prompt(considerations, resources)

    try:
        resp = openai.ChatCompletion.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1000,
        )
        text = resp["choices"][0]["message"]["content"].strip()
        # Try to parse JSON from model
        try:
            data = json.loads(text)
            # Validate structure
            if isinstance(data, list):
                return data
        except Exception:
            # attempt to extract JSON substring
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end != -1:
                try:
                    data = json.loads(text[start:end+1])
                    if isinstance(data, list):
                        return data
                except Exception:
                    pass
    except Exception:
        pass

    # fallback
    return heuristic_allocate(considerations, resources)
