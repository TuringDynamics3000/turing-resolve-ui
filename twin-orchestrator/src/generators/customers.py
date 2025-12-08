"""
Customer Generator

Pure functions for generating synthetic customer seeds based on tenant demographics
and scenario configuration.

These functions do NOT call TuringCore - they only return CustomerSeed objects.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from random import Random
from typing import Any, Dict, Iterable, List

from models.customer import CustomerSeed
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig


# ---------- Internal helper structures ----------


@dataclass
class AgeBand:
    name: str
    min_age: int
    max_age: int
    weight: float


@dataclass
class IncomeBand:
    name: str
    min_annual: int
    max_annual: int
    weight: float


@dataclass
class EmploymentOption:
    status: str
    weight: float


@dataclass
class SegmentRule:
    segment: str
    age_band_name: str


# ---------- Public API ----------


def generate_customer_seeds(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    rng: Random,
) -> List[CustomerSeed]:
    """
    Generate synthetic customers based on tenant demographics and scenario config.

    - Uses tenant_cfg.raw["demographics"] if present.
    - Falls back to sane defaults if not.
    - Returns a list of `CustomerSeed` objects; NO side-effects on TuringCore.
    
    Args:
        tenant_cfg: Tenant configuration with demographics
        scenario_cfg: Scenario configuration with num_customers
        rng: Random number generator for reproducibility
        
    Returns:
        List of CustomerSeed objects ready to be created in TuringCore
    """
    demo_cfg = (tenant_cfg.raw or {}).get("demographics", {}) or {}

    age_bands = _load_age_bands(demo_cfg, rng)
    income_bands = _load_income_bands(demo_cfg, rng)
    employment_opts = _load_employment_options(demo_cfg, rng)
    segment_rules = _load_segment_rules(demo_cfg, age_bands)

    seeds: List[CustomerSeed] = []
    for idx in range(scenario_cfg.num_customers):
        external_ref = f"CUST-{idx+1:06d}"
        seed = _generate_single_customer(
            idx=idx,
            external_ref=external_ref,
            age_bands=age_bands,
            income_bands=income_bands,
            employment_opts=employment_opts,
            segment_rules=segment_rules,
            rng=rng,
        )
        seeds.append(seed)

    return seeds


def iter_customer_seeds(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    rng: Random,
) -> Iterable[CustomerSeed]:
    """
    Memory-friendly iterator version; identical logic to generate_customer_seeds.
    
    This is more efficient for large numbers of customers as it doesn't
    load all seeds into memory at once.
    
    Args:
        tenant_cfg: Tenant configuration with demographics
        scenario_cfg: Scenario configuration with num_customers
        rng: Random number generator for reproducibility
        
    Yields:
        CustomerSeed objects one at a time
    """
    demo_cfg = (tenant_cfg.raw or {}).get("demographics", {}) or {}

    age_bands = _load_age_bands(demo_cfg, rng)
    income_bands = _load_income_bands(demo_cfg, rng)
    employment_opts = _load_employment_options(demo_cfg, rng)
    segment_rules = _load_segment_rules(demo_cfg, age_bands)

    for idx in range(scenario_cfg.num_customers):
        external_ref = f"CUST-{idx+1:06d}"
        yield _generate_single_customer(
            idx=idx,
            external_ref=external_ref,
            age_bands=age_bands,
            income_bands=income_bands,
            employment_opts=employment_opts,
            segment_rules=segment_rules,
            rng=rng,
        )


# ---------- Core generation logic ----------


def _generate_single_customer(
    idx: int,
    external_ref: str,
    age_bands: List[AgeBand],
    income_bands: List[IncomeBand],
    employment_opts: List[EmploymentOption],
    segment_rules: List[SegmentRule],
    rng: Random,
) -> CustomerSeed:
    """
    Generate a single synthetic customer using weighted demographics.
    
    Args:
        idx: Customer index (used for email uniqueness)
        external_ref: External reference ID (e.g., "CUST-000001")
        age_bands: List of age bands with weights
        income_bands: List of income bands with weights
        employment_opts: List of employment options with weights
        segment_rules: List of segment mapping rules
        rng: Random number generator for reproducibility
        
    Returns:
        CustomerSeed object with realistic Australian identity
    """

    age_band = _weighted_choice(age_bands, [b.weight for b in age_bands], rng)
    age = rng.randint(age_band.min_age, age_band.max_age)

    # Use today as anchor; could also use "simulation start date" if you expose it.
    today = date.today()
    dob = today - timedelta(days=age * 365 + rng.randint(0, 364))

    income_band = _weighted_choice(
        income_bands, [b.weight for b in income_bands], rng
    )

    employment = _weighted_choice(
        employment_opts, [e.weight for e in employment_opts], rng
    )

    segment = _derive_segment_from_age_band(age_band, segment_rules)

    first_name = _sample_first_name(segment, rng)
    last_name = _sample_last_name(segment, rng)

    email = f"{first_name}.{last_name}.{idx}@cudigital.example.com".lower()
    mobile = _generate_au_mobile(rng)
    address = _generate_address(rng)

    return CustomerSeed(
        external_ref=external_ref,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=dob,
        email=email,
        mobile=mobile,
        address=address,
        segment=segment,
        income_band=income_band.name,
        employment_status=employment.status,
    )


# ---------- Config loaders ----------


def _load_age_bands(demo_cfg: Dict[str, Any], rng: Random) -> List[AgeBand]:
    """Load age bands from demographics config or use defaults."""
    raw_bands = (
        demo_cfg.get("ageBands")
        or demo_cfg.get("age_bands")
        or []
    )

    if not raw_bands:
        # Default bands if nothing configured
        return [
            AgeBand(name="YOUTH", min_age=16, max_age=24, weight=0.2),
            AgeBand(name="CORE", min_age=25, max_age=55, weight=0.55),
            AgeBand(name="SENIOR", min_age=56, max_age=85, weight=0.25),
        ]

    bands: List[AgeBand] = []
    for b in raw_bands:
        bands.append(
            AgeBand(
                name=str(b.get("band") or b.get("name")),
                min_age=int(b.get("minAge", 18)),
                max_age=int(b.get("maxAge", 80)),
                weight=float(b.get("weight", 1.0)),
            )
        )

    _normalise_weights_in_place(bands, rng)
    return bands


def _load_income_bands(demo_cfg: Dict[str, Any], rng: Random) -> List[IncomeBand]:
    """Load income bands from demographics config or use defaults."""
    raw_bands = (
        demo_cfg.get("incomeBands")
        or demo_cfg.get("income_bands")
        or []
    )

    if not raw_bands:
        return [
            IncomeBand("LOW", min_annual=25000, max_annual=50000, weight=0.3),
            IncomeBand("MEDIUM", min_annual=50000, max_annual=110000, weight=0.5),
            IncomeBand("HIGH", min_annual=110000, max_annual=220000, weight=0.2),
        ]

    bands: List[IncomeBand] = []
    for b in raw_bands:
        bands.append(
            IncomeBand(
                name=str(b.get("band") or b.get("name")),
                min_annual=int(b.get("minAnnual", 30000)),
                max_annual=int(b.get("maxAnnual", 200000)),
                weight=float(b.get("weight", 1.0)),
            )
        )

    _normalise_weights_in_place(bands, rng)
    return bands


def _load_employment_options(
    demo_cfg: Dict[str, Any],
    rng: Random,
) -> List[EmploymentOption]:
    """Load employment options from demographics config or use defaults."""
    raw_opts = (
        demo_cfg.get("employmentStatus")
        or demo_cfg.get("employment_status")
        or []
    )

    if not raw_opts:
        return [
            EmploymentOption("FULL_TIME", 0.55),
            EmploymentOption("PART_TIME", 0.2),
            EmploymentOption("STUDENT", 0.1),
            EmploymentOption("UNEMPLOYED", 0.05),
            EmploymentOption("RETIRED", 0.1),
        ]

    opts: List[EmploymentOption] = []
    for e in raw_opts:
        opts.append(
            EmploymentOption(
                status=str(e.get("status")),
                weight=float(e.get("weight", 1.0)),
            )
        )

    _normalise_weights_in_place(opts, rng)
    return opts


def _load_segment_rules(
    demo_cfg: Dict[str, Any],
    age_bands: List[AgeBand],
) -> List[SegmentRule]:
    """Load segment mapping rules from demographics config or use defaults."""
    raw_rules = (
        demo_cfg.get("segments")
        or demo_cfg.get("segmentsMapping")
        or []
    )
    rules: List[SegmentRule] = []

    for r in raw_rules:
        seg = str(r.get("segment") or r.get("name"))
        age_band_name = str(r.get("ageBand") or r.get("age_band") or "")
        rules.append(SegmentRule(segment=seg, age_band_name=age_band_name))

    # If none, create a simple default: map 1:1 to age band names.
    if not rules:
        for b in age_bands:
            rules.append(SegmentRule(segment=b.name, age_band_name=b.name))

    return rules


# ---------- Sampling helpers ----------


def _weighted_choice(
    items: List[Any],
    weights: List[float],
    rng: Random,
) -> Any:
    """
    Simple cumulative-weight sampler. Assumes len(items) == len(weights) > 0.
    """
    total = sum(weights)
    if total <= 0:
        # fallback to uniform
        return items[rng.randint(0, len(items) - 1)]

    r = rng.random() * total
    upto = 0.0
    for item, w in zip(items, weights):
        upto += w
        if upto >= r:
            return item

    return items[-1]


def _normalise_weights_in_place(items_with_weight_attr: List[Any], rng: Random) -> None:
    """
    Normalise .weight field across a list, avoiding zeros.
    """
    total = sum(getattr(i, "weight", 0.0) for i in items_with_weight_attr)
    if total <= 0:
        # Spread uniformly
        n = len(items_with_weight_attr)
        if n == 0:
            return
        for i in items_with_weight_attr:
            i.weight = 1.0 / n
        return

    for i in items_with_weight_attr:
        i.weight = getattr(i, "weight", 0.0) / total


# ---------- Segment / identity helpers ----------


def _derive_segment_from_age_band(
    age_band: AgeBand,
    rules: List[SegmentRule],
) -> str:
    """Derive customer segment from age band using mapping rules."""
    for rule in rules:
        if rule.age_band_name == age_band.name:
            return rule.segment
    # fallback: just use the age band name
    return age_band.name


_FIRST_NAMES_YOUTH = [
    "Liam", "Noah", "Olivia", "Ava", "Isla", "Mia", "Leo", "Hudson",
]
_FIRST_NAMES_CORE = [
    "James", "Michael", "Sarah", "Emily", "Daniel", "Jessica", "Andrew", "Kate",
]
_FIRST_NAMES_SENIOR = [
    "John", "Margaret", "Peter", "Susan", "Robert", "Helen", "David", "Patricia",
]

_LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Taylor", "Wilson", "Martin",
]


def _sample_first_name(segment: str, rng: Random) -> str:
    """Sample a first name appropriate for the customer segment."""
    seg_upper = segment.upper()
    if "YOUTH" in seg_upper:
        pool = _FIRST_NAMES_YOUTH
    elif "SENIOR" in seg_upper:
        pool = _FIRST_NAMES_SENIOR
    else:
        pool = _FIRST_NAMES_CORE

    return pool[rng.randint(0, len(pool) - 1)]


def _sample_last_name(segment: str, rng: Random) -> str:
    """Sample a last name."""
    return _LAST_NAMES[rng.randint(0, len(_LAST_NAMES) - 1)]


def _generate_au_mobile(rng: Random) -> str:
    """
    Generate a simple Australian-style mobile number: 04xx xxx xxx
    (not meant to be real, just shape-correct).
    """
    digits = [str(rng.randint(0, 9)) for _ in range(8)]
    base = "".join(digits)
    return "04" + base[:2] + " " + base[2:5] + " " + base[5:8]


_SUBURBS = [
    ("Sydney", "NSW", "2000"),
    ("Melbourne", "VIC", "3000"),
    ("Brisbane", "QLD", "4000"),
    ("Adelaide", "SA", "5000"),
    ("Perth", "WA", "6000"),
]


def _generate_address(rng: Random) -> Dict[str, str]:
    """Generate a realistic Australian address."""
    street_no = rng.randint(1, 250)
    street_names = ["George St", "King St", "High St", "Main Rd", "Victoria Rd"]
    street = street_names[rng.randint(0, len(street_names) - 1)]
    suburb, state, postcode = _SUBURBS[rng.randint(0, len(_SUBURBS) - 1)]

    return {
        "line1": f"{street_no} {street}",
        "line2": "",
        "suburb": suburb,
        "state": state,
        "postcode": postcode,
        "country": "AU",
    }
