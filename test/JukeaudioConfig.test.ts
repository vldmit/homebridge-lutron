import { expect } from "chai";

import { resolveJukeaudioConfig } from "../src/JukeaudioConfig";

describe("resolveJukeaudioConfig", () => {
    it("returns null when missing", () => {
        expect(resolveJukeaudioConfig(undefined)).to.equal(null);
        expect(resolveJukeaudioConfig(null)).to.equal(null);
        expect(resolveJukeaudioConfig({})).to.equal(null);
    });

    it("returns null when enabled false", () => {
        expect(
            resolveJukeaudioConfig({
                enabled: false,
                baseUrl: "http://127.0.0.1:9002",
                username: "control",
                password: "x",
                bindings: [{ deviceName: "A", zone: "Z" }],
            }),
        ).to.equal(null);
    });

    it("resolves defaults", () => {
        const cfg = resolveJukeaudioConfig({
            baseUrl: "http://127.0.0.1:9002/",
            username: "control",
            password: "changeme",
            bindings: [{ deviceName: "Room Audio remote Position 1", zone: "Upper Floor" }],
        });

        expect(cfg).to.not.equal(null);
        expect(cfg!.baseUrl).to.equal("http://127.0.0.1:9002");
        expect(cfg!.step).to.equal(5);
        expect(cfg!.holdDelayMs).to.equal(450);
        expect(cfg!.bindings[0].volumeUp).to.equal("Volume Up");
        expect(cfg!.bindings[0].volumeDown).to.equal("Volume Down");
    });
});
