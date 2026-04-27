"""
Dashboard Repository — Data access layer for dashboard aggregation queries.

Implements 5 pure SQL aggregation methods for the dashboard data panel (SWARM-P2-007-BE).
All operations are read-only (BC-006), performing GROUP BY, COUNT directly in the
database engine (BC-002). All date calculations use UTC (BC-003). No write operations
or side effects beyond standard query logging.

File: app/repositories/dashboard_repository.py
"""

from typing import Any, Dict, List, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session


class DashboardRepository:
    """Repository for dashboard aggregation queries.

    Provides read-only aggregation methods that execute SQL directly against
    the assets, categories, and brands tables. All GROUP BY, COUNT operations
    are performed by the database engine (BC-002).

    Attributes:
        db: SQLAlchemy Session for executing database queries.
    """

    def __init__(self, db: Session) -> None:
        """Initialize the repository with a database session.

        Args:
            db: SQLAlchemy ORM Session instance used for query execution.
        """
        self.db = db

    def get_status_overview(self) -> Dict[str, Any]:
        """Retrieve total asset count and per-status distribution.

        Executes a GROUP BY query on the assets table to count assets by
        status. The total is derived as the sum of all per-status counts,
        ensuring consistency without a separate COUNT(*) query.

        Returns:
            Dict with keys:
                - total (int): Total number of assets across all statuses.
                - status_counts (Dict[str, int]): Mapping of each status
                  string to its count. Empty dict when no assets exist.
                  The service layer is responsible for ensuring all known
                  statuses appear with count 0 when data is missing.

        Example:
            {"total": 15, "status_counts": {"IN_USE": 7, "IDLE": 4,
             "IN_REPAIR": 2, "SCRAPPED": 2}}
        """
        sql = text("""
            SELECT status, COUNT(*) AS count
            FROM assets
            GROUP BY status
        """)
        result = self.db.execute(sql)

        status_counts: Dict[str, int] = {}
        for row in result:
            status_counts[row[0]] = row[1]

        total = sum(status_counts.values())

        return {
            "total": total,
            "status_counts": status_counts,
        }

    def get_category_distribution(self) -> Dict[str, Any]:
        """Retrieve asset count per category and uncategorized count.

        Categorized assets are counted via INNER JOIN with the categories
        table. Assets with NULL category_id are counted separately.

        Returns:
            Dict with keys:
                - categories (List[Dict]): Each dict has category_id (str),
                  category_name (str), count (int). Sorted by count DESC,
                  then category_name ASC.
                - uncategorized_count (int): Number of assets with NULL
                  category_id.

        Example:
            {"categories": [{"category_id": "uuid-1", "category_name":
             "IT设备", "count": 10}, ...], "uncategorized_count": 1}
        """
        cat_sql = text("""
            SELECT c.id AS category_id, c.name AS category_name,
                   COUNT(a.id) AS count
            FROM assets a
            INNER JOIN categories c ON a.category_id = c.id
            GROUP BY c.id, c.name
            ORDER BY count DESC, c.name ASC
        """)
        cat_result = self.db.execute(cat_sql)
        categories = [
            {
                "category_id": str(row[0]),
                "category_name": row[1],
                "count": row[2],
            }
            for row in cat_result
        ]

        uncat_sql = text("""
            SELECT COUNT(*) AS count
            FROM assets
            WHERE category_id IS NULL
        """)
        uncat_result = self.db.execute(uncat_sql)
        uncategorized_count = uncat_result.scalar() or 0

        return {
            "categories": categories,
            "uncategorized_count": uncategorized_count,
        }

    def get_brand_top10(self) -> List[Dict[str, Any]]:
        """Retrieve top 10 brands by asset count.

        Performs INNER JOIN between assets and brands, groups by brand,
        and returns at most 10 results. Ties in count are broken by
        brand_name in ascending alphabetical order (ATB-003).

        Returns:
            List of dicts with brand_id (str), brand_name (str), count (int).
            At most 10 items; fewer if fewer brands exist (no padding).

        Example:
            [{"brand_id": "uuid-a", "brand_name": "联想", "count": 20}, ...]
        """
        sql = text("""
            SELECT b.id AS brand_id, b.name AS brand_name,
                   COUNT(a.id) AS count
            FROM assets a
            INNER JOIN brands b ON a.brand_id = b.id
            GROUP BY b.id, b.name
            ORDER BY count DESC, b.name ASC
            LIMIT 10
        """)
        result = self.db.execute(sql)
        return [
            {
                "brand_id": str(row[0]),
                "brand_name": row[1],
                "count": row[2],
            }
            for row in result
        ]

    def get_warranty_expiring_assets(
        self, days: int = 90
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """Retrieve assets with warranty expiring within the given days.

        Queries assets whose warranty_expiry is strictly after today and
        at most N days from today (inclusive boundary). Uses server-side
        CURRENT_DATE in UTC as baseline (BC-003). Results ordered by
        warranty_expiry ascending (soonest first).

        To detect truncation without a full table scan, queries LIMIT 201
        and checks if more than 200 rows were returned (BC-005).

        Args:
            days: Look-ahead window (30, 60, or 90). Parameter validation
                  (enum check) is the controller layer's responsibility.
                  Defaults to 90.

        Returns:
            Tuple of (asset_list, truncated_flag):
                - asset_list (List[Dict]): Each dict has asset_id, asset_name,
                  asset_code, category_name (str|None), brand_name (str|None),
                  warranty_expiry (ISO 8601 date string), days_remaining (int).
                  At most 200 items.
                - truncated_flag (bool): True when the full result set exceeds
                  200 records.

        Example:
            ([
              {"asset_id": "uuid", "asset_name": "ThinkPad",
               "asset_code": "AST-2025-001", "category_name": "IT设备",
               "brand_name": "联想", "warranty_expiry": "2025-01-20",
               "days_remaining": 5}
            ], False)
        """
        sql = text("""
            SELECT
                a.id   AS asset_id,
                a.name AS asset_name,
                a.code AS asset_code,
                c.name AS category_name,
                b.name AS brand_name,
                a.warranty_expiry,
                (DATE(a.warranty_expiry) - CURRENT_DATE) AS days_remaining
            FROM assets a
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN brands b      ON a.brand_id = b.id
            WHERE a.warranty_expiry IS NOT NULL
              AND DATE(a.warranty_expiry) > CURRENT_DATE
              AND (DATE(a.warranty_expiry) - CURRENT_DATE) <= :days
            ORDER BY a.warranty_expiry ASC
            LIMIT 201
        """)
        result = self.db.execute(sql, {"days": days})
        rows = result.fetchall()

        truncated = len(rows) > 200
        if truncated:
            rows = rows[:200]

        assets: List[Dict[str, Any]] = []
        for row in rows:
            expiry_val = row[5]
            if hasattr(expiry_val, "isoformat"):
                expiry_str = expiry_val.isoformat()
            else:
                expiry_str = str(expiry_val)

            assets.append({
                "asset_id": str(row[0]),
                "asset_name": row[1],
                "asset_code": row[2],
                "category_name": row[3],
                "brand_name": row[4],
                "warranty_expiry": expiry_str,
                "days_remaining": int(row[6]) if row[6] is not None else 0,
            })

        return assets, truncated

    def get_monthly_trend(self, months: int = 12) -> List[Dict[str, Any]]:
        """Retrieve monthly asset addition and scrapping counts.

        Executes two GROUP BY queries using PostgreSQL native DATE_TRUNC
        for month-level grouping (BC-002). The service layer is responsible
        for generating the full time window with zero-filled months.

        'added' counts assets by created_at month.
        'removed' counts assets whose status is SCRAPPED by updated_at month,
        based on the current status field (BC-001 — no status history table).

        Args:
            months: Window size in months (default 12). The period spans
                    the current month and the preceding (months - 1) months,
                    inclusive.

        Returns:
            List of dicts for months that have actual activity, each with:
                - month (str): YYYY-MM format.
                - added (int): Assets created in this month.
                - removed (int): Assets scrapped in this month.
            Sorted by month ascending. The service layer zero-fills the
            remaining months to ensure exactly `months` entries.

        Example:
            [{"month": "2025-03", "added": 5, "removed": 2},
             {"month": "2025-05", "added": 3, "removed": 0}]
        """
        offset = months - 1

        added_sql = text("""
            SELECT TO_CHAR(DATE_TRUNC('month', a.created_at), 'YYYY-MM') AS month,
                   COUNT(*) AS added
            FROM assets a
            WHERE a.created_at >= DATE_TRUNC('month',
                        CURRENT_DATE - :offset * INTERVAL '1 month')
            GROUP BY DATE_TRUNC('month', a.created_at)
            ORDER BY month ASC
        """)

        removed_sql = text("""
            SELECT TO_CHAR(DATE_TRUNC('month', a.updated_at), 'YYYY-MM') AS month,
                   COUNT(*) AS removed
            FROM assets a
            WHERE a.status = 'SCRAPPED'
              AND a.updated_at >= DATE_TRUNC('month',
                        CURRENT_DATE - :offset * INTERVAL '1 month')
            GROUP BY DATE_TRUNC('month', a.updated_at)
            ORDER BY month ASC
        """)

        params = {"offset": offset}

        added_result = self.db.execute(added_sql, params)
        added_map: Dict[str, int] = {row[0]: row[1] for row in added_result}

        removed_result = self.db.execute(removed_sql, params)
        removed_map: Dict[str, int] = {row[0]: row[1] for row in removed_result}

        # Merge months that have either additions or removals.
        # Service layer fills gaps to produce a contiguous window.
        all_months = sorted(set(added_map.keys()) | set(removed_map.keys()))

        return [
            {
                "month": m,
                "added": added_map.get(m, 0),
                "removed": removed_map.get(m, 0),
            }
            for m in all_months
        ]