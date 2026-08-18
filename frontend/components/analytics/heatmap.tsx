interface HeatmapProps {
  data: { hour: number; day: number; avgScore: number }[];  // 7 days x 24 hours
}

function heatColor(score: number): string {
  if (score >= 0.85) return "#f85149";
  if (score >= 0.65) return "#d29922";
  if (score >= 0.3) return "#1f6f3f";
  return "#1c2333";
}

export function Heatmap({ data }: HeatmapProps) {
  const grid = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.avgScore]));

  return (
    <div className="grid grid-cols-24 gap-[3px]">
      {Array.from({ length: 7 }).flatMap((_, day) =>
        Array.from({ length: 24 }).map((_, hour) => {
          const score = grid.get(`${day}-${hour}`) ?? 0;
          return (
            <div key={`${day}-${hour}`} className="aspect-square rounded-[2px]"
              style={{ background: heatColor(score) }}
              title={`Day ${day}, ${hour}:00 — avg ${score.toFixed(2)}`} />
          );
        })
      )}
    </div>
  );
}
