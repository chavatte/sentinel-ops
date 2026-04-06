import json

def get_bump_type(current, latest):
    if not current or not latest or current == "?":
        return "unknown"
    c = current.split(".")
    l = latest.split(".")
    if len(c) < 1 or len(l) < 1:
        return "unknown"
    if c[0] != l[0]:
        return "major"
    if len(c) > 1 and len(l) > 1 and c[1] != l[1]:
        return "minor"
    return "patch"

def add_audit_item(result, adv, seen_set, path=None):
    adv_id = adv.get("github_advisory_id") or adv.get("id")
    if adv_id and adv_id not in seen_set:
        seen_set.add(adv_id)
        severity = adv.get("severity", "low")
        result["audit_items"].append(
            {
                "id": str(adv_id),
                "severity": severity,
                "module": adv.get("module_name"),
                "title": adv.get("title"),
                "cves": adv.get("cves", []),
                "recommendation": adv.get("recommendation"),
                "paths": [path] if path else [],
                "source": ["Audit"],
            }
        )
        if severity == "high":
            result["audit"]["high"] += 1
        elif severity == "critical":
            result["audit"]["critical"] += 1

def parse_yarn_outdated(output, result):
    try:
        for line in output.splitlines():
            try:
                data = json.loads(line)
                if data.get("type") == "table":
                    for row in data.get("data", {}).get("body", []):
                        result["outdated"].append(
                            {
                                "name": row[0],
                                "current": row[1],
                                "latest": row[3],
                                "bump": get_bump_type(row[1], row[3]),
                            }
                        )
            except:
                continue
    except:
        pass

def parse_yarn_audit(output, result):
    seen = set()
    try:
        for line in output.splitlines():
            try:
                data = json.loads(line)
                if data.get("type") == "auditAdvisory":
                    adv = data.get("data", {}).get("advisory", {})
                    add_audit_item(
                        result,
                        adv,
                        seen,
                        path=data.get("data", {}).get("resolution", {}).get("path"),
                    )
            except:
                continue
    except:
        pass

def parse_npm_outdated(output, result):
    try:
        data = json.loads(output)
        for pkg, info in data.items():
            result["outdated"].append(
                {
                    "name": pkg,
                    "current": info.get("current", "?"),
                    "latest": info.get("latest", "?"),
                    "bump": get_bump_type(info.get("current"), info.get("latest")),
                }
            )
    except:
        pass

def parse_npm_audit_tree(vulns_dict, result):
    seen = set()
    for pkg_name, item in vulns_dict.items():
        severity = item.get("severity", "low")
        via = item.get("via", [])
        if isinstance(via, list) and len(via) > 0 and isinstance(via[0], dict):
            adv = via[0]
            ghsa_id = adv.get("source", "N/A")
            title = adv.get("title", "Vuln")
        else:
            ghsa_id = "NPM-AUDIT"
            title = f"Vuln in {pkg_name}"

        key = f"{pkg_name}-{ghsa_id}"
        if key in seen:
            continue
        seen.add(key)

        result["audit_items"].append(
            {
                "id": str(ghsa_id),
                "severity": severity,
                "module": pkg_name,
                "title": title,
                "cves": [],
                "recommendation": (
                    "Update available" if item.get("fixAvailable") else "Check deps"
                ),
                "paths": [node for node in item.get("nodes", [])],
                "source": ["Audit"],
            }
        )
        if severity == "high":
            result["audit"]["high"] += 1
        elif severity == "critical":
            result["audit"]["critical"] += 1

def parse_pnpm_audit(output, result):
    try:
        data = json.loads(output)
        if "advisories" in data:
            seen = set()
            for _, adv in data["advisories"].items():
                add_audit_item(result, adv, seen)
        elif "vulnerabilities" in data:
            parse_npm_audit_tree(data["vulnerabilities"], result)
    except:
        pass

def parse_yarn_berry_outdated(output, result):
    try:
        json_str = "{}"
        for line in reversed(output.splitlines()):
            line = line.strip()
            if line.startswith("{") or line.startswith("["):
                json_str = line
                break
        
        data = json.loads(json_str)
        
        if isinstance(data, dict):
            for pkg, info in data.items():
                result["outdated"].append(
                    {
                        "name": pkg,
                        "current": info.get("current", "?"),
                        "latest": info.get("latest", "?"),
                        "bump": get_bump_type(info.get("current"), info.get("latest")),
                    }
                )
        elif isinstance(data, list):
            for item in data:
                result["outdated"].append(
                    {
                        "name": item.get("name", "unknown"),
                        "current": item.get("current", "?"),
                        "latest": item.get("latest", "?"),
                        "bump": get_bump_type(item.get("current"), item.get("latest")),
                    }
                )
    except Exception as e:
        pass

def parse_yarn_berry_audit(output, result):
    seen = set()
    try:
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                
                if "vulnerabilities" in data:
                    parse_npm_audit_tree(data["vulnerabilities"], result)
                
                elif "advisories" in data:
                    for _, adv in data["advisories"].items():
                        add_audit_item(result, adv, seen)
                        
                elif "advisory" in data:
                    add_audit_item(result, data["advisory"], seen)
            except:
                continue
    except Exception as e:
        pass
    
def parse_osv_audit(output, result):
    output = output.strip()
    if not output: return
        
    if not output.startswith('{'):
        start_idx = output.find('{')
        if start_idx != -1:
            output = output[start_idx:]
        else:
            return

    try:
        data = json.loads(output)
        for res in data.get("results", []):
            for pkg in res.get("packages", []):
                pkg_name = pkg.get("package", {}).get("name", "Unknown")
                for vuln in pkg.get("vulnerabilities", []):
                    vuln_id = vuln.get("id")
                    if not vuln_id: continue
                    
                    existing_item = next((item for item in result.get("audit_items", []) if item.get("id") == vuln_id), None)
                    
                    if existing_item:
                        if "source" not in existing_item:
                            existing_item["source"] = ["Audit"]
                        if "OSV" not in existing_item["source"]:
                            existing_item["source"].append("OSV")
                        continue
                        
                    severity = "moderate"
                    db_specific = vuln.get("database_specific", {})
                    if "severity" in db_specific:
                        sev = str(db_specific["severity"]).lower()
                        if sev in ["low", "moderate", "high", "critical"]:
                            severity = sev
                            
                    summary = vuln.get("summary") or vuln.get("details", "Vulnerabilidade descoberta pelo OSV")
                    if summary and len(summary) > 100:
                        summary = summary[:97] + "..."
                        
                    result["audit_items"].append({
                        "id": vuln_id,
                        "severity": severity,
                        "module": pkg_name,
                        "title": summary,
                        "cves": vuln.get("aliases", []),
                        "recommendation": "Verifique documentação CVE/GHSA para mitigações.",
                        "paths": [],
                        "source": ["OSV"]
                    })
                    
                    if severity == "high":
                        result["audit"]["high"] += 1
                    elif severity == "critical":
                        result["audit"]["critical"] += 1
                        
    except Exception as e:
        print(f"⚠️ Erro ao fazer parse do JSON do OSV: {e}")