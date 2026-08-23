-- Allow long staff notes on tuition / finance-head payments
ALTER TABLE `tuition_payments` MODIFY `note` TEXT NULL;
