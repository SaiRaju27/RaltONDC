import { Request, Response } from 'express';
import { orderManager } from '../services/orderManager';
import { ondcClient } from '../services/ondcClient';
import { config } from '../config';

const orderPayloadCache = new Map<string, { fulfillment?: any; billing?: any; linkedOrder?: any }>();

export class ONDCController {
  /**
   * Handle incoming /search
   */
  public static async handleSearch(req: Request, res: Response) {
    const { context } = req.body;
    console.log(`[ONDC Gateway] Incoming /search for transaction: ${context?.transaction_id}`);

    // Immediately respond with Beckn ACK
    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    // Asynchronously send on_search quote
    setImmediate(async () => {
      try {
        await ondcClient.sendOnSearch({
          bapUri: context.bap_uri,
          bapId: context.bap_id,
          transactionId: context.transaction_id,
          messageId: context.message_id,
          deliveryFee: config.commercial.defaultDeliveryFee,
          coreVersion: context.core_version,
          city: context.city
        });
      } catch (err: any) {
        console.error('[ONDC Gateway] Error sending on_search:', err.message);
      }
    });
  }

  /**
   * Handle incoming /init
   */
  public static async handleInit(req: Request, res: Response) {
    const { context, message } = req.body;
    console.log(`[ONDC Gateway] Incoming /init for transaction: ${context?.transaction_id}`);

    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    setImmediate(async () => {
      try {
        const incomingFulfillment = message?.order?.fulfillments?.[0];
        const incomingBilling = message?.order?.billing;
        await ondcClient.sendOnInit({
          bapUri: context.bap_uri,
          bapId: context.bap_id,
          transactionId: context.transaction_id,
          messageId: context.message_id,
          deliveryFee: config.commercial.defaultDeliveryFee,
          coreVersion: context.core_version,
          fulfillment: incomingFulfillment,
          billing: incomingBilling
        });
      } catch (err: any) {
        console.error('[ONDC Gateway] Error sending on_init:', err.message);
      }
    });
  }

