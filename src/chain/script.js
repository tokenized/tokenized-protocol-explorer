#!/usr/bin/env node

import * as secp from "@noble/secp256k1";

import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { readVarint, writeVarint } from "./utils.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { BufferReader, BufferWriter } from "buffer-io";

// class PUSH {
//     constructor(data) {
//         this.data = data;
//     }

//     execute(stack) {
//         stack.push(this.data);
//     }
// }

class Value {
    constructor(bytes) {
        this.bytes = bytes;
    }

    get number() {
        return this.bytes.reduce((v, b, i) => {
            if (i == this.bytes.length - 1 && b >= 0x80) return -(v + ((b & 0x7f << (8 * i))));
            return v + (b << (8 * i));
        }, 0);
    }

    get string() {
        return new TextDecoder().decode(this.bytes);
    }

    isHex(hex) {
        return bytesToHex(this.bytes) == hex;
    }
}



const operations = [
    "NOP",
    "VER",
    "IF",
    "NOTIF",
    "VERIF",
    "VERNOTIF",
    "ELSE",
    "ENDIF",
    "VERIFY",
    "RETURN",
    "TOALTSTACK",
    "FROMALTSTACK",
    "2DROP",
    "2DUP",
    "3DUP",
    "2OVER",
    "2ROT",
    "2SWAP",
    "IFDUP",
    "DEPTH",
    "DROP",
    "DUP",
    "NIP",
    "OVER",
    "PICK",
    "ROLL",
    "ROT",
    "SWAP",
    "TUCK",
    "CAT",
    "SPLIT",
    "NUM2BIN",
    "BIN2NUM",
    "SIZE",
    "INVERT",
    "AND",
    "OR",
    "XOR",
    "EQUAL",
    "EQUALVERIFY",
    "RESERVED1",
    "RESERVED2",
    "1ADD",
    "1SUB",
    "2MUL",
    "2DIV",
    "NEGATE",
    "ABS",
    "NOT",
    "0NOTEQUAL",
    "ADD",
    "SUB",
    "MUL",
    "DIV",
    "MOD",
    "LSHIFT",
    "RSHIFT",
    "BOOLAND",
    "BOOLOR",
    "NUMEQUAL",
    "NUMEQUALVERIFY",
    "NUMNOTEQUAL",
    "LESSTHAN",
    "GREATERTHAN",
    "LESSTHANOREQUAL",
    "GREATERTHANOREQUAL",
    "MIN",
    "MAX",
    "WITHIN",
    "RIPEMD160",
    "SHA1",
    "SHA256",
    "HASH160",
    "HASH256",
    "CODESEPARATOR",
    "CHECKSIG",
    "CHECKSIGVERIFY",
    "CHECKMULTISIG",
    "CHECKMULTISIGVERIFY",
    "NOP1",
    "NOP2",
    "NOP3",
];

const writeInput = (writer, { txid, index }) => {
    writer.writeBytes(hexToBytes(txid).reverse());
    writer.writeU32(index);
}

const encodeInputOutpoints = (inputs) => {
    let writer = new BufferWriter().configure({ littleEndian: true });
    inputs.forEach((input) => writeInput(writer, input));
    return writer.getBuffer();
};

const encodeInputSequences = (inputs) => {
    let writer = new BufferWriter().configure({ littleEndian: true });
    inputs.forEach(({ sequence }) => {
        writer.writeU32(sequence);
    });
    return writer.getBuffer();
};

const encodeOutputs = outputs => {
    let writer = new BufferWriter().configure({ littleEndian: true });
    for (let { value, script } of outputs) {
        writer.writeU64big(BigInt(value));
        writeScript(writer, script);
    }
    return writer.getBuffer();
};

const encodeScript = script => {
    let writer = new BufferWriter().configure({ littleEndian: true });
    writeScript(writer, script);
    return writer.getBuffer();
}

const zeroHash = new Uint8Array(new Array(32).fill(0));

const log = (prefix, writer, callback) => {
    let start = writer.getSize();
    callback();
    let end = writer.getSize();
    console.log(prefix, writer.getBuffer().slice(start, end).toString("hex"));
};

const computeForkSigData = (transaction, inputIndex, spendingOutput, sigType) => {
    let writer = new BufferWriter().configure({ littleEndian: true });

    let all = (sigType & 0x3f) == 0x1;
    let none = (sigType & 0x3f) == 0x2;
    let single = (sigType & 0x3f) == 0x3;
    let anyonecanpay = sigType & 0x80;

    let forkid = 0;

    writer.writeU32(transaction.version);
    writer.writeBytes(anyonecanpay ? zeroHash : sha256(sha256(encodeInputOutpoints(transaction.inputs))));
    writer.writeBytes((anyonecanpay || single || none) ? zeroHash : sha256(sha256(encodeInputSequences(transaction.inputs))));
    writeInput(writer, transaction.inputs[inputIndex]);
    writer.writeBytes(encodeScript(spendingOutput.script));
    writer.writeU64big(BigInt(spendingOutput.value));
    writer.writeU32(transaction.inputs[inputIndex].sequence);
    writer.writeBytes(none ? zeroHash : sha256(sha256(encodeOutputs(single ? [transaction.outputs[inputIndex]] : transaction.outputs))));
    writer.writeU32(transaction.time);
    writer.writeU32(sigType || (forkid << 8));

    return writer.getBuffer();
};

