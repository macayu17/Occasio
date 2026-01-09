import twilio from 'twilio';

// Initialize Twilio client (only if credentials are available)
let twilioClient = null;

function getTwilioClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        console.log('✅ Twilio client initialized');
    }
    return twilioClient;
}

/**
 * Format phone number to E.164 format
 * Assumes Indian numbers if no country code provided
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If it starts with 0, remove it
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }

    // If it's a 10-digit number (Indian format), add +91
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }

    // If it already has country code (11+ digits), add +
    if (cleaned.length > 10 && !phone.startsWith('+')) {
        return `+${cleaned}`;
    }

    // If already in E.164 format
    if (phone.startsWith('+')) {
        return phone;
    }

    return null;
}

/**
 * Send SMS booking confirmation
 */
export async function sendBookingSMS(phoneNumber, eventDetails) {
    const client = getTwilioClient();

    if (!client) {
        console.warn('⚠️ Twilio not configured - SMS not sent');
        return null;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
        console.warn('⚠️ Invalid phone number format - SMS not sent');
        return null;
    }

    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhone) {
        console.warn('⚠️ TWILIO_PHONE_NUMBER not configured - SMS not sent');
        return null;
    }

    try {
        const message = await client.messages.create({
            body: `🎉 Booking Confirmed!\n\nEvent: ${eventDetails.eventTitle}\n📍 ${eventDetails.location}\n📅 ${eventDetails.dateTime}\n\nTicket ID: ${eventDetails.ticketId}\n\nSee you there! - Occasio`,
            from: twilioPhone,
            to: formattedPhone
        });

        console.log(`✅ SMS sent successfully: ${message.sid}`);
        return message;
    } catch (error) {
        console.error('❌ SMS sending failed:', error.message);
        return null;
    }
}

/**
 * Send WhatsApp booking confirmation
 */
export async function sendBookingWhatsApp(phoneNumber, eventDetails) {
    const client = getTwilioClient();

    if (!client) {
        console.warn('⚠️ Twilio not configured - WhatsApp not sent');
        return null;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
        console.warn('⚠️ Invalid phone number format - WhatsApp not sent');
        return null;
    }

    const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!twilioWhatsApp) {
        console.warn('⚠️ TWILIO_WHATSAPP_NUMBER not configured - WhatsApp not sent');
        return null;
    }

    try {
        const message = await client.messages.create({
            body: `🎉 *Booking Confirmed!*\n\n*Event:* ${eventDetails.eventTitle}\n📍 *Location:* ${eventDetails.location}\n📅 *Date:* ${eventDetails.dateTime}\n\n🎫 *Ticket ID:* ${eventDetails.ticketId}\n\nWe're excited to see you there!\n\n_Occasio - Your Event Partner_`,
            from: twilioWhatsApp,
            to: `whatsapp:${formattedPhone}`
        });

        console.log(`✅ WhatsApp sent successfully: ${message.sid}`);
        return message;
    } catch (error) {
        console.error('❌ WhatsApp sending failed:', error.message);
        return null;
    }
}

/**
 * Send SMS notification (WhatsApp removed - requires paid Business API)
 */
export async function sendBookingNotifications(phoneNumber, eventDetails) {
    const result = await sendBookingSMS(phoneNumber, eventDetails);
    return { sms: result };
}
