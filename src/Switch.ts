import * as Leap from "@vldmit/leap-client";

import { API, CharacteristicValue, Logging, Service } from "homebridge";

import { Common } from "./Common";
import { Device } from "./Device";

/**
 * Creates a switch device.
 * @private
 */
export class Switch extends Common<Leap.Switch> implements Device {
    private service: Service;

    /**
     * Creates a switch device.
     *
     * @param homebridge A reference to the Homebridge API.
     * @param device A reference to the discovered device.
     * @param log A refrence to the Homebridge logger.
     */
    constructor(homebridge: API, device: Leap.Switch, log: Logging) {
        super(homebridge, device, log);

        this.service =
            this.accessory.getService(this.homebridge.hap.Service.Switch) ||
            this.accessory.addService(this.homebridge.hap.Service.Switch, this.device.name);

        if (!this.service.testCharacteristic(this.homebridge.hap.Characteristic.ConfiguredName)) {
            this.service.addCharacteristic(this.homebridge.hap.Characteristic.ConfiguredName);
        }

        this.service.setCharacteristic(this.homebridge.hap.Characteristic.Name, this.displayName);
        this.service.setCharacteristic(this.homebridge.hap.Characteristic.ConfiguredName, this.displayName);

        this.service
            .getCharacteristic(this.homebridge.hap.Characteristic.On)
            .onGet(this.onGetState)
            .onSet(this.onSetState);
    }

    /**
     * Updates Homebridge accessory when an update comes from the device.
     *
     * @param state The current switch state.
     */
    public onUpdate(state: Leap.SwitchState): void {
        this.log.debug(`Switch: ${this.device.name} state: ${state.state}`);

        this.service.updateCharacteristic(this.homebridge.hap.Characteristic.On, state.state === "On");
    }

    /**
     * Fetches the current state when Homebridge asks for it.
     *
     * @returns A characteristic value.
     */
    private onGetState = (): CharacteristicValue => {
        const on = this.device.status.state === "On";

        this.log.info(`[LEAP] Switch Get State: ${this.device.name} status=${this.device.status.state} -> ${on}`);

        return on;
    };

    /**
     * Updates the device when a change comes in from Homebridge.
     *
     * @param value The characteristic value from Homebrtidge.
     */
    private onSetState = async (value: CharacteristicValue): Promise<void> => {
        const state = value ? "On" : "Off";

        this.log.info(
            `[LEAP] Switch Set State: ${this.device.name} requested=${state} current=${this.device.status.state}`,
        );

        if (this.device.status.state !== state) {
            try {
                await this.device.set({ state });
                this.log.info(`[LEAP] Switch Set State: ${this.device.name} set() completed for ${state}`);
            } catch (error) {
                this.log.error(
                    `[LEAP] Switch Set State failed: ${this.device.name} ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        } else {
            this.log.info(`[LEAP] Switch Set State: ${this.device.name} already ${state}, skipping set()`);
        }
    };
}
