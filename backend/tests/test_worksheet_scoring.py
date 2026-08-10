import pytest
from app.application.services.excel_header_extractor import ExcelHeaderExtractor

def test_worksheet_classification():
    # Test summary classification by name
    c1 = ExcelHeaderExtractor._classify_worksheet("CAT-3", 17, 4, 1, 12, True)
    assert c1 == "SUMMARY"

    # Test pivot table classification by content indicators
    c2 = ExcelHeaderExtractor._classify_worksheet("Sheet1", 20, 5, 3, 2, False)
    assert c2 == "PIVOT_TABLE"

    # Test project data classification
    c3 = ExcelHeaderExtractor._classify_worksheet("CMF F1H", 20, 59, 0, 45, False)
    assert c3 == "PROJECT_DATA"

    # Test empty sheet classification
    c4 = ExcelHeaderExtractor._classify_worksheet("Sheet2", 0, 0, 0, 0, False)
    assert c4 == "EMPTY"

def test_worksheet_scoring_project_data_beats_pivot():
    class DummySheet:
        def __init__(self, rows):
            self._rows = rows
        def iter_rows(self, max_row=20, values_only=True):
            return self._rows[:max_row]

    # CAT-3 pivot/summary sheet: 4 cols, 17 rows, pivot name
    cat3_rows = [["Grand Total", "Count of CAT", "Row Labels", "Total"]] * 17
    cat3_sheet = DummySheet(cat3_rows)

    # CMF F1H project data sheet: 59 cols, 20 rows
    headers = ["unique_id", "part_name", "part_number", "supplier_name", "buyer", "weekly_capacity", "lead_time", "cat_evaluation"] + [f"col_{i}" for i in range(51)]
    cmf_rows = [headers] + [["val"] * 59] * 19
    cmf_sheet = DummySheet(cmf_rows)

    template_kws = {"unique_id", "part_name", "part_number", "supplier_name", "buyer", "cat_evaluation"}

    s_cat3 = ExcelHeaderExtractor._score_sheet(cat3_sheet, "CAT-3", template_kws)
    s_cmf = ExcelHeaderExtractor._score_sheet(cmf_sheet, "CMF F1H", template_kws)

    assert s_cat3["classification"] in ["SUMMARY", "PIVOT_TABLE"]
    assert s_cmf["classification"] == "PROJECT_DATA"
    assert s_cmf["score"] > s_cat3["score"]
    assert s_cmf["confidence"] > s_cat3["confidence"]
