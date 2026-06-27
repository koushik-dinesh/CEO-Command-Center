-- Repurpose pbt_monthly_inputs.indirectExpense as additional indirect only (exclude HR).
-- Subtract linked HR expense from legacy totals where HR was entered separately.
UPDATE pbt_monthly_inputs p
INNER JOIN hr_expenses h ON h.calendarYear = p.year AND h.month = p.month
SET p.indirectExpense = GREATEST(0, p.indirectExpense - h.hrExpense);
