# SPDX-License-Identifier: GPL-3.0-or-later


import unittest

from analysis_service import deterministic, who


class DeterministicAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.item = {
            "weight_kg": 7.2,
            "height_cm": 67.0,
            "age_months": 6,
            "sex": "P",
            "measurement_method": "Terlentang",
            "measurement_date": "2026-09-01",
            "exclusive_breastfeeding": "Ya",
        }

    def test_who_assessment_is_deterministic(self):
        result = who.assess_item(self.item)
        self.assertIn("bbu_status", result)
        self.assertIsNotNone(result["bbu_z_score"])
        self.assertNotIn("risk", result)
        self.assertNotIn("anomaly", result)

    def test_weight_gain_status_uses_thresholds(self):
        previous = {**self.item, "weight_kg": 6.7, "measurement_date": "2026-08-01"}
        self.assertEqual(deterministic.calculate_weight_gain_status(self.item, previous), "N")
        self.assertEqual(deterministic.calculate_weight_gain_status({**self.item, "weight_kg": 6.8}, previous), "T")

    def test_asi_progressive_answer_at_six_months(self):
        context = deterministic._asi_context(self.item, [])
        self.assertEqual(context["status"], "Ya")
        self.assertEqual(context["inferredAges"], [0, 1, 2, 3, 4, 5])

    def test_batch_contains_only_deterministic_fields(self):
        result = who.calculate_batch([self.item])
        self.assertEqual(result["calculator"], "python-deterministic-lms")
        self.assertEqual(len(result["items"]), 1)
        self.assertNotIn("risk", result["items"][0])
        self.assertNotIn("graph_analysis", result["items"][0])


if __name__ == "__main__":
    unittest.main()
