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
                    div(idLink("f3a7a81307b8c445782cf75422bd8a335329fd5e36859b4d28e377e27356202a", "Example transaction")),
                    div(idLink("f45b3688712eb6fc84c18989c4f31df21e1e850663bfc723f133ca01c0201a6e", "Example trade")),
                    div(idLink("890ce3d6b7bf368acd723ddb818b5678d64ac22f66eb9526a69e8b93cae74311", "Example Entity contract")),
                    div(idLink("3dbda19bf8e152736455531033ddb7399ea066423127bb6fa3bd25be4c419db2"), "Example rejection"),
                ]
            )
        )

    ];
}
