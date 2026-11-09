import pc from 'picocolors';

export const logger = {
  info: (msg: string) => console.log(pc.cyan('ℹ ') + msg),
  success: (msg: string) => console.log(pc.green('✔ ') + msg),
  warn: (msg: string) => console.log(pc.yellow('⚠ ') + msg),
  error: (msg: string) => console.error(pc.red('✖ ') + msg),
  step: (step: number | string, msg: string) =>
    console.log(pc.bold(pc.magenta(`[${step}] `)) + pc.bold(msg)),
  dim: (msg: string) => console.log(pc.dim(msg)),
};