const computeOriginalSigData = (transaction, inputIndex, pkScript) => {
    let writer = new BufferWriter().configure({ littleEndian: true });

    let inputs = transaction.inputs.map(({ script, ...input }, index) => ({ ...input, script: index == inputIndex ? pkScript : [] }))
    writeTransaction(writer, { inputs, ...transaction });
    //console.log(parseTransaction(writer.getBuffer()));


    writer.writeU32(sigType);

    return writer.getBuffer();
};

function pop(stack) {
    if (!stack.length) throw "Stack empty";
    return stack.pop();
}

function popInteger(stack) {
    if (!stack.length) throw "Stack empty";
    let v = stack.pop();
    if (typeof v != 'number') {
        throw "Not a number";
    }
    return v;
}


export function evaluateScript(script, inputIndex, spendingOutput, transaction) {
    let stack = [];
    let altstack = [];
    let conditional = [];
    let enabled = true;
    for (let { operation, data } of script) {
        //console.log(enabled ? "+" : "-", operation, data ?? "", stack.map(data => Buffer.isBuffer(data) ? `#${data.length}` : data).join(" "));
        if (operation == "ENDIF") {
            enabled = pop(conditional);
            continue;
        }
        if (operation == "ELSE") {
            conditional.push(pop(conditional));
            enabled = !enabled;
            continue;
        }

        if (!enabled) continue;

        if (operation == "DUP") {
            let v = pop(stack);
            stack.push(v, v);
        } else if (operation == "PUSH") {
            stack.push(data);
        } else if (operation == "TOALTSTACK") {
            altstack.push(pop(stack));
        } else if (operation == "FROMALTSTACK") {
            stack.push(pop(altstack));
        } else if (operation == "IF") {
            conditional.push(enabled);
            enabled = !!pop(stack);
        } else if (operation == "1ADD") {
            stack.push((popInteger(stack) + 1) >> 0);
        } else if (operation == "LESSTHANOREQUAL") {
            stack.push((popInteger(stack) >= popInteger(stack)) ? 1 : 0);
        } else if (operation == "HASH160") {
            stack.push(ripemd160(sha256(pop(stack))));
        } else if (operation == "EQUALVERIFY") {
            let a = pop(stack);
            let b = pop(stack);
            if (!a.equals(b)) {
                throw "EQUALVERIFY failed";
            }
        } else if (operation == "CHECKSIG" || operation == "CHECKSIGVERIFY") {
            // https://en.bitcoin.it/wiki/OP_CHECKSIG
            // https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/replay-protected-sighash.md
            let publicKey = pop(stack);
            let signature = pop(stack);
            // https://wiki.bitcoinsv.io/index.php/SIGHASH_flags
            let sigType = signature[signature.length - 1];
            let signatureData = signature.slice(0, -1);


            let forkId = sigType & 0x40;

            let buffer = (forkId ? computeForkSigData : computeOriginalSigData)(transaction, inputIndex, spendingOutput, sigType);

            console.log("sign data:", buffer.toString("hex"));
            console.log("Sigtype hex:", sigType.toString(16));
            console.log("publicKey:", publicKey.length, publicKey.toString("hex"));
            console.log("signature:", signatureData.length, signatureData.toString("hex"));
            //console.log("VERIFICATION:", createVerify("sha256").update(sha256(buffer)).verify({ key: publicKey, format: "der", type: "pkcs1" }, signatureDER));
            //console.log("VERIFICATION:", verify("sha256", sha256(buffer), { key: publicKey, format: "der", type: "pkcs1" }, signatureData));
            //console.log(secp.verify(signatureData, sha256(sha256(buffer)), publicKey));
            let verification = secp.verify(signatureData, sha256(sha256(buffer)), publicKey);

            if (operation == "CHECKSIG") {
                stack.push(verification);
            } else {
                if (!verification) throw "Signature not verified";
            }
        } else {
            throw new Error(`unknown opcode: ${operation}`);
        }
    }
    return popInteger(stack);
}

export function readScriptBytes(bytes) {
    const scriptReader = new BufferReader(bytes);
    const script = [];
    while (!scriptReader.eof()) {
        try {
            let reader = scriptReader.here();
            const opCode = reader.readU8();
            let data;
            let operation;
            if (opCode == 80) {
                operation = "RESERVED";
            } else if (opCode <= 96) {
                data = new Uint8Array();
                operation = "PUSH";
                if (opCode >= 1 && opCode <= 75) data = reader.readBytes(opCode);
                if (opCode == 76) data = reader.readBytes(reader.readU8());
                if (opCode == 77) data = reader.readBytes(reader.readU16({ littleEndian: false }));
                if (opCode == 78) data = reader.readBytes(reader.readU32({ littleEndian: false }));
                if (opCode >= 79 && opCode <= 96) data = new Uint8Array([opCode - 80]);

            } else if (opCode <= 185) {
                operation = operations[opCode - 97];
            }
            let encoded = scriptReader.readBytes(reader.getReadSize());
            let value = data && new Value(data);
            script.push({ encoded, operation, data, text: data && data.toString(), value })
        } catch (e) {
            console.log(e);
            script.push({ error: `${e}` });
            break;
        }
    }

    return script;
}

export function readScript(reader) {
    const buffer = reader.readBytes(readVarint(reader));
    try {
        return readScriptBytes(buffer);
    } catch (e) {
        console.log(e);
        return buffer.toString("hex");
    }
}

export function writeScript(writer, script) {
    let scriptWriter = new BufferWriter().configure({ littleEndian: true });
    script.forEach(({ encoded }) => scriptWriter.writeBytes(encoded));
    writeVarint(writer, scriptWriter.getSize());
    writer.writeBytes(scriptWriter.getBuffer());
}
