import { HTML } from "ui-io";
import { decodeOutputScript } from "../chain/decode.js";
import { TokenizedAction } from "../chain/tokenized.js";
import { parseTransaction } from "../chain/transaction.js";
import { link } from "../location.js";
import { findAddressTx, getTxBytes } from "../network.js";

const { div, a, span, h1, i } = HTML(document);


async function addrInformation(address) {
    let transactionBytes = await findAddressTx(address, async ({ tx_hash }) => await getTxBytes(tx_hash));
    if (!transactionBytes) return '';
    try {
        let transaction = parseTransaction(transactionBytes);
        let tokenized = transaction.outputs.map(({ script }) => decodeOutputScript(script)?.content).find(content => content instanceof TokenizedAction);
        if (tokenized?.actionCode == "C1") {
            return tokenized?.description ? ` - ${tokenized.description}` : '';
        }
        return '';
    } catch (e) {
        // never mind
    }
}

export function addrLink(address) {
    return link(`/addr/${address}`, address, i(addrInformation(address)));
}
