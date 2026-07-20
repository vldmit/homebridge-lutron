/**
 * Per-button state machine: press step, hold ramp, double-click absolute.
 * @private
 */

import { JukeaudioClient, RampDirection } from "./JukeaudioClient";

export interface VolumeHookOptions {
    zone: string;
    direction: RampDirection;
    step: number;
    holdDelayMs: number;
    doubleClickMs: number;
    client: JukeaudioClient;
    log: (message: string) => void;
    logError: (message: string) => void;
    /** Injected for tests. */
    setTimeoutFn?: typeof setTimeout;
    clearTimeoutFn?: typeof clearTimeout;
}

type Phase = "idle" | "held" | "ramping" | "waitDouble";

/**
 * Handles raw Press/Release for one volume button bound to a zone.
 */
export class VolumeHookController {
    private phase: Phase = "idle";
    private holdTimer?: ReturnType<typeof setTimeout>;
    private doubleTimer?: ReturnType<typeof setTimeout>;
    private readonly setTimeoutFn: typeof setTimeout;
    private readonly clearTimeoutFn: typeof clearTimeout;

    constructor(private readonly options: VolumeHookOptions) {
        this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
        this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    }

    onPress(): void {
        if (this.phase === "waitDouble") {
            this.clearDoubleTimer();
            this.phase = "idle";
            void this.safe("set absolute", () =>
                this.options.client.setVolume(this.options.zone, this.options.direction === "up" ? 100 : 0),
            );
            this.options.log(
                `Juke: ${this.options.zone} double-click → volume ${this.options.direction === "up" ? 100 : 0}`,
            );
            return;
        }

        if (this.phase !== "idle") {
            return;
        }

        this.phase = "held";
        const { zone, direction, step } = this.options;
        const label = direction === "up" ? `+${step}` : `-${step}`;

        void this.safe("step", async () => {
            if (direction === "up") {
                await this.options.client.increase(zone, step);
            } else {
                await this.options.client.decrease(zone, step);
            }
        });
        this.options.log(`Juke: ${zone} ${label}`);

        this.holdTimer = this.setTimeoutFn(() => {
            this.holdTimer = undefined;
            if (this.phase !== "held") {
                return;
            }
            this.phase = "ramping";
            void this.safe("ramp start", () => this.options.client.rampStart(zone, direction));
            this.options.log(`Juke: ${zone} ramp ${direction} start`);
        }, this.options.holdDelayMs) as ReturnType<typeof setTimeout>;
    }

    onRelease(): void {
        this.clearHoldTimer();

        if (this.phase === "ramping") {
            const { zone, direction } = this.options;
            this.phase = "idle";
            void this.safe("ramp stop", () => this.options.client.rampStop(zone, direction));
            this.options.log(`Juke: ${zone} ramp ${direction} stop`);
            return;
        }

        if (this.phase === "held") {
            // Short press — arm double-click window.
            this.phase = "waitDouble";
            this.doubleTimer = this.setTimeoutFn(() => {
                this.doubleTimer = undefined;
                if (this.phase === "waitDouble") {
                    this.phase = "idle";
                }
            }, this.options.doubleClickMs) as ReturnType<typeof setTimeout>;
            return;
        }
    }

    /** Stop any active ramp (e.g. platform shutdown). */
    dispose(): void {
        this.clearHoldTimer();
        this.clearDoubleTimer();
        if (this.phase === "ramping") {
            void this.safe("ramp stop dispose", () =>
                this.options.client.rampStop(this.options.zone, this.options.direction),
            );
        }
        this.phase = "idle";
    }

    private clearHoldTimer(): void {
        if (this.holdTimer != null) {
            this.clearTimeoutFn(this.holdTimer);
            this.holdTimer = undefined;
        }
    }

    private clearDoubleTimer(): void {
        if (this.doubleTimer != null) {
            this.clearTimeoutFn(this.doubleTimer);
            this.doubleTimer = undefined;
        }
    }

    private async safe(label: string, fn: () => Promise<void>): Promise<void> {
        try {
            await fn();
        } catch (error) {
            this.options.logError(
                `Juke ${label} failed (${this.options.zone}): ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
