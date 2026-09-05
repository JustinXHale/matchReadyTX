this is accurate. i just want to create an invoice tracker/type system that user can go in at any point and check who needs to be paid, what they've been paid, how (in dropdown like paypal, zelle), their payment address like what their email or phone number is, etc... i would also want the user to easily be able to checkoff who has been paid. 

as for the invoicing. we invoice the conference per month, so i would want to be able to select a date range, select the amount to invoice per position (for instance though we might be paying refs 100 we invoice for 130)... invoice would need to be itemized per line items, like per game/tournament. when setting up the invoice i would want the user to be able to set universal pricing for positions, and if needed change per line item.  at the end of the invoice i need to be able to set surcharge, and on another line set any discounts. 

Im thinking of something like:

---

Header
Invoice Number: Year-Month
Date of Issue: Generation Date
Due Date: Set by user

Bill to
Who its going to (Lonestar Men or Women)
Email of Bill to

| Date                  | Match - Tier #        | Position(s)           | Cost  | Milage    | Sub- Total        | Grand Total   |
| Friday, Sept. 5, 2026 | TAMU v SHSU - Tier 1  | (1) Match Official    | $130  |           | $130              |   $330        |
|                       |                       | (2) Assistants        | $50   |           | $100              |               |
|                       |                       | (1) CMO               | $100  |           | $100              |               |
|                       |                       |                       |       |           |         Subtotal: |         $230  |
|                       |                       |                       |       |           |         Surcharge:|         10%   |  
|                       |                       |                       |       |           |         Discount: |         $50   |  
|                       |                       |                       |       |           |      GRAND TOTAL: |         $$$   |  