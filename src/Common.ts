import { API, Logging, PlatformAccessory } from "homebridge";
import { Device } from "@mkellsy/hap-device";

import { accessories, devices, platform, plugin } from "./Platform";
import { deviceAreaPath, deviceDisplayName } from "./Names";

/**
 * Defines common functionallity for a device.
 * @private
 */
export abstract class Common<DEVICE extends Device> {
    public readonly id: string;
    public readonly accessory: PlatformAccessory;

    protected readonly log: Logging;
    protected readonly homebridge: API;
    protected readonly device: DEVICE;
    protected readonly displayName: string;
    protected readonly areaPath: string;

    /**
     * Creates a common device.
     *
     * @param homebridge A reference to the Homebridge API.
     * @param device A reference to the discovered device.
     * @param log A refrence to the Homebridge logger.
     */
    constructor(homebridge: API, device: DEVICE, log: Logging) {
        this.log = log;
        this.homebridge = homebridge;
        this.device = device;
        this.displayName = deviceDisplayName(device);
        this.areaPath = deviceAreaPath(device);

        this.id = this.homebridge.hap.uuid.generate(this.device.id);
        this.accessory =
            accessories.get(this.id) || new this.homebridge.platformAccessory(this.displayName, this.id);

        this.accessory.displayName = this.displayName;

        this.accessory
            .getService(this.homebridge.hap.Service.AccessoryInformation)!
            .setCharacteristic(this.homebridge.hap.Characteristic.Manufacturer, this.device.manufacturer)
            .setCharacteristic(this.homebridge.hap.Characteristic.Model, this.device.type)
            .setCharacteristic(this.homebridge.hap.Characteristic.SerialNumber, this.device.id)
            .setCharacteristic(this.homebridge.hap.Characteristic.Name, this.displayName);
    }

    /**
     * Registers a device and if not cached, it will also inform Homebridge
     * about the device.
     */
    public register(): void {
        devices.set(this.id, this);

        if (accessories.has(this.id)) {
            return;
        }

        this.log.debug(`Register accessory: ${this.displayName} path=${this.areaPath}`);

        accessories.set(this.id, this.accessory);

        this.homebridge.registerPlatformAccessories(plugin, platform, [this.accessory]);
    }
}
