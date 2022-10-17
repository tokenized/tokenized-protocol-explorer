import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { attr, classList, Data, HTML, on, style } from "ui-io";
import { protocolAddressToBase58 } from "../chain/address.js";
import { decodeInputScript, decodeOutputScript, EnvelopeV0, EnvelopeV1, P2PKH } from "../chain/decode.js";
import { readScript, readScriptBytes } from "../chain/script.js";
import { ArrayType, jsonPrettyPrint, ObjectType } from "../chain/tokenized.js";
import { bytes, end, parseTransaction, start } from "../chain/transaction.js";
import { camelCaseToSnakeCase as camelCaseToKebabCase, total } from "../chain/utils.js";
import { link } from '../location.js';
import { findAddressTx, getAddressTxs, getTxBytes } from "../network.js";
import { addrLink } from "../links/addr.js";
import { idLink, inputLink, outputLink } from "../links/id.js";
import { hexByteReverse } from "../pages/id.js";

const { h1, div, pre, ul, li, a, table, tbody, tr, td, p, span, dialog, form, button } = HTML(document);

const { ceil } = Math;

function structuredValueView(type, value) {
    if (type instanceof ObjectType) {
        return ul(objectView(type, value));
    }
    if (type instanceof ArrayType) {
        return ul(value.map((item) => li(simpleValueView(type.itemType, item), structuredValueView(type.itemType, item))));
    }
}

function simpleValueView(type, value) {
    if (type instanceof ObjectType) {
        return a(
            clickModal(
                h1("Tokenized protocol type definition"),
                p("Type: ", type.specification.label),
                p(type.specification.description),
                p("Name: ", type.specification.name),
                protocolLink(type.specification.name, "action", "type", type.specification.name),
            ),
            type.specification.name, '{}'
        );
    }
    if (type instanceof ArrayType) {
        return `[${value.length}]`;
    }
    if (type.typeName == "Address" && value) {
        return addrLink(protocolAddressToBase58(value));
    }
    if (type.typeName == "TxId" && value) {
        return idLink(hexByteReverse(value));
    }
    if (type.typeName == "Timestamp") {
        return `${new Date(value / 1e6).toISOString().replace('T', ' ')}`;
    }
    if (value instanceof Uint8Array && value.length <= 4) {
        return `0x${bytesToHex(value)}`;
    }
    if (value instanceof Uint8Array) {
        return a(`bytes[${value.length}]`, clickModal(
            ul(
                li(`length: ${value.length} bytes`),
                li('hex: ', Array.from({ length: value.length / 8 }).map((_, index) => div(bytesToHex(value.slice(index * 8, index * 8 + 8))))),
                li('text: ', new TextDecoder().decode(value)),
            )
        ));
    }

    return `${value}`;
    //return pre(type.typeName, ' : ', jsonPrettyPrint(value));
}

function clickModal(...content) {

    let dialogElement = dialog(
        on('click', event => event.stopPropagation()),
        form(attr({ method: "dialog" }), button('✕')),
        div(
            ...content,
        )

    );
    return [
        on('click', () => dialogElement.open ? dialogElement.close() : dialogElement.showModal()),
        dialogElement,
    ];
}


function objectView(objectType, object) {
    if (object == null) return 'null';
    if (!objectType.specification) return JSON.stringify(object);
    return objectType.specification.fields
        .filter(({ type }) => type != 'deprecated')
        .map(({ label, description, name, type }) =>
            li(
                a(
                    clickModal(
                        h1("Tokenized protocol field definition"),
                        p("Field: ", label),
                        p(description),
                        p('Type: ', type),
                        p('Name: ', name),
                    ),
                    label
                ),
                ": ",
                simpleValueView(objectType.fieldType(name), object[name]),
                structuredValueView(objectType.fieldType(name), object[name])
            )
        );

}

function actionBytesView(actionBytes) {
    return payloadView(decodeOutputScript(readScriptBytes(actionBytes)));
}

function messageView(message) {
    let { transaction, action } = message;
    return ul(
        li(
            a(
                clickModal(
                    h1(`Tokenized protocol message: ${message.messageType.code} ${message.messageType.label}`),
                    p(message.messageType.description),
                    protocolLink(message.messageType.name, "messages", null, message.messageType.name),
                ),
                message.messageType.name
            ),
            ul(
                objectView(message.objectType, message.data),
                transaction ? li('Transaction:', transactionBytesView(transaction)) : null,
                action ? li('Action:', actionBytesView(action)) : null
            )
        )
    );
}

function protocolLink(name, type, kind, key) {
    return a(
        attr({
            href: `https://docs.protocol.tokenized.com/docs/protocol/${type}#${kind ? kind + "-" : ""}${camelCaseToKebabCase(key)}`,
            target: "_blank",
        }),
        "Tokenized protocol documentation link: ",
        name
    );
}

function instrumentView(instrument) {

    return ul(
        a(
            clickModal(
                h1(`Tokenized protocol instrument type: ${instrument.instrumentType.name}`),
                p(instrument.instrumentType.description),
                protocolLink(instrument.instrumentType.name, "assets", null, instrument.instrumentType.name),
            ),
            instrument.instrumentType.name
        ),
        ul(
            objectView(instrument.objectType, instrument.data),
        )
    );
}

