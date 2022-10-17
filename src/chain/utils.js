export function readVarint(reader) {
    const initial = reader.readU8();
    if (initial == 0xFD) return reader.readU16();
    if (initial == 0xFE) return reader.readU32();
    if (initial == 0xFF) return Number(reader.readU64Big());
    return initial;
};

export function writeVarint(writer, value) {
    if (value < 0xFD) {
        writer.writeU8(value);
    } else if (value <= 0xFFFF) {
        writer.writeU8(0xFD);
        writer.writeU16(value)
    } else if (value <= 0xFFFFFFFF) {
        writer.writeU8(0xFE);
        writer.writeU32(value)
    } else {
        writer.writeU8(0xFF);
        writer.writeU64big(BigInt(value))
    }
};

export function bytesAreEqual(bytes1, bytes2) {
    if (bytes1.byteLength !== bytes2.byteLength) {
        return false;
    }

    for (let i = 0; i < bytes1.byteLength; i += 1) {
        if (bytes1[i] !== bytes2[i]) {
            return false;
        }
    }

    return true;
}

export function total(values) {
    return values.reduce((s, v) => s + v, 0);
}

export function camelCaseToSnakeCase(text) {
    return text.replace(/([A-Z])/g, '-$1').slice(1).toLowerCase();
}