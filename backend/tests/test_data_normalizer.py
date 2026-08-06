import pytest
from datetime import date, datetime
from app.domain.import_schema import ImportColumnSpec
from app.application.services.data_normalizer import DataNormalizer


def test_numeric_normalization():
    spec_int = ImportColumnSpec(key="qty", label="Quantity", type="integer")
    spec_num = ImportColumnSpec(key="budget", label="Budget", type="number")

    # Business units
    res1 = DataNormalizer.normalize("3400 pcs-sem", spec_int)
    assert res1.normalized_value == 3400
    assert not res1.is_null

    res2 = DataNormalizer.normalize("5200 pcs/week", spec_int)
    assert res2.normalized_value == 5200

    res3 = DataNormalizer.normalize("15 weeks", spec_int)
    assert res3.normalized_value == 15

    # Currency and thousand separators
    res4 = DataNormalizer.normalize("5,200", spec_num)
    assert res4.normalized_value == 5200.0

    res5 = DataNormalizer.normalize("80%", spec_num)
    assert res5.normalized_value == 80.0

    res6 = DataNormalizer.normalize("€3500", spec_num)
    assert res6.normalized_value == 3500.0

    res7 = DataNormalizer.normalize("$12,500.50", spec_num)
    assert res7.normalized_value == 12500.50


def test_null_proxy_normalization():
    spec_date = ImportColumnSpec(key="start_date", label="Start Date", type="date", nullable=True)
    spec_str = ImportColumnSpec(key="notes", label="Notes", type="string", nullable=True)

    null_inputs = [
        "",
        "  ",
        "N/A",
        "NA",
        "TBD",
        "TBDefined",
        "To Be Defined",
        "Not requested",
        "-",
        "/",
    ]

    for val in null_inputs:
        res = DataNormalizer.normalize(val, spec_date)
        assert res.is_null, f"Expected '{val}' to be recognized as null proxy for date"
        assert res.normalized_value is None

        res_str = DataNormalizer.normalize(val, spec_str)
        assert res_str.is_null, f"Expected '{val}' to be recognized as null proxy for string"


def test_ambiguous_date_normalization():
    spec_date = ImportColumnSpec(key="start_date", label="Start Date", type="date")

    res = DataNormalizer.normalize("29", spec_date)
    assert res.is_null
    assert res.normalized_value is None
    assert res.warning is not None
    assert "Ambiguous date value '29'" in res.warning


def test_date_parsing_formats():
    spec_date = ImportColumnSpec(key="start_date", label="Start Date", type="date")

    formats = [
        ("29/07/2026", date(2026, 7, 29)),
        ("07/29/2026", date(2026, 7, 29)),
        ("2026-07-29", date(2026, 7, 29)),
        ("29-07-2026", date(2026, 7, 29)),
        ("2026/07/29", date(2026, 7, 29)),
    ]

    for raw, expected in formats:
        res = DataNormalizer.normalize(raw, spec_date)
        assert not res.is_null
        assert res.normalized_value == expected, f"Failed for date input '{raw}'"


def test_enum_normalization():
    spec_enum = ImportColumnSpec(key="status", label="Status", type="enum")

    res = DataNormalizer.normalize("  Active  ", spec_enum)
    assert res.normalized_value == "active"

    res2 = DataNormalizer.normalize("On Hold", spec_enum)
    assert res2.normalized_value == "on_hold"
