import { hexToBytes } from "@noble/hashes/utils";
import transactionBytesView from "../components/transactionBytesView.js";


export default function tx(tx$) {
    return tx$.to(tx => transactionBytesView(hexToBytes(tx)))
}