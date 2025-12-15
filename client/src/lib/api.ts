import { Decision } from "./mockData";

const API_BASE_URL = "https://8000-ifn4cmpvyieq38cbadkuh-5422eaae.manus-asia.computer";

export async function fetchDecisions(): Promise<Decision[]> {
  const response = await fetch(`${API_BASE_URL}/decisions`);
  if (!response.ok) {
    throw new Error("Failed to fetch decisions");
  }
  const data = await response.json();
  
  // Map API response to frontend model if necessary
  // The API returns a simplified model for the list view
  return data.map((d: any) => ({
    ...d,
    // Ensure types match what the UI expects
    risk_score: d.risk_score || 0,
    facts: {}, // List view might not have full facts
    timeline: [],
    explanation_tree: []
  }));
}

export async function fetchDecisionDetail(decisionId: string): Promise<Decision> {
  const response = await fetch(`${API_BASE_URL}/decisions/${decisionId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch decision detail");
  }
  const data = await response.json();
  
  // Transform API response to match UI Decision interface
  // The backend returns a flat structure, we might need to adapt it
  // For now, we'll assume the backend returns a compatible structure
  // or we construct the missing UI-specific fields here.
  
  return {
    decision_id: data.decision_id,
    entity_id: data.entity_id,
    timestamp: data.created_at,
    outcome: data.outcome.toUpperCase(), // API might return lowercase
    summary: data.explanation,
    risk_score: 85, // Placeholder as backend might not calculate this yet
    policy_version: "v1.0", // Placeholder
    facts: data.facts_used.reduce((acc: any, fact: any) => {
      acc[fact.fact_type] = fact.value;
      return acc;
    }, {}),
    timeline: [], // Backend doesn't support timeline yet
    explanation_tree: [
      {
        level: 1,
        title: "Policy Evaluation",
        content: data.explanation,
        evidence: {},
        children: data.policies_fired.map((policyId: string) => ({
          level: 2,
          title: `Policy Fired: ${policyId}`,
          content: "Policy criteria met",
          evidence: {},
          children: []
        }))
      }
    ]
  };
}
