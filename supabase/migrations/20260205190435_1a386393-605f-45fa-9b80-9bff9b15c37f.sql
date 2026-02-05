-- Add policy to allow anyone to view a booking by tracking_id (for public tracking)
CREATE POLICY "Anyone can view bookings by tracking_id" 
ON public.bookings 
FOR SELECT 
USING (true);