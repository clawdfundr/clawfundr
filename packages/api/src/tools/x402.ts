import { X402Requirement } from '../types';

/**
 * Parse HTTP 402 Payment Required response
 */
export function parseX402Response(headers: Record<string, string>): X402Requirement | null {
    // Standard x402 headers (hypothetical spec)
    const merchant = headers['x-payment-merchant'];
    const amount = headers['x-payment-amount'];
    const token = headers['x-payment-token'] || 'ETH';
    const recipient = headers['x-payment-recipient'];
    const resource = headers['x-payment-resource'];

    if (!merchant || !amount || !recipient || !resource) {
        return null;
    }

    return {
        merchant,
        amount,
        token,
        recipient,
        resource,
    };
}

/**
 * Fetch resource and check for 402
 */
export async function fetchWithX402Check(url: string): Promise<{
    status: number;
    requirement: X402Requirement | null;
    data?: any;
}> {
    try {
        const response = await fetch(url);

        if (response.status === 402) {
            // Payment required
            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headers[key.toLowerCase()] = value;
            });

            const requirement = parseX402Response(headers);

            return {
                status: 402,
                requirement,
            };
        }

        if (response.ok) {
            const data = await response.json();
            return {
                status: response.status,
                requirement: null,
                data,
            };
        }

        return {
            status: response.status,
            requirement: null,
        };
    } catch (error) {
        console.error('Error fetching resource:', error);
        throw error;
    }
}

/**
 * Fetch resource with payment proof
 */
export async function fetchWithPaymentProof(
    url: string,
    txHash: string
): Promise<{ status: number; data?: any }> {
    try {
        const response = await fetch(url, {
            headers: {
                'X-Payment-Proof': txHash,
            },
        });

        if (response.ok) {
            const data = await response.json();
            return {
                status: response.status,
                data,
            };
        }

        return {
            status: response.status,
        };
    } catch (error) {
        console.error('Error fetching with payment proof:', error);
        throw error;
    }
}
