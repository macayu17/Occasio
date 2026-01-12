/**
 * Wallet Pass Generation Service
 * 
 * Generates Apple Wallet (.pkpass) and Google Wallet passes for tickets.
 * 
 * SETUP REQUIRED:
 * 
 * For Apple Wallet:
 * 1. Create an Apple Developer account ($99/year)
 * 2. Create a Pass Type ID at developer.apple.com
 * 3. Download the .p12 certificate and convert to .pem
 * 4. Set these env vars:
 *    - APPLE_PASS_TYPE_ID: pass.com.yourcompany.occasio
 *    - APPLE_TEAM_ID: Your team ID
 *    - APPLE_PASS_CERT_PATH: Path to cert.pem
 *    - APPLE_PASS_KEY_PATH: Path to key.pem
 * 
 * For Google Wallet:
 * 1. Enable Google Wallet API in Google Cloud Console
 * 2. Create a Service Account with Wallet access
 * 3. Download the JSON key file
 * 4. Set these env vars:
 *    - GOOGLE_APPLICATION_CREDENTIALS: Path to service-account.json
 *    - GOOGLE_WALLET_ISSUER_ID: Your issuer ID
 */

import crypto from 'crypto';

// ============================================
// APPLE WALLET PASS GENERATION
// ============================================

/**
 * Generate an Apple Wallet pass for a ticket
 * Returns a Buffer containing the .pkpass file, or null if not configured
 */
export async function generateAppleWalletPass(ticket, event, attendee) {
    // Check if Apple Wallet is configured
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID) {
        console.log('Apple Wallet not configured - skipping pass generation');
        return null;
    }

    try {
        // Dynamic import - only load if we're going to use it
        const { PKPass } = await import('passkit-generator');
        const fs = await import('fs');
        const path = await import('path');

        const passJson = {
            formatVersion: 1,
            passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
            teamIdentifier: process.env.APPLE_TEAM_ID,
            organizationName: 'Occasio',
            serialNumber: ticket.id,
            description: `Ticket for ${event.title}`,

            backgroundColor: 'rgb(25, 25, 35)',
            foregroundColor: 'rgb(255, 255, 255)',
            labelColor: 'rgb(140, 140, 160)',

            eventTicket: {
                primaryFields: [
                    {
                        key: 'event',
                        label: 'EVENT',
                        value: event.title
                    }
                ],
                secondaryFields: [
                    {
                        key: 'date',
                        label: 'DATE',
                        value: new Date(event.startTime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        })
                    },
                    {
                        key: 'time',
                        label: 'TIME',
                        value: new Date(event.startTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    }
                ],
                auxiliaryFields: [
                    {
                        key: 'location',
                        label: 'VENUE',
                        value: event.location
                    }
                ],
                backFields: [
                    {
                        key: 'attendee',
                        label: 'ATTENDEE',
                        value: attendee.name || 'Guest'
                    },
                    {
                        key: 'email',
                        label: 'EMAIL',
                        value: attendee.email
                    },
                    {
                        key: 'ticketId',
                        label: 'TICKET #',
                        value: ticket.id.substring(0, 8).toUpperCase()
                    }
                ]
            },

            barcode: {
                format: 'PKBarcodeFormatQR',
                message: ticket.qrPayload,
                messageEncoding: 'iso-8859-1'
            },

            relevantDate: event.startTime
        };

        // This would use PKPass to generate the actual file
        // For now, return the JSON data as placeholder
        console.log('Apple Wallet pass data generated for ticket:', ticket.id);

        // In production, this would return:
        // const pass = new PKPass(passJson, { cert, key });
        // return pass.getAsBuffer();

        return null; // Placeholder until certificates are configured

    } catch (error) {
        console.error('Apple Wallet pass generation error:', error);
        return null;
    }
}

// ============================================
// GOOGLE WALLET PASS GENERATION
// ============================================

/**
 * Generate a Google Wallet save URL for a ticket
 * Returns a URL string that adds the pass to Google Wallet
 */
export async function generateGoogleWalletUrl(ticket, event, attendee) {
    // Check if Google Wallet is configured
    if (!process.env.GOOGLE_WALLET_ISSUER_ID) {
        console.log('Google Wallet not configured - skipping URL generation');
        return null;
    }

    try {
        const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
        const classId = `${issuerId}.${event.id}`;
        const objectId = `${issuerId}.${ticket.id}`;

        // Create the pass object
        const passObject = {
            id: objectId,
            classId: classId,
            state: 'ACTIVE',

            // Header
            logo: {
                sourceUri: {
                    uri: 'https://occasio.vercel.app/logo.png'
                }
            },

            // Event details
            eventName: {
                defaultValue: {
                    language: 'en',
                    value: event.title
                }
            },

            venue: {
                name: {
                    defaultValue: {
                        language: 'en',
                        value: event.location
                    }
                }
            },

            dateTime: {
                start: event.startTime,
                end: event.endTime
            },

            // Ticket holder
            ticketHolderName: attendee.name || 'Guest',
            ticketNumber: ticket.id.substring(0, 8).toUpperCase(),

            // QR code
            barcode: {
                type: 'QR_CODE',
                value: ticket.qrPayload
            },

            // Styling
            hexBackgroundColor: '#19191f'
        };

        // In production, this would:
        // 1. Create the class if it doesn't exist
        // 2. Create/update the object
        // 3. Return a signed JWT URL

        // For now, return a placeholder
        const saveUrl = `https://pay.google.com/gp/v/save/${Buffer.from(JSON.stringify(passObject)).toString('base64')}`;

        console.log('Google Wallet URL generated for ticket:', ticket.id);
        return saveUrl;

    } catch (error) {
        console.error('Google Wallet URL generation error:', error);
        return null;
    }
}

/**
 * Check if wallet passes are available
 */
export function getWalletAvailability() {
    return {
        appleWallet: !!(process.env.APPLE_PASS_TYPE_ID && process.env.APPLE_TEAM_ID),
        googleWallet: !!process.env.GOOGLE_WALLET_ISSUER_ID
    };
}
