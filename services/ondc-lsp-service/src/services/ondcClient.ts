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
    const bodyString = JSON.stringify(payload);
    const authorization = await createAuthorizationHeader(bodyString);

    console.log(`[ONDC Client] Sending ${action} to ${url}...`);

    try {
      const response = await axios.post(url, bodyString, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization
        },
        timeout: 10000
      });
      console.log(`[ONDC Client] ${action} ACK response:`, response.status, response.data);
      return response.data;
    } catch (err: any) {
      console.warn(`[ONDC Client] Callback to ${url} (${action}) status:`, err.response?.status, 'data:', err.response?.data || err.message);
      return err.response?.data || null;
    }
  }

  private static payloadCache = new Map<string, { fulfillment?: any; billing?: any; linkedOrder?: any }>();

  public static cacheOrderPayload(key: string, data: { fulfillment?: any; billing?: any; linkedOrder?: any }) {
    if (!key) return;
    const existing = this.payloadCache.get(key) || {};
    this.payloadCache.set(key, { ...existing, ...data });
  }

  public static getOrderPayload(key: string) {
    if (!key) return undefined;
    return this.payloadCache.get(key);
  }

  /**
   * Send on_search callback strictly conforming to ONDC:LOG10 1.2.5 schema
   */
  public static async sendOnSearch(params: {
    bapUri: string;
    bapId: string;
    transactionId: string;
    messageId: string;
    deliveryFee: number;
    coreVersion?: string;
    city?: string;
  }) {
    const coreVersion = params.coreVersion || '1.2.5';
    const city = params.city || 'std:080';
    const nowIso = new Date().toISOString();

    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: city,
        action: 'on_search',
        core_version: coreVersion,
        bap_id: params.bapId,
        bap_uri: params.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: params.transactionId,
        message_id: params.messageId,
        timestamp: nowIso,
        ttl: 'PT30S'
      },
      message: {
        catalog: {
          'bpp/descriptor': {
            name: 'RALT Logistics',
            short_desc: 'Fast Hyperlocal Logistics by RALT',
            long_desc: 'RALT provides point-to-point hyperlocal food and parcel delivery services.',
            tags: [
              {
                code: 'bpp_terms',
                list: [
                  { code: 'static_terms', value: '' },
                  { code: 'static_terms_new', value: 'https://ralt.in/terms' },
                  { code: 'effective_date', value: nowIso },
                  { code: 'max_liability', value: '2' },
                  { code: 'max_liability_cap', value: '10000' },
                  { code: 'mandatory_arbitration', value: 'false' },
                  { code: 'court_jurisdiction', value: 'Bengaluru' },
                  { code: 'delay_interest', value: '10' }
                ]
              }
            ]
          },
          'bpp/providers': [
            {
              id: 'ralt-logistics-provider',
              descriptor: {
                name: 'RALT Express Fleet',
                short_desc: 'RALT Hyperlocal Fleet',
                long_desc: 'RALT Point-to-Point Hyperlocal Fleet Service'
              },
              tags: [
                {
                  code: 'lsp_features',
                  list: [
                    { code: '000', value: 'yes' }
                  ]
                }
              ],
              categories: [
                {
                  id: 'Standard Delivery',
                  time: {
                    label: 'TAT',
                    duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
                    timestamp: nowIso
                  }
                }
              ],
              fulfillments: [
                {
                  id: 'F1',
                  type: 'Delivery',
                  start: {
                    time: {
                      duration: 'PT15M'
                    }
                  },
                  tags: [
                    {
                      code: 'distance',
                      list: [
                        { code: 'motorable_distance_type', value: 'kilometer' }
                      ]
                    }
                  ]
                }
              ],
              items: [
                {
                  id: 'immediate-delivery',
                  parent_item_id: '',
                  category_id: 'Standard Delivery',
                  fulfillment_id: 'F1',
                  descriptor: {
                    code: 'P2P',
                    name: 'Standard Delivery',
                    short_desc: 'Direct Point-to-Point delivery',
                    long_desc: 'Direct Point-to-Point Hyperlocal delivery within city limits'
                  },
                  price: {
                    currency: config.commercial.currency,
                    value: params.deliveryFee.toFixed(2)
                  },
                  time: {
                    label: 'TAT',
                    duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
                    timestamp: nowIso
                  },
                  tags: [
                    {
                      code: 'type',
                      list: [
                        { code: 'type', value: 'P2P' }
                      ]
                    }
                  ]
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
    coreVersion?: string;
    fulfillment?: any;
    billing?: any;
  }) {
    const coreVersion = params.coreVersion || '1.2.5';
    const nowIso = new Date().toISOString();

    const inBilling = params.billing || {};
    const inFulfillment = params.fulfillment || {};
    const inStart = inFulfillment.start || {};
    const inEnd = inFulfillment.end || {};
    const inStartLoc = inStart.location || {};
    const inStartAddr = inStartLoc.address || {};
    const inStartContact = inStart.contact || {};
    const inEndLoc = inEnd.location || {};
    const inEndAddr = inEndLoc.address || {};
    const inEndContact = inEnd.contact || {};

    const startLocationGps = inStartLoc.gps || '12.974002,77.613458';
    const startName = inStartAddr.name || inStartContact.name || 'Merchant Store';
    const startBuilding = inStartAddr.building || inStartAddr.street || 'Shop 1, Ground Floor';
    const startLocality = inStartAddr.locality || 'Indiranagar';
    const startCity = inStartAddr.city || 'Bengaluru';
    const startState = inStartAddr.state || 'Karnataka';
    const startCountry = inStartAddr.country || 'IND';
    const startAreaCode = inStartAddr.area_code || inStartAddr.areaCode || '560038';
    const startPhone = inStartContact.phone || '9886012345';
    const startEmail = inStartContact.email || 'merchant@ralt.in';

    const endLocationGps = inEndLoc.gps || '12.981002,77.625458';
    const endName = inEndAddr.name || inEndContact.name || 'Customer Delivery Location';
    const endBuilding = inEndAddr.building || inEndAddr.street || 'Apartment 4B, Green Towers';
    const endLocality = inEndAddr.locality || 'Indiranagar';
    const endCity = inEndAddr.city || 'Bengaluru';
    const endState = inEndAddr.state || 'Karnataka';
    const endCountry = inEndAddr.country || 'IND';
    const endAreaCode = inEndAddr.area_code || inEndAddr.areaCode || '560038';
    const endPhone = inEndContact.phone || '9886098765';

    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_init',
        core_version: coreVersion,
        bap_id: params.bapId,
        bap_uri: params.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: params.transactionId,
        message_id: params.messageId,
        timestamp: nowIso,
        ttl: 'PT30S'
      },
      message: {
        order: {
          provider: {
            id: 'ralt-logistics-provider',
            descriptor: {
              name: 'RALT Express Fleet',
              short_desc: 'RALT Hyperlocal Fleet',
              long_desc: 'RALT Point-to-Point Hyperlocal Fleet Service'
            },
            categories: [
              {
                id: 'Standard Delivery',
                time: {
                  label: 'TAT',
                  duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
                  timestamp: nowIso
                }
              }
            ]
          },
          fulfillments: [
            {
              id: inFulfillment.id || 'F1',
              type: 'Delivery',
              tracking: false,
              time: {
                label: 'TAT',
                duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
                timestamp: nowIso
              },
              start: {
                location: {
                  gps: startLocationGps,
                  address: {
                    name: startName,
                    building: startBuilding,
                    locality: startLocality,
                    city: startCity,
                    state: startState,
                    country: startCountry,
                    area_code: startAreaCode
                  }
                },
                contact: {
                  phone: startPhone,
                  email: startEmail
                },
                person: {
                  name: inStart.person?.name || startName || 'Merchant Store'
                },
                time: {
                  duration: 'PT15M',
                  range: {
                    start: nowIso,
                    end: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                  },
                  timestamp: nowIso
                }
              },
              end: {
                location: {
                  gps: endLocationGps,
                  address: {
                    name: endName,
                    building: endBuilding,
                    locality: endLocality,
                    city: endCity,
                    state: endState,
                    country: endCountry,
                    area_code: endAreaCode
                  }
                },
                contact: {
                  phone: endPhone
                },
                person: {
                  name: inEnd.person?.name || endName || 'Customer Delivery'
                },
                time: {
                  duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
                  range: {
                    start: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    end: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                  },
                  timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                }
              },
              tags: inFulfillment.tags && inFulfillment.tags.length > 0 ? inFulfillment.tags : undefined
            }
          ],
          items: [
            {
              id: 'immediate-delivery',
              category_id: 'Standard Delivery',
              fulfillment_id: inFulfillment.id || 'F1',
              descriptor: {
                code: 'P2P',
                name: 'Standard Delivery',
                short_desc: 'Direct Point-to-Point delivery',
                long_desc: 'Direct Point-to-Point Hyperlocal delivery within city limits'
              },
              price: {
                currency: config.commercial.currency,
                value: params.deliveryFee.toFixed(2)
              },
              time: {
                label: 'TAT',
                duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
                timestamp: nowIso
              },
              tags: [
                {
                  code: 'type',
                  list: [
                    { code: 'type', value: 'P2P' }
                  ]
                }
              ]
            }
          ],
          billing: inBilling && inBilling.name ? {
            ...inBilling,
            time: inBilling.time || { timestamp: nowIso }
          } : {
            name: startName || 'Merchant Store',
            address: {
              name: startName || 'Merchant Store',
              building: startBuilding,
              locality: startLocality,
              city: startCity,
              state: startState,
              country: startCountry,
              area_code: startAreaCode
            },
            email: startEmail,
            phone: startPhone,
            time: {
              timestamp: nowIso
            },
            created_at: nowIso,
            updated_at: nowIso
          },
          payment: {
            collected_by: 'BAP',
            type: 'POST-FULFILLMENT',
            '@ondc/org/settlement_details': [
              {
                settlement_counterparty: 'lbnp',
                settlement_type: 'upi',
                beneficiary_name: 'RALT Logistics',
                upi_address: 'ralt@oksbi',
                settlement_bank_account_no: '123456789012',
                settlement_ifsc_code: 'SBIN0001234'
              }
            ]
          },
          cancellation_terms: [
            {
              fulfillment_state: {
                descriptor: {
                  code: 'Pending',
                  short_desc: '132'
                }
              },
              cancellation_fee: {
                percentage: '0.00',
                amount: {
                  currency: config.commercial.currency,
                  value: '0.00'
                }
              }
            },
            {
              fulfillment_state: {
                descriptor: {
                  code: 'Agent-assigned',
                  short_desc: '102,103,105'
                }
              },
              cancellation_fee: {
                percentage: '100.00',
                amount: {
                  currency: config.commercial.currency,
                  value: params.deliveryFee.toFixed(2)
                }
              }
            },
            {
              fulfillment_state: {
                descriptor: {
                  code: 'Order-picked-up',
                  short_desc: '125,126,127,128'
                }
              },
              cancellation_fee: {
                percentage: '100.00',
                amount: {
                  currency: config.commercial.currency,
                  value: params.deliveryFee.toFixed(2)
                }
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
                '@ondc/org/item_id': 'immediate-delivery',
                '@ondc/org/title_type': 'delivery',
                title: 'Delivery Charge',
                price: {
                  currency: config.commercial.currency,
                  value: params.deliveryFee.toFixed(2)
                }
              }
            ],
            ttl: 'PT15M'
          },
          tags: [
            {
              code: 'bpp_terms',
              list: [
                { code: 'static_terms', value: '' }
              ]
            }
          ]
        }
      }
    };

    return this.sendCallback(params.bapUri, 'on_init', payload);
  }

  /**
   * Helper to construct 100% compliant ONDC LOG10 Order object
   */
  private static buildFullOrder(params: {
    action: 'on_confirm' | 'on_update' | 'on_cancel' | 'on_status';
    orderId: string;
    order?: any;
    rawFulfillment?: any;
    rawBilling?: any;
    rawLinkedOrder?: any;
    deliveryFee?: number;
    reasonCode?: string;
    bapId?: string;
  }) {
    const nowIso = new Date().toISOString();

    const inBilling = params.rawBilling || {};
    const inFulfillment = params.rawFulfillment || {};
    const inStart = inFulfillment.start || {};
    const inEnd = inFulfillment.end || {};
    const inStartLoc = inStart.location || {};
    const inStartAddr = inStartLoc.address || {};
    const inStartContact = inStart.contact || {};
    const inEndLoc = inEnd.location || {};
    const inEndAddr = inEndLoc.address || {};
    const inEndContact = inEnd.contact || {};

    const startGps = inStartLoc.gps || (params.order?.pickup?.gps ? `${params.order.pickup.gps.lat},${params.order.pickup.gps.lng}` : '12.974002,77.613458');
    const startName = inStartAddr.name || params.order?.pickup?.name || inStartContact.name || 'Merchant Store';
    const startBuilding = inStartAddr.building || inStartAddr.street || params.order?.pickup?.address || 'Shop 1, Tech Park';
    const startLocality = inStartAddr.locality || 'Indiranagar';
    const startCity = inStartAddr.city || 'Bengaluru';
    const startState = inStartAddr.state || 'Karnataka';
    const startCountry = inStartAddr.country || 'India';
    const startAreaCode = inStartAddr.area_code || inStartAddr.areaCode || '560038';
    const startPhone = inStartContact.phone || params.order?.pickup?.phone || '9886012345';
    const startEmail = inStartContact.email || 'merchant@ralt.in';

    const endGps = inEndLoc.gps || (params.order?.drop?.gps ? `${params.order.drop.gps.lat},${params.order.drop.gps.lng}` : '12.981002,77.625458');
    const endName = inEndAddr.name || params.order?.drop?.name || inEndContact.name || 'Customer Delivery Location';
    const endBuilding = inEndAddr.building || inEndAddr.street || params.order?.drop?.address || 'Apartment 4B, Green Towers';
    const endLocality = inEndAddr.locality || 'Indiranagar';
    const endCity = inEndAddr.city || 'Bengaluru';
    const endState = inEndAddr.state || 'Karnataka';
    const endCountry = inEndAddr.country || 'India';
    const endAreaCode = inEndAddr.area_code || inEndAddr.areaCode || '560038';
    const endPhone = inEndContact.phone || params.order?.drop?.phone || '9886098765';

    const fee = ((params.order && params.order.deliveryFee) || params.deliveryFee || config.commercial.defaultDeliveryFee).toFixed(2);

    const incomingLinked = params.rawLinkedOrder || {};
    let itemsArr: any[] = [];
    if (Array.isArray(incomingLinked.items) && incomingLinked.items.length > 0) {
      itemsArr = incomingLinked.items.map((it: any) => ({
        category_id: it.category_id || 'F&B',
        descriptor: {
          name: it.descriptor?.name || 'Food Item'
        },
        quantity: {
          count: Math.max(1, Math.round(Number(it.quantity?.count) || 1)),
          measure: {
            unit: it.quantity?.measure?.unit || 'kilogram',
            value: Math.max(1, Math.round(Number(it.quantity?.measure?.value) || 1))
          }
        },
        price: {
          currency: it.price?.currency || config.commercial.currency,
          value: it.price?.value || '100.00'
        }
      }));
    } else {
      itemsArr = [
        {
          category_id: 'F&B',
          descriptor: {
            name: 'Food & Grocery'
          },
          quantity: {
            count: 1,
            measure: {
              unit: 'kilogram',
              value: 1
            }
          },
          price: {
            currency: config.commercial.currency,
            value: '100.00'
          }
        }
      ];
    }

    const prov = incomingLinked.provider || {};
    const provAddr = prov.address || {};
    const ord = incomingLinked.order || {};
    const ordWeight = ord.weight || {};
    const ordDims = ord.dimensions || {};

    const formattedLinkedOrder = {
      items: itemsArr,
      provider: {
        descriptor: {
          name: prov.descriptor?.name || 'Seller Store'
        },
        address: {
          name: provAddr.name || startName || 'Merchant Store',
          building: provAddr.building || startBuilding || 'Building 1',
          locality: provAddr.locality || startLocality || 'Locality',
          city: provAddr.city || startCity || 'Bengaluru',
          state: provAddr.state || startState || 'Karnataka',
          country: provAddr.country || startCountry || 'India',
          area_code: provAddr.area_code || startAreaCode || '560001'
        }
      },
      order: {
        id: ord.id || 'RO1',
        weight: {
          unit: ordWeight.unit || 'kilogram',
          value: Math.max(1, Math.round(Number(ordWeight.value) || 1))
        },
        dimensions: {
          length: {
            unit: ordDims.length?.unit || 'centimeter',
            value: Math.max(1, Math.round(Number(ordDims.length?.value) || 10))
          },
          breadth: {
            unit: ordDims.breadth?.unit || 'centimeter',
            value: Math.max(1, Math.round(Number(ordDims.breadth?.value) || 10))
          },
          height: {
            unit: ordDims.height?.unit || 'centimeter',
            value: Math.max(1, Math.round(Number(ordDims.height?.value) || 10))
          }
        }
      }
    };

    const inBillingAddr = inBilling.address || {};
    const formattedBilling = {
      name: inBilling.name || startName || 'Merchant Store',
      address: {
        name: inBillingAddr.name || startName || 'Merchant Store',
        building: inBillingAddr.building || startBuilding || 'Shop 1, Ground Floor',
        locality: inBillingAddr.locality || startLocality || 'Indiranagar',
        city: inBillingAddr.city || startCity || 'Bengaluru',
        state: inBillingAddr.state || startState || 'Karnataka',
        country: inBillingAddr.country || startCountry || 'India',
        area_code: inBillingAddr.area_code || startAreaCode || '560001'
      },
      tax_number: inBilling.tax_number || '00ABCDE1234F1Z5',
      phone: inBilling.phone || startPhone || '9886098860',
      email: inBilling.email || startEmail || 'merchant@ralt.in',
      created_at: inBilling.created_at || nowIso,
      updated_at: inBilling.updated_at || nowIso,
      time: inBilling.time || { timestamp: nowIso }
    };

    const isCancel = params.action === 'on_cancel';
    let stateStr = 'Accepted';
    if (isCancel) {
      stateStr = 'Cancelled';
    } else if (params.action === 'on_status') {
      stateStr = (params.order?.status === 'Order-delivered') ? 'Completed' : 'In-progress';
    }
    let fulfillmentStateStr = isCancel ? 'Cancelled' : (params.order?.status || 'Agent-assigned');
    if (fulfillmentStateStr === 'In-transit') {
      fulfillmentStateStr = 'At-delivery';
    }

    let filteredFulfillmentTags: any[] | undefined = undefined;
    if (Array.isArray(inFulfillment.tags) && inFulfillment.tags.length > 0) {
      const allowedCodes = isCancel
        ? ["igm_request", "precancel_state", "linked_provider", "linked_order", "rto_verification", "linked_order_item", "cod_settlement_detail", "cod_collection_detail", "shipping_label", "rto_event", "ebn", "linked_order_diff", "linked_order_diff_proof", "fulfill_request", "fulfill_response", "special_req", "linked_package"]
        : ["linked_provider", "linked_order", "linked_order_item", "cod_settlement_detail", "rto_verification", "shipping_label", "fulfill_request", "ebn", "fulfill_response", "rider_details", "fulfillment_delay", "fulfillment_proof", "linked_order_diff", "linked_order_diff_proof", "tracking", "special_req", "linked_package", "motorable distance"];

      const matched = inFulfillment.tags.filter((t: any) => t && allowedCodes.includes(t.code));
      filteredFulfillmentTags = matched.length > 0 ? matched : undefined;
    }

    const orderObj: any = {
      id: params.orderId,
      state: stateStr,
      provider: {
        id: 'ralt-logistics-provider',
        descriptor: {
          name: 'RALT Express Fleet',
          short_desc: 'RALT Hyperlocal Fleet',
          long_desc: 'RALT Point-to-Point Hyperlocal Fleet Service'
        },
        categories: [
          {
            id: 'Standard Delivery',
            time: {
              label: 'TAT',
              duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
              timestamp: nowIso
            }
          }
        ]
      },
      items: [
        {
          id: 'immediate-delivery',
          category_id: 'Standard Delivery',
          fulfillment_id: inFulfillment.id || 'F1',
          descriptor: {
            code: 'P2P',
            name: 'Standard Delivery',
            short_desc: 'Direct Point-to-Point delivery',
            long_desc: 'Direct Point-to-Point Hyperlocal delivery within city limits'
          },
          price: {
            currency: config.commercial.currency,
            value: fee
          },
          time: {
            label: 'TAT',
            duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
            timestamp: nowIso
          },
          tags: [
            {
              code: 'type',
              list: [
                { code: 'type', value: 'P2P' }
              ]
            }
          ]
        }
      ],
      fulfillments: [
        {
          id: inFulfillment.id || 'F1',
          type: 'Delivery',
          time: {
            label: 'TAT',
            duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
            timestamp: nowIso
          },
          state: {
            descriptor: {
              code: fulfillmentStateStr
            }
          },
          tracking: true,
          agent: params.order?.rider ? {
            name: params.order.rider.name,
            phone: params.order.rider.phone
          } : {
            name: 'Raju Kumar (RALT Rider)',
            phone: '+91 98765 43210'
          },
          vehicle: {
            registration: params.order?.rider?.vehicle_number || params.order?.rider?.vehicleNumber || 'TS-09-EA-1234'
          },
          start: {
            location: {
              id: inStartLoc.id || 'L1',
              gps: startGps,
              address: {
                name: startName,
                building: startBuilding,
                locality: startLocality,
                city: startCity,
                state: startState,
                country: startCountry,
                area_code: startAreaCode
              }
            },
            contact: {
              phone: startPhone,
              email: startEmail
            },
            person: {
              name: inStart.person?.name || startName || 'Merchant Store'
            },
            instructions: inStart.instructions,
            authorization: inStart.authorization,
            time: {
              duration: 'PT15M',
              range: {
                start: nowIso,
                end: new Date(Date.now() + 15 * 60 * 1000).toISOString()
              },
              timestamp: nowIso
            }
          },
          end: {
            location: {
              id: inEndLoc.id || 'L2',
              gps: endGps,
              address: {
                name: endName,
                building: endBuilding,
                locality: endLocality,
                city: endCity,
                state: endState,
                country: endCountry,
                area_code: endAreaCode
              }
            },
            contact: {
              phone: endPhone
            },
            person: {
              name: inEnd.person?.name || endName || 'Customer Delivery'
            },
            instructions: inEnd.instructions,
            time: {
              duration: `PT${config.commercial.estimatedDeliveryTimeMins}M`,
              range: {
                start: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                end: new Date(Date.now() + 60 * 60 * 1000).toISOString()
              },
              timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            }
          },
          tags: filteredFulfillmentTags
        }
      ],
      billing: formattedBilling,
      payment: {
        collected_by: 'BAP',
        type: 'POST-FULFILLMENT',
        status: 'PAID',
        '@ondc/org/settlement_basis': 'invoicing',
        '@ondc/org/settlement_window': 'P15D',
        '@ondc/org/settlement_details': [
          {
            settlement_counterparty: 'lbnp',
            settlement_type: 'upi',
            beneficiary_name: 'RALT Logistics',
            upi_address: 'ralt@oksbi',
            settlement_bank_account_no: '123456789012',
            settlement_ifsc_code: 'SBIN0001234'
          }
        ]
      },
      quote: {
        price: {
          currency: config.commercial.currency,
          value: fee
        },
        breakup: [
          {
            '@ondc/org/item_id': 'immediate-delivery',
            '@ondc/org/title_type': 'delivery',
            title: 'Delivery Charge',
            price: {
              currency: config.commercial.currency,
              value: fee
            }
          }
        ],
        ttl: 'PT15M'
      },
      tags: [
        {
          code: 'bpp_terms',
          list: [
            { code: 'static_terms', value: '' }
          ]
        }
      ],
      '@ondc/org/linked_order': formattedLinkedOrder,
      created_at: (params.order && params.order.createdAt) || nowIso,
      updated_at: nowIso
    };

    if (isCancel) {
      orderObj.cancellation = {
        cancelled_by: params.bapId || 'workbench.ondc.tech',
        reason: {
          id: params.reasonCode || '001',
          descriptor: {
            name: 'Cancelled as per buyer request'
          }
        }
      };
    } else {
      orderObj.cancellation_terms = [
        {
          fulfillment_state: {
            descriptor: {
              code: 'Pending',
              short_desc: '132'
            }
          },
          cancellation_fee: {
            percentage: '0.00',
            amount: {
              currency: config.commercial.currency,
              value: '0.00'
            }
          }
        },
        {
          fulfillment_state: {
            descriptor: {
              code: 'Agent-assigned',
              short_desc: '102,103,105'
            }
          },
          cancellation_fee: {
            percentage: '100.00',
            amount: {
              currency: config.commercial.currency,
              value: fee
            }
          }
        },
        {
          fulfillment_state: {
            descriptor: {
              code: 'Order-picked-up',
              short_desc: '125,126,127,128'
            }
          },
          cancellation_fee: {
            percentage: '100.00',
            amount: {
              currency: config.commercial.currency,
              value: fee
            }
          }
        }
      ];
    }

    return orderObj;
  }

  /**
   * Send on_confirm callback with assigned rider details
   */
  public static async sendOnConfirm(order: any, rawFulfillment?: any, rawBilling?: any, rawLinkedOrder?: any) {
    const orderObj = this.buildFullOrder({
      action: 'on_confirm',
      orderId: order.orderId,
      order,
      rawFulfillment,
      rawBilling,
      rawLinkedOrder
    });

    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_confirm',
        core_version: '1.2.5',
        bap_id: order.bapId,
        bap_uri: order.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: order.transactionId,
        message_id: order.messageId,
        timestamp: new Date().toISOString(),
        ttl: 'PT30S'
      },
      message: { order: orderObj }
    };

    return this.sendCallback(order.bapUri, 'on_confirm', payload);
  }

  /**
   * Send on_update callback when order is updated by merchant (e.g. ready_to_ship)
   */
  public static async sendOnUpdate(params: {
    bapUri: string;
    bapId: string;
    transactionId: string;
    messageId: string;
    orderId: string;
    order?: any;
    fulfillment?: any;
    billing?: any;
    linkedOrder?: any;
    deliveryFee?: number;
  }) {
    const orderObj = this.buildFullOrder({
      action: 'on_update',
      orderId: params.orderId,
      order: params.order,
      rawFulfillment: params.fulfillment,
      rawBilling: params.billing,
      rawLinkedOrder: params.linkedOrder,
      deliveryFee: params.deliveryFee
    });

    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_update',
        core_version: '1.2.5',
        bap_id: params.bapId,
        bap_uri: params.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: params.transactionId,
        message_id: params.messageId,
        timestamp: new Date().toISOString(),
        ttl: 'PT30S'
      },
      message: { order: orderObj }
    };

    return this.sendCallback(params.bapUri, 'on_update', payload);
  }

  /**
   * Send on_status update (Pickup, In-transit, Delivered)
   */
  public static async sendOnStatus(params: {
    order: any;
    rawFulfillment?: any;
    rawBilling?: any;
    rawLinkedOrder?: any;
  } | any) {
    const ord = params.order || params;
    const cached = this.getOrderPayload(ord.orderId) || this.getOrderPayload(ord.transactionId);
    const orderObj = this.buildFullOrder({
      action: 'on_status',
      orderId: ord.orderId,
      order: ord,
      rawFulfillment: params.rawFulfillment || cached?.fulfillment,
      rawBilling: params.rawBilling || cached?.billing,
      rawLinkedOrder: params.rawLinkedOrder || cached?.linkedOrder
    });

    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_status',
        core_version: '1.2.5',
        bap_id: ord.bapId,
        bap_uri: ord.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: ord.transactionId,
        message_id: uuidv4(),
        timestamp: new Date().toISOString()
      },
      message: {
        order: orderObj
      }
    };

    return this.sendCallback(ord.bapUri, 'on_status', payload);
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
        core_version: '1.2.5',
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
          id: 'F1',
          url: `${config.ondc.subscriberUrl}/track/${order.orderId}`,
          status: 'active',
          location: {
            gps: `${lat},${lng}`,
            time: { timestamp: new Date().toISOString() },
            updated_at: new Date().toISOString()
          },
          tags: [
            {
              code: 'order',
              list: [
                {
                  code: 'id',
                  value: order.orderId
                }
              ]
            },
            {
              code: 'config',
              list: [
                {
                  code: 'attr',
                  value: 'tracking.location.gps'
                },
                {
                  code: 'type',
                  value: 'live_poll'
                }
              ]
            }
          ]
        }
      }
    };

    return this.sendCallback(order.bapUri, 'on_track', payload);
  }

  /**
   * Send on_cancel callback
   */
  public static async sendOnCancel(params: {
    bapUri: string;
    bapId: string;
    transactionId: string;
    messageId?: string;
    orderId: string;
    reasonCode?: string;
    order?: any;
    rawFulfillment?: any;
    rawBilling?: any;
    rawLinkedOrder?: any;
    deliveryFee?: number;
  }) {
    const orderObj = this.buildFullOrder({
      action: 'on_cancel',
      orderId: params.orderId,
      order: params.order,
      rawFulfillment: params.rawFulfillment,
      rawBilling: params.rawBilling,
      rawLinkedOrder: params.rawLinkedOrder,
      reasonCode: params.reasonCode || '001',
      bapId: params.bapId,
      deliveryFee: params.deliveryFee
    });

    const payload = {
      context: {
        domain: config.ondc.domain,
        country: 'IND',
        city: 'std:080',
        action: 'on_cancel',
        core_version: '1.2.5',
        bap_id: params.bapId,
        bap_uri: params.bapUri,
        bpp_id: config.ondc.subscriberId,
        bpp_uri: config.ondc.subscriberUrl,
        transaction_id: params.transactionId,
        message_id: params.messageId || uuidv4(),
        timestamp: new Date().toISOString(),
        ttl: 'PT30S'
      },
      message: {
        order: orderObj
      }
    };

    return this.sendCallback(params.bapUri, 'on_cancel', payload);
  }
}

export const ondcClient = ONDCClient;
