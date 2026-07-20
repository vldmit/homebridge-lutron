/**
 * Optional jukeaudio-control integration config (platform.jukeaudio).
 * @private
 */

export interface JukeaudioBindingConfig {
    /** Match LEAP/Homebridge device.name exactly (e.g. "Room Audio remote Position 1"). */
    deviceName: string;
    /** Zone or virtual zone name for jukeaudio-control (/zones/{zone}/...). */
    zone: string;
    /** Button name for volume up (default "Volume Up"). */
    volumeUp?: string;
    /** Button name for volume down (default "Volume Down"). */
    volumeDown?: string;
}

export interface JukeaudioConfig {
    enabled?: boolean;
    /** Base URL of the control service, e.g. http://127.0.0.1:9002 */
    baseUrl: string;
    /** HTTP Basic username for the control service. */
    username: string;
    /** HTTP Basic password for the control service. */
    password: string;
    /** One-shot step on press (default 5). */
    step?: number;
    /** Hold this long before ramp start (default 450). */
    holdDelayMs?: number;
    /** Double-click window after short release (default 450). */
    doubleClickMs?: number;
    /** HTTP timeout in ms (default 3000). */
    timeoutMs?: number;
    bindings: JukeaudioBindingConfig[];
}

export interface ResolvedJukeaudioConfig {
    enabled: boolean;
    baseUrl: string;
    username: string;
    password: string;
    step: number;
    holdDelayMs: number;
    doubleClickMs: number;
    timeoutMs: number;
    bindings: Array<{
        deviceName: string;
        zone: string;
        volumeUp: string;
        volumeDown: string;
    }>;
}

export function resolveJukeaudioConfig(raw: unknown): ResolvedJukeaudioConfig | null {
    if (raw == null || typeof raw !== "object") {
        return null;
    }

    const cfg = raw as Partial<JukeaudioConfig>;

    if (cfg.enabled === false) {
        return null;
    }

    if (!cfg.baseUrl || !cfg.username || !cfg.password) {
        return null;
    }

    const bindings = Array.isArray(cfg.bindings) ? cfg.bindings : [];
    if (bindings.length === 0) {
        return null;
    }

    const resolved = bindings
        .filter((b) => b && typeof b.deviceName === "string" && typeof b.zone === "string")
        .map((b) => ({
            deviceName: b.deviceName,
            zone: b.zone,
            volumeUp: b.volumeUp || "Volume Up",
            volumeDown: b.volumeDown || "Volume Down",
        }));

    if (resolved.length === 0) {
        return null;
    }

    return {
        enabled: true,
        baseUrl: String(cfg.baseUrl).replace(/\/+$/, ""),
        username: String(cfg.username),
        password: String(cfg.password),
        step: typeof cfg.step === "number" && cfg.step > 0 ? cfg.step : 5,
        holdDelayMs: typeof cfg.holdDelayMs === "number" && cfg.holdDelayMs >= 0 ? cfg.holdDelayMs : 450,
        doubleClickMs: typeof cfg.doubleClickMs === "number" && cfg.doubleClickMs >= 0 ? cfg.doubleClickMs : 450,
        timeoutMs: typeof cfg.timeoutMs === "number" && cfg.timeoutMs > 0 ? cfg.timeoutMs : 3000,
        bindings: resolved,
    };
}
