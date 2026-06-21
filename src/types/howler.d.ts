declare module "howler" {
  interface HowlerOptions {
    src: string[];
    format?: string[];
    html5?: boolean;
    preload?: boolean | "metadata" | "none";
    volume?: number;
    onload?: () => void;
    onloaderror?: (id: number, error: unknown) => void;
    onplay?: () => void;
    onend?: () => void;
    onpause?: () => void;
    onstop?: () => void;
    onseek?: () => void;
  }

  class Howl {
    constructor(options: HowlerOptions);
    play(id?: number): number;
    pause(id?: number): this;
    stop(id?: number): this;
    seek(seek?: number, id?: number): number;
    duration(id?: number): number;
    state(): "unloaded" | "loading" | "loaded";
    playing(id?: number): boolean;
    unload(): void;
    volume(vol?: number, id?: number): number;
    on(event: string, fn: (...args: unknown[]) => void, id?: number): this;
    off(event: string, fn?: (...args: unknown[]) => void, id?: number): this;
  }

  export { Howl };
  export type { HowlerOptions };
}
