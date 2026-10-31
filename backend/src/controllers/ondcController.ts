import { Request, Response } from 'express';
import { orderManager } from '../services/orderManager';
import { ondcClient } from '../services/ondcClient';
import { config } from '../config';

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
          deliveryFee: config.commercial.defaultDeliveryFee
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
    const { context } = req.body;
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
        await ondcClient.sendOnInit({
          bapUri: context.bap_uri,
          bapId: context.bap_id,
          transactionId: context.transaction_id,
          messageId: context.message_id,
          deliveryFee: config.commercial.defaultDeliveryFee
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
        const fulfillment = message?.order?.fulfillments?.[0] || {};
        const startLoc = fulfillment?.start?.location || {};
        const endLoc = fulfillment?.end?.location || {};

        const parseGps = (str: string) => {
          if (!str) return { lat: 17.4375, lng: 78.3687 };
          const parts = str.split(',').map(s => parseFloat(s.trim()));
          return { lat: parts[0] || 17.4375, lng: parts[1] || 78.3687 };
        };

        const order = await orderManager.createOrder({
          transactionId: context.transaction_id,
          messageId: context.message_id,
          bapId: context.bap_id,
          bapUri: context.bap_uri,
          pickup: {
            name: startLoc?.address?.name || 'Partner Restaurant (Biryani)',
            phone: fulfillment?.start?.contact?.phone || '+91 99887 76655',
            address: startLoc?.address?.street || 'Food Court, Hitec City, Hyderabad',
            gps: parseGps(startLoc?.gps)
          },
          drop: {
            name: endLoc?.address?.name || 'Customer Delivery',
            phone: fulfillment?.end?.contact?.phone || '+91 98765 43210',
            address: endLoc?.address?.street || 'Kondapur, Hyderabad',
            gps: parseGps(endLoc?.gps)
          },
          items: message?.order?.items?.map((it: any) => ({ name: it.id || it.descriptor?.name || 'Food Item', quantity: 1 })),
          deliveryFee: config.commercial.defaultDeliveryFee
        });

        console.log(`[ONDC Gateway] Created real order ${order.orderId}, assigned rider: ${order.rider?.name || 'Available Riders'}`);
        await ondcClient.sendOnConfirm(order);
      } catch (err: any) {
        console.error('[ONDC Gateway] Error in handleConfirm:', err.message);
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
          await ondcClient.sendOnStatus(order);
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
    const { context } = req.body;
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
        const order = await orderManager.getOrderByTransaction(context.transaction_id);
        if (order) {
          const updated = await orderManager.updateStatus(order.orderId, 'Cancelled');
          if (updated) {
            await ondcClient.sendOnCancel(updated);
          }
        }
      } catch (err: any) {
        console.error('[ONDC Gateway] Error in handleCancel:', err.message);
      }
    });
  }
}
