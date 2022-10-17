import { hexToBytes } from "@noble/hashes/utils";
import AutoMap from "auto-creating-map";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function rateLimit(asyncFunction, timeMs) {
    let bottleneck = Promise.resolve();

    return async function rateLimited(...args) {
        let result = bottleneck.then(() => asyncFunction(...args));
        bottleneck = result.catch(() => 0).then(() => wait(timeMs));
        return await result;
    }
}

const promiseCache = new AutoMap(rateLimit(fetch, 400));

async function cachedFetch(url, maxAge = Infinity) {

    const cache = await caches.open("network");

    let response = await cache.match(url);

    let age = response ? Date.now() - Number(response.headers.get("Cache-Time")) : Infinity;

    if (!response || age > maxAge) {
        let networkResponse = await promiseCache.get(url);
        response = new Response(await networkResponse.clone().text(), {
            headers: {
                "Cache-Time": `${Date.now()}`,
                "Content-Type": networkResponse.headers.get("Content-Type"),
            }
        });
        await cache.put(url, response.clone());
    }


    if (!response.ok) throw new Error(`Fetch failed ${url}`);

    return await response.clone().text();
}



export async function getTxBytes(hash) {
    return hexToBytes(await cachedFetch(
        `https://api.whatsonchain.com/v1/bsv/main/tx/${encodeURIComponent(hash)}/hex`
    ));
}

export async function getAddressTxs(address, cacheTime = 30000) {
    return JSON.parse(await cachedFetch(
        `https://api.whatsonchain.com/v1/bsv/main/address/${encodeURIComponent(address)}/history`, cacheTime
    ));
}


export async function findAddressTx(address, transform) {
    let cachedTxs = await getAddressTxs(address, Infinity);
    for await (let tx of cachedTxs) {
        try {
            let result = await transform(tx);
            if (result != undefined) return result;
        } catch (e) {
            console.error(`Transaction processing failed ${address} ${tx.tx_hash}`, e);
        }
    }
    let uptodateTxs = await getAddressTxs(address);
    for await (let tx of uptodateTxs) {
        let result = await transform(tx);
        if (result != undefined) return result;
    }
}
