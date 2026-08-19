export function getHomeRailCoverMetrics(screenWidth: number) {
  const width = Math.min(152, Math.max(132, screenWidth * 0.36));

  return {
    height: Math.round(width * (374 / 264)),
    width,
  };
}
