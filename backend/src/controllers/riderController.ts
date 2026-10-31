import { Request, Response } from 'express';
import { riderManager } from '../services/riderManager';
import { orderManager, ONDCFulfillmentState } from '../services/orderManager';
import { ondcClient } from '../services/ondcClient';

export class RiderController {
  public static async getProfile(req: Request, res: Response) {
    try {
      const riderId = (req.query.riderId as string) || 'rider-ralt-001';
      const rider = await riderManager.getRider(riderId);
      if (!rider) {
        return res.status(404).json({ error: 'Rider not found' });
      }
      res.json({ rider });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async toggleOnline(req: Request, res: Response) {
    try {
      const { riderId = 'rider-ralt-001', isOnline } = req.body;
      const rider = await riderManager.toggleOnline(riderId, Boolean(isOnline));
      res.json({ success: true, isOnline: rider?.is_online === 1 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async updateLocation(req: Request, res: Response) {
    try {
      const { riderId = 'rider-ralt-001', lat, lng } = req.body;
      await riderManager.updateLocation(riderId, lat, lng);
      const rider = await riderManager.getRider(riderId);

      // If rider has active order, push track update to ONDC if needed
      if (rider?.current_order_id) {
        const order = await orderManager.getOrder(rider.current_order_id);
        if (order && order.bapUri) {
          ondcClient.sendOnTrack(order, lat, lng).catch(() => {});
        }
      }

      res.json({ success: true, lat, lng });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getActiveOrders(req: Request, res: Response) {
    try {
      const riderId = (req.query.riderId as string) || 'rider-ralt-001';
      const orders = await orderManager.getActiveOrders(riderId);
      res.json({ orders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getAllOrders(req: Request, res: Response) {
    try {
      const orders = await orderManager.getAllOrders(50);
      res.json({ orders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getEarnings(req: Request, res: Response) {
    try {
      const riderId = (req.query.riderId as string) || 'rider-ralt-001';
      const earningsData = await riderManager.getEarnings(riderId);
      res.json(earningsData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { status } = req.body as { status: ONDCFulfillmentState };

      const order = await orderManager.updateStatus(orderId, status);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json({ success: true, order });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async verifyDeliveryOtp(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ success: false, error: 'OTP is required' });
      }

      const result = await orderManager.verifyOtpAndComplete(orderId, otp);
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        message: 'Delivery verified successfully! ₹50 credited.',
        order: result.order
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Endpoint to create real live orders for testing (from Web dashboard or Postman)
   * Dispatches via WebSocket directly to online rider mobile app!
   */
  public static async simulateIncomingOrder(req: Request, res: Response) {
    try {
      const {
        restaurantName = 'Bawarchi Biryani House',
        restaurantAddress = 'Plot 42, Main Road, Gachibowli, Hyderabad',
        customerName = 'Arun Kumar',
        customerPhone = '+91 98765 43210',
        customerAddress = 'Flat 402, Sai Residency, Kondapur, Hyderabad',
        items = [{ name: 'Chicken Dum Biryani', quantity: 2 }, { name: 'Thums Up (750ml)', quantity: 1 }],
        deliveryFee = 50.0
      } = req.body || {};

      const order = await orderManager.createOrder({
        transactionId: `tx-${Date.now()}`,
        messageId: `msg-${Date.now()}`,
        bapId: 'mock-buyer.ondc.org',
        bapUri: 'http://localhost:5000/mock/bap',
        pickup: {
          name: restaurantName,
          phone: '+91 99887 76655',
          address: restaurantAddress,
          gps: { lat: 17.4399, lng: 78.3680 }
        },
        drop: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          gps: { lat: 17.4589, lng: 78.3721 }
        },
        items,
        deliveryFee
      });

      res.json({
        success: true,
        message: 'Real ONDC test order created and dispatched to rider app',
        order
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
