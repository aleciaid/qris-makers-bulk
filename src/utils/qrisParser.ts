export interface QRISData {
    merchantName?: string;
    nmid?: string;
    amount?: string;
    raw?: string;
}

export function parseQRIS(qrisPayload: string): QRISData {
    const data: QRISData = { raw: qrisPayload };
    let index = 0;

    const tags: { [key: string]: string } = {};

    // Basic EMVCo Loop
    while (index < qrisPayload.length) {
        const id = qrisPayload.substr(index, 2);
        const lenStr = qrisPayload.substr(index + 2, 2);
        const length = parseInt(lenStr, 10);

        if (isNaN(length)) break;

        const value = qrisPayload.substr(index + 4, length);
        tags[id] = value;

        index += 4 + length;
    }

    // Extract Standard Fields
    if (tags['59']) {
        data.merchantName = tags['59'];
    }

    if (tags['54']) {
        data.amount = 'Rp. ' + parseInt(tags['54']).toLocaleString('id-ID'); // formatted
    }

    // NMID Extraction Strategy
    // Strategy 1: Look in Tag 51 (Merchant Account Information)
    // Often format: 00=GlobalID, 02=MerchantID (NMID)
    if (tags['51']) {
        const subTags = parseSubTags(tags['51']);
        if (subTags['02']) { // Common for NMID
            data.nmid = subTags['02'];
        } else if (subTags['03']) {
            data.nmid = subTags['03'];
        }
    }

    // Strategy 2: If finding "ID20..." pattern in the raw string if specific tag extraction fails
    // or if it's located elsewhere (e.g. tag 62 additional data).
    // Let's check tag 62 (Additional Data)
    if (!data.nmid && tags['62']) {
        const subTags = parseSubTags(tags['62']);
        // sometimes Terminal Label (07) or other fields
        if (subTags['07']) {
            // check if looks like NMID
            if (subTags['07'].startsWith('ID')) data.nmid = subTags['07'];
        }
    }

    // Fallback: Regex for "ID" followed by 8-15 digits which is typical for NMID
    if (!data.nmid) {
        const match = qrisPayload.match(/ID[0-9]{8,15}/);
        if (match) {
            data.nmid = match[0];
        }
    }

    return data;
}

function parseSubTags(payload: string): { [key: string]: string } {
    const tags: { [key: string]: string } = {};
    let index = 0;
    while (index < payload.length) {
        const id = payload.substr(index, 2);
        const lenStr = payload.substr(index + 2, 2);
        const length = parseInt(lenStr, 10);
        if (isNaN(length)) break;
        const value = payload.substr(index + 4, length);
        tags[id] = value;
        index += 4 + length;
    }
    return tags;
}
