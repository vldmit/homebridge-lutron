import * as HAP from "@mkellsy/hap-device";
import * as Leap from "@mkellsy/leap-client";
import * as JsLogger from "js-logger";

import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from "homebridge";

import { Accessories } from "./Accessories";
import { Device } from "./Device";

import { defaults } from "./Config";

const accessories: Map<string, PlatformAccessory> = new Map();
const devices: Map<string, Device> = new Map();

const platform: string = "Lutron";
const plugin: string = "@mkellsy/homebridge-lutron";

export { accessories, devices, platform, plugin };

/**
 * Impliments a Homebridge platform plugin.
 * @private
 */
export class Platform implements DynamicPlatformPlugin {
    private readonly log: Logging;
    private readonly config: PlatformConfig;
    private readonly homebridge: API;
    private updateCount = 0;
    private actionCount = 0;

    /**
     * Creates an instance to this plugin.
     *
     * @param log A reference to the Homebridge logger.
     * @param config A reference to this plugin's config.
     * @param homebridge A reference to the Homebridge API.
     */
    constructor(log: Logging, config: PlatformConfig, homebridge: API) {
        this.log = log;
        this.config = { ...defaults, ...config };
        this.homebridge = homebridge;

        // leap-client uses js-logger; useDefaults installs a console handler (setDefaults alone is silent).
        JsLogger.useDefaults({
            defaultLevel: JsLogger.DEBUG,
            formatter: (messages, context) => {
                messages.unshift(`[LEAP][${context.name || "root"}]`);
            },
        });

        this.log.info(
            `[LEAP] platform init toggles: switches=${this.config.switches} dimmers=${this.config.dimmers} ` +
                `keypads=${this.config.keypads} sensors=${this.config.sensors} remotes=${this.config.remotes} ` +
                `timeclocks=${this.config.timeclocks} fans=${this.config.fans} shades=${this.config.shades} ` +
                `strips=${this.config.strips} cco=${this.config.cco}`,
        );

        this.homebridge.on("didFinishLaunching", () => {
            this.log.info("[LEAP] didFinishLaunching — starting Leap.connect()");

            try {
                const client = Leap.connect();

                client
                    .on("Available", this.onAvailable)
                    .on("Action", this.onAction)
                    .on("Update", this.onUpdate);

                this.log.info("[LEAP] Leap.connect() client created; waiting for discovery/Available");
            } catch (error) {
                this.log.error(`[LEAP] Leap.connect() threw: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }

    /**
     * Function to call when Homebridge findes a cached accessory that is
     * associated to this plugin.
     *
     * Note these accessories do not have extended data, the plugin wwill need
     * to re-initialize the device, and re-bind any listeners.
     *
     * @param accessory A reference to the cached accessory.
     */
    public configureAccessory(accessory: PlatformAccessory): void {
        accessories.set(accessory.UUID, accessory);
    }

    /*
     * mDNS discovery listener. This will create devices when found and will
     * register with Homebridge or re-initialize the accessory if it is from
     * the cache.
     */
    private onAvailable = (found: HAP.Device[]): void => {
        this.log.info(`[LEAP] Available event: ${found.length} device(s)`);

        if (found.length === 0) {
            this.log.warn("[LEAP] Available fired with zero devices");
        }

        let registered = 0;
        let skipped = 0;
        let failed = 0;

        for (const device of found) {
            try {
                const accessory = Accessories.create(this.homebridge, device, this.config, this.log);

                if (accessory == null) {
                    skipped += 1;
                    this.log.warn(
                        `[LEAP] no accessory for type=${device.type} name=${device.name} (disabled or unsupported)`,
                    );
                    Accessories.remove(this.homebridge, device);
                    continue;
                }

                accessory.register();
                registered += 1;
                this.log.info(`[LEAP] device available type=${device.type} name=${device.name} id=${device.id}`);
            } catch (error) {
                failed += 1;
                this.log.error(
                    `[LEAP] failed to wire device type=${device.type} name=${device.name} id=${device.id}: ${
                        error instanceof Error ? error.stack || error.message : String(error)
                    }`,
                );
            }
        }

        this.log.info(`[LEAP] Available wiring done: registered=${registered} skipped=${skipped} failed=${failed}`);
    };

    /*
     * Button press listener. This recieves actions from remotes and relays to
     * Homebridge.
     */
    private onAction = (device: HAP.Device, button: HAP.Button, action: HAP.Action): void => {
        this.actionCount += 1;

        if (this.actionCount <= 20 || this.actionCount % 50 === 0) {
            this.log.info(
                `[LEAP] Action #${this.actionCount}: ${device.name} button=${button.name} action=${action}`,
            );
        }

        const accessory = Accessories.get(this.homebridge, device);

        if (accessory == null || accessory.onAction == null) {
            return;
        }

        accessory.onAction(button, action);
    };

    /*
     * Device update listener. This recieves updates from the devices and will
     * relay the state to Homebridge.
     */
    private onUpdate = (device: HAP.Device, state: HAP.DeviceState): void => {
        this.updateCount += 1;

        if (this.updateCount <= 30 || this.updateCount % 50 === 0) {
            this.log.info(
                `[LEAP] Update #${this.updateCount}: ${device.name} (${device.type}) state=${JSON.stringify(state)}`,
            );
        }

        const accessory = Accessories.get(this.homebridge, device);

        if (accessory == null || accessory.onUpdate == null) {
            if (this.updateCount <= 10) {
                this.log.warn(`[LEAP] Update for unbound device ${device.name} (${device.type})`);
            }

            return;
        }

        accessory.onUpdate(state);
    };
}
