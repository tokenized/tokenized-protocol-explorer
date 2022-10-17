import { HTML, style } from "ui-io";
import { link } from "../location.js";

const { span } = HTML(document);


export function idLink(hash, extra = '') {
    return link(`/id/${hash}`, span(style({ fontFamily: 'monospace', paddingRight: "4px" }), hash.slice(0, 6)), extra)
}

export function inputLink(hash, inputNumber) {
    return link(`/id/${hash}/input/${inputNumber}`,
        style({ fontFamily: 'monospace' }),
        `${hash.slice(0, 6)}…#${inputNumber}`
    );
}

export function outputLink(hash, outputNumber) {
    return link(`/id/${hash}/output/${outputNumber}`,
        style({ fontFamily: 'monospace' }),
        `${hash.slice(0, 6)}…#${outputNumber}`
    );
}


