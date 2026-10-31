import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  env: process.env.NODE_ENV || 'development',
  ondc: {
    environment: process.env.ONDC_ENVIRONMENT || 'preprod',
    subscriberId: process.env.ONDC_SUBSCRIBER_ID || 'ralt.in',
    subscriberUrl: process.env.ONDC_SUBSCRIBER_URL || 'https://ralt.in/ondc',
    domain: process.env.ONDC_DOMAIN || 'ONDC:LOG10',
    role: process.env.ONDC_ROLE || 'BPP',
    ukid: process.env.ONDC_UKID || '2cb2bdeb-457b-47a9-bef9-c4d8954cbe49',
    signingPublicKey: process.env.ONDC_SIGNING_PUBLIC_KEY || '',
    signingPrivateKey: process.env.ONDC_SIGNING_PRIVATE_KEY || '',
    encryptionPublicKey: process.env.ONDC_ENCRYPTION_PUBLIC_KEY || '',
    encryptionPrivateKey: process.env.ONDC_ENCRYPTION_PRIVATE_KEY || '',
  },
  commercial: {
    defaultDeliveryFee: parseFloat(process.env.DEFAULT_DELIVERY_FEE || '50'),
    currency: process.env.CURRENCY || 'INR',
    maxServiceRadiusKm: parseFloat(process.env.MAX_SERVICE_RADIUS_KM || '5.0'),
    estimatedDeliveryTimeMins: parseInt(process.env.ESTIMATED_DELIVERY_TIME_MINS || '25', 10),
  }
};

