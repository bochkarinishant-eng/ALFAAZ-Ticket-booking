-- Add Razorpay payment tracking columns to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id);
