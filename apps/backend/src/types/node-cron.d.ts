declare module 'node-cron' {
  export interface ScheduledTask {
    start: () => void;
    stop: () => void;
  }
  export function schedule(
    expression: string,
    func: () => void,
    options?: { scheduled?: boolean; timezone?: string },
  ): ScheduledTask;
  const _default: { schedule: typeof schedule };
  export default _default;
}
