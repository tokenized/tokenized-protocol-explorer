import { HTML } from "ui-io";

const { pre } = HTML(document);

export default function formatJson(content) {
    return pre(JSON.stringify(content, null, 4));
}