import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { JukeaudioClient } from "../src/JukeaudioClient";

chai.use(sinonChai);

describe("JukeaudioClient", () => {
    let fetchStub: sinon.SinonStub;
    let client: JukeaudioClient;

    beforeEach(() => {
        fetchStub = sinon.stub(globalThis, "fetch").resolves({
            ok: true,
            text: async () => "",
        } as Response);

        client = new JukeaudioClient({
            baseUrl: "http://127.0.0.1:9002/",
            username: "control",
            password: "changeme",
            timeoutMs: 1000,
        });
    });

    afterEach(() => {
        fetchStub.restore();
    });

    it("POSTs increase with step query and basic auth", async () => {
        await client.increase("Upper Floor", 5);

        expect(fetchStub).to.have.been.calledOnce;
        const [url, init] = fetchStub.firstCall.args;
        expect(url).to.equal("http://127.0.0.1:9002/zones/Upper%20Floor/volume/increase?step=5");
        expect(init.method).to.equal("POST");
        expect(init.headers.Authorization).to.equal(
            `Basic ${Buffer.from("control:changeme").toString("base64")}`,
        );
    });

    it("POSTs decrease", async () => {
        await client.decrease("Kitchen Speaker", 3);
        const [url] = fetchStub.firstCall.args;
        expect(url).to.equal(
            "http://127.0.0.1:9002/zones/Kitchen%20Speaker/volume/decrease?step=3",
        );
    });

    it("POSTs ramp start/stop", async () => {
        await client.rampStart("Upper Floor", "up");
        expect(fetchStub.firstCall.args[0]).to.equal(
            "http://127.0.0.1:9002/zones/Upper%20Floor/volume/increase/start",
        );
        await client.rampStop("Upper Floor", "down");
        expect(fetchStub.secondCall.args[0]).to.equal(
            "http://127.0.0.1:9002/zones/Upper%20Floor/volume/decrease/stop",
        );
    });

    it("POSTs absolute volume JSON body", async () => {
        await client.setVolume("Upper Floor", 100);
        const [url, init] = fetchStub.firstCall.args;
        expect(url).to.equal("http://127.0.0.1:9002/zones/Upper%20Floor/volume");
        expect(init.body).to.equal(JSON.stringify({ volume: 100 }));
        expect(init.headers["Content-Type"]).to.equal("application/json");
    });

    it("throws on non-ok response", async () => {
        fetchStub.resolves({
            ok: false,
            status: 401,
            text: async () => "unauthorized",
        } as Response);

        try {
            await client.increase("x", 1);
            expect.fail("should throw");
        } catch (e: any) {
            expect(e.message).to.include("401");
        }
    });
});
