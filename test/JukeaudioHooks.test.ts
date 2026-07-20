import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { JukeaudioHooks } from "../src/JukeaudioHooks";
import * as ClientMod from "../src/JukeaudioClient";

chai.use(sinonChai);

describe("JukeaudioHooks", () => {
    let log: any;
    let increase: sinon.SinonStub;
    let setVolume: sinon.SinonStub;
    let health: sinon.SinonStub;
    let clientCtor: sinon.SinonStub;

    beforeEach(() => {
        log = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };

        increase = sinon.stub().resolves();
        setVolume = sinon.stub().resolves();
        health = sinon.stub().resolves(true);

        clientCtor = sinon.stub(ClientMod, "JukeaudioClient").callsFake(
            () =>
                ({
                    increase,
                    decrease: sinon.stub().resolves(),
                    rampStart: sinon.stub().resolves(),
                    rampStop: sinon.stub().resolves(),
                    setVolume,
                    health,
                }) as any,
        );
    });

    afterEach(() => {
        clientCtor.restore();
    });

    function hooks() {
        return new JukeaudioHooks(
            {
                enabled: true,
                baseUrl: "http://127.0.0.1:9002",
                username: "control",
                password: "changeme",
                step: 5,
                holdDelayMs: 450,
                doubleClickMs: 450,
                timeoutMs: 3000,
                bindings: [
                    {
                        deviceName: "Room Audio remote Position 1",
                        zone: "Upper Floor",
                        volumeUp: "Volume Up",
                        volumeDown: "Volume Down",
                    },
                ],
            },
            log,
        );
    }

    it("handles matching volume up press", () => {
        const h = hooks();
        const handled = h.handle(
            { name: "Room Audio remote Position 1" } as any,
            { name: "Volume Up" } as any,
            "Press",
        );
        expect(handled).to.equal(true);
        expect(increase).to.have.been.calledOnce;
    });

    it("ignores unknown device", () => {
        const h = hooks();
        const handled = h.handle(
            { name: "Other remote" } as any,
            { name: "Volume Up" } as any,
            "Press",
        );
        expect(handled).to.equal(false);
        expect(increase).to.not.have.been.called;
    });
});
