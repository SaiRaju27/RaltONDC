import { Request, Response } from 'express';
import { orderManager } from '../services/orderManager';
import { ondcClient } from '../services/ondcClient';
import { config } from '../config';
import { ondcRequestsTotal, ondcRequestDurationSeconds } from '../observability';
import { logger } from '../logger';

const orderPayloadCache = new Map<string, { fulfillment?: any; billing?: any; linkedOrder?: any }>();

export class ONDCController {
  /**
   * Handle incoming /search
   */
  public static async handleSearch(req: Request, res: Response) {
    const startTime = Date.now();
    const { context } = req.body;
    logger.info({ action: 'search', txId: context?.transaction_id, bapId: context?.bap_id }, 'Incoming ONDC /search request');
    ondcRequestsTotal.inc({ action: 'search', status: 'received' });

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
        ondcRequestsTotal.inc({ action: 'on_search', status: 'success' });
        ondcRequestDurationSeconds.observe({ action: 'search' }, (Date.now() - startTime) / 1000);
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_search', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error sending on_search callback');
      }
    });
  }

  /**
   * Handle incoming /init
   */
  public static async handleInit(req: Request, res: Response) {
    const startTime = Date.now();
    const { context, message } = req.body;
    logger.info({ action: 'init', txId: context?.transaction_id, bapId: context?.bap_id }, 'Incoming ONDC /init request');
    ondcRequestsTotal.inc({ action: 'init', status: 'received' });

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
        ondcRequestsTotal.inc({ action: 'on_init', status: 'success' });
        ondcRequestDurationSeconds.observe({ action: 'init' }, (Date.now() - startTime) / 1000);
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_init', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error sending on_init callback');
      }
    });
  }

  /**
   * Handle incoming /confirm (Order booked by seller)
   */
  public static async handleConfirm(req: Request, res: Response) {
    const startTime = Date.now();
    const { context, message } = req.body;
    logger.info({ action: 'confirm', txId: context?.transaction_id, bapId: context?.bap_id }, 'Incoming ONDC /confirm request');
    ondcRequestsTotal.inc({ action: 'confirm', status: 'received' });

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

        logger.info(
          { pickupName, dropName, itemsCount: realItems.length, fee: deliveryFee },
          'Parsed real ONDC order payload'
        );

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
        if (order?.orderId) {
          orderPayloadCache.set(order.orderId, { fulfillment, billing, linkedOrder });
          ondcClient.cacheOrderPayload(order.orderId, { fulfillment, billing, linkedOrder });
        }

        await ondcClient.sendOnConfirm(order, fulfillment, billing, linkedOrder);
        ondcRequestsTotal.inc({ action: 'on_confirm', status: 'success' });
        ondcRequestDurationSeconds.observe({ action: 'confirm' }, (Date.now() - startTime) / 1000);
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_confirm', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error in handleConfirm');
      }
    });
  }

  /**
   * Handle incoming /update
   */
  public static async handleUpdate(req: Request, res: Response) {
    const { context, message } = req.body;
    logger.info({ action: 'update', txId: context?.transaction_id }, 'Incoming ONDC /update request');
    ondcRequestsTotal.inc({ action: 'update', status: 'received' });

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
          fulfillment,
          billing,
          linkedOrder
        });
        ondcRequestsTotal.inc({ action: 'on_update', status: 'success' });
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_update', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error in handleUpdate');
      }
    });
  }

  /**
   * Handle incoming /status
   */
  public static async handleStatus(req: Request, res: Response) {
    const { context } = req.body;
    logger.info({ action: 'status', txId: context?.transaction_id }, 'Incoming ONDC /status request');
    ondcRequestsTotal.inc({ action: 'status', status: 'received' });

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
          ondcRequestsTotal.inc({ action: 'on_status', status: 'success' });
        }
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_status', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error sending on_status');
      }
    });
  }

  /**
   * Handle incoming /track
   */
  public static async handleTrack(req: Request, res: Response) {
    const { context } = req.body;
    logger.info({ action: 'track', txId: context?.transaction_id }, 'Incoming ONDC /track request');
    ondcRequestsTotal.inc({ action: 'track', status: 'received' });

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
          ondcRequestsTotal.inc({ action: 'on_track', status: 'success' });
        }
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_track', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error sending on_track');
      }
    });
  }

  /**
   * Handle incoming /cancel
   */
  public static async handleCancel(req: Request, res: Response) {
    const { context, message } = req.body;
    logger.info({ action: 'cancel', txId: context?.transaction_id }, 'Incoming ONDC /cancel request');
    ondcRequestsTotal.inc({ action: 'cancel', status: 'received' });

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
        ondcRequestsTotal.inc({ action: 'on_cancel', status: 'success' });
      } catch (err: any) {
        ondcRequestsTotal.inc({ action: 'on_cancel', status: 'error' });
        logger.error({ err: err.message, txId: context?.transaction_id }, 'Error in handleCancel');
      }
    });
  }
}
