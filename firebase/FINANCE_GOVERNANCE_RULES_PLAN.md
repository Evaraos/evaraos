# Evaraos — Finance + Governance Firestore Expansion Plan

## New Collections Introduced

### Financial
- payouts
- transactions
- invoices
- jobs
- company_split_configs

### Governance
- staff_profiles
- onboarding
- approvals

---

# Recommended Access Structure

## staff_profiles
### Read
- operations+
- owning user
- same company scope

### Write
- operations+

### Delete
- owner/admin only

---

## transactions
### Read
- operations+

### Create
- operations+

### Update
- owner/admin only

### Delete
- disabled or owner-only

---

## payouts
### Read
- operations+
- same company scope

### Create
- operations+

### Update
- operations+

### Delete
- owner/admin only

---

## company_split_configs
### Read
- operations+

### Write
- owner/admin only

---

## invoices
### Read
- operations+
- invoice customer
- same company scope

### Write
- operations+

### Delete
- owner/admin only

---

## jobs
### Read
- operations+
- assigned staff
- customer owner
- same company scope

### Write
- operations+

### Delete
- owner/admin only

---

# Planned Split Models

## platform_vendor
- vendorPercent: 70
- platformPercent: 30

## expansion_partner
- operatorPercent: 50
- platformPercent: 50

---

# Planned Future Engine

## split-engine.js
Centralized split calculations:
- invoices
- payouts
- payroll
- revenue
- referral overrides
- lead commissions
- territory overrides

---

# Planned Future Governance Layer

## company-governance.js
Will control:
- companyType
- splitModel
- payout rules
- hierarchy
- territory ownership
- regional structures
- operator permissions
