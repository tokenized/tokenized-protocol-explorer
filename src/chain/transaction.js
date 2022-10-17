import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { BufferReader, BufferWriter } from "buffer-io";
import { readScript } from "./script";
import { readVarint, writeVarint } from "./utils";

export const start = Symbol("start");
export const end = Symbol("end");
export const bytes = Symbol("bytes");

function writeTransaction(writer, { version, inputs, outputs, time }) {
    writer.writeU32(version);
    writeVarint(writer, inputs.length);
    inputs.forEach(({ txid, index, script, sequence }) => {
        writer.writeBytes(hexToBytes(txid).reverse());
        writer.writeU32(index);
        writeScript(writer, script);
        writer.writeU32(sequence);
    });
    writeVarint(writer, outputs.length);
    outputs.forEach(({ value, script }) => {
        writer.writeU64big(BigInt(value));
        writeScript(writer, script);
    });
    writer.writeU32(time);
}

function annotate(reader, callback) {
    let startIndex = reader.getReadSize();
    let result = callback(reader);
    result[start] = startIndex;
    result[end] = reader.getReadSize();
    result[bytes] = reader.uint8array;
    return result;
}

export function parseTransaction(transactionBytes) {
    // https://wiki.bitcoinsv.io/index.php/Bitcoin_Transactions

    const reader = new BufferReader(transactionBytes).configure({ littleEndian: true });

    return annotate(reader, () => {

        const version = reader.readU32();

        const inputs = new Array(readVarint(reader)).fill().map(() => annotate(reader, () => ({
            [start]: reader.getReadSize(),
            txid: bytesToHex(reader.readBytes(32).reverse()),
            index: reader.readU32(),
            script: readScript(reader),
            sequence: reader.readU32(),
            [bytes]: reader.getReadSize(),
        })));

        const outputs = new Array(readVarint(reader)).fill().map(() => annotate(reader, () => ({
            [start]: reader.getReadSize(),
            value: Number(reader.readU64big()),
            script: readScript(reader),
            [end]: reader.getReadSize(),
        })));

        const time = reader.readU32();

        return { version, inputs, outputs, time };
    });
}