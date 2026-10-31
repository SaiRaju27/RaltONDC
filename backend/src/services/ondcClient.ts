import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { createAuthorizationHeader } from '../crypto/auth';

export class ONDCClient {
  /**
   * Helper to send signed callback to BAP
   */
  private static async sendCallback(bapUri: string, action: string, payload: any) {
    const url = `${bapUri.replace(/\/$/, '')}/${action}`;
    const { authorization, digest } = createAuthorizationHeader(`/${action}`, payload);

    console.log(`[ONDC Client] Sending ${action} to ${url}...`);

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization,
          'Digest': digest,
        },
        timeout: 8000
      });
      console.log(`[ONDC Client] ${action} ACK response:`, response.status);
      return response.data;
    } catch (err: any) {
      console.warn(`[ONDC Client] Note: Callback to ${url} (${action}):`, err.response?.status || err.message);
      return null;
    }
  }

  /**
   * Send on_search callback with Delivery quote (e.g. ₹50)
   */
  public static async sendOnSearch(params: {
    bapUri: string;
    bapId: string;
    transactionId: string;
    messageId: string;
    deliveryFee: number;
  }) {
    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_search',
        core_version: '1.2.0',
        bap_id: params.bapId,
        bap_uri: params.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: params.transactionId,
        message_id: params.messageId,
        timestamp: new Date().toISOString(),
        ttl: 'PT30S'
      },
      message: {
        catalog: {
          bpp_descriptor: {
            name: 'RALT Logistics (Hyperlocal Delivery)',
            short_desc: 'Fast hyperlocal food delivery by RALT'
          },
          bpp_providers: [
            {
              id: 'ralt-logistics-provider',
              descriptor: {
                name: 'RALT Express Fleet'
              },
              items: [
                {
                  id: 'immediate-delivery',
                  parent_item_id: '',
                  descriptor: {
                    name: 'Immediate Delivery (Within 3-5 km)',
                    short_desc: 'Direct Point-to-Point delivery'
                  },
                  price: {
                    currency: config.commercial.currency,
                    value: params.deliveryFee.toFixed(2)
                  },
                  time: {
                    label: 'TAT',
                    duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`
                  }
                }
              ]
            }
          ]
        }
      }
    };

    return this.sendCallback(params.bapUri, 'on_search', payload);
  }

  /**
   * Send on_init callback (Terms and fulfillment preparation)
   */
  public static async sendOnInit(params: {
    bapUri: string;
    bapId: string;
    transactionId: string;
    messageId: string;
    deliveryFee: number;
  }) {
    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_init',
        core_version: '1.2.0',
        bap_id: params.bapId,
        bap_uri: params.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: params.transactionId,
        message_id: params.messageId,
        timestamp: new Date().toISOString(),
        ttl: 'PT30S'
      },
      message: {
        order: {
          provider: {
            id: 'ralt-logistics-provider'
          },
          items: [
            {
              id: 'immediate-delivery',
              price: {
                currency: config.commercial.currency,
                value: params.deliveryFee.toFixed(2)
              }
            }
          ],
          quote: {
            price: {
              currency: config.commercial.currency,
              value: params.deliveryFee.toFixed(2)
            },
            breakup: [
              {
                title: 'Delivery Charge',
                price: {
                  currency: config.commercial.currency,
                  value: params.deliveryFee.toFixed(2)
                }
              }
            ]
          }
        }
      }
    };

    return this.sendCallback(params.bapUri, 'on_init', payload);
  }

  /**
   * Send on_confirm callback with assigned rider details
   */
  public static async sendOnConfirm(order: any) {
    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_confirm',
        core_version: '1.2.0',
        bap_id: order.bapId,
        bap_uri: order.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: order.transactionId,
        message_id: order.messageId,
        timestamp: new Date().toISOString(),
        ttl: 'PT30S'
      },
      message: {
        order: {
          id: order.orderId,
          state: 'Accepted',
          fulfillments: [
            {
              id: 'ralt-fulfillment-1',
              type: 'Delivery',
              state: {
                descriptor: {
                  code: order.status
                }
              },
              tracking: true,
              agent: order.rider ? {
                name: order.rider.name,
                phone: order.rider.phone
              } : undefined,
              vehicle: order.rider ? {
                registration: order.rider.vehicle_number || order.rider.vehicleNumber
              } : undefined,
              start: {
                location: {
                  gps: `${order.pickup.gps.lat},${order.pickup.gps.lng}`,
                  address: { name: order.pickup.name, street: order.pickup.address }
                },
                contact: { phone: order.pickup.phone }
              },
              end: {
                location: {
                  gps: `${order.drop.gps.lat},${order.drop.gps.lng}`,
                  address: { name: order.drop.name, street: order.drop.address }
                },
                contact: { phone: order.drop.phone }
              }
            }
          ]
        }
      }
    };

    return this.sendCallback(order.bapUri, 'on_confirm', payload);
  }

  /**
   * Send on_status update (Pickup, In-transit, Delivered)
   */
  public static async sendOnStatus(order: any) {
    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_status',
        core_version: '1.2.0',
        bap_id: order.bapId,
        bap_uri: order.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: order.transactionId,
        message_id: uuidv4(),
        timestamp: new Date().toISOString()
      },
      message: {
        order: {
          id: order.orderId,
          state: order.status === 'Order-delivered' ? 'Completed' : 'In-progress',
          fulfillments: [
            {
              id: 'ralt-fulfillment-1',
              state: {
                descriptor: {
                  code: order.status
                }
              },
              agent: order.rider ? {
                name: order.rider.name,
                phone: order.rider.phone
              } : undefined
            }
          ]
        }
      }
    };

    return this.sendCallback(order.bapUri, 'on_status', payload);
  }

  /**
   * Send on_track live GPS coordinates
   */
  public static async sendOnTrack(order: any, lat: number, lng: number) {
    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_track',
        core_version: '1.2.0',
        bap_id: order.bapId,
        bap_uri: order.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: order.transactionId,
        message_id: uuidv4(),
        timestamp: new Date().toISOString()
      },
      message: {
        tracking: {
          url: `${config.ondc.subscriberUrl}/track/${order.orderId}`,
          status: 'active',
          location: {
            gps: `${lat},${lng}`,
            time: { timestamp: new Date().toISOString() },
            updated_at: new Date().toISOString()
          }
        }
      }
    };

    return this.sendCallback(order.bapUri, 'on_track', payload);
  }

  /**
   * Send on_cancel callback
   */
  public static async sendOnCancel(order: any, reasonCode: string = '001') {
    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_cancel',
        core_version: '1.2.0',
        bap_id: order.bapId,
        bap_uri: order.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: order.transactionId,
        message_id: uuidv4(),
        timestamp: new Date().toISOString()
      },
      message: {
        order: {
          id: order.orderId,
          state: 'Cancelled',
          cancellation: {
            cancelled_by: 'BAP',
            reason: {
              id: reasonCode,
              descriptor: {
                name: 'Cancelled as per buyer request'
              }
            }
          }
        }
      }
    };

    return this.sendCallback(order.bapUri, 'on_cancel', payload);
  }
}

export const ondcClient = ONDCClient;