function actionView(action) {
    return ul(
        li(
            a(
                clickModal(
                    h1(`Tokenized protocol action: ${action.actionType.name}`),
                    p(action.actionType.description),
                    protocolLink(action.actionType.name, "actions", "action", action.actionType.name),
                ),
                `Tokenized ${action.actionCode} (${action.actionType.label})`
            ),
            ul(
                objectView(action.objectType, action.data),
                action.message ? li("Message content:", messageView(action.message)) : null,
                action.instrument ? li("Instrument details:", instrumentView(action.instrument)) : null,
            )
        )
    );
}



function payloadView(payload) {
    if (payload instanceof P2PKH) {
        return addrLink(payload.address);
    }
    if (payload instanceof EnvelopeV0) {
        let content = payload?.content;
        return ul(
            li(`Envelope V0: ${payload.protocolTag}`,
                content && actionView(content)
            ),
        );
    }
    if (payload instanceof EnvelopeV1) {
        let content = payload?.content;
        return ul(
            li(`Envelope V1: ${payload.protocols.join(",")}`,
                content && actionView(content)
            ),
        );
    }
}

function commandView({ operation, value }) {
    if (!value) {
        return div(operation);
    }
    let expanded$ = new Data(false);
    return div(
        expand(expanded$),
        operation, ' ',
        value.bytes.length > 4 ? `#${value.bytes.length}` : value.number,
        ul(display(expanded$),
            li(`length: ${value.bytes.length} bytes`),
            li('hex: ', bytesToHex(value.bytes)),
            li('text: ', value.string),
        )
    );
}

function expand(expanded$) {
    return [
        span(
            style({ width: '20px', height: '20px', display: 'inline-block', verticalAlign: 'middle', textAlign: 'center' }),
            expanded$.if('▼', '▶')
        ),
        on('click', () => expanded$.set(!expanded$.get())),
    ];
}

function display(expanded$) {
    return style({ display: expanded$.if(null, 'none') });
}



function scriptView(script) {
    return span(
        clickModal(h1("Script"),
            script.map(commandView)
        ),
        span(classList("pill"), 'script')
    );
}

function bytesView(object) {
    console.log(object[start], object[end]);
    let data = object[bytes].subarray(object[start], object[end]);
    let bytesPerLine = 16;
    let transactionBytesModal = div(
        new Array(ceil(data.length / bytesPerLine)).fill()
            .map((_, index) =>
                div(classList("monospace"),
                    bytesToHex(data.subarray(index * bytesPerLine, (index + 1) * bytesPerLine))
                )
            )
    );

    return span(
        clickModal(
            div(transactionBytesModal)
        ),
        span(classList("pill"), object[end] - object[start], 'bytes')
    );
}

async function spentStatus(decodedScript, txId, index) {
    if (!(decodedScript instanceof P2PKH)) return "";
    let txHeight = await findAddressTx(decodedScript.address, ({ tx_hash, height }) => tx_hash == txId ? height : undefined);
    if (txHeight == undefined) return "";
    let spent = await findAddressTx(decodedScript.address, async ({ tx_hash, height }) => {
        if (txHeight == -1 ? height == -1 : height >= txHeight) {
            let transactionBytes = await getTxBytes(tx_hash);
            let transaction = parseTransaction(transactionBytes);
            let inputIndex = transaction.inputs.findIndex(input => input.txid == txId && input.index == index);
            if (inputIndex >= 0) {
                return span("Spent: ", inputLink(tx_hash, inputIndex));
            }
        }
    });
    return spent || `Unspent`;
}

export default function transactionBytesView(txBytes, highlight, highlightIndex) {
    let hash = sha256(sha256(txBytes));
    let txId = hexByteReverse(hash);
    let transaction = parseTransaction(txBytes);

    function outputView(output, index) {
        let decodedScript = decodeOutputScript(output.script);
        return li(
            classList(highlight == "output" && index == highlightIndex ? "selected" : "normal"),
            bytesView(output),
            scriptView(output.script),
            output.value,
            "sat → ",
            payloadView(decodedScript),
            " ",
            spentStatus(decodedScript, txId, index)
        );
    }

    function inputView(input, index) {
        return li(
            classList(highlight == "input" && index == highlightIndex ? "selected" : "normal"),
            bytesView(input),
            scriptView(input.script),
            outputLink(input.txid, input.index), " ",
            payloadView(decodeInputScript(input.script)), " → ",
            spendingOutputPromises[index].then(output => `${output.value}sat`),
        )
    }



    let spendingOutputPromises = transaction.inputs.map(async ({ txid, index }) =>
        parseTransaction(await getTxBytes(txid)).outputs[index]
    );

    let minerFeeView$ = Promise.all(spendingOutputPromises)
        .then(spendingOutputs => {
            let totalSpendingOutputs = total(spendingOutputs.map(({ value }) => value));
            let totalValueOutputs = total(transaction.outputs.map(({ value }) => value));
            let minerFee = totalSpendingOutputs - totalValueOutputs;
            let bytes = txBytes.length;
            return `bytes: ${bytes} ; miner fee: ${minerFee}sat ; ${(minerFee / bytes).toFixed(2)}sat/byte`;
        });

    return ul(
        li(bytesView(transaction), "Id: ", txId),
        li(
            'version: ', transaction.version,
        ),
        li('inputs: ',

            ul(transaction.inputs.map(inputView))
        ),
        li('outputs: ',
            ul(transaction.outputs.map(outputView)),
        ),
        minerFeeView$
    );
}
