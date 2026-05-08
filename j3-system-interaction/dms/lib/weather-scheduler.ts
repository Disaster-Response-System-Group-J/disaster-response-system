/**
 * STUB — weather-scheduler.ts was never merged to main.
 * These exports satisfy the imports in app/api/weather/fetch/route.ts and
 * app/api/weather/scheduler/route.ts so the build succeeds.
 * The real implementation (with Open-Meteo fetch logic) must be restored
 * from the weather-integration branch before weather APIs will function.
 */

const activeTasks = new Map<string, ReturnType<typeof setTimeout>>();

export async function fetchAndSaveWeatherForAllDivisions(
  _daysBack: number = 7
): Promise<{ success: number; failed: number; errors: string[] }> {
  console.warn("[WeatherScheduler] stub — weather-scheduler.ts not yet merged");
  return { success: 0, failed: 0, errors: ["Weather scheduler not implemented"] };
}

export function scheduleDailyWeatherFetch(scheduleTime: string): string {
  const taskId = `weather-task-${Date.now()}`;
  console.warn(`[WeatherScheduler] Stub scheduled for ${scheduleTime}`);
  const handle = setTimeout(() => {}, 86_400_000);
  activeTasks.set(taskId, handle);
  return taskId;
}

export function cancelAllScheduledTasks(): void {
  for (const [id, handle] of activeTasks) {
    clearTimeout(handle);
    activeTasks.delete(id);
  }
}

export function getActiveTaskCount(): number {
  return activeTasks.size;
}
