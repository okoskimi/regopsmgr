declare module 'safe-eval' {
  export default function safeEval(
    code: string,
    context: { [key: string]: any }
  ): any;
}
