import { Router, Request, Response } from 'express';
import {
  benchmarkEngine,
  ALL_SCENARIOS,
  getScenariosByCategory,
  getScenarioById,
  getScenarioStats,
  generateHumanReadableSummary,
  RETELL_OVERALL_BASELINE,
  RETELL_DOCUMENTED_FEATURES,
  RETELL_KNOWN_WEAKNESSES,
  RETELL_KNOWN_STRENGTHS,
  RETELL_CATEGORY_BASELINES,
  type BenchmarkConfig,
} from '../services/competitive-benchmark';

const router = Router();

function validateInternalApiKey(req: Request, res: Response, next: Function) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Internal API not configured' });
  }
  const provided = req.headers['x-internal-api-key'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

router.use(validateInternalApiKey);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'competitive-benchmark',
    timestamp: new Date().toISOString(),
    engineStatus: benchmarkEngine.getStatus(),
  });
});

router.get('/scenarios', (req: Request, res: Response) => {
  const { category } = req.query;
  if (category && typeof category === 'string') {
    const filtered = getScenariosByCategory(category as 'customer_support' | 'appointment_booking' | 'lead_qualification');
    return res.json({ scenarios: filtered, count: filtered.length });
  }
  res.json({ scenarios: ALL_SCENARIOS, count: ALL_SCENARIOS.length, stats: getScenarioStats() });
});

router.get('/scenarios/:id', (req: Request, res: Response) => {
  const scenario = getScenarioById(req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  res.json(scenario);
});

router.get('/retell-baseline', (_req: Request, res: Response) => {
  res.json({
    overall: RETELL_OVERALL_BASELINE,
    byCategory: RETELL_CATEGORY_BASELINES,
    documentedFeatures: RETELL_DOCUMENTED_FEATURES,
    knownStrengths: RETELL_KNOWN_STRENGTHS,
    knownWeaknesses: RETELL_KNOWN_WEAKNESSES,
  });
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const status = benchmarkEngine.getStatus();
    if (status.isRunning) {
      return res.status(409).json({
        error: 'Benchmark already running',
        status,
      });
    }

    const config: BenchmarkConfig = {};

    const validCategories = ['customer_support', 'appointment_booking', 'lead_qualification'];

    if (req.body.categories) {
      if (!Array.isArray(req.body.categories) || !req.body.categories.every((c: string) => validCategories.includes(c))) {
        return res.status(400).json({ error: 'Invalid categories. Must be array of: customer_support, appointment_booking, lead_qualification' });
      }
      config.categories = req.body.categories;
    }
    if (req.body.scenarioIds) {
      if (!Array.isArray(req.body.scenarioIds) || req.body.scenarioIds.length > 50) {
        return res.status(400).json({ error: 'scenarioIds must be an array with max 50 items' });
      }
      if (!req.body.scenarioIds.every((id: unknown) => typeof id === 'string')) {
        return res.status(400).json({ error: 'All scenarioIds must be strings' });
      }
      const unknownIds = req.body.scenarioIds.filter((id: string) => !getScenarioById(id));
      if (unknownIds.length > 0) {
        return res.status(400).json({ error: `Unknown scenarioIds: ${unknownIds.join(', ')}` });
      }
      config.scenarioIds = req.body.scenarioIds;
    }
    if (req.body.model) {
      const allowedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
      if (typeof req.body.model !== 'string' || !allowedModels.includes(req.body.model)) {
        return res.status(400).json({ error: `Invalid model. Must be one of: ${allowedModels.join(', ')}` });
      }
      config.model = req.body.model;
    }
    if (req.body.maxConcurrent !== undefined) {
      const mc = Number(req.body.maxConcurrent);
      if (!Number.isInteger(mc) || mc < 1 || mc > 20) {
        return res.status(400).json({ error: 'maxConcurrent must be an integer between 1 and 20' });
      }
      config.maxConcurrent = mc;
    }
    if (req.body.includeRetellBaseline !== undefined) {
      config.includeRetellBaseline = !!req.body.includeRetellBaseline;
    }
    if (req.body.includeLLMJudge !== undefined) {
      config.includeLLMJudge = !!req.body.includeLLMJudge;
    }

    const report = await benchmarkEngine.runBenchmark(config);
    const humanReadable = generateHumanReadableSummary(report);

    res.json({
      report,
      summary: humanReadable,
    });
  } catch (error: any) {
    console.error('Benchmark execution failed:', error);
    res.status(500).json({
      error: 'Benchmark execution failed',
      message: error.message,
    });
  }
});

router.post('/run-category', async (req: Request, res: Response) => {
  try {
    const { category } = req.body;
    if (!category || !['customer_support', 'appointment_booking', 'lead_qualification'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be: customer_support, appointment_booking, or lead_qualification' });
    }

    const status = benchmarkEngine.getStatus();
    if (status.isRunning) {
      return res.status(409).json({ error: 'Benchmark already running', status });
    }

    const report = await benchmarkEngine.runBenchmark({
      categories: [category],
      includeLLMJudge: req.body.includeLLMJudge !== false,
    });
    const humanReadable = generateHumanReadableSummary(report);

    res.json({ report, summary: humanReadable });
  } catch (error: any) {
    console.error('Category benchmark failed:', error);
    res.status(500).json({ error: 'Category benchmark failed', message: error.message });
  }
});

router.post('/run-scenario', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.body;
    if (!scenarioId) {
      return res.status(400).json({ error: 'scenarioId is required' });
    }

    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const status = benchmarkEngine.getStatus();
    if (status.isRunning) {
      return res.status(409).json({ error: 'Benchmark already running', status });
    }

    const report = await benchmarkEngine.runBenchmark({
      scenarioIds: [scenarioId],
      includeLLMJudge: req.body.includeLLMJudge !== false,
    });
    const humanReadable = generateHumanReadableSummary(report);

    res.json({ report, summary: humanReadable });
  } catch (error: any) {
    console.error('Scenario benchmark failed:', error);
    res.status(500).json({ error: 'Scenario benchmark failed', message: error.message });
  }
});

router.get('/status', (_req: Request, res: Response) => {
  res.json(benchmarkEngine.getStatus());
});

router.get('/feature-parity', async (_req: Request, res: Response) => {
  try {
    const { generateComparisonReport: genReport } = await import('../services/competitive-benchmark/report-generator');
    const report = genReport([], [], [], []);
    res.json({
      checklist: report.featureParityChecklist,
      diployAdvantages: report.featureParityChecklist.filter((f: any) => f.diploy === 'yes' && f.retell !== 'yes').length,
      retellAdvantages: report.featureParityChecklist.filter((f: any) => f.retell === 'yes' && f.diploy !== 'yes').length,
      fullParity: report.featureParityChecklist.filter((f: any) => f.diploy === 'yes' && f.retell === 'yes').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate feature parity', message: error.message });
  }
});

export default router;
