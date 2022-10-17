import { bytesToHex } from "@noble/hashes/utils";
import Pbf from "pbf";
import actionsJSON from "../../specification/dist/json/actions.json";
import actionsProto from "../../specification/dist/protobuf/actions.proto";
import instrumentsJSON from "../../specification/dist/json/instruments.json";
import instrumentsProto from "../../specification/dist/protobuf/instruments.proto"
import messagesJSON from "../../specification/dist/json/messages.json";
import messagesProto from "../../specification/dist/protobuf/messages.proto"
import { parseTransaction } from "./transaction";




// const actionsSchema = YAML.parse(await (await fetch('https://raw.githubusercontent.com/tokenized/specification/master/src/actions/develop/schema.yaml')).text());

// const actionMessages = await Promise.all(actionsSchema.messages.map(async name =>
//     YAML.parse(await (await fetch(`https://raw.githubusercontent.com/tokenized/specification/master/src/actions/develop/${name}.yaml`)).text())
// ));


// const fieldTypes = await Promise.all(actionsSchema.fieldTypes.map(async name =>
//     YAML.parse(await (await fetch(`https://raw.githubusercontent.com/tokenized/specification/master/src/actions/develop/${name}.yaml`)).text())
// ));

//const messagesSchema = YAML.parse(await (await fetch('https://raw.githubusercontent.com/tokenized/specification/master/src/messages/develop/schema.yaml')).text());


//console.log(fieldTypes);

//console.log(actionMessages);

const actionAlias = { A1: 'I1', A2: 'I2', A3: 'I3' };

//console.log(actionsJSON.messages);

export class SimpleType {
    constructor(typeName) {
        this.typeName = typeName;
    }
}

export class ArrayType {
    constructor(itemType) {
        this.itemType = itemType;
    }
}

function findType(schema, typeName) {
    if (typeName.endsWith("[]")) {
        return new ArrayType(findType(schema, typeName.slice(0, -2)));
    }
    let fieldType = schema.fieldTypes.find(({ name }) => name == typeName);
    if (fieldType) {
        return new ObjectType(schema, fieldType);
    }
    return new SimpleType(typeName);
}

export class ObjectType {
    constructor(schema, specification) {
        this.specification = specification;
        this.schema = schema;
    }

    fieldType(fieldName) {
        return findType(this.schema, this.specification.fields.find(({ name }) => name == fieldName).type);
    }
}



export class TokenizedAction {
    constructor(actionCode, actionType, data) {
        this.actionCode = actionCode;
        this.data = data;
        this.actionType = actionType;
        this.objectType = new ObjectType(actionsJSON, actionType);

        // this.decoded = {
        //     InstrumentCreation: () => decodeInstrument(data.InstrumentType, data.InstrumentPayload),
        //     InstrumentDefinition: () => decodeInstrument(data.InstrumentType, data.InstrumentPayload),
        //     Message: () => decodeMessage(data.MessageCode, data.MessagePayload)
        // }[actionType.name]?.();

        this.message = this.actionType.name == "Message" && decodeMessage(data.MessageCode, data.MessagePayload);
        this.instrument = ["InstrumentCreation", "InstrumentDefinition"].includes(this.actionType.name) &&
            decodeInstrument(data.InstrumentType, data.InstrumentPayload);

        this.description = {
            "ContractOffer": this.data.ContractName,
            "ContractFormation": this.data.ContractName,
            // "InstrumentCreation": `${this.data.AuthorizedTokenQty} ${this.instrument.InstrumentPayload?.CouponName}`,
            // "InstrumentDefinition": `${this.data.AuthorizedTokenQty} ${this.decoded.InstrumentPayload?.CouponName}`,
        }[this.actionType.name];
    }



    static decode(code, payload) {
        let actionCode = actionAlias[code] || code;
        let actionType = actionsJSON.messages.find(({ code }) => code == actionCode) || {};
        let action = actionsProto[actionType.name]?.read(new Pbf(payload));

        return new TokenizedAction(actionCode, actionType, action);
    }
}

export function jsonPrettyPrint(value) {
    function jsonTransform(value) {
        if (value instanceof Array) {
            return value.map(jsonTransform);
        }
        if (value instanceof Uint8Array) {
            return `bytes:${bytesToHex(value)}`;
        }
        if (value?.constructor?.isLong?.(value)) {
            return value.toNumber();
        }
        if (value instanceof Object) {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonTransform(v)]));
        }

        return value;
    }

    return JSON.stringify(jsonTransform(value), null, 4);
}

class Instrument {
    constructor(instrumentType, data) {
        this.objectType = new ObjectType(instrumentsJSON, instrumentType);
        this.instrumentType = instrumentType;
        this.data = data;
    }
}

export function decodeInstrument(instrumentTypeCode, instrumentPayload) {

    let instrumentType = instrumentsJSON.messages.find(({ code }) => code == instrumentTypeCode) || {};
    return new Instrument(instrumentType, instrumentsProto[instrumentType.name]?.read(new Pbf(instrumentPayload)));
}

function tryParseTransaction(tx) {
    try {
        console.log("parse tx", tx);
        return parseTransaction(tx);
    } catch (e) {
        console.error(e);
        return `Unable to parse transaction: ${e.message}`;
    }
}

class Message {
    constructor(messageType, data) {
        this.objectType = new ObjectType(messagesJSON, messageType);
        this.messageType = messageType;
        this.data = data;
    }

    get transaction() {
        return ["Offer", "SignatureRequest"].includes(this.messageType.name) && this.data.Payload;
    }

    get action() {
        return ["SettlementRequest"].includes(this.messageType.name) && this.data.Settlement;
    }
}

export function decodeMessage(messageCode, messagePayload) {
    let messageType = messagesJSON.messages.find(({ code }) => code == messageCode);
    let data = messagesProto[messageType.name]?.read(new Pbf(messagePayload));

    return new Message(messageType, data);
}
