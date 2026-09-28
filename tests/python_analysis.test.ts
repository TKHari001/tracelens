import { resolve } from 'node:path';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { analyzerEngine } from '../apps/api/src/ai/AnalyzerEngine.ts';

async function runRegressionTests() {
  console.log('🚀 Starting X-RAY VISION Package Analyzer Architecture Test Suite...\n');
  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failedCount++;
    }
  };

  const fixtureBugPath = resolve('./tests/fixtures/sample_bug.py');
  const fixtureCleanPath = resolve('./tests/fixtures/sample_clean.py');

  // Case A: Valid clean Python file
  try {
    console.log('Test Case A: Valid clean Python file');
    const resultA = await analyzerEngine.analyze({ localPath: fixtureCleanPath });
    const allTestsPassed = resultA.testSuite.every(t => t.status === 'PASSED');
    assert(
      allTestsPassed && resultA.issues.length === 0 && resultA.healthScore === 100,
      'Case A: Clean Python file has all analyzer stages PASSED, 0 findings, and 100% Health Score',
      `All Stages PASSED: ${allTestsPassed}, Findings: ${resultA.issues.length}, Health Score: ${resultA.healthScore}%`
    );
  } catch (err: any) {
    assert(false, 'Case A: Clean Python file analysis failed', err.message);
  }

  // Case B: Python file with deliberate errors (Core Architecture Verification)
  try {
    console.log('\nTest Case B: Python file with deliberate errors');
    const resultB = await analyzerEngine.analyze({ localPath: fixtureBugPath });
    const discoveryPassed = resultB.testSuite.some(t => t.testName.includes('Discovery') && t.status === 'PASSED');
    const parserPassed = resultB.testSuite.some(t => t.testName.includes('Parser') && t.status === 'PASSED');
    const securityPassed = resultB.testSuite.some(t => t.testName.includes('Security') && t.status === 'PASSED');
    const resourcePassed = resultB.testSuite.some(t => t.testName.includes('Resource') && t.status === 'PASSED');

    assert(
      discoveryPassed && parserPassed && securityPassed && resourcePassed && resultB.issues.length > 0 && resultB.healthScore !== null && resultB.healthScore < 100,
      'Case B: Broken Python file has ALL 4 analyzer stages PASSED (subsystems executed), BUT findings > 0 and healthScore < 100%',
      `Stages Passed: Discovery(${discoveryPassed}), Parser(${parserPassed}), Security(${securityPassed}), Resource(${resourcePassed}) | Findings: ${resultB.issues.length}, Health Score: ${resultB.healthScore}%`
    );
  } catch (err: any) {
    assert(false, 'Case B: Python file with errors threw exception', err.message);
  }

  // Case C: Empty Python file
  const emptyFilePath = resolve('./tests/fixtures/empty_test.py');
  try {
    console.log('\nTest Case C: Empty Python file');
    writeFileSync(emptyFilePath, '   \n  \n', 'utf8');
    const resultC = await analyzerEngine.analyze({ localPath: emptyFilePath });
    assert(
      resultC.analysisStatus === 'FILE_READ_FAILED' && resultC.healthScore === null,
      'Case C: Empty file returns FILE_READ_FAILED status and null health score (—)',
      `Status: ${resultC.analysisStatus}, Health Score: ${resultC.healthScore}`
    );
  } catch (err: any) {
    assert(false, 'Case C threw unexpected exception', err.message);
  } finally {
    if (existsSync(emptyFilePath)) unlinkSync(emptyFilePath);
  }

  // Case D: Invalid path
  try {
    console.log('\nTest Case D: Invalid path');
    const invalidPath = resolve('./tests/fixtures/non_existent_file.py');
    const resultD = await analyzerEngine.analyze({ localPath: invalidPath });
    assert(
      resultD.analysisStatus === 'FILE_READ_FAILED' && resultD.healthScore === null,
      'Case D: Non-existent path returns FILE_READ_FAILED status and null health score (—)',
      `Status: ${resultD.analysisStatus}, Health Score: ${resultD.healthScore}`
    );
  } catch (err: any) {
    assert(false, 'Case D threw unexpected exception', err.message);
  }

  // Summary Report
  console.log('\n==================================================');
  console.log(`📊 Test Suite Finished: ${passedCount} Passed, ${failedCount} Failed.`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
