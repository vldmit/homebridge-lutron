import * as Leap from "@vldmit/leap-client";

import { API, Logging, Service } from "homebridge";
import { Action, Button, DeviceType } from "@mkellsy/hap-device";

import { Common } from "./Common";
import { Device } from "./Device";

/**
 * Creates a keypad device.
 * @private
 */
export class Keypad extends Common<Leap.Keypad> implements Device {
    private services: Map<string, Service> = new Map();

    /**
     * Creates a keypad device.
     *
     * @param homebridge A reference to the Homebridge API.
     * @param device A reference to the discovered device.
     * @param log A refrence to the Homebridge logger.
     */
    constructor(homebridge: API, device: Leap.Keypad, log: Logging) {
        super(homebridge, device, log);

        const labelService =
            this.accessory.getService(this.homebridge.hap.Service.ServiceLabel) ||
            this.accessory.addService(this.homebridge.hap.Service.ServiceLabel);

        labelService.setCharacteristic(
            this.homebridge.hap.Characteristic.ServiceLabelNamespace,
            this.homebridge.hap.Characteristic.ServiceLabelNamespace.ARABIC_NUMERALS,
        );

        this.log.info(
            `Keypad/Remote setup: ${device.name} type=${device.type} buttons=${device.buttons?.length ?? 0}`,
        );

        for (const button of device.buttons) {
            const service =
                this.accessory.getServiceById(this.homebridge.hap.Service.StatelessProgrammableSwitch, button.name) ||
                this.accessory.addService(
                    this.homebridge.hap.Service.StatelessProgrammableSwitch,
                    button.name,
                    button.name,
                );

            if (!service.testCharacteristic(this.homebridge.hap.Characteristic.ConfiguredName)) {
                service.addCharacteristic(this.homebridge.hap.Characteristic.ConfiguredName);
            }
            service.addLinkedService(labelService);

            service.setCharacteristic(this.homebridge.hap.Characteristic.Name, button.name);
            service.setCharacteristic(this.homebridge.hap.Characteristic.ConfiguredName, button.name);
            service.setCharacteristic(this.homebridge.hap.Characteristic.ServiceLabelIndex, button.index);

            // Remotes support single/double/long; keypads only single press.
            // minValue must stay 0 (SINGLE_PRESS); only cap maxValue.
            service.getCharacteristic(this.homebridge.hap.Characteristic.ProgrammableSwitchEvent).setProps({
                minValue: this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
                maxValue:
                    device.type === DeviceType.Keypad
                        ? this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
                        : this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
                validValues:
                    device.type === DeviceType.Keypad
                        ? [this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS]
                        : [
                              this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
                              this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
                              this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
                          ],
            });

            this.services.set(button.id, service);
        }

        if ((device.buttons?.length ?? 0) === 0) {
            this.log.warn(
                `Keypad/Remote ${device.name} has 0 buttons — HomeKit will mark it Not Compatible until buttons load`,
            );
        }
    }

    /**
     * Invokes an action when a button is pressed.
     *
     * @param button The current button where the action was invoked.
     * @param action The action invoked (press, release, ...).
     */
    public onAction(button: Button, action: Action): void {
        const service = this.services.get(button.id);
        const characteristic = service?.getCharacteristic(this.homebridge.hap.Characteristic.ProgrammableSwitchEvent);

        if (service != null && characteristic != null) {
            switch (action) {
                case "Press":
                    this.log.info(`Keypad: ${this.device.name} ${button.name} Pressed`);

                    characteristic.updateValue(this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                    break;

                case "DoublePress":
                    this.log.info(`Keypad: ${this.device.name} ${button.name} Double Pressed`);

                    characteristic.updateValue(this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
                    break;

                case "LongPress":
                    this.log.info(`Keypad: ${this.device.name} ${button.name} Long Pressed`);

                    characteristic.updateValue(this.homebridge.hap.Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                    break;
            }
        }
    }
}
