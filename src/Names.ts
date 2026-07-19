import { Device } from "@mkellsy/hap-device";

/**
 * Devices may carry areaPath from leap-client (not on the base hap-device type).
 */
export type DeviceLocation = Device & {
    areaPath?: string;
};

/**
 * HomeKit display name: "Room DeviceName", unless the name already includes
 * the room (keypads/remotes) or room is empty/identical.
 */
export function deviceDisplayName(device: DeviceLocation): string {
    const name = (device.name || "").trim() || "Unknown";
    const room = (device.room || "").trim();

    if (!room || room === name) {
        return name;
    }

    if (name.startsWith(`${room} `) || name.startsWith(`${room} - `)) {
        return name;
    }

    return `${room} ${name}`;
}

/**
 * Full LEAP area hierarchy when available (e.g. "House / Floor / Room").
 */
export function deviceAreaPath(device: DeviceLocation): string {
    if (typeof device.areaPath === "string" && device.areaPath.trim() !== "") {
        return device.areaPath.trim();
    }

    return (device.room || "").trim();
}
