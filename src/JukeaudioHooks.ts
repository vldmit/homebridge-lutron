/**
 * Routes Pico volume buttons to jukeaudio-control via VolumeHookController.
 * @private
 */

import { Action, Button, Device } from "@mkellsy/hap-device";
import { Logging } from "homebridge";

import { JukeaudioClient, RampDirection } from "./JukeaudioClient";
import { ResolvedJukeaudioConfig } from "./JukeaudioConfig";
import { VolumeHookController } from "./VolumeHookController";

function keyOf(deviceName: string, buttonName: string): string {
    return `${deviceName}\0${buttonName}`;
}

/**
 * Indexes config bindings and handles LEAP Action events for matched buttons.
 */
export class JukeaudioHooks {
    private readonly client: JukeaudioClient;
    private readonly controllers = new Map<string, VolumeHookController>();
    private readonly matchedDevices = new Set<string>();
    private readonly expectedDevices: string[];

    constructor(
        private readonly config: ResolvedJukeaudioConfig,
        private readonly log: Logging,
    ) {
        this.client = new JukeaudioClient({
            baseUrl: config.baseUrl,
            username: config.username,
            password: config.password,
            timeoutMs: config.timeoutMs,
        });

        this.expectedDevices = [...new Set(config.bindings.map((b) => b.deviceName))];

        for (const binding of config.bindings) {
            this.registerButton(binding.deviceName, binding.volumeUp, binding.zone, "up");
            this.registerButton(binding.deviceName, binding.volumeDown, binding.zone, "down");
        }

        this.log.info(
            `Jukeaudio hooks: ${config.bindings.length} binding(s) → ${config.baseUrl} ` +
                `(step=${config.step} hold=${config.holdDelayMs}ms double=${config.doubleClickMs}ms)`,
        );

        void this.client.health().then((ok) => {
            if (ok) {
                this.log.info(`Jukeaudio control service healthy at ${config.baseUrl}`);
            } else {
                this.log.warn(`Jukeaudio control service not reachable at ${config.baseUrl}/health`);
            }
        });
    }

    /**
     * Handle a LEAP button action. Returns true if a juke binding consumed it.
     */
    public handle(device: Device, button: Button, action: Action): boolean {
        const controller = this.controllers.get(keyOf(device.name, button.name));
        if (controller == null) {
            return false;
        }

        this.matchedDevices.add(device.name);

        if (action === "Press") {
            controller.onPress();
            return true;
        }

        if (action === "Release") {
            controller.onRelease();
            return true;
        }

        // DoublePress / LongPress should not appear for raise/lower after leap-client raw mode.
        return true;
    }

    /** Log bindings that never matched a live remote (call after discovery settles). */
    public warnUnmatched(): void {
        for (const name of this.expectedDevices) {
            if (!this.matchedDevices.has(name)) {
                this.log.warn(
                    `Jukeaudio binding deviceName=${JSON.stringify(name)} has not received any button events yet`,
                );
            }
        }
    }

    public dispose(): void {
        for (const controller of this.controllers.values()) {
            controller.dispose();
        }
        this.controllers.clear();
    }

    private registerButton(deviceName: string, buttonName: string, zone: string, direction: RampDirection): void {
        const k = keyOf(deviceName, buttonName);
        this.controllers.set(
            k,
            new VolumeHookController({
                zone,
                direction,
                step: this.config.step,
                holdDelayMs: this.config.holdDelayMs,
                doubleClickMs: this.config.doubleClickMs,
                client: this.client,
                log: (msg) => this.log.info(msg),
                logError: (msg) => this.log.error(msg),
            }),
        );
        this.log.info(`Jukeaudio bind: ${deviceName} / ${buttonName} → ${zone} (${direction})`);
    }
}
