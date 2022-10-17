import Pbf from "pbf";
import { publicKeyHashToAddress, publicKeyToAddress } from "../chain/address.js";
import envelopeProto from "../envelope.proto";
import { TokenizedAction } from "./tokenized.js";

function isScript(script, text) {
    return script.map(({ operation }) => operation).join(",") == text;
}


export function decodeInputScript(script) {
    if (isScript(script, "PUSH,PUSH")) {
        return new P2PKH(publicKeyToAddress(script[1].data));
    }
}

export class P2PKH {
    constructor(address) {
        this.address = address;
    }
}

function consumePushdata(script) {
    if (script[0].operation != "PUSH") return null;
    return script.shift().value;
}



export class EnvelopeV1 {
    constructor(protocols, data) {
        this.protocols = protocols;
        this.data = data;
    }

    get content() {
        if (["TKN", "test.TKN"].includes(this.protocols[0])) {
            let [version, typeCode, payloadProtobuf] = this.data;
            if (version?.number == 0) {
                return TokenizedAction.decode(typeCode.string, payloadProtobuf.bytes);
            }
        }
    }

    static decode(parameters) {
        // https://tsc.bitcoinassociation.net/standards/envelope-specification/
        let countProtocols = consumePushdata(parameters)?.number;
        let protocols = new Array(countProtocols).fill().map(() => consumePushdata(parameters)?.string);
        let countData = consumePushdata(parameters)?.number;
        let data = new Array(countData).fill().map(() => consumePushdata(parameters));
        return new EnvelopeV1(protocols, data);
    }
}

export class EnvelopeV0 {
    constructor(protocolTag, envelope, data) {
        this.protocolTag = protocolTag;
        this.envelope = envelope;
        this.data = data;
    }

    get content() {
        if (["TKN", "test.TKN"].includes(this.protocolTag)) {
            return TokenizedAction.decode(new TextDecoder().decode(this.envelope.Identifier), this.data.bytes);
        }
    }

    static decode(parameters) {
        const protocolTag = consumePushdata(parameters)?.string;
        let envelope = envelopeProto.Envelope.read(new Pbf(consumePushdata(parameters).bytes));
        let data = consumePushdata(parameters);
        return new EnvelopeV0(protocolTag, envelope, data);
    }
}

export function decodeOutputScript(script) {
    if (isScript(script, "DUP,HASH160,PUSH,EQUALVERIFY,CHECKSIG")) {
        return new P2PKH(publicKeyHashToAddress(script[2].data));
    }
    if (isScript(script.slice(0, 2), "PUSH,RETURN")) {
        let parameters = script.slice(2);
        let envelopeId = consumePushdata(parameters);
        if (envelopeId?.isHex("bd01")) {
            return EnvelopeV1.decode(parameters);
        }
        if (envelopeId?.isHex("bd00")) {
            return EnvelopeV0.decode(parameters);
        }
    }
}

