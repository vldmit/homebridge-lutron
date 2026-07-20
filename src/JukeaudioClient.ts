/**
 * HTTP client for the local jukeaudio-control service.
 * @private
 */

export type RampDirection = "up" | "down";

export interface JukeaudioClientOptions {
    baseUrl: string;
    username: string;
    password: string;
    timeoutMs: number;
}

export class JukeaudioClient {
    private readonly baseUrl: string;
    private readonly authHeader: string;
    private readonly timeoutMs: number;

    constructor(options: JukeaudioClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, "");
        this.authHeader = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
        this.timeoutMs = options.timeoutMs;
    }

    async increase(zone: string, step: number): Promise<void> {
        await this.post(`/zones/${encodeURIComponent(zone)}/volume/increase?step=${encodeURIComponent(String(step))}`);
    }

    async decrease(zone: string, step: number): Promise<void> {
        await this.post(`/zones/${encodeURIComponent(zone)}/volume/decrease?step=${encodeURIComponent(String(step))}`);
    }

    async rampStart(zone: string, direction: RampDirection): Promise<void> {
        const path = direction === "up" ? "increase" : "decrease";
        await this.post(`/zones/${encodeURIComponent(zone)}/volume/${path}/start`);
    }

    async rampStop(zone: string, direction: RampDirection): Promise<void> {
        const path = direction === "up" ? "increase" : "decrease";
        await this.post(`/zones/${encodeURIComponent(zone)}/volume/${path}/stop`);
    }

    async setVolume(zone: string, volume: number): Promise<void> {
        await this.post(`/zones/${encodeURIComponent(zone)}/volume`, { volume });
    }

    async health(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
            clearTimeout(timer);
            return res.ok;
        } catch {
            return false;
        }
    }

    private async post(path: string, body?: Record<string, unknown>): Promise<void> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method: "POST",
                headers: {
                    Authorization: this.authHeader,
                    ...(body != null ? { "Content-Type": "application/json" } : {}),
                },
                body: body != null ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status} ${path}: ${text.slice(0, 200)}`);
            }
        } finally {
            clearTimeout(timer);
        }
    }
}
