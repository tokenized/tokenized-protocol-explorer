import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import transactionBytesView from "../components/transactionBytesView.js";
import { getTxBytes } from "../network.js";


export function hexByteReverse(v) {
    return bytesToHex(new Uint8Array([...v].reverse()));
}



async function txInfo(target) {
    console.log(target.length);
    let [hash, highlight, index] = target.split("/");
    let txBytes = await getTxBytes(hash).catch((e) => {console.error(e);return getTxBytes(hexByteReverse(hexToBytes(hash)));});
    console.log(target.length, txBytes);
    return transactionBytesView(txBytes, highlight, index ? Number(index) : null);
}

export default function id(hash$) {
    return hash$.to(txInfo).asyncResult();
}