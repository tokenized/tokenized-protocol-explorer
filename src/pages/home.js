import { hexToBytes } from "@noble/hashes/utils";
import { classList, Data, HTML, value } from "ui-io";
import { base58ToBuffer } from "../chain/address.js";
import { parseTransaction } from "../chain/transaction.js";
import { addrLink } from "../links/addr.js";
import { idLink } from "../links/id.js";
import { txLink } from "../links/tx.js";
import { getTxBytes } from "../network.js";
import { hexByteReverse } from "./id.js";
const { div, h1, input } = HTML(document);

function searchIdLink(searchText) {
    if (searchText.length != 64) return null;

    let reversedHex = hexByteReverse(hexToBytes(searchText));
    let forwards = getTxBytes(searchText).then(() => div(idLink(searchText)));
    let reversed = forwards.catch(() => getTxBytes(reversedHex).then(() => div(idLink(reversedHex))));
    return [
        forwards,
        reversed,
    ];
}

function searchParseTx(searchText) {
    try {
        parseTransaction(hexToBytes(searchText));
        return txLink(searchText);
    } catch (e) {
        return null;
    }
}

function searchAddress(searchText) {
    try {
        let addressBytes = base58ToBuffer(searchText);
        if (addressBytes.length == 20) {
            return div(addrLink(searchText));
        }
    } catch (e) {
        // Ignore unparseable address
    }
}

function searchInfo(search) {
    let searchText = search.trim();
    let searchIsHex = searchText == searchText.replaceAll(/[^A-Fa-f0-9]/g, '');

    return [
        searchIsHex ? searchIdLink(searchText) : '',
        searchIsHex ? searchParseTx(searchText) : '',
        searchAddress(searchText)
    ];
}

export default function home() {
    let search$ = new Data("");
    return [
        h1("Tokenized Protocol Explorer"),
        div(
            classList("search"), 
            input(value(search$)),
            search$.if(
                search$.to(searchInfo),
                [
                    div(idLink("1f498019fdd54754e4c6f940a4f39b4b704732b05ae53548bb39318bd9984107", "Example transaction")),
                    div(idLink("702c650ee3cde489f3c986e8f7d5ea41b0ff41bc0a7153e2199138e1fb20dbe4", "Example contract")),
                ]
            )
        )

    ];
}
