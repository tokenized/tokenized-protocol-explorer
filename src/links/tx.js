import { link } from "../location.js";


export function txLink(hex, extra = 'parse transaction') {
    return link(`/tx/${hex}`, extra)
}