  /**
   * Handle incoming /confirm (Order booked by seller)
   */
  public static async handleConfirm(req: Request, res: Response) {
    const { context, message } = req.body;
    console.log(`[ONDC Gateway] Incoming /confirm for transaction: ${context?.transaction_id}`);

    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    setImmediate(async () => {
      try {
        const billing = message?.order?.billing || {};
        const linkedOrder = message?.order?.['@ondc/org/linked_order'] || {};
        const fulfillment = message?.order?.fulfillments?.[0] || {};
        const startLoc = fulfillment?.start?.location || {};
        const endLoc = fulfillment?.end?.location || {};

        const parseGps = (str: any) => {
          if (!str) return { lat: 17.4375, lng: 78.3687 };
          if (typeof str === 'object' && str.lat && str.lng) {
            return { lat: Number(str.lat), lng: Number(str.lng) };
          }
          const parts = String(str).split(',').map(s => parseFloat(s.trim()));
          return { lat: parts[0] || 17.4375, lng: parts[1] || 78.3687 };
        };

        // Real Merchant / Restaurant pickup details
        const pAddr = startLoc?.address || linkedOrder?.provider?.address || {};
        const pickupName =
          linkedOrder?.provider?.descriptor?.name ||
          linkedOrder?.provider?.address?.name ||
          pAddr.name ||
          startLoc?.descriptor?.name ||
          'Merchant Store';

        const pickupAddressParts = [
          pAddr.building,
          pAddr.locality || pAddr.street,
          pAddr.city,
          pAddr.state,
          pAddr.area_code
        ].filter(Boolean);
        const pickupAddress = pickupAddressParts.length > 0
          ? pickupAddressParts.join(', ')
          : (pAddr.name || 'Merchant Pickup Point');

        const pickupPhone = fulfillment?.start?.contact?.phone || '+91 99887 76655';

        // Real Customer drop details
        const dAddr = endLoc?.address || billing?.address || {};
        const dropName = billing?.name || endLoc?.descriptor?.name || dAddr.name || 'Customer Delivery';

        const dropAddressParts = [
          dAddr.building,
          dAddr.locality || dAddr.street,
          dAddr.city,
          dAddr.state,
          dAddr.area_code
        ].filter(Boolean);
        const dropAddress = dropAddressParts.length > 0
          ? dropAddressParts.join(', ')
          : (dAddr.name || 'Customer Delivery Address');

        const dropPhone = fulfillment?.end?.contact?.phone || billing?.phone || '+91 98765 43210';

        // Real Order Items from linked_order or items
        let realItems: Array<{ name: string; quantity: number }> = [];
        if (Array.isArray(linkedOrder?.items) && linkedOrder.items.length > 0) {
          realItems = linkedOrder.items.map((it: any) => ({
            name: it.descriptor?.name || it.name || it.id || 'Order Item',
            quantity: it.quantity?.count || it.quantity?.measure?.value || 1
          }));
        } else if (Array.isArray(message?.order?.items)) {
          realItems = message.order.items
            .filter((it: any) => it.id !== 'immediate-delivery')
            .map((it: any) => ({
              name: it.descriptor?.name || it.id || 'Delivery Item',
              quantity: it.quantity?.count || 1
            }));
        }
        if (realItems.length === 0) {
          realItems = [{ name: 'Standard Package', quantity: 1 }];
        }

        const deliveryFee = parseFloat(
          message?.order?.quote?.price?.value ||
          config.commercial.defaultDeliveryFee.toString()
        );

        console.log(`[ONDC Gateway] Parsed real ONDC order: Store: "${pickupName}", Customer: "${dropName}", Items: ${realItems.map(i => `${i.name}x${i.quantity}`).join(', ')}`);

        const order = await orderManager.createOrder({
          transactionId: context.transaction_id,
          messageId: context.message_id,
          bapId: context.bap_id,
          bapUri: context.bap_uri,
          pickup: {
            name: pickupName,
            phone: pickupPhone,
            address: pickupAddress,
            gps: parseGps(startLoc?.gps)
          },
          drop: {
            name: dropName,
            phone: dropPhone,
            address: dropAddress,
            gps: parseGps(endLoc?.gps)
          },
          items: realItems,
          deliveryFee
        });

        if (context.transaction_id) {
          orderPayloadCache.set(context.transaction_id, { fulfillment, billing, linkedOrder });
          ondcClient.cacheOrderPayload(context.transaction_id, { fulfillment, billing, linkedOrder });
        }

        console.log(`[ONDC Gateway] Created real order ${order.orderId}, assigned rider: ${order.rider?.name || 'Available Riders'}`);
        if (order?.orderId) {
          orderPayloadCache.set(order.orderId, { fulfillment, billing, linkedOrder });
          ondcClient.cacheOrderPayload(order.orderId, { fulfillment, billing, linkedOrder });
        }
        await ondcClient.sendOnConfirm(order, fulfillment, billing, linkedOrder);
      } catch (err: any) {
        console.error('[ONDC Gateway] Error in handleConfirm:', err.message);
      }
    });
  }

