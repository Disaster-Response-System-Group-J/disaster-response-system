import unittest

from app.utils.consideration_score import compute_consideration_scores


class ConsiderationScoreTests(unittest.TestCase):
    def test_single_hazard_row_returns_minimal_output(self):
        preds = [
            {
                "division": "Division-1",
                "date": "2026-05-06",
                "hazard": "Flood",
                "flood_p_normal": 0.05,
                "flood_p_moderate": 0.10,
                "flood_p_severe": 0.15,
                "flood_p_extreme": 0.70,
            }
        ]
        pop_rows = [{"division": "Division-1", "population": 1000}]

        results = compute_consideration_scores(preds, pop_rows)

        self.assertEqual(len(results), 1)
        self.assertEqual(set(results[0].keys()), {"division", "date", "consideration_score"})
        self.assertEqual(results[0]["division"], "Division-1")
        self.assertEqual(results[0]["date"], "2026-05-06")
        self.assertGreaterEqual(results[0]["consideration_score"], 0.0)
        self.assertLessEqual(results[0]["consideration_score"], 1.0)

    def test_class_multiplier_changes_score(self):
        pop_rows = [{"division": "Division-1", "population": 1000}]

        normal_row = [
            {
                "division": "Division-1",
                "date": "2026-05-06",
                "hazard": "Flood",
                "normal": 0.90,
                "moderate": 0.05,
                "severe": 0.03,
                "extreme": 0.02,
            }
        ]
        extreme_row = [
            {
                "division": "Division-1",
                "date": "2026-05-06",
                "hazard": "Flood",
                "normal": 0.02,
                "moderate": 0.03,
                "severe": 0.05,
                "extreme": 0.90,
            }
        ]

        normal_score = compute_consideration_scores(normal_row, pop_rows)[0]["consideration_score"]
        extreme_score = compute_consideration_scores(extreme_row, pop_rows)[0]["consideration_score"]

        self.assertLess(normal_score, extreme_score)


if __name__ == "__main__":
    unittest.main()
