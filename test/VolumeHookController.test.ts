import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { VolumeHookController } from "../src/VolumeHookController";
import { JukeaudioClient } from "../src/JukeaudioClient";

chai.use(sinonChai);

describe("VolumeHookController", () => {
    let client: sinon.SinonStubbedInstance<JukeaudioClient>;
    let log: sinon.SinonStub;
    let logError: sinon.SinonStub;
    let clock: sinon.SinonFakeTimers;
    let controller: VolumeHookController;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
        client = {
            increase: sinon.stub().resolves(),
            decrease: sinon.stub().resolves(),
            rampStart: sinon.stub().resolves(),
            rampStop: sinon.stub().resolves(),
            setVolume: sinon.stub().resolves(),
            health: sinon.stub().resolves(true),
        } as any;
        log = sinon.stub();
        logError = sinon.stub();

        controller = new VolumeHookController({
            zone: "Upper Floor",
            direction: "up",
            step: 5,
            holdDelayMs: 450,
            doubleClickMs: 450,
            client: client as any,
            log,
            logError,
        });
    });

    afterEach(() => {
        clock.restore();
    });

    it("sends one-shot increase on press", async () => {
        controller.onPress();
        await clock.tickAsync(0);
        expect(client.increase).to.have.been.calledOnceWith("Upper Floor", 5);
        expect(client.rampStart).to.not.have.been.called;
    });

    it("starts ramp after holdDelayMs if still held", async () => {
        controller.onPress();
        await clock.tickAsync(449);
        expect(client.rampStart).to.not.have.been.called;
        await clock.tickAsync(1);
        expect(client.rampStart).to.have.been.calledOnceWith("Upper Floor", "up");
    });

    it("stops ramp on release after hold", async () => {
        controller.onPress();
        await clock.tickAsync(450);
        controller.onRelease();
        await clock.tickAsync(0);
        expect(client.rampStop).to.have.been.calledOnceWith("Upper Floor", "up");
        expect(client.setVolume).to.not.have.been.called;
    });

    it("does not start ramp if released before hold delay", async () => {
        controller.onPress();
        await clock.tickAsync(100);
        controller.onRelease();
        await clock.tickAsync(500);
        expect(client.rampStart).to.not.have.been.called;
        expect(client.increase).to.have.been.calledOnce;
    });

    it("sets volume 100 on double-click up within window", async () => {
        controller.onPress();
        await clock.tickAsync(0);
        controller.onRelease();
        await clock.tickAsync(100);
        controller.onPress();
        await clock.tickAsync(0);
        expect(client.setVolume).to.have.been.calledOnceWith("Upper Floor", 100);
        expect(client.increase).to.have.been.calledOnce;
    });

    it("sets volume 0 on double-click down", async () => {
        const down = new VolumeHookController({
            zone: "Kitchen Speaker",
            direction: "down",
            step: 5,
            holdDelayMs: 450,
            doubleClickMs: 450,
            client: client as any,
            log,
            logError,
        });
        down.onPress();
        await clock.tickAsync(0);
        down.onRelease();
        await clock.tickAsync(50);
        down.onPress();
        await clock.tickAsync(0);
        expect(client.decrease).to.have.been.calledOnceWith("Kitchen Speaker", 5);
        expect(client.setVolume).to.have.been.calledOnceWith("Kitchen Speaker", 0);
    });

    it("does not set absolute after long hold release", async () => {
        controller.onPress();
        await clock.tickAsync(450);
        controller.onRelease();
        await clock.tickAsync(0);
        controller.onPress();
        await clock.tickAsync(0);
        // second press after long hold is a new step, not double absolute
        expect(client.setVolume).to.not.have.been.called;
        expect(client.increase).to.have.been.calledTwice;
    });

    it("expires double-click window without absolute set", async () => {
        controller.onPress();
        await clock.tickAsync(0);
        controller.onRelease();
        await clock.tickAsync(451);
        controller.onPress();
        await clock.tickAsync(0);
        expect(client.setVolume).to.not.have.been.called;
        expect(client.increase).to.have.been.calledTwice;
    });
});
