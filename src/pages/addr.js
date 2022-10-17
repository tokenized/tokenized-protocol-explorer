import { hexToBytes } from "@noble/hashes/utils";
import { HTML, intersectionLoader, style } from "ui-io";
import { protocolAddressToBase58 } from "../chain/address.js";
import { decodeOutputScript } from "../chain/decode.js";
import { TokenizedAction } from "../chain/tokenized.js";
import { parseTransaction } from "../chain/transaction.js";
import { idLink } from "../links/id.js";
import { getAddressTxs, getTxBytes } from "../network.js";
import { monospace } from "../styles.js";

const { div, span, h1 } = HTML(document);


async function transactionLine(hash) {
    let transactionBytes = await getTxBytes(hash);
    let transaction = parseTransaction(transactionBytes);
    let tokenized = transaction.outputs.map(({ script }) => decodeOutputScript(script)?.content).find(content => content instanceof TokenizedAction);
    console.log(tokenized?.actionType);
    return (
        tokenized && [
            span(monospace, ' ', tokenized.actionCode), ' ', tokenized.actionType.label, " ", tokenized.description
        ]
    );
}


async function addressView(address) {
    if (address.startsWith("20")) {
        console.log(hexToBytes(address).length)
        address = protocolAddressToBase58(hexToBytes(address));
    }
    let history = await getAddressTxs(address);

    let loader = intersectionLoader();

    return [
        h1("Address: ", address),
        history.map(({ tx_hash }) =>
            div(style({ lineHeight: '24px' }),
                idLink(tx_hash),
                loader(() => transactionLine(tx_hash), "..."),
            )
        )
    ];
}


export function addr(address$) {
    return address$.to(addressView).asyncResult();
}