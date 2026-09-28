import { Router } from 'express';
import { pool } from './db.ts';

export const telemetryRouter = Router();

// SSE Clients
const clients = new Set<any>();

export function broadcastEvent(event: string, data: any) {
  for (const client of clients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

// --- Local-mode SSE helpers (no DB required) ---
export function broadcastLog(level: string, message: string, source?: string) {
  broadcastEvent('log.entry', {
    timestamp: new Date().toISOString(),
    level,
    message,
    source: source || 'system'
  });
}

export function broadcastTrace(traceId: string, spanName: string, durationMs: number, status: string, service?: string) {
  broadcastEvent('trace.span', {
    traceId,
    spanName,
    durationMs,
    status,
    service: service || 'tracelens-api',
    timestamp: new Date().toISOString()
  });
}

export function broadcastMetric(name: string, value: number, unit: string, tags?: Record<string, string>) {
  broadcastEvent('metric.update', {
    name,
    value,
    unit,
    tags: tags || {},
    timestamp: new Date().toISOString()
  });
}

export function broadcastAnalysisOutput(result: any) {
  broadcastEvent('analysis.output', result);
}

export function broadcastRemediationOutput(result: any) {
  broadcastEvent('remediation.output', result);
}

telemetryRouter.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  clients.add(res);
  
  // Send initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    clients.delete(res);
  });
});

// POST /log — Accept log entries from frontend or analysis pipeline and broadcast
telemetryRouter.post('/log', (req, res) => {
  const { level, message, source } = req.body;
  broadcastLog(level || 'INFO', message || 'Log entry', source);
  res.json({ ok: true });
});

telemetryRouter.post('/events', async (req, res) => {
  const { title, severity, category, affectedService, affectedFile, stackTrace } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO telemetry.issues (title, severity, category, affected_service, affected_file, stack_trace)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [title, severity, category, affectedService, affectedFile, stackTrace]);
    
    const newIssue = result.rows[0];
    
    // Broadcast event to frontend
    broadcastEvent('issue.detected', newIssue);
    
    // Trigger async AI analysis
    setTimeout(() => {
       analyzeIssue(newIssue.id);
    }, 500);

    res.status(201).json(newIssue);
  } catch (error) {
    console.error('Error inserting event', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

telemetryRouter.get('/issues', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM telemetry.issues ORDER BY first_seen DESC');
    res.json(result.rows);
  } catch (error) {
    // Return empty array in local mode without network PostgreSQL
    res.json([]);
  }
});

async function analyzeIssue(issueId: string) {
    try {
        const result = await pool.query('SELECT * FROM telemetry.issues WHERE id = $1', [issueId]);
        const issue = result.rows[0];
        if (!issue) return;

        const provider = await (await import('./ai/Orchestrator.ts')).aiOrchestrator.getPrimaryProvider();
        const { evaluatePolicy } = await import('./policy.ts');
        
        const context = {
          id: issue.id,
          title: issue.title,
          severity: issue.severity,
          category: issue.category,
          affectedService: issue.affected_service,
          affectedFile: issue.affected_file,
          stackTrace: issue.stack_trace
        };

        const analysis = await provider.analyzeIssue(context);
        
        await pool.query(`
            UPDATE telemetry.issues
            SET root_cause = $1, confidence = $2, status = 'ANALYZING'
            WHERE id = $3
        `, [analysis.rootCause, analysis.confidence, issueId]);
        
        broadcastEvent('analysis.completed', { issueId, rootCause: analysis.rootCause, confidence: analysis.confidence });

        const plan = await provider.generateFixPlan(context, analysis);
        const policyResult = evaluatePolicy(context, plan);

        const remediationStatus = policyResult.approved ? 'AUTO_REMEDIATED' : 'APPROVAL_REQUIRED';

        const remResult = await pool.query(`
            INSERT INTO telemetry.remediations (issue_id, ai_model, confidence, proposed_action, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `, [issueId, provider.name, plan.confidence, plan.proposedAction, remediationStatus]);
        
        broadcastEvent('remediation.proposed', remResult.rows[0]);

        if (policyResult.approved) {
           await pool.query(`UPDATE telemetry.issues SET status = 'RESOLVED' WHERE id = $1`, [issueId]);
           broadcastEvent('issue.resolved', { issueId });
        }
    } catch (error) {
        console.error('AI Analysis failed:', error);
    }
}
