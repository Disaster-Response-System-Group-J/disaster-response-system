import { NextResponse } from 'next/server';

const J2_API_URL = process.env.J2_API_URL || 'http://localhost:8082';

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${J2_API_URL}/api/v1/predictions/latest?limit=50`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`J2 API responded with ${res.status}`);
    }

    const json = await res.json();
    const predictions: any[] = json.predictions || [];

    // Normalise J2 DisasterPrediction rows into the alert shape the dashboard expects
    const alerts = predictions
      .filter((p: any) => p.predicted_severity >= 1) // skip NORMAL (0)
      .map((p: any) => {
        const maxProb = Math.max(p.prob_normal, p.prob_moderate, p.prob_severe, p.prob_extreme);
        let severity_level: string;
        if (p.prob_extreme >= 0.5 || p.prob_severe >= 0.75) severity_level = 'CRITICAL';
        else if (p.prob_severe >= 0.5) severity_level = 'HIGH';
        else if (p.prob_moderate >= 0.5) severity_level = 'MEDIUM';
        else severity_level = 'LOW';

        return {
          alertId: `pred-${p.prediction_id}`,
          title: `${p.predicted_severity_label} ${p.hazard_type} Risk`,
          severity_level,
          severity: severity_level,
          district: `Division ${p.division_id}`,
          division_id: p.division_id,
          hazard_type: p.hazard_type,
          predictionCategory: p.predicted_severity_label,
          predictionProbability: maxProb,
          considerationScore: maxProb, // real score populated by event-bridge enrichment
          status: 'ACTIVE',
          createdAt: p.run_at,
          created_at: p.run_at,
          probabilities: {
            normal: p.prob_normal,
            moderate: p.prob_moderate,
            severe: p.prob_severe,
            extreme: p.prob_extreme,
          },
        };
      });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Failed to fetch alerts from J2:', error);
    return NextResponse.json([], { status: 200 }); // Return empty array so dashboard still renders
  }
}
