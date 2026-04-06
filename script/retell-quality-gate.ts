import process from "node:process";

interface TopRisk {
  risk: string;
  count: number;
  percentage: number;
}

interface TopRecommendation {
  action: string;
  count: number;
  percentage: number;
}

interface ReadinessSummary {
  analyzedCalls: number;
  avgRetellReadiness: number;
  belowTargetCalls: number;
  targetScore: number;
}

interface RegressionSummary {
  windowSize: number;
  topRisks: TopRisk[];
  topRecommendations: TopRecommendation[];
}

const DEFAULTS = {
  minReadiness: 85,
  minCalls: 10,
  maxBelowTargetPct: 35,
  maxTopRiskPct: 55,
  limit: 50,
};

function toNumber(input: string | undefined, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}: ${text}`);
  }
  return response.json() as Promise<T>;
}

async function run(): Promise<void> {
  const baseUrl = process.env.RETELL_GATE_BASE_URL || process.env.GATE_BASE_URL || "";
  const token = process.env.RETELL_GATE_TOKEN || process.env.GATE_TOKEN || "";
  const strictNoData = (process.env.RETELL_GATE_STRICT_NO_DATA || "false").toLowerCase() === "true";

  if (!baseUrl) {
    if (strictNoData) {
      throw new Error("RETELL_GATE_BASE_URL is required in strict mode.");
    }
    console.warn("[retell-quality-gate] WARN RETELL_GATE_BASE_URL missing; skipping gate (non-strict mode).");
    return;
  }
  if (!token) {
    if (strictNoData) {
      throw new Error("RETELL_GATE_TOKEN is required in strict mode.");
    }
    console.warn("[retell-quality-gate] WARN RETELL_GATE_TOKEN missing; skipping gate (non-strict mode).");
    return;
  }

  const minReadiness = toNumber(process.env.RETELL_GATE_MIN_READINESS, DEFAULTS.minReadiness);
  const minCalls = toNumber(process.env.RETELL_GATE_MIN_CALLS, DEFAULTS.minCalls);
  const maxBelowTargetPct = toNumber(process.env.RETELL_GATE_MAX_BELOW_TARGET_PCT, DEFAULTS.maxBelowTargetPct);
  const maxTopRiskPct = toNumber(process.env.RETELL_GATE_MAX_TOP_RISK_PCT, DEFAULTS.maxTopRiskPct);
  const limit = toNumber(process.env.RETELL_GATE_WINDOW, DEFAULTS.limit);

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const readinessUrl = `${normalizedBase}/api/qa/benchmark/retell-readiness-summary?limit=${limit}`;
  const regressionsUrl = `${normalizedBase}/api/qa/benchmark/regressions?limit=${limit}`;

  const [readiness, regressions] = await Promise.all([
    fetchJson<ReadinessSummary>(readinessUrl, token),
    fetchJson<RegressionSummary>(regressionsUrl, token),
  ]);

  const failures: string[] = [];
  const analyzedCalls = readiness.analyzedCalls || 0;

  if (analyzedCalls < minCalls) {
    const message = `Insufficient benchmark data: analyzedCalls=${analyzedCalls}, required=${minCalls}`;
    if (strictNoData) {
      failures.push(message);
    } else {
      console.warn(`[retell-quality-gate] WARN ${message}`);
    }
  }

  if (analyzedCalls > 0 && readiness.avgRetellReadiness < minReadiness) {
    failures.push(
      `Readiness below threshold: avgRetellReadiness=${readiness.avgRetellReadiness}, min=${minReadiness}`
    );
  }

  if (analyzedCalls > 0) {
    const belowTargetPct = Math.round((readiness.belowTargetCalls / analyzedCalls) * 100);
    if (belowTargetPct > maxBelowTargetPct) {
      failures.push(
        `Too many below-target calls: belowTargetPct=${belowTargetPct}%, max=${maxBelowTargetPct}%`
      );
    }
  }

  const topRisk = regressions.topRisks?.[0];
  if (topRisk && topRisk.percentage > maxTopRiskPct) {
    failures.push(
      `Top risk too frequent: "${topRisk.risk}" at ${topRisk.percentage}%, max=${maxTopRiskPct}%`
    );
  }

  const report = {
    readiness,
    regressions,
    thresholds: {
      minReadiness,
      minCalls,
      maxBelowTargetPct,
      maxTopRiskPct,
      window: limit,
      strictNoData,
    },
  };

  console.log("[retell-quality-gate] Report:", JSON.stringify(report, null, 2));

  if (failures.length > 0) {
    console.error("[retell-quality-gate] FAILED");
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log("[retell-quality-gate] PASSED");
}

run().catch((error) => {
  console.error("[retell-quality-gate] ERROR", error);
  process.exit(1);
});
