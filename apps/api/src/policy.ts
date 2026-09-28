import { IssueContext, RemediationPlan } from './ai/Provider.ts';

export interface RemediationPolicy {
  actionType: string;
  environment: string;
  severity: string;
  requiresApproval: boolean;
  confidenceThreshold: number;
}

const defaultPolicies: RemediationPolicy[] = [
  { actionType: 'CODE_PATCH', environment: 'Production', severity: 'Critical', requiresApproval: true, confidenceThreshold: 90 },
  { actionType: 'CONFIGURATION_CHANGE', environment: 'Development', severity: 'Warning', requiresApproval: false, confidenceThreshold: 80 }
];

export function evaluatePolicy(
  context: IssueContext,
  plan: RemediationPlan,
  environment: string = 'Production'
): { approved: boolean; reason: string } {
  // If it's a critical production issue, ALWAYS require approval
  if (environment === 'Production' && context.severity === 'Critical') {
    return { approved: false, reason: 'Production policies require human approval for critical issues.' };
  }

  // If the AI confidence is too low, require approval
  if (plan.confidence < 85) {
    return { approved: false, reason: `AI Confidence (${plan.confidence}%) is below the safe threshold of 85%.` };
  }

  // Find a matching policy
  const matchedPolicy = defaultPolicies.find(p => p.actionType === plan.actionType && p.environment === environment);
  if (matchedPolicy) {
    if (matchedPolicy.requiresApproval) {
      return { approved: false, reason: 'Policy rule specifically requires approval for this action.' };
    }
    if (plan.confidence < matchedPolicy.confidenceThreshold) {
       return { approved: false, reason: 'Confidence did not meet the policy threshold.' };
    }
    return { approved: true, reason: 'Action is safe and auto-remediation is permitted by policy.' };
  }

  // Default to requiring approval if no explicit policy allows it
  return { approved: false, reason: 'No explicit policy found to auto-approve this action.' };
}
