import sqlite3
import os
import time
from config import DATA_DIR

DB_PATH = os.path.join(DATA_DIR, "sentinel.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS repositories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                git_url TEXT NOT NULL,
                ssh_key TEXT,
                is_enabled INTEGER DEFAULT 1
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS threat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_id TEXT,
                vuln_id TEXT,
                module TEXT,
                severity TEXT,
                detected_at INTEGER,
                fixed_at INTEGER
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tech_debt_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_id TEXT,
                package TEXT,
                bump_type TEXT,
                detected_at INTEGER,
                fixed_at INTEGER
            )
        """)
        conn.commit()


def get_all_repos():
    with get_connection() as conn:
        return [dict(row) for row in conn.execute("SELECT * FROM repositories")]


def get_active_repos():
    with get_connection() as conn:
        return [
            dict(row)
            for row in conn.execute("SELECT * FROM repositories WHERE is_enabled = 1")
        ]


def add_repo(repo_data):
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO repositories (id, name, git_url, ssh_key, is_enabled) VALUES (?, ?, ?, ?, ?)",
            (
                repo_data["id"],
                repo_data["name"],
                repo_data["git"],
                repo_data.get("ssh_key", ""),
                1,
            ),
        )


def delete_repo(repo_id):
    with get_connection() as conn:
        conn.execute("DELETE FROM repositories WHERE id = ?", (repo_id,))


def toggle_repo(repo_id):
    with get_connection() as conn:
        conn.execute(
            "UPDATE repositories SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (repo_id,),
        )


def sync_threats(repo_id, current_vulns):
    now = int(time.time())
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, vuln_id, module FROM threat_history WHERE repo_id = ? AND fixed_at IS NULL",
            (repo_id,),
        )
        active_threats = {
            f"{row['vuln_id']}-{row['module']}": row["id"] for row in cursor.fetchall()
        }

        current_threat_keys = set()

        for v in current_vulns:
            key = f"{v.get('id', 'unknown')}-{v.get('module', 'unknown')}"
            current_threat_keys.add(key)

            if key not in active_threats:
                cursor.execute(
                    "INSERT INTO threat_history (repo_id, vuln_id, module, severity, detected_at) VALUES (?, ?, ?, ?, ?)",
                    (
                        repo_id,
                        v.get("id"),
                        v.get("module"),
                        v.get("severity", "unknown"),
                        now,
                    ),
                )

        fixed_keys = set(active_threats.keys()) - current_threat_keys
        for f_key in fixed_keys:
            threat_db_id = active_threats[f_key]
            cursor.execute(
                "UPDATE threat_history SET fixed_at = ? WHERE id = ?",
                (now, threat_db_id),
            )
        conn.commit()


def sync_tech_debt(repo_id, outdated_items):
    now = int(time.time())
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, package FROM tech_debt_history WHERE repo_id = ? AND fixed_at IS NULL",
            (repo_id,),
        )
        active_debt = {row["package"]: row["id"] for row in cursor.fetchall()}
        current_pkgs = set()

        for item in outdated_items:
            pkg = item.get("name")
            if not pkg:
                continue
            current_pkgs.add(pkg)

            if pkg not in active_debt:
                cursor.execute(
                    "INSERT INTO tech_debt_history (repo_id, package, bump_type, detected_at) VALUES (?, ?, ?, ?)",
                    (repo_id, pkg, item.get("bump", "unknown"), now),
                )

        fixed_pkgs = set(active_debt.keys()) - current_pkgs
        for f_pkg in fixed_pkgs:
            debt_db_id = active_debt[f_pkg]
            cursor.execute(
                "UPDATE tech_debt_history SET fixed_at = ? WHERE id = ?",
                (now, debt_db_id),
            )
        conn.commit()


def get_metrics():
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT AVG(fixed_at - detected_at) as avg_seconds, COUNT(*) as fixed_count 
            FROM threat_history 
            WHERE fixed_at IS NOT NULL
        """)
        row = cursor.fetchone()
        avg_seconds = row["avg_seconds"] or 0
        fixed_count = row["fixed_count"] or 0

        cursor.execute(
            "SELECT COUNT(*) as pending FROM threat_history WHERE fixed_at IS NULL"
        )
        pending_count = cursor.fetchone()["pending"]

        cursor.execute("""
            SELECT LOWER(severity) as sev, COUNT(*) as count 
            FROM threat_history 
            WHERE fixed_at IS NULL 
            GROUP BY LOWER(severity)
        """)
        severity_dist = {r["sev"]: r["count"] for r in cursor.fetchall()}

        cursor.execute("""
            SELECT LOWER(bump_type) as bump, COUNT(*) as count 
            FROM tech_debt_history 
            WHERE fixed_at IS NULL 
            GROUP BY LOWER(bump_type)
        """)
        tech_debt_dist = {r["bump"]: r["count"] for r in cursor.fetchall()}
        total_debt = sum(tech_debt_dist.values())

        cursor.execute("""
            SELECT r.name, COUNT(t.id) as threat_count
            FROM repositories r
            JOIN threat_history t ON r.id = t.repo_id
            WHERE t.fixed_at IS NULL
            GROUP BY r.id
            ORDER BY threat_count DESC
            LIMIT 3
        """)
        top_offenders = [
            {"name": r["name"], "count": r["threat_count"]} for r in cursor.fetchall()
        ]

        return {
            "mttr_days": round(avg_seconds / 86400, 2),
            "fixed_count": fixed_count,
            "pending_count": pending_count,
            "severity_distribution": {
                "critical": severity_dist.get("critical", 0),
                "high": severity_dist.get("high", 0),
                "moderate": severity_dist.get("moderate", 0),
                "low": severity_dist.get("low", 0),
            },
            "tech_debt": {
                "total": total_debt,
                "major": tech_debt_dist.get("major", 0),
                "minor": tech_debt_dist.get("minor", 0),
                "patch": tech_debt_dist.get("patch", 0),
            },
            "top_offenders": top_offenders,
        }


init_db()
