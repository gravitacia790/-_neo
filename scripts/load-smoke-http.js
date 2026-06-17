#!/usr/bin/env node
/**
 * Basic HTTP load smoke for release readiness checks.
 *
 * Usage:
 *   node scripts/load-smoke-http.js http://127.0.0.1:3000 200 20
 *   # args: baseUrl totalRequests concurrency
 */
const http = require('http');
const https = require('https');

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const totalRequests = Number(process.argv[3] || 200);
const concurrency = Number(process.argv[4] || 20);

const targets = ['/health', '/ready', '/api/stats'];
const latencies = [];
let sent = 0;
let completed = 0;
let failed = 0;
const statusCounts = {};
const errorCounts = {};
const agent = baseUrl.startsWith('https:') ? https : http;

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function runOne() {
  if (sent >= totalRequests) return;
  sent += 1;
  const path = targets[sent % targets.length];
  const started = Date.now();
  const req = agent.get(baseUrl + path, (res) => {
    const statusKey = String(res.statusCode || 0);
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    res.on('data', function () {});
    res.on('end', () => {
      latencies.push(Date.now() - started);
      completed += 1;
      tick();
    });
  });
  req.on('error', (err) => {
    const key = err && err.code ? err.code : 'REQUEST_ERROR';
    errorCounts[key] = (errorCounts[key] || 0) + 1;
    failed += 1;
    completed += 1;
    tick();
  });
  req.setTimeout(15000, () => {
    req.destroy(new Error('timeout'));
  });
}

function tick() {
  while (sent < totalRequests && sent - completed < concurrency) {
    runOne();
  }
  if (completed >= totalRequests) {
    const sorted = latencies.slice().sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    const okCount = Object.keys(statusCounts)
      .filter((s) => Number(s) >= 200 && Number(s) < 400)
      .reduce((sum, s) => sum + statusCounts[s], 0);
    const report = {
      baseUrl,
      totalRequests,
      concurrency,
      completed,
      failed,
      okCount,
      statusCounts,
      errorCounts,
      p50_ms: p50,
      p95_ms: p95,
      p99_ms: p99,
    };
    console.log(JSON.stringify(report, null, 2));
    if (failed > 0 || okCount === 0) {
      process.exitCode = 1;
    }
  }
}

tick();
