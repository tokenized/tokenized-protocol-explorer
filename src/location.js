import { attr, HTML, locationPathData, on } from "ui-io";

const { a } = HTML(document);

export const location$ = locationPathData();

export function link(href, ...content) {
    return a(
        attr({ href }),
        on('click', event => {
            location$.set(href);
            event.preventDefault();
        }),
        ...content
    );
}

