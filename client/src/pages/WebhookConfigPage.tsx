/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 *
 * Backward-compatible shim. The original webhook config UI was
 * split into the new tabbed AutomationHub at:
 *   - Marketplace:  /app/settings/automation/marketplace
 *   - Starter pack: /app/settings/automation/starter
 *   - My Webhooks:  /app/settings/automation/mine
 *   - API Keys:     /app/settings/automation/api
 */
import { Redirect } from "wouter";

export default function WebhookConfigPage() {
  return <Redirect to="/app/settings/automation/mine" />;
}