  /**
   * Handle incoming /update (Order fulfillment updated, e.g. ready_to_ship)
   */
  public static async handleUpdate(req: Request, res: Response) {
    const { context, message } = req.body;
    console.log(`[ONDC Gateway] Incoming /update for transaction: ${context?.transaction_id}`);

    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    setImmediate(async () => {
      try {
        const fulfillment = message?.order?.fulfillments?.[0] || {};
        const orderId = message?.order?.id;
        const existingOrder = orderId ? await orderManager.getOrder(orderId) : undefined;
        const cached = orderPayloadCache.get(context.transaction_id) || (orderId ? orderPayloadCache.get(orderId) : undefined);
        const billing = message?.order?.billing || cached?.billing;
        const linkedOrder = message?.order?.['@ondc/org/linked_order'] || cached?.linkedOrder;

        orderPayloadCache.set(context.transaction_id, { fulfillment, billing, linkedOrder });
        ondcClient.cacheOrderPayload(context.transaction_id, { fulfillment, billing, linkedOrder });
        if (orderId) {
          orderPayloadCache.set(orderId, { fulfillment, billing, linkedOrder });
          ondcClient.cacheOrderPayload(orderId, { fulfillment, billing, linkedOrder });
        }

        await ondcClient.sendOnUpdate({
          bapUri: context.bap_uri,
          bapId: context.bap_id,
          transactionId: context.transaction_id,
          messageId: context.message_id,
          orderId: orderId || existingOrder?.orderId || 'ralt-ondc-order',
          order: existingOrder,
          fulfillment: fulfillment,
          billing: billing,
          linkedOrder: linkedOrder
        });
      } catch (err: any) {
        console.error('[ONDC Gateway] Error in handleUpdate:', err.message);
      }
    });
  }

  /**
   * Handle incoming /status
   */
  public static async handleStatus(req: Request, res: Response) {
    const { context } = req.body;
    console.log(`[ONDC Gateway] Incoming /status for transaction: ${context?.transaction_id}`);

    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    setImmediate(async () => {
      try {
        const order = await orderManager.getOrderByTransaction(context.transaction_id);
        if (order) {
          const cached = orderPayloadCache.get(context.transaction_id) || orderPayloadCache.get(order.orderId);
          await ondcClient.sendOnStatus({
            order,
            rawFulfillment: cached?.fulfillment,
            rawBilling: cached?.billing,
            rawLinkedOrder: cached?.linkedOrder
          });
        }
      } catch (err: any) {
        console.error('[ONDC Gateway] Error sending on_status:', err.message);
      }
    });
  }

  /**
   * Handle incoming /track
   */
  public static async handleTrack(req: Request, res: Response) {
    const { context } = req.body;
    console.log(`[ONDC Gateway] Incoming /track for transaction: ${context?.transaction_id}`);

    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    setImmediate(async () => {
      try {
        const order = await orderManager.getOrderByTransaction(context.transaction_id);
        if (order && order.rider) {
          await ondcClient.sendOnTrack(
            order,
            order.rider.lat,
            order.rider.lng
          );
        }
      } catch (err: any) {
        console.error('[ONDC Gateway] Error sending on_track:', err.message);
      }
    });
  }

  /**
   * Handle incoming /cancel
   */
  public static async handleCancel(req: Request, res: Response) {
    const { context, message } = req.body;
    console.log(`[ONDC Gateway] Incoming /cancel for transaction: ${context?.transaction_id}`);

    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    setImmediate(async () => {
      try {
        const reasonCode = message?.cancellation_reason_id || '001';
        let order = await orderManager.getOrderByTransaction(context.transaction_id);
        if (!order && message?.order_id) {
          order = await orderManager.getOrder(message.order_id);
        }

        const cached = orderPayloadCache.get(context.transaction_id)
          || (order ? orderPayloadCache.get(order.orderId) : undefined)
          || (message?.order_id ? orderPayloadCache.get(message.order_id) : undefined);

        const orderId = message?.order_id || order?.orderId || 'ralt-ondc-order';
        const bapUri = context.bap_uri || order?.bapUri;
        const bapId = context.bap_id || order?.bapId;

        if (order) {
          await orderManager.updateStatus(order.orderId, 'Cancelled');
        }

        await ondcClient.sendOnCancel({
          bapUri,
          bapId,
          transactionId: context.transaction_id,
          messageId: context.message_id,
          orderId,
          reasonCode,
          order,
          rawFulfillment: cached?.fulfillment,
          rawBilling: cached?.billing,
          rawLinkedOrder: cached?.linkedOrder
        });
      } catch (err: any) {
        console.error('[ONDC Gateway] Error in handleCancel:', err.message);
      }
    });
  }
}
