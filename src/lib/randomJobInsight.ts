import insights from './jobInsights.json';

export function getRandomJobInsight(): string {
  if (!Array.isArray(insights) || insights.length === 0) {
    return 'No job insights available.';
  }
  const idx = Math.floor(Math.random() * insights.length);
  return insights[idx];
}
