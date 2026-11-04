# Inventaris API publik Mekari

Sumber: developers.mekari.com/docs/kb/product-api (diakses 4 Nov 2026) yang menautkan koleksi Postman Talenta,
Klikpajak, Qontak CRM, Swagger Jurnal (api-doc.jurnal.id), OpenAPI POS (api-docs-pos.mekari.com), OpenAPI Sign
(api-docs.esign.mekari.com), dan dokumentasi Expense (api-docs.expense.mekari.com). API menunjukkan entitas data dan
aksi yang benar-benar ada di balik layar setiap produk.

## Talenta (Postman: Talenta Data API V2 - MAG HMAC Backend Integration)
### Access Role
- GET /v2/talenta/v2/access-role/:superadminid/  Access Role by User ID
- GET /v2/talenta/v2/company/:company_id/superadmin  Super Admin List
### Attendance
- GET /v2/talenta/v2/attendance/:userId/shift  Attendance Shift
- GET /v2/talenta/v2/attendance/:userId/activities  Attendance Activities
- GET /v2/talenta/v2/attendance/:userId/history-list  Attendance History List
- PUT /v2/talenta/v2/attendance/:user_id/update  Update Attendance
- GET /v2/talenta/v2/attendance/:userId/request-detail  Attendance Request Detail
- GET /v2/talenta/v2/attendance/:userId/approval-list  Attendance Request Index (Approval)
- GET /v2/talenta/v2/attendance/:userId/approval-detail  Attendance Request Detail (Approval)
### Attendance v3
- GET /v2/talenta/v3/attendance/summary-report  Attendance Summary Report
- GET /v2/talenta/v2/attendance/:userId/requests  Attendance Request List
- POST /v2/talenta/v3/attendance/location-settings  Create Location Setting
- PUT /v3/attendance/:id/update  Update Attendance V3
### Cost Center
- GET /v2/talenta/v2/company/:cid/cost-center  Get Company Cost Center
### Cost Center v3
- POST /v2/talenta/v3/cost-center  Post Master Cost Center
- POST /v2/talenta/v3/cost-center-import  Import Master Cost Center
### Company
#### Grade
- GET /v2/company/:company_id/grade  Get Grade
- POST /v2/talenta/v2/company/grade  Create Grade
#### Job Position
- POST /v2/talenta/v2/company/:companyId/job-position  Add Job Position
#### Branch
- POST /v2/talenta/v2/branch  Create Branch
- GET /v2/talenta/v2/company/3620/branch  Get Branch
- GET /v2/talenta/v2/company/branch/:branch_id  Get Branch Detail
#### Organization
- POST /v2/talenta/v2/company/organization  Post Organization
- GET /v2/talenta/v2/company/3620/organization  Get Organization
#### Employment Status
- POST /v2/talenta/v2/company/employment-status  Post Employmemt Status
- GET /v2/talenta/v2/company/me/employment-status  Get Employment Status
#### Job Level
- GET /v2/talenta/v2/company/3620/job-level  Get Job Level
- POST /v2/talenta/v2/company/job-level  Create Job Level
- GET /v2/talenta/v2/company/3620/personal  Get Personal Data
- GET /v2/talenta/v2/company/3620/custom-field  Get Custom Field
- GET /v2/talenta/v2/company/:companyId/consultant  Get Consultant
- GET /v2/talenta/v2/company/:companyId/access-role  Get Access Role
- GET /v2/talenta/v2/company/3620/bank-list  Get Bank List
- GET /v2/talenta/v2/company/:cid/cost-center  Get Cost Center
- GET /v2/talenta/v2/company/:company_id/class  Get Class
- GET /v2/talenta/v2/company/:company_id/info  Get Company Info
- GET /v2/talenta/v2/company/auto-generate  Auto Generate Setting
### Company V3
#### Branch
- GET /v2/talenta/v3/company/branch  List
- GET /v2/talenta/v3/company/branch/:branch_id  Detail
- POST /v2/talenta/v3/company/branch  Create
#### Job Position
- GET /v2/talenta/v3/company/:company_id/job-positions  Get Job Position
#### Class
- POST /v2/talenta/v3/company/class  Create Class
#### Custom Field
- POST /v2/talenta/v3/company/custom-fields/employee  Create Custom Field
- GET /v2/talenta/v3/masterdata/cities  Get Cities
- GET /v2/talenta/v3/masterdata/provinces  Get Provinces
- GET /v2/talenta/v3/company/job-levels  Get Job Levels
### Document Template
- POST /v2/talenta/v3/document-template/:template_id/generate  Create Document Template
### Employee
- GET /v2/talenta/v2/employee/102091  Get Employee By User ID
- GET /v2/employee/:userId/status  Get Employee On Leave Status By ID
- PATCH /v2/talenta/v2/employee/:userID  Patch Employee
- POST /v2/talenta/v2/employee/informal-education/create  Employee Informal Education
- PATCH /v2/talenta/v2/employee/informal-education/:informalEducationId/update  Employee Informal Education
- GET /v2/talenta/v2/employee/informal-education/:userId/list  Employee Informal Education
- GET /v2/talenta/v2/employee/informal-education/:userID/detail/:informalEducationId  Employee Informal Education Detail
- PATCH /v2/talenta/v2/employee/employment-information/:user_id/update  Employment Information
### Employee v3
#### Formal Education
- GET /v2/talenta/v3/employee/formal-education  Get Formal Education
#### Informal Education
- GET /v2/talenta/v3/employee/informal-education  Get Informal Education
- POST /v2/talenta/v3/employee/informal-education  Create Informal Education
- PATCH /employee/informal-education/:id  Patch Employee Informal Education
#### Mass Resign
- POST /v2/talenta/v3/employee/resign  Mass Resign
#### Personal Data
- PATCH /employee/:uid/personal-data  Patch Employee Personal Data
- GET /v2/talenta/v3/employees  Get All Employee
- GET /v2/talenta/v3/employee/additional-info  Get Employee Additional Info
- GET /v2/talenta/v3/employee/employment-info  Get Employment Info
- GET /v2/talenta/v3/employee/family-info  Get Family Info
- GET /v2/talenta/v3/employee/cancel-resign  Get Cancel Resign
- POST /v2/talenta/v3/employee  Add Employee
- PATCH /v2/talenta/v3/employee/employment-information/:user_id/update  Employment Information
### Employee File V3
- GET /v2/talenta/v3/employee-file/categories  Get File Category List
- POST /v2/talenta/v3/employee-file  Upload Employee File
### Employee Transfer v3
- GET /v2/talenta/v3/employee-transfer  Get List
- GET /v2/talenta/v3/employee-transfer/:employee-transfer-id  Get Details
- POST /v2/talenta/v3/employee-transfer  Create
- PATCH /v2/talenta/v3/employee-transfer-approval  Patch Approval
- PATCH /v2/talenta/v3/employee-transfer/:id-employee-transfer/cancel  Cancel
### Fingerprint
- POST /v2/talenta/v2/attendance/import-fingerprint  Attendance Import Fingerprint
### General Ledger v3
- GET /v2/talenta/v3/ledger/report/history  Report History
- GET /v2/talenta/v3/ledger/report/:id  Report Details
- GET /v2/talenta/v3/ledger/:id/report/latest  Latest Report Details
### Live Attendance
- GET /v2/talenta/v2/live-attendance/location  Get User Location for Attendance
- GET /v2/talenta/v2/live-attendance/schedule  Get User Schedule for Attendance
### Live Attendance V3
- GET /v2/talenta/v3/live-attendance  Get User Live Attendance List V3
- POST /v2/talenta/v3/live-attendance  Live Attendance
### Loans
#### Loan Names
- POST /v2/talenta/v2/loans/names  Create loan name
#### Loan Transactions
- GET /v2/talenta/v2/loans  List loan transaction
- GET /v2/talenta/v2/loans/:loan_id  Loan detail
- GET /v2/talenta/v2/loans/:loan-id/details  Loan installment
- POST /v2/talenta/v2/loans  Post Loan Transaction
- PATCH /v2/talenta/v2/loans/:loan_id  Patch Loan Transaction
### Loans v3
- GET /loans/:id/details  Get Loan Installment Details
- POST /v3/loans  Create Loan V3
- GET /v3/loans/:id  Get Loan Detail V3
### Notification v3
- POST /v2/talenta/v3/notifications  Bulk Notification
### Overtime V3
#### Overtime Request v3
- GET /v2/talenta/v3/overtime/request  Get Overtime Request List
- POST /v2/talenta/v3/overtime/request  Create Overtime Request
- POST /v2/talenta/v3/overtime  Create Overtime
- POST /v2/talenta/v3/overtime-planning  Create Overtime Planning
- POST /v2/talenta/v3/overtime/master-overtime  Create Master Overtime
- POST /v2/talenta/v3/time-management/overtime-leave-rules  Create Overtime Leave Rule
### Payroll
- GET /v2/talenta/v2/payroll/tax-report  Get Tax Detail Report
- GET /v2/talenta/v2/company/:cid/payroll-component  Company Payroll Component
- POST /v2/talenta/v2/update-payroll-component  Create Update Payroll Component
- GET /v2/talenta/v2/update-payroll-component/:cid/detail-summary/:trd  Get Update Payroll Component Detail Summary
- GET /v2/talenta/v2/update-payroll-component/:cid/detail-component/:trid  Get Update Payroll Component Detail Component
- GET /v2/talenta/v2/update-payroll-component/:companyId/history  List of Update Payroll Component History
- DELETE /v2/talenta/v2/update-payroll-component/:cid/:trd  Delete Update Payroll Component
- PUT /v2/talenta/v2/update-payroll-component/:cid/:trd  Update Update Payroll Component
### Payroll V3
#### Payroll Component
- POST /v2/talenta/v3/payroll/update-payroll-component  Create-Update Payroll Component transaction
- PUT /v2/talenta/v3/payroll/update-payroll-component  Update-Update Payroll Component transaction
- POST /v2/talenta/v3/payroll/components  Create Payroll Component Settings
- GET /v2/talenta/v3/payroll/report  Get Salary Report
- GET /v2/talenta/v3/payroll  Payroll Info List
- GET /v2/talenta/v3/payroll/info  Get Employee Payroll Info
- POST /v2/talenta/v3/payroll/payslips  Payslips List
- POST /v2/talenta/v3/payroll/payment-schedules  Create Payment Schedule
### Payroll Payment Schedule
- GET /v2/talenta/v2/company/me/payroll-payment-schedule  Company Payroll Payment Schedule
- GET /v2/payroll-payment-schedule/:companyId/history  Payroll Payment Schedule History
### Payroll Payment Schedule v3
- GET /v2/talenta/v3/payroll/payment-schedule  Get Payment Schedule
### Performance Review
#### Goals
##### Individual
- GET /v2/talenta/v2/performance-review/individual-goals  Get List
- GET /v2/talenta/v2/performance-review/individual-goals/:uuid  Get Individual Goal Detail by UUID
- POST /v2/talenta/v2/performance-review/individual-goals  Create Individual Goal
- PATCH /v2/talenta/v2/performance-review/individual-goals/:uuid/update-progress  Update Individual Goal Progress
- PATCH /v2/talenta/v2/performance-review/individual-goals/:uuid/force-update-progress  Force Update Individual Goal Progress
- PUT /v2/talenta/v2/performance-review/individual-goals/:uuid  Edit Individual Goal
- PATCH /v2/talenta/v2/performance-review/individual-goals/:uuid/close  Close Individual Goal
##### Team
- GET /v2/talenta/v2/performance-review/team-goals  Get List
- PATCH /v2/talenta/v2/performance-review/team-goals/:uuid/update-progress  Update Team Goal Progress
- GET /v2/talenta/v2/performance-review/team-goals/:uuid  Get Team Goal Detail by UUID
- POST /v2/talenta/v2/performance-review/team-goals  Create Team Goals
- PUT /v2/talenta/v2/performance-review/team-goals/:uuid  Edit Team Goal
- PATCH /v2/talenta/v2/performance-review/team-goals/:uuid/close  Close Team Goal
### Reimbursement
- GET /v2/talenta/v2/reimbursement/:userId/benefit  Reimbursement Benefit
- GET /v2/talenta/v2/reimbursement/:userId/policy  Reimbursement Policy
- GET /v2/talenta/v2/reimbursement/list  Reimbursement List
- PATCH /v2/talenta/v2/reimbursement/:userId/cancel  Cancel Reimbursement Request
- POST /v2/talenta/v2/reimbursement  Reimbursement Request
- GET /v2/talenta/v2/reimbursement/:userId  Detail Employee Reimbursement Request
- GET /v2/talenta/v2/reimbursement/:userId/history  Get Reimbursement History Index List
- GET /v2/talenta/v2/reimbursement/:userId/approval-list  Get Reimbursement Index Approval
- GET /v2/talenta/v2/reimbursement/:userId/approval-detail  Get Detail Reimbursement Approval
- PATCH /v2/talenta/v2/reimbursement  Patch Approval Reimbursement Request
### Reimbursement v3
- GET /v2/talenta/v3/reimbursement  Get All Reimbursement
- POST /v2/talenta/v3/reimbursement/policies  Create Reimbursment Policies
### Report
- GET /v2/talenta/v2/report/:userId/turnover  Turnover Report
### Reprimand v3
- POST /v2/talenta/v3/reprimand  Create
- GET /v2/talenta/v3/reprimand  List
### Task and Timesheet v3
#### Task
- POST /v2/talenta/v3/task  Create
#### Timesheet
- GET /v2/talenta/v3/timesheet  List
### Time Off
#### Balance Log
- GET /v2/talenta/v3/time-off/balance-log  Get Time Off Balance Log
- GET /v2/talenta/v2/time-off  Get List of Time Off Request
- GET /v2/talenta/v2/time-off/delegation-list  Get Delegation List
- PATCH /v2/talenta/v2/time-off  Update Approval Time Off
- POST /v2/talenta/v2/time-off   Submit Time Off
### Time Off v3
- GET /v2/talenta/v3/time-off/balance-history  Balance History
- GET /v2/talenta/v3/time-off/balance-log  Balance Log
- POST /v2/talenta/v3/time-off/update-balance  Update Balance
- GET /v2/talenta/v3/time-off/employee/:userId/history  Employee's Timeoff History
- GET /v2/talenta/v3/time-off/history/:timeoffID  Timeoff History Detail
- GET /time-off/policies/users/:user_id  Policies By User
- GET /time-off/policies/companies/:company_id  Policies By Company
- GET /time-off/balance-overview  Balance Overview
- PATCH /v2/talenta/v3/time-off/policies/:policy_id  Patch Timeoff Policy
- POST /v2/talenta/v3/time-off/policies  Create Timeoff Policy
### Shift
- GET /v2/talenta/v2/shift/:userId/list  Shift List
- GET /v2/talenta/v2/shift/:userId/requests  Shift Request List
- GET /v2/shift/:userId/request-detail  Shift Request Detail
- POST /v2/talenta/v2/shift  Create New Shift
- PATCH /v2/talenta/v2/shift/:userId/cancel  Cancel Shift Request
- GET /v2/talenta/v2/shift/:userId/approval-list  List of Change Shift Request for Approval
- GET /v2/talenta/v2/shift/:userId/approval-detail  Detail Change Shift Request for Approval
- PATCH /v2/talenta/v2/shift  Approval Change Shift Request
- PATCH /v2/talenta/v2/shift/bulk-approval  Bulk Approval Change Shift Request
- POST /v2/talenta/v2/shift/change-request  Submit Change Shift Request
### Shift v3
- POST /v3/shift  Create Shift V3
### Overtime
- GET /v2/talenta/v2/overtime/:userId/requests  Overtime Request List
- GET /v2/talenta/v2/overtime/:userId/approval-list  Overtime Request Approval List
- GET /v2/talenta/v2/overtime/:userId/approval-detail  Overtime Request Approval Detail
- PATCH /v2/talenta/v2/overtime/:userId/cancel  Cancel Overtime Request
- POST /v2/talenta/v2/overtime  Create overtime request
- GET /v2/talenta/v2/overtime/:userID/request-detail  Overtime request detail
- PATCH /v2/talenta/v2/overtime  Approval Overtime Request
- PATCH /v2/talenta/v2/overtime/bulk-approval  Bulk Approval Overtime Request
### Recruitment
- POST /v2/talenta/v3/recruitment/jobs/bulk-add  Bulk Add Job
- POST /v2/talenta/v3/recruitment/candidates/bulk-add  Bulk Add Candidate
- POST /v2/talenta/v3/recruitment/candidates/upload  Candidate Upload
- GET /v2/talenta/v3/recruitment/jobs  Job List
- GET /v2/talenta/v3/recruitment/jobs/:job_id  Job Detail
- GET /v2/talenta/v3/recruitment/candidates  Candidate List
- GET /v2/talenta/v3/recruitment/candidates/:job_application_id  Candidate Detail
- GET /v2/talenta/v3/recruitment/hiring-stages  Hiring Stages
- GET /v2/talenta/v3/recruitment/reference/provinces  Reference - Provinces
- GET /v2/talenta/v3/recruitment/reference/provinces/:id/cities  Reference - Cities
- GET /v2/talenta/v3/recruitment/reference/educations  Reference - Educations
- GET /v2/talenta/v3/recruitment/reference/degrees  Reference - Degrees
- GET /v2/talenta/v3/recruitment/reference/experience-levels  Reference - Experience Levels
- GET /v2/talenta/v3/recruitment/reference/currencies  Reference - Currencies
- GET /v2/talenta/v3/recruitment/reference/users  Reference - Users
### Schedule v3
- GET /v2/talenta/v3/schedule  Employee Schedule
- POST /v2/talenta/v3/attendance/assign-flexible-schedule  Assign Flexible Schedule
- POST /v2/talenta/v3/attendance/assign-schedule  Assign Schedule
- GET /v2/talenta/v3/schedule/employee  Employee Schedule (Details)
- POST /v2/talenta/v3/schedule/master-schedules  Create Master Schedule
### Form v3
- GET /v2/talenta/v3/form/templates/:id/submissions  Get Form Submission
- GET /v2/talenta/v3/form/templates/:id  Get Form Template Detail
- POST /v2/talenta/v3/form/submission  Create Form Submission
- POST /v2/talenta/v3/form/pre-upload-files  Pre Upload Files
### Asset V3
- GET /v2/talenta/v3/assets  Get Asset List v3
- GET /v2/talenta/v3/assets/:id  Get Asset Detail v3
### ERP
- GET /v2/talenta/v2/erp/entries/business-one  Get Business One ERP Entry List
### Delegation
- GET /v2/talenta/v3/delegations  Delegation List
### SBU V3
- POST /v2/talenta/v3/sbu-groups  Create SBU Group
- POST /v2/talenta/v3/sbu-items  Create SBU Item
- PATCH /v2/talenta/v3/sbu-groups/:id  Edit SBU Group
- PATCH /v2/talenta/v3/sbu-items/:id  Edit SBU Item
- GET /v2/talenta/v3/sbu-groups/:id/sbu-items  GET SBU Item
- GET /v2/talenta/v3/sbu-groups  GET SBU Group
### NPP v3
- GET /v2/talenta/v3/npp  Get NPP
- POST /v2/talenta/v3/npp/npps  Create NPP

Jumlah endpoint: 218

## Klikpajak (Postman: Klikpajak Public API v1)
### E-Faktur API
#### Sales Invoice
##### Bulk Request
- POST /v2/klikpajak/v1/efaktur/out/bulk  Create Bulk Sales Invoice
- POST /v2/klikpajak/v1/efaktur/out/bulk/cancel  Cancel Bulk Sales Invoice
- POST /v2/klikpajak/v1/efaktur/out/bulk/delete  Delete Bulk Sales Invoice Draft
- POST /v2/klikpajak/v1/efaktur/out/bulk/approve  Approve Bulk Sales Invoice Draft
- GET /v2/klikpajak/v1/efaktur/out/bulk/:reqId  Retrieve Bulk Sales Invoice
- POST /v2/klikpajak/v1/efaktur/out/bulk/:reqId/pdf  Generate PDF Bulk Sales Invoice
- GET /v2/klikpajak/v1/efaktur/out/bulk/:reqId/pdf  Retrieve PDF Bulk Sales Invoice
##### Single Request
- POST /v2/klikpajak/v1/efaktur/out  Create Sales Invoice
- PUT /v2/klikpajakdev/v1/efaktur/out/:id/cancel  Cancel Sales Invoice
- GET /v2/klikpajak/v1/efaktur/out/:id  Retrieve Sales Invoice
- PUT /v2/klikpajak/v1/efaktur/out/:id/approve  Approve Sales Invoice Draft
- PUT /v2/klikpajak/v1/efaktur/out/:id  Edit Sales Invoice Draft
- DELETE /v2/klikpajakdev/v1/efaktur/out/:id  Delete Sales Invoice Draft
- POST /v2/klikpajak/v1/efaktur/out/:id/pdf  Generate PDF Sales Invoice
- GET /v2/klikpajak/v1/efaktur/out/:id/pdf  Retrieve PDF Sales Invoice
#### Purchase Invoice
##### Bulk request
- POST /v2/klikpajak/v1/efaktur/in/bulk  Bulk Create Purchase Invoice
- GET /v2/klikpajak/v1/efaktur/in/bulk/:reqId  Bulk Retrieve Purchase Invoice
- POST /v2/klikpajak/v1/efaktur/in/bulk/delete  Bulk Delete Purchase Invoice
- POST /v2/klikpajak/v1/efaktur/in/bulk/approve  Bulk Approve Purchase Invoice
- POST /v2/klikpajak/v1/efaktur/in/bulk/cancel  Bulk Cancel Purchase Invoice
##### Single Request
- POST /v2/klikpajakdev/v1/efaktur/in  Create Purchase Invoice
- PUT /v2/klikpajak/v1/efaktur/in/:id/approve  Approve Purchase Invoice
- GET /v2/klikpajak/v1/efaktur/in/:id  Retrieve Purchase Invoice
- PUT /v2/klikpajak/v1/efaktur/in/:id  Edit Purchase Invoice
- DELETE /v2/klikpajakdev/v1/efaktur/in/10241  Delete Purchase Invoice
- PUT /v2/klikpajak/v1/efaktur/in/:id/cancel  Cancel Purchase Invoice
#### Credit Note
- POST /v2/klikpajak/v1/efaktur/out/return  Create Credit Note
- PUT /v2/klikpajak/v1/efaktur/out/return/:id  Edit Credit Note
- GET /v2/klikpajak/v1/efaktur/out/return/:id  Retrieve Credit Note
- DELETE /v2/klikpajak/v1/efaktur/out/return/:id  Delete Credit Note
- PUT /v2/klikpajak/v1/efaktur/out/return/:id/approve  Approve Credit Note
- PUT /v2/klikpajak/v1/efaktur/out/return/:id/cancel  Cancel Credit Note
#### Debit Note
- POST /v2/klikpajak/v1/efaktur/in/return  Create Debit Note
- PUT /v2/klikpajak/v1/efaktur/in/return/:id  Edit Debit Note
- GET /v2/klikpajak/v1/efaktur/in/return/:id  Retrieve Debit Note
- PUT /v2/klikpajak/v1/efaktur/in/return/:id/approve  Approve Debit Note
- PUT /v2/klikpajak/v1/efaktur/in/return/:id/cancel  Cancel Debit Note
- DELETE /v2/klikpajak/v1/efaktur/in/return/:id  Delete Debit Note
#### Selling Document
##### Bulk Request
- POST /v2/klikpajak/v1/efaktur/docout/bulk  Create Bulk Selling Document
- GET /v2/klikpajak/v1/efaktur/docout/bulk/:reqId  Retrieve Bulk Selling Document
##### Single Request
- POST /v2/klikpajak/v1/efaktur/docout  Create Selling Document
- GET /v2/klikpajak/v1/efaktur/docout/:id  Retrieve Selling Document
- PUT /v2/klikpajak/v1/efaktur/docout/:id/approve  Approve Selling Document
- PUT /v2/klikpajak/v1/efaktur/docout/:id  Edit Selling Document
- PUT /v2/klikpajak/v1/efaktur/docout/:id/cancel  Cancel Selling Document
- DELETE /v2/klikpajakdev/v1/efaktur/docout/234  Delete Selling Document
#### Return Selling Document
- DELETE /v2/klikpajak/v1/efaktur/docout/return/692  Delete Return Selling Document
- POST /v2/klikpajak/v1/efaktur/docout/return  Create Return Selling Document
- PUT /v2/klikpajak/v1/efaktur/docout/return/704  Edit Return Selling Document
- PUT /v2/klikpajak/v1/efaktur/docout/return/704/approve  Approve Return Selling Document
- GET /v2/klikpajak/v1/efaktur/docout/return/704  Retrieve Return Selling Document
- POST /v2/klikpajak/v1/efaktur/docout/return/704/upload  Edit Approved Return Selling Document
#### Purchasing Document
##### Bulk Request
- POST /v2/klikpajak/v1/efaktur/docin/bulk  Create Purchasing Document
- GET /v2/klikpajak/v1/efaktur/docin/bulk/:reqId  Retrieve Bulk Purchasing Document
##### Single Request
- POST /v2/klikpajak/v1/efaktur/docin  Create Purchasing Document
- PUT /v2/klikpajak/v1/efaktur/docin/2541  Edit Purchasing Document
- PUT /v2/klikpajak/v1/efaktur/docin/2542/cancel  Cancel Purchasing Document
- PUT /v2/klikpajak/v1/efaktur/docin/2543/approve  Approve Purchasing Document
- GET /v2/klikpajak/v1/efaktur/docin/2542  Retrieve Purchasing Document
- DELETE /v2/klikpajak/v1/efaktur/docin/2542  Delete Purchasing Document
#### Return Purchasing Document
- POST /v2/klikpajakdev/v1/efaktur/docin/return  Create Return Purchasing Document
- PUT /v2/klikpajakdev/v1/efaktur/docin/return/64  Edit Return Purchasing Document
- GET /v2/klikpajakdev/v1/efaktur/docin/return/1500  Retrieve Return Purchasing Document
- PUT /v2/klikpajakdev/v1/efaktur/docin/return/1500/approve  Approved Return Purchasing Document
- DELETE /v2/klikpajakdev/v1/efaktur/docin/return/5500  Delete Return Purchasing Document
- POST /v2/klikpajakdev/v1/efaktur/docin/return/64/upload  Edit Approved Return Purchasing Document
#### Reconcile Efaktur Out
- POST /v2/klikpajak/v1/efaktur/out/reconcile  Create Reconcile
- GET /v2/klikpajak/v1/efaktur/out/reconcile/1  Retrieve Reconcile
- POST /v2/klikpajak/v1/efaktur/out/reconcile/delete  Delete Reconcile
### Ebupot API
#### Tax Receipt Domestic
##### Bulk Request
- POST /v2/klikpajak/v1/ebupot/domestic/bulk  Bulk Create Tax Receipt Domestic
- GET /v2/klikpajak/v1/ebupot/domestic/bulk/:id  Retrieve Bulk Tax Receipt Domestic
##### Single Request
- POST /v2/klikpajak/v1/ebupot/domestic  Create Tax Receipt Domestic
- PUT /v2/klikpajak/v1/ebupot/domestic/:id  Edit Tax Receipt Domestic
- GET /v2/klikpajak/v1/ebupot/domestic/:id  Retrieve Tax Receipt Domestic
- DELETE /v2/klikpajak/v1/ebupot/domestic/:id  Delete Tax Receipt Domestic
#### Tax Receipt Article 26
##### Single Request
- POST /v2/klikpajak/v1/ebupot/bp26  Create Tax Receipt BP26
- PUT /v2/klikpajak/v1/ebupot/bp26/:bupotId  Edit Tax Receipt BP26
- GET /v2/klikpajak/v1/ebupot/bp26/:bupotId  Retrieve Tax Receipt BP26
- DELETE /v2/klikpajak/v1/ebupot/bp26/:bupotId  Delete Tax Receipt BP26
- POST /v2/klikpajak/v1/ebupot/bp26/:bupotId  Revise Tax Receipt BP26
#### Tax Receipt A1
##### Single Request
- POST /v2/klikpajak/v1/ebupot/bpa1  Create Tax Receipt BPA1
- PUT /v2/klikpajak/v1/ebupot/bpa1/:bupotId  Edit Tax Receipt BPA1
- GET /v2/klikpajak/v1/ebupot/bpa1/:bupotId  Retrieve Tax Receipt BPA1
- DELETE /v2/klikpajak/v1/ebupot/bpa1/:bupotId  Delete Tax Receipt BPA1
- POST /v2/klikpajak/v1/ebupot/bpa1/:bupotId  Revise Tax Receipt BPA1
#### Tax Receipt Article 21
##### Single Request
- POST /v2/klikpajak/v1/ebupot/bp21  Create Tax Receipt BP21
- PUT /v2/klikpajak/v1/ebupot/bp21/:bupotId  Edit Tax Receipt BP21
- GET /v2/klikpajak/v1/ebupot/bp21/:bupotId  Retrieve Tax Receipt BP21
- DELETE /v2/klikpajak/v1/ebupot/bp21/:bupotId  Delete Tax Receipt BP21
- POST /v2/klikpajak/v1/ebupot/bp21/:bupotId  Revise Tax Receipt BP21
#### Tax Receipt MP
##### Single Request
- POST /v2/klikpajak/v1/ebupot/bpmp  Create Tax Receipt BPMP
- PUT /v2/klikpajak/v1/ebupot/bpmp/:bupotId  Edit Tax Receipt BPMP
- GET /v2/klikpajak/v1/ebupot/bpmp/:bupotId  Retrieve Tax Receipt BPMP
- DELETE /v2/klikpajak/v1/ebupot/bpmp/:bupotId  Delete Tax Receipt BPMP
- POST /v2/klikpajak/v1/ebupot/bpmp/:bupotId  Revise Tax Receipt BPMP
#### Tax Receipt A2
##### Single Request
- POST /v2/klikpajak/v1/ebupot/bpa2  Create Tax Receipt BPA2
- PUT /v2/klikpajak/v1/ebupot/bpa2/:bupotId  Edit Tax Receipt BPA2
- GET /v2/klikpajak/v1/ebupot/bpa2/:bupotId  Retrieve Tax Receipt BPA2
- DELETE /v2/klikpajak/v1/ebupot/bpa2/:bupotId  Delete Tax Receipt BPA2
- POST /v2/klikpajak/v1/ebupot/bpa2/:bupotId  Revise Tax Receipt BPA2
### Ebilling API
#### ID Billing
##### Bulk Request
- POST /v2/klikpajak/v1/ebilling/bulk  Create bulk ID Billing
- GET /v2/klikpajak/v1/ebilling/bulk/01f18a7c-bdc4-1ec5-9f71-49010a5e5cda  Retrieve Bulk ID Billing
##### Single Request
- POST /v2/klikpajak/v1/ebilling  Create single idbilling
- GET /v2/klikpajak/v1/ebilling/:ebillingId  Retrieve ID Billing
- POST /v2/klikpajak/v1/ebilling/:ebillingId/send  Send ID Billing Email
### Validate API
#### NPWP
##### Single Request
- GET /v2/klikpajak/v1/npwp/validation  Validate NPWP
- GET /v2/klikpajak/v1/npwp/inquiry  Inquiry NPWP
- GET /v2/klikpajak/v1/npwp/latest  Get Latest NPWP
##### Bulk Request
- POST /v2/klikpajak/v1/npwp/latest/bulk  Bulk Latest NPWP
- GET /v2/klikpajak/v1/npwp/latest/bulk/:requestId  Bulk Retrieve Latest NPWP
- POST /v2/klikpajak/v1/npwp/inquiry/bulk  [UNRELEASED] Bulk Inquiry NPWP
- GET /v2/klikpajak/v1/npwp/inquiry/bulk/:requestId  [UNRELEASED] Bulk Retrieve Inquiry NPWP
### Subscription API
- GET /v2/klikpajak/v1/subscription  Subscription Info

Jumlah endpoint: 113

## Qontak CRM (Postman: Qontak CRM OpenAPI - MAG)
### Contacts
- GET //contacts/info  Get Contact Template
- GET //contacts  Get All Contacts
- GET //contacts  Get All Contacts [date search]
- GET //contacts/:id  Get Single Contact
- GET //contacts/:id/timeline  Get Contact Timeline
- GET //contacts/:id/chat-history  Get Chat History
- POST //contacts  Create Contact
- PUT //contacts/:id  Update Contact
- PUT //contacts/:id/update_owner  Update Contact Owner
- DELETE //contacts/:id  Delete Contact
### Deals
- GET //deals/info  Get Deal Template
- GET //deals  Get All Deal
- GET //deals/:id  Get Single Deal
- GET //deals/:id/timeline  Get Deal Timeline
- GET //deals/:id/stage_history  Get Deal Stage History
- GET //deals/:id/chat-history  Get Chat History
- POST //deals  Create Deal
- PUT //deals/:id  Update Deal
- DELETE //deals/:id  Delete Deal
- GET //deals/:id/real_creator  Get Real Creator
- GET //deals/:id/full-field  Get Full Field
- GET //deals/full-fields  Get All Deals Full Field
- GET //deals/sla  Get Deal SLA
- GET //deals/:id/change_log  Get Deal Change Log
- POST //deals/auto-assign  Auto Assign Deal
- POST //deals/update_attribute  Update Deal Attribute
- GET //deals/channel_integration_room/:channel_integration_room_id  Get By Channel Integration Room Id
- PUT //deals/:id/update_owner  Update Owner
- POST //deals/deal_permission  Deal Permission
### Tasks
- GET //tasks/category  Get Task Category
- POST //tasks/category  Add Task Category
- DELETE //tasks/category/:id  Delete Task Category
- GET //tasks/info  Get Template
- GET //tasks  Get All Tasks
- GET //tasks/:id  Get Task by Id
- POST //tasks  Create Task
- PUT //tasks/:id  Update Task
- DELETE //tasks/:id  Delete Task
### Pipelines
- GET //pipelines  Get All Pipelines
- GET //pipelines/:id/stages  Get Stages from Pipeline
- GET //pipelines/:id  Get Single Pipeline
### Tickets
- GET //tickets  Get All Tickets
- GET //tickets/ticket_pipelines  Get Ticket Pipelines
- GET //tickets/info  Get Template
- POST //tickets  Create Ticket
- GET //tickets/:id  Get Single Ticket
- DELETE //tickets/:id  Delete Ticket
- PUT //tickets/:id  Update Ticket
### Products
- GET //products/info  Get Product Template
- GET //products  Get All Products
- GET //products/:id  Get Product by Id
- POST //products  Create Product
- DELETE //products/:id  Delete Product
- PUT //products/:id  Update Product
### Companies
- GET //companies/info  Get Company Template
- GET //companies  Get All Company
- GET //companies/:id  Get Company by Id
- POST //companies  Create Company
- POST //companies  Create Company novalidate
- PUT //companies/:id  Update Company novalidate
- DELETE //companies/:id  Delete Company
- GET //companies/:id/timeline  Get Timeline
- PUT //companies/:id/update_owner  Update Owner
### Product Association
- GET //products_association/:id  Get Product Association by Id
- GET //products_association  Get All Product Association
- POST //products_association  Create Product Association
- PUT //products_association/:id  Update Product Association
- DELETE //products_association/:id  Delete Product Association
### Notes
- GET //notes  Get All notes
- GET //notes/:id  Get Notes by id
- POST //notes  Create Notes
- PUT //notes/:id  Update Notes
- DELETE //notes/:id  Delete Notes
### Geolocations
- GET //geolocations  Get All Geolocations
- GET //geolocations/:id  Get Geolocations by id
- POST //geolocations  Create Geolocations
- PUT //geolocations/:id  Update Geolocations
### Notifications
- GET //notifications/info  Get Notification Template
- GET //notifications  Get All Notifications
- GET //notifications/:id  Get Notification by id
- PUT //notifications/:id/mark_as_read  Mark as read
- PUT //notifications/mark_all_as_read  Mark all as read
- POST //notifications  Create Notification
### Approvals
- GET //approvals/rules  Get Approval Rules
- POST //approvals/apply_rules  Apply Rules
- POST //approvals/toggle_workflow  Toggle Workflow
### Category Product
- GET //category_products  Get All Category Products
- GET //category_products/:id  Get Single Category Products
- GET //category_products/unique_id_availability  Check Unique ID Availability
- POST //category_products  Create Category Products
- PUT //category_products/:id  Update Category Products
- DELETE //category_products/:id  Delete Category Products
### Sub Category Product
- GET //subcategory_products  Get All Sub Category Products
- GET //subcategory_products/:id  Get Single Sub Category Products
- GET //subcategory_products/unique_id_availability  Check Unique ID Availability
- POST //subcategory_products  Create Sub Category Products
- PUT //subcategory_products/:id  Update Sub Category Products
- DELETE //subcategory_products/:id  Delete Sub Category Products

Jumlah endpoint: 98

## Jurnal (Jurnal API Doc 2.0.0)
### ACCOUNTS
- GET /public/jurnal/api/v1/select2_resources/get_account  Account Resource
- GET /public/jurnal/api/v1/accounts/{id}  Get an Account
- PATCH /public/jurnal/api/v1/accounts/{id}  Update an Account
- DELETE /public/jurnal/api/v1/accounts/{id}  Delete an Account
- GET /public/jurnal/api/v1/accounts/export  Export Accounts
- GET /public/jurnal/api/v1/accounts/{account_id}/bank_statements  Get History of Bank Statements
- GET /public/jurnal/api/v1/accounts  Get List of Accounts
- POST /public/jurnal/api/v1/accounts  Add an Account
- GET /public/jurnal/api/v1/coa_mapping/reset_chart_of_accounts  Check Whether the Chart of Accounts Can Be Reset
- POST /public/jurnal/api/v1/coa_mapping/reset_coa  Reset the Chart of Accounts
### AGED PAYABLES
- GET /public/jurnal/api/v1/aged_payables  Get Aged Payables
### AGED RECEIVABLES
- GET /public/jurnal/api/v1/aged_receivables  Get Aged Receivables
### ASSET
- GET /public/jurnal/api/v1/asset_managements/{id}  Get an Asset Detail
- PATCH /public/jurnal/api/v1/asset_managements/{id}  Update an Asset
- DELETE /public/jurnal/api/v1/asset_managements/{id}  Delete an Asset
- POST /public/jurnal/api/v1/asset_managements  Create an Asset
- GET /public/jurnal/api/v1/asset_managements  Get Active Assets
- GET /public/jurnal/api/v1/asset_managements/depreciation_schedules  Get Depreciation Asset Schedules
- POST /public/jurnal/api/v1/asset_managements/create_dispose/{id}  Dispose an Asset
- POST /public/jurnal/api/v1/asset_managements/depreciate/{id}  Depreciate an Asset
- POST /public/jurnal/api/v1/asset_managements/revert/{id}  Revert a Disposed Asset
- POST /public/jurnal/api/v1/asset_managements/revert_depreciation/{id}  Revert a Depreciation
### ASSET V2
- POST /public/jurnal/api/v2/asset_managements  Create an Asset (V2, multi-dimension)
- GET /public/jurnal/api/v2/asset_managements/{id}  Get an Asset (V2, multi-dimension)
- PATCH /public/jurnal/api/v2/asset_managements/{id}  Update an Asset (V2, multi-dimension)
- GET /public/jurnal/api/v2/imports/assets/template  Get the V2 Asset Import Template URL
- POST /public/jurnal/api/v2/imports/assets/validate  Validate a V2 Asset Import File
- POST /public/jurnal/api/v2/imports/assets/execute  Execute a V2 Asset Import
### BALANCE SHEET
- GET /public/jurnal/api/v1/balance_sheet  Get Balance Sheet Information
- GET /public/jurnal/api/v1/balance_sheet/export  Export Balance Sheet Report
### BANK DEPOSITS
- GET /public/jurnal/api/v1/bank_deposits  Get List of Bank Deposits
- POST /public/jurnal/api/v1/bank_deposits  Add a Bank Deposit
- DELETE /public/jurnal/api/v1/bank_deposits/{id}  Delete a Bank Deposit
- GET /public/jurnal/api/v1/bank_deposits/{id}  Get a Bank Deposit
- PATCH /public/jurnal/api/v1/bank_deposits/{id}  Update a Bank Deposit
- POST /public/jurnal/api/v1/bank_deposits/batch_create  Add Many Bank Deposits
### BANK PARTNERS
- GET /public/jurnal/api/v1/bank_partner  Get Bank Partners
### BANK RECONCILIATION SUMMARY
- GET /public/jurnal/api/v1/bank_reconciliation_summary  Get Bank Reconciliation Summary
- GET /public/jurnal/api/v1/bank_reconciliation_summary/export  Export Bank Reconciliation Summary
### BANK REVALUATION
- GET /public/jurnal/api/v1/bank_revaluation  Get Bank Revaluation
### BANK STATEMENT REPORT
- GET /public/jurnal/api/v1/bank_statement_report  Get Bank Statement Report
- GET /public/jurnal/api/v1/bank_statement_report/export  Export Bank Statement Report
### BANK SUMMARY
- GET /public/jurnal/api/v1/bank_summary  Get Bank Summary
- GET /public/jurnal/api/v1/bank_summary/export  Export Bank Summary
### BANK TRANSFERS
- GET /public/jurnal/api/v1/bank_transfers  Get List of Bank Transfers
- POST /public/jurnal/api/v1/bank_transfers  Add a Bank Transfer
- DELETE /public/jurnal/api/v1/bank_transfers/{id}  Delete a Bank Transfer
- GET /public/jurnal/api/v1/bank_transfers/{id}  Get a Bank Transfer
- PATCH /public/jurnal/api/v1/bank_transfers/{id}  Update a Bank Transfer
- POST /public/jurnal/api/v1/bank_transfers/batch_create  Add Many Bank Transfers
### BANK WITHDRAWALS
- GET /public/jurnal/api/v1/bank_withdrawals  Get List of Bank Withdrawals
- POST /public/jurnal/api/v1/bank_withdrawals  Add a Bank Withdrawal
- DELETE /public/jurnal/api/v1/bank_withdrawals/{id}  Delete a Bank Withdrawal
- GET /public/jurnal/api/v1/bank_withdrawals/{id}  Get a Bank Withdrawal
- PATCH /public/jurnal/api/v1/bank_withdrawals/{id}  Update a Bank Withdrawal
- POST /public/jurnal/api/v1/bank_withdrawals/batch_create  Add Many Bank Withdrawals
### BUDGET MANAGEMENT
- GET /public/jurnal/api/v2/budget_management  Get Budget Management
- POST /public/jurnal/api/v2/budget_management  Create new budget management template
- PATCH /public/jurnal/api/v2/budget_management/{id}  Update budget management template
- DELETE /public/jurnal/api/v2/budget_management/{id}  Delete Budget
### CASH FLOW
- GET /public/jurnal/api/v1/cash_flow  Get Cash Flow Report
- GET /public/jurnal/api/v1/cash_flow/export  Export Cash Flow Report
### CASH FLOW NEW REPORT
- POST /public/jurnal/api/v2/cash_flow  Create cashflow custom layout
- GET /public/jurnal/api/v2/cash_flow  Get cashflow report data
- GET /public/jurnal/api/v2/cash_flow/list_layout  Get List of Layouts
- POST /public/jurnal/api/v2/cash_flow/update_chosen_layout  Update chosen layout
- GET /public/jurnal/api/v2/cash_flow/new  Get default layout value
- GET /public/jurnal/api/v2/cash_flow/{id}  Get chosen cashflow layout value
- PATCH /public/jurnal/api/v2/cash_flow/{id}  Update cashflow custom layout
- DELETE /public/jurnal/api/v2/cash_flow/{id}  Delete custom layout
### CLOSING THE BOOK
- GET /public/jurnal/api/v1/closing_the_books/{closing_the_book_id}/trial_balance  Get CTB Trial Balance
- GET /public/jurnal/api/v1/closing_the_books/{closing_the_book_id}/cash_flow  Get CTB Cash Flow
- GET /public/jurnal/api/v1/closing_the_books/{closing_the_book_id}/balance_sheet  Get CTB Balance Sheet
- GET /public/jurnal/api/v1/closing_the_books/{closing_the_book_id}/profit_loss  Get CTB Profit Loss
- PATCH /public/jurnal/api/v1/closing_the_books/{closing_the_book_id}  Update CTB (Publish CTB only)
### COMPANIES
- GET /public/jurnal/api/v1/companies  Get List of Companies
- POST /public/jurnal/api/v1/companies  Add a Company
- GET /public/jurnal/api/v1/companies/{id}  Get a Company
- PATCH /public/jurnal/api/v1/companies/{id}  Update a Company
- GET /public/jurnal/api/v1/companies/related_companies  Get All Company Relation Based on Owner
- GET /public/jurnal/api/v1/companies/active  Get Current Active Company
- POST /public/jurnal/api/v1/companies/upload_logo  Add Company Logo
- DELETE /public/jurnal/api/v1/companies/remove_logo  Remove Logo
- GET /public/jurnal/api/v1/companies/get_currency  Get Company Currency
### COMPANY TAXES
- GET /public/jurnal/api/v1/company_taxes  Get List of Company Taxes
- POST /public/jurnal/api/v1/company_taxes  Create a Company Tax (single or group)
- GET /public/jurnal/api/v1/company_taxes/new  Supporting Data for the Create Form
- GET /public/jurnal/api/v1/company_taxes/{id}  Get a Company Tax
- PUT /public/jurnal/api/v1/company_taxes/{id}  Update a Company Tax
- DELETE /public/jurnal/api/v1/company_taxes/{id}  Delete a Company Tax
- GET /public/jurnal/api/v1/company_taxes/{id}/edit  Supporting Data for the Edit Form
### CONTACT CUSTOM FIELDS
- GET /public/jurnal/api/v1/contacts/custom_fields  Get Contact Custom Field Definitions
- GET /public/jurnal/api/v1/contacts/{id}/custom_fields  Get Contact Custom Field Values
### CONTACTS
- GET /public/jurnal/api/v1/contact_groups  Get Contact Groups
- POST /public/jurnal/api/v1/contact_groups  Create Contact Group
- GET /public/jurnal/api/v1/table_column_settings  Get Contact's Table Colum Setting
- POST /public/jurnal/api/v1/table_column_settings  Update Column Setting of Contact's Table
- GET /public/jurnal/api/v1/contact_groups/new  Get Create Contact Group Contact
- GET /public/jurnal/api/v1/contacts/new  Get Create Contact Contract
- POST /public/jurnal/api/v1/contacts/{contact_id}/activate  Unarchive Contact
- POST /public/jurnal/api/v1/contacts/{contact_id}/deactivate  Archive Contact
- DELETE /public/jurnal/api/v1/contact_groups/{group_id}  Delete Contact Group
- PATCH /public/jurnal/api/v1/contact_groups/{group_id}  Update Contact Group
- POST /public/jurnal/api/v1/contacts  Create Contact
- GET /public/jurnal/api/v1/contacts  Get Contacts
- GET /public/jurnal/api/v1/contacts/summary  Get Contact Index Summary
- POST /public/jurnal/api/v1/contacts/merge_contacts  Merge Two Contacts
- POST /public/jurnal/api/v1/contacts/add_to_groups  Add Contacts to Group
- GET /public/jurnal/api/v1/contacts/{id}  Get Contact Profile
- DELETE /public/jurnal/api/v1/contacts/{id}  Delete Contact
- PATCH /public/jurnal/api/v1/contacts/{id}  Update Contact
### CONVERSION BALANCE
- POST /public/jurnal/api/v1/conversion_balances  Create Conversion Balance
### CONVERT PRODUCTS
- GET /public/jurnal/api/v1/convert_products/{id}  Get a Convert Product
- DELETE /public/jurnal/api/v1/convert_products/{id}  Delete a Convert Product
- POST /public/jurnal/api/v1/convert_products  Add a Convert Product
- PATCH /public/jurnal/api/v1/convert_product_approval/{id}/approve_rule_based  Approve Convert Product
- GET /public/jurnal/api/v1/convert_products/{transaction_id}/comments  Comment Convert Product
- POST /public/jurnal/api/v1/convert_products/{transaction_id}/comments  Create Comment Stock Adjustment
### CREDIT MEMO
- GET /public/jurnal/api/v1/credit_memos  Get Credit Memo
- POST /public/jurnal/api/v1/credit_memos  Create Credit Memo
- GET /public/jurnal/api/v1/{person_type}/{id}/credit_memos  Get Credit Memo by Person Type
- GET /public/jurnal/api/v1/credit_memos/{id}  Get Selected Credit Memo
- PATCH /public/jurnal/api/v1/credit_memos/{id}  Update Credit Memo
- DELETE /public/jurnal/api/v1/credit_memos/{id}  Delete Credit Memo
- GET /public/jurnal/api/v1/credit_memos/{id}/detail  Get Credit Memo Detail (Edit Page Load)
- GET /public/jurnal/api/v1/credit_memos/{id}/build_credit_memo  Get Credit Memo New Page Prefill
### CURRENCY LISTS
- GET /public/jurnal/api/v1/currency_lists/{id}  Get Currency lists
- PATCH /public/jurnal/api/v1/currency_lists/{id}  Update Currency lists
- DELETE /public/jurnal/api/v1/currency_lists/{id}  Delete Currency lists
- GET /public/jurnal/api/v1/currency_lists  List Currency lists
- POST /public/jurnal/api/v1/currency_lists  Create Currency lists
### CURRENCY RATE
- GET /public/jurnal/api/v1/currency_rates  GET Currency Rate Index
### CUSTOM FIELDS
- GET /public/jurnal/api/v1/transactions/custom_fields  Get Custom Field Definitions for Transaction Type
### CUSTOMER APPLY CREDIT MEMO
- POST /public/jurnal/api/v1/customer_apply_credit_memo  Create Customer Apply Credit Memo
- DELETE /public/jurnal/api/v1/customer_apply_credit_memo/{id}  Delete a Customer Apply Credit Memo
- PATCH /public/jurnal/api/v1/customer_apply_credit_memo/{id}  Update a Customer Apply Credit Memo
- GET /public/jurnal/api/v1/customer_apply_credit_memo/{id}  Get Customer Apply Credit Memo by Id
- GET /public/jurnal/api/v1/customer_apply_credit_memo/{id}/detail  Get Customer Apply Credit Memo Detail (Edit Page Load)
- GET /public/jurnal/api/v1/customer_apply_credit_memo/{id}/build_apply_credit_memo  Get Customer Apply Credit Memo New Page Prefill
- GET /public/jurnal/api/v1/customer_apply_credit_memo/credit_memo_options  Get Selectable Credit Memos for Customer Apply
- GET /public/jurnal/api/v1/customer_apply_credit_memo/apply_targets  Get Unpaid Sales Invoices to Apply Against
### CUSTOMER BALANCE
- GET /public/jurnal/api/v1/customer_balances/export  Export Customer Balance
### CUSTOMER CREDIT MEMO REFUND
- POST /public/jurnal/api/v1/customer_credit_memo_refund  Create Customer Credit Memo Refund
- DELETE /public/jurnal/api/v1/customer_credit_memo_refund/{id}  Delete a Customer Credit Memo Refund
- PATCH /public/jurnal/api/v1/customer_credit_memo_refund/{id}  Update a Customer Credit Memo Refund
- GET /public/jurnal/api/v1/customer_credit_memo_refund/{id}  Get Customer Credit Memo Refund by Id
- GET /public/jurnal/api/v1/customer_credit_memo_refund/{id}/detail  Get Customer Credit Memo Refund Detail (Edit Page Load)
- GET /public/jurnal/api/v1/customer_credit_memo_refund/{id}/build_credit_memo_refund  Get Customer Credit Memo Refund New Page Prefill
- GET /public/jurnal/api/v1/customer_credit_memo_refund/credit_memo_options  Get Selectable Source Memos for Customer Refund
### CUSTOMERS
- GET /public/jurnal/api/v1/customers  Get List of Customers
- POST /public/jurnal/api/v1/customers  Add a Customer
- GET /public/jurnal/api/v1/customers/{id}  Get a Customer
- PATCH /public/jurnal/api/v1/customers/{id}  Update a Customer
- DELETE /public/jurnal/api/v1/customers/{id}  Delete a Customer
- POST /public/jurnal/api/v1/customers/batch_create  Add Many Customers
- GET /public/jurnal/api/v1/customers/new  Get Default Input for Customer
- GET /public/jurnal/api/v1/customers/export  Export customers
### DEBIT MEMO
- GET /public/jurnal/api/v1/debit_memos  Get Debit Memo
- POST /public/jurnal/api/v1/debit_memos  Create a Debit Memo
- GET /public/jurnal/api/v1/debit_memos/{id}  Get a Debit Memo
- PATCH /public/jurnal/api/v1/debit_memos/{id}  Update a Debit Memo
- DELETE /public/jurnal/api/v1/debit_memos/{id}  Delete a Debit Memo
- GET /public/jurnal/api/v1/debit_memos/{id}/detail  Get Debit Memo Detail (Edit Page Load)
- GET /public/jurnal/api/v1/debit_memos/{id}/build_debit_memo  Get Debit Memo New Page Prefill
### DIMENSIONAL PROFIT LOSS
- POST /public/jurnal/api/v1/reporting_service_export/dimensional_profit_loss  Export Dimensional (Cost & Profit Center) P&L Report
### EXECUTIVE SUMMARY
- GET /public/jurnal/api/v1/executive_summary  Get Executive Summary
- GET /public/jurnal/api/v1/executive_summary/export  Export Executive Summary
### EXPENSES
- DELETE /public/jurnal/api/v1/expenses/{id}  Delete an Expense
- GET /public/jurnal/api/v1/expenses/{id}  Get an Expense
- PATCH /public/jurnal/api/v1/expenses/{id}  Update an Expense
- GET /public/jurnal/api/v1/expenses  Get List of Expenses
- POST /public/jurnal/api/v1/expenses  Add an Expense
- GET /public/jurnal/api/v1/select2_resources/get_unpaid_expense  Unpaid Expense
- GET /public/jurnal/api/v1/expenses/{id}/bank_withdrawals  Get List of Payments from Expense
- GET /public/jurnal/api/v1/expenses/classification_suggestion  Get Suggested Classifications for an Expense Line
- POST /public/jurnal/api/v1/expenses/batch_create  Add Many Expenses
- GET /public/jurnal/api/v1/expense_details  Get Expense Details Report
- GET /public/jurnal/api/v1/expense_details/export  Export Expense Details Report
### FEATURES LIST
- GET /public/jurnal/api/v1/features/en  Get Features List (English)
- GET /public/jurnal/api/v1/features/id  Get Features List (Bahasa)
### FIXED ASSET
- GET /public/jurnal/api/v1/fixed_asset_summary  Get Fixed Asset Summary Report
### FOREIGN EXCHANGE GAIN LOSS
- GET /public/jurnal/api/v1/foreign_exchange_gain_loss  Get Foreign Exchange Gain Loss
- GET /public/jurnal/api/v1/foreign_exchange_gain_loss/export  Export Foreign Exchange Gain Loss
### GENERAL LEDGER
- GET /public/jurnal/api/v1/general_ledger  Get General Ledger Report
- GET /public/jurnal/api/v1/general_ledger/export  Export General Ledger
- POST /public/jurnal/api/v1/reporting_service_export/dimensional_general_ledger  Export Multidimensional General Ledger
### GET OTHER
- GET /public/jurnal/api/v1/select2_resources/get_other  Unit, Warehouse, Tax & Payment Method
### IMPORTS
- POST /public/jurnal/api/v1/imports/expense  Upload an Expense Import File
- POST /public/jurnal/api/v1/imports/general_journal  Upload a General Journal Import File
- GET /public/jurnal/api/v1/imports/import_background_validation  Enqueue an Uploaded Import for Processing
### INVENTORY DETAIL
- GET /public/jurnal/api/v1/inventory_detail  Get Inventory Detail
- GET /public/jurnal/api/v1/inventory_detail/export  Export Inventory Detail
### INVENTORY SUMMARY
- GET /public/jurnal/api/v1/inventory_summary  Get Inventory Summary
- GET /public/jurnal/api/v1/inventory_summary/export  Export Inventory Summary
### INVENTORY VALUATION
- GET /public/jurnal/api/v1/inventory_valuation  Get Inventory Valuation
- GET /public/jurnal/api/v1/inventory_valuation/export  Export Inventory Valuation
### JOURNAL ENTRIES
- GET /public/jurnal/api/v1/journal_entries  Get List of Journal Entries
- POST /public/jurnal/api/v1/journal_entries  Add a Journal Entry
- DELETE /public/jurnal/api/v1/journal_entries/{id}  Delete a Journal Entry
- GET /public/jurnal/api/v1/journal_entries/{id}  Get a Journal Entry
- PATCH /public/jurnal/api/v1/journal_entries/{id}  Update a Journal Entry
- POST /public/jurnal/api/v1/journal_entries/batch_create  Add Many Journal Entries
### MERGED INVOICES
- GET /public/jurnal/api/v1/merged_invoices  Get List of Merged Invoices
- POST /public/jurnal/api/v1/merged_invoices  Add a Merged Invoice
- GET /public/jurnal/api/v1/merged_invoices/{id}  Get a Merged Invoice
- PATCH /public/jurnal/api/v1/merged_invoices/{id}  Update a Merged Invoice
- DELETE /public/jurnal/api/v1/merged_invoices/{id}  Delete a Merged Invoice
### MULTICURRENCY
- GET /public/jurnal/api/v2/multi_currencies/find  Find Multi-Currency Rate
- POST /public/jurnal/api/v2/multi_currencies  Create Multi-Currency Rate
### PAYMENT METHOD
- GET /public/jurnal/api/v1/payment_methods  Get List of Payment Methods
- POST /public/jurnal/api/v1/payment_methods  Add a Payment Method
- GET /public/jurnal/api/v1/payment_methods/{id}  Get a Payment Method
- PATCH /public/jurnal/api/v1/payment_methods/{id}  Update a Payment Method
- DELETE /public/jurnal/api/v1/payment_methods/{id}  Delete a Payment Method
### PERSONS
- GET /public/jurnal/api/v1/select2_resources/get_person  Person Resource
### PRO FORMA ORDERS
- GET /public/jurnal/api/v1/pro_forma_orders  List Pro Forma Orders
- POST /public/jurnal/api/v1/pro_forma_orders  Add a Pro Forma Order
- GET /public/jurnal/api/v1/pro_forma_orders/{id}  Get a Pro Forma Order
- PATCH /public/jurnal/api/v1/pro_forma_orders/{id}  Update a Pro Forma Order
- DELETE /public/jurnal/api/v1/pro_forma_orders/{id}  Delete a Pro Forma Order
- GET /public/jurnal/api/v1/pro_forma_orders/{id}/custom_fields  Get Custom Fields for a Pro Forma Order
### PRODUCT CATEGORIES
- POST /public/jurnal/api/v1/product_categories  Add a Product Category
- GET /public/jurnal/api/v1/product_categories  Get List of Product Categories
- GET /public/jurnal/api/v1/product_categories/{id}  Get a Product Category
- PATCH /public/jurnal/api/v1/product_categories/{id}  Update a Product Category
- DELETE /public/jurnal/api/v1/product_categories/{id}  Delete a Product Category
### PRODUCT UNIT
- GET /public/jurnal/api/v1/product_units  Get List of Product Unit
- POST /public/jurnal/api/v1/product_units  Create a Product Unit
- GET /public/jurnal/api/v1/product_units/{id}  Get Selected Product Unit
- DELETE /public/jurnal/api/v1/product_units/{id}  Delete a Product Unit
### PRODUCTS
- GET /public/jurnal/api/v1/select2_resources/get_product  Product Resource
- GET /public/jurnal/api/v1/products  Get List of Products
- POST /public/jurnal/api/v1/products  Add a Product
- GET /public/jurnal/api/v1/products/{id}/unit_conversions  Get Unit Conversion by Product Id
- GET /public/jurnal/api/v1/products/{id}  Get a Product
- PATCH /public/jurnal/api/v1/products/{id}  Update a Product
- DELETE /public/jurnal/api/v1/products/{id}  Delete a Product
- POST /public/jurnal/api/v1/products/{id}/upload_product_image  Upload Product Image
- POST /public/jurnal/api/v1/products/batch_create  Add Many Products
- DELETE /public/jurnal/api/v1/products/{id}/remove_product_image  Remove Product Image
- POST /public/jurnal/api/v1/products/{product_id}/activate  Unarchive Product
- POST /public/jurnal/api/v1/products/{product_id}/deactivate  Archive Product
- GET /public/jurnal/api/v1/products/new  Get Default Input for Product
- GET /public/jurnal/api/v1/products/export  Export Products
### PROFIT & LOSS
- GET /public/jurnal/api/v1/profit_and_loss  Get Profit Lost Information
### PROFIT & LOSS BUDGETING
- GET /public/jurnal/api/v2/profit_loss_budgeting  Get Profit Loss Budgeting Information
### PROFIT AND LOSS
- GET /public/jurnal/api/v1/profit_and_loss/export  Export Profit Loss Report
### PROFORMA INVOICES
- GET /public/jurnal/api/v1/proforma_invoices  List Proforma Invoices
- POST /public/jurnal/api/v1/proforma_invoices  Add a Proforma Invoice
- GET /public/jurnal/api/v1/proforma_invoices/{id}  Get a Proforma Invoice
- PATCH /public/jurnal/api/v1/proforma_invoices/{id}  Update a Proforma Invoice
- DELETE /public/jurnal/api/v1/proforma_invoices/{id}  Delete a Proforma Invoice
- GET /public/jurnal/api/v1/proforma_invoices/{id}/custom_fields  Get Custom Fields for a Proforma Invoice
### PURCHASE DELIVERIES
- GET /public/jurnal/api/v1/purchase_deliveries/{id}/custom_fields  Get Custom Fields for a Purchase Delivery
### PURCHASE DELIVERY
- GET /public/jurnal/api/v1/purchase_deliveries  Get List of Purchase Deliveries
- POST /public/jurnal/api/v1/purchase_deliveries  Add a Purchase Delivery
- GET /public/jurnal/api/v1/purchase_deliveries/{id}  Get a Purchase Delivery
- PATCH /public/jurnal/api/v1/purchase_deliveries/{id}  Update a Purchase Delivery
- DELETE /public/jurnal/api/v1/purchase_deliveries/{id}  Delete a Purchase Delivery
- POST /public/jurnal/api/v1/purchase_deliveries/{id}/convert_to_invoice  Convert to Purchase Invoice
- POST /public/jurnal/api/v1/purchase_deliveries/print_pdf  Print Purchase Delivery PDF
- GET /public/jurnal/api/v1/purchase_delivery_reports  Get Purchases By Product Report
- GET /public/jurnal/api/v1/purchase_delivery_reports/export  Export Purchases By Product Report
### PURCHASE INVOICES
- GET /public/jurnal/api/v1/purchase_invoices  Get List of Purchase Invoices
- POST /public/jurnal/api/v1/purchase_invoices  Add a Purchase Invoice
- DELETE /public/jurnal/api/v1/purchase_invoices/{id}  Delete a Purchase invoice
- GET /public/jurnal/api/v1/purchase_invoices/{id}  Get a Purchase Invoice
- PATCH /public/jurnal/api/v1/purchase_invoices/{id}  Update a Purchase Invoice
- GET /public/jurnal/api/v1/purchase_invoices/{id}/purchase_payments  Get List of Payments from Purchase Invoice
- POST /public/jurnal/api/v1/purchase_invoices/batch_create  Add Many Purchase Invoices
- GET /public/jurnal/api/v1/purchase_invoices/{id}/register_tiny_url  Get an Purchase Invoice Link
- GET /public/jurnal/api/v1/purchase_invoices/{id}/custom_fields  Get Custom Fields for a Purchase Invoice
### PURCHASE MERGED INVOICES
- GET /public/jurnal/api/v1/purchase_merged_invoices  Get List of Purchase Merged Invoices
- POST /public/jurnal/api/v1/purchase_merged_invoices  Add a Purchase Merged Invoice
- GET /public/jurnal/api/v1/purchase_merged_invoices/{id}  Get a Purchase Merged Invoice
- PATCH /public/jurnal/api/v1/purchase_merged_invoices/{id}  Update a Purchase Merged Invoice
- DELETE /public/jurnal/api/v1/purchase_merged_invoices/{id}  Delete a Purchase Merged Invoice
### PURCHASE ORDER PAYMENT
- GET /public/jurnal/api/v1/purchase_order_payments  Get List of Purchase Order Payment
- POST /public/jurnal/api/v1/purchase_order_payments  Create a Purchase Order Payment
- GET /public/jurnal/api/v1/purchase_order_payments/{id}  Get a Purchase Order Payment
- PATCH /public/jurnal/api/v1/purchase_order_payments/{id}  Update a Purchase Order Payment
- DELETE /public/jurnal/api/v1/purchase_order_payments/{id}  Delete a Purchase Order Payment
- POST /public/jurnal/api/v1/purchase_order_payments/batch_create  Add Many Purchase Order Payment
### PURCHASE ORDERS
- GET /public/jurnal/api/v1/purchase_orders  Get List of Purchase Orders
- POST /public/jurnal/api/v1/purchase_orders  Add a Purchase Order
- DELETE /public/jurnal/api/v1/purchase_orders/{id}  Delete a Purchase Order
- GET /public/jurnal/api/v1/purchase_orders/{id}  Get a Purchase Order
- PATCH /public/jurnal/api/v1/purchase_orders/{id}  Update a Purchase Orders
- GET /public/jurnal/api/v1/purchase_orders/{id}/invoices_history  Get Invoices History List
- GET /public/jurnal/api/v1/purchase_orders/{id}/purchase_order_payments  Get Purchase Order Payments
- GET /public/jurnal/api/v1/purchase_orders/{id}/history  Get History Transation
- POST /public/jurnal/api/v1/purchase_orders/batch_create  Add Many Purchase Orders
- POST /public/jurnal/api/v1/purchase_orders/{id}/convert_to_invoice  Convert to Purchase Invoice
- POST /public/jurnal/api/v1/purchase_orders/{id}/convert_to_delivery  Convert to Purchase Delivery
- POST /public/jurnal/api/v1/purchase_orders/{id}/close_order  Close Purchase Order
- GET /public/jurnal/api/v1/purchase_orders/{id}/custom_fields  Get Custom Fields for a Purchase Order
### PURCHASE PAYMENTS
- GET /public/jurnal/api/v1/purchase_payments  Get List of Purchase Payment
- POST /public/jurnal/api/v1/purchase_payments  Create a Purchase Payment
- GET /public/jurnal/api/v1/purchase_payments/{id}  Get a Purchase Payment
- PATCH /public/jurnal/api/v1/purchase_payments/{id}  Update a Purchase Payment
- DELETE /public/jurnal/api/v1/purchase_payments/{id}  Delete a Purchase Payment
- POST /public/jurnal/api/v1/purchase_payments/batch_create  Add Many Purchase Payments
### PURCHASE QUOTE
- GET /public/jurnal/api/v1/purchase_quotes  Get List of Purchase Quotes
- POST /public/jurnal/api/v1/purchase_quotes  Create a Purchase Quote
- PATCH /public/jurnal/api/v1/purchase_quotes/{id}  Update a Purchase Quote
- DELETE /public/jurnal/api/v1/purchase_quotes/{id}  Delete a Purchase Quote
- GET /public/jurnal/api/v1/purchase_quotes/{id}  Get a Purchase Quote
- POST /public/jurnal/api/v1/purchase_quotes/batch_create  Add Many Purchase Quotes
- POST /public/jurnal/api/v1/purchase_quotes/{id}/convert_to_order  Convert to Purchase Order
- POST /public/jurnal/api/v1/purchase_quotes/{id}/convert_to_invoice  Convert to Purchase Invoice
### PURCHASE QUOTES
- GET /public/jurnal/api/v1/purchase_quotes/{id}/custom_fields  Get Custom Fields for a Purchase Quote
### PURCHASE REQUESTS
- GET /public/jurnal/api/v1/purchase_requests  List Purchase Requests
- POST /public/jurnal/api/v1/purchase_requests  Add a Purchase Request
- GET /public/jurnal/api/v1/purchase_requests/{id}  Get a Purchase Request
- PATCH /public/jurnal/api/v1/purchase_requests/{id}  Update a Purchase Request
- DELETE /public/jurnal/api/v1/purchase_requests/{id}  Delete a Purchase Request
- GET /public/jurnal/api/v1/purchase_requests/{id}/custom_fields  Get Custom Fields for a Purchase Request
### PURCHASE RETURNS
- GET /public/jurnal/api/v1/purchase_returns  Get List of Purchase Returns
- POST /public/jurnal/api/v1/purchase_returns  Create a Purchase Return
- DELETE /public/jurnal/api/v1/purchase_returns/{id}  Delete a Purchase Return
- GET /public/jurnal/api/v1/purchase_returns/{id}  Get a Purchase Return
- PATCH /public/jurnal/api/v1/purchase_returns/{id}  Update a Purchase Return
- GET /public/jurnal/api/v1/purchase_returns/{id}/custom_fields  Get Custom Fields for a Purchase Return
### REALISED CURRENCY GAIN LOSS
- GET /public/jurnal/api/v1/realised_currency_gain_loss  Get Realised Currency Gain Loss
- GET /public/jurnal/api/v1/realised_currency_gain_loss/export  Export Realised Currency Gain Loss
### RECEIVE PAYMENTS
- GET /public/jurnal/api/v1/receive_payments  Get List of Receive Payments
- POST /public/jurnal/api/v1/receive_payments  Add a Receive Payment
- DELETE /public/jurnal/api/v1/receive_payments/{id}  Delete a Receive Payment
- GET /public/jurnal/api/v1/receive_payments/{id}  Get a Receive Payment
- PATCH /public/jurnal/api/v1/receive_payments/{id}  Update a Receive Payment
- POST /public/jurnal/api/v1/receive_payments/batch_create  Add Many Receive Payments
### REPORT LAYOUT
- GET /public/jurnal/api/v1/report_layouts  Get Report Layout
- POST /public/jurnal/api/v1/report_layouts  Create Report Layout
- PUT /public/jurnal/api/v1/report_layouts  Update Report Layout
- PATCH /public/jurnal/api/v1/report_layouts  Patch Report Layout
- DELETE /public/jurnal/api/v1/report_layouts/{id}  Delete Report Layout
- GET /public/jurnal/api/v1/report_layouts/{id}  Get Column By Transaction Type Id
- GET /public/jurnal/api/v1/{report_type_id}/report_layouts  Get All Report Type in Specified Report Type Id
### REPORTS
- GET /public/jurnal/api/v2/journal_reports  Get Journal Report
### SALES BY CUSTOMERS
- GET /public/jurnal/api/v1/sales_by_customers/export  Export Sales By Customers
- GET /public/jurnal/api/v1/sales_by_customers  Get Sales Report By Customers
### SALES BY PRODUCT
- GET /public/jurnal/api/v1/sales_by_products  Get Sales Report by Product (General)
- GET /public/jurnal/api/v1/sales_by_products/export  Export Sales By Product
### SALES DELIVERIES
- GET /public/jurnal/api/v1/sales_deliveries/{id}/custom_fields  Get Custom Fields for a Sales Delivery
### SALES DELIVERY
- POST /public/jurnal/api/v1/sales_deliveries  Add a Sales Delivery
- GET /public/jurnal/api/v1/sales_deliveries  Get List of Sales Deliveries
- GET /public/jurnal/api/v1/sales_deliveries/{id}  Get a Sales Delivery
- PATCH /public/jurnal/api/v1/sales_deliveries/{id}  Update a  Sales Delivery
- DELETE /public/jurnal/api/v1/sales_deliveries/{id}  Delete a Sales Delivery
- POST /public/jurnal/api/v1/sales_deliveries/{id}/convert_to_invoice  Convert to Sales Invoice
- POST /public/jurnal/api/v1/sales_deliveries/print_pdf  Print Sales Delivery PDF
- GET /public/jurnal/api/v1/sales_delivery_reports/export  Export Sales Delivery Reports
### SALES INVOICES
- GET /public/jurnal/api/v1/sales_invoices  Get List of Sales Invoices
- POST /public/jurnal/api/v1/sales_invoices  Add a Sales Invoice
- DELETE /public/jurnal/api/v1/sales_invoices/{id}  Delete a Sales Invoice
- GET /public/jurnal/api/v1/sales_invoices/{id}  Get a Sales Invoice
- PATCH /public/jurnal/api/v1/sales_invoices/{id}  Update a Sales Invoice
- POST /public/jurnal/api/v1/sales_invoices/batch_create  Add Many Sales Invoices
- GET /public/jurnal/api/v1/sales_invoices/{id}/register_tiny_url  Get an Invoice Link
- GET /public/jurnal/api/v1/sales_invoices/{id}/receive_payments  Get List of Payments from Sales Invoice
- GET /public/jurnal/api/v1/sales_invoices/{id}/custom_fields  Get Custom Fields for a Sales Invoice
### SALES LISTS
- GET /public/jurnal/api/v1/sales_lists  Get Sales List Report
- GET /public/jurnal/api/v1/sales_lists/export  Export Sales List
### SALES ORDER PAYMENT
- GET /public/jurnal/api/v1/sales_order_payments  Get List of Sales Order Payments
- POST /public/jurnal/api/v1/sales_order_payments  Create a Sales Order Payment
- GET /public/jurnal/api/v1/sales_order_payments/{id}  Get a Sales Order Payment
- PATCH /public/jurnal/api/v1/sales_order_payments/{id}  Update a Sales Order Payment
- DELETE /public/jurnal/api/v1/sales_order_payments/{id}  Delete a Sales Order Payment
- POST /public/jurnal/api/v1/sales_order_payments/batch_create  Add Many Sales Order Payments
### SALES ORDERS
- GET /public/jurnal/api/v1/sales_orders  Get List of Sales Orders
- POST /public/jurnal/api/v1/sales_orders  Add a Sales Order
- DELETE /public/jurnal/api/v1/sales_orders/{id}  Delete a Sales Order
- GET /public/jurnal/api/v1/sales_orders/{id}  Get a Sales Order
- PATCH /public/jurnal/api/v1/sales_orders/{id}  Update a Sales Order
- GET /public/jurnal/api/v1/sales_orders/{id}/invoices_history  Get Invoices History List
- GET /public/jurnal/api/v1/sales_orders/{id}/sales_order_payments  Get Sales Order Payments
- GET /public/jurnal/api/v1/sales_orders/{id}/history  Get History Transaction
- POST /public/jurnal/api/v1/sales_orders/batch_create  Add Many Sales Orders
- POST /public/jurnal/api/v1/sales_orders/{id}/convert_to_invoice  Convert to Sales Invoice
- POST /public/jurnal/api/v1/sales_orders/{id}/convert_to_delivery  Convert to Sales Delivery
- POST /public/jurnal/api/v1/sales_orders/{id}/close_order  Close Sales Order
- GET /public/jurnal/api/v1/sales_orders/{id}/custom_fields  Get Custom Fields for a Sales Order
### SALES QUOTE
- GET /public/jurnal/api/v1/sales_quotes  Get List of Sales Quotes
- POST /public/jurnal/api/v1/sales_quotes  Add a Sales Quote
- POST /public/jurnal/api/v1/sales_quotes/batch_create  Add Many Sales Quotes
- POST /public/jurnal/api/v1/sales_quotes/{id}/convert_to_invoice  Convert to Sales Invoice
- POST /public/jurnal/api/v1/sales_quotes/{id}/convert_to_order  Convert to Sales Order
- GET /public/jurnal/api/v1/sales_quotes/{id}  Get Sales Quote
- PATCH /public/jurnal/api/v1/sales_quotes/{id}  Update a Sales Quote
- DELETE /public/jurnal/api/v1/sales_quotes/{id}  Delete a Sales Quote
### SALES QUOTES
- GET /public/jurnal/api/v1/sales_quotes/{id}/custom_fields  Get Custom Fields for a Sales Quote
### SALES RETURNS
- GET /public/jurnal/api/v1/sales_returns  Get List of Sales Returns
- POST /public/jurnal/api/v1/sales_returns  Add a Sales Return
- DELETE /public/jurnal/api/v1/sales_returns/{id}  Delete a Sales Return
- GET /public/jurnal/api/v1/sales_returns/{id}  Get a Sales Return
- PATCH /public/jurnal/api/v1/sales_returns/{id}  Update a Sales Return
- GET /public/jurnal/api/v1/sales_returns/{id}/custom_fields  Get Custom Fields for a Sales Return
### STATEMENT OF CHANGE IN EQUITY
- GET /public/jurnal/api/v1/statement_of_change_in_equity  Get Statement of Change in Equity Report
- GET /public/jurnal/api/v1/statement_of_change_in_equity/export  Export Statement of Change in Equity
### STOCK ADJUSTMENT
- GET /public/jurnal/api/v1/stock_adjustments  Get List of Stock Adjustments
- POST /public/jurnal/api/v1/stock_adjustments  Add a Stock Adjustment
- GET /public/jurnal/api/v1/stock_adjustment_approval/approval_list?page=1&page_size=25&keyword=  Get List of Stock Adjustment Need Approval
- GET /public/jurnal/api/v1/stock_adjustment_approval/approval_total  Get List of Stock Adjustment Total data Need approval
- PATCH /public/jurnal/api/v1/stock_adjustment_approval/{id}/approve_rule_based  Approve Stock Adjustment
- GET /public/jurnal/api/v1/stock_adjustments/{transaction_id}/comments  Comment Stock Adjustment
- POST /public/jurnal/api/v1/stock_adjustments/{transaction_id}/comments  Create Comment Stock Adjustment
- GET /public/jurnal/api/v1/stock_adjustments/new  Get List of New Stock Adjustment Line Products
- GET /public/jurnal/api/v1/stock_adjustments/check_existing_stock_adjustments  Get existing stock adjustment by date
- GET /public/jurnal/api/v1/stock_adjustments/{id}  Get a Stock Adjustment
- PATCH /public/jurnal/api/v1/stock_adjustments/{id}  Update a Stock Adjustment
- DELETE /public/jurnal/api/v1/stock_adjustments/{id}  Delete a Stock Adjustment
### STOCK ADJUSTMENT ACCOUNT
- GET /public/jurnal/api/v1/select2_resources/get_stock_adjustment_account  Stock Adjustment Accounts
### STOCK ADJUSTMENT TYPE
- GET /public/jurnal/api/v1/select2_resources/get_stock_adjustment_type  Stock Adjustments Type
### TAXES
- GET /public/jurnal/api/v1/select2_resources/get_tax  Tax Resource
- GET /public/jurnal/api/v1/taxes  Get List of Taxes
- POST /public/jurnal/api/v1/taxes  Add Tax with Witholding
- GET /public/jurnal/api/v1/taxes/{id}  Get a Single Tax
- PATCH /public/jurnal/api/v1/taxes/{id}  Update a Single Tax
- DELETE /public/jurnal/api/v1/taxes/{id}  Delete a Tax
### TERM
- GET /public/jurnal/api/v1/select2_resources/get_term  Term Resources
- GET /public/jurnal/api/v1/terms  Get List of Terms
- POST /public/jurnal/api/v1/terms  Add a Term
- GET /public/jurnal/api/v1/terms/{id}  Get a Term
- DELETE /public/jurnal/api/v1/terms/{id}  Delete a Term
### TRANSACTION PDF
- POST /public/jurnal/api/v1/transaction_pdfs/send_email  Email Transaction PDF
- POST /public/jurnal/api/v1/transaction_pdfs/export  Export to PDF
### TRANSACTION QUOTA
- POST /public/jurnal/companies/request_quota  companies request_quota
- GET /public/jurnal/sales_invoices/quota  sales_invoices quota
- GET /public/jurnal/sales_invoices/quota_histories  sales_invoices quota_histories
- GET /public/jurnal/sales_invoices/quota_summary  sales_invoices quota_summary
### TRANSACTION TAG
- GET /public/jurnal/api/v1/select2_resources/get_taggings  Tag Resources
- GET /public/jurnal/api/v1/tags  Get List of Transaction Tags
- POST /public/jurnal/api/v1/tags  Add a Transaction Tag
- GET /public/jurnal/api/v1/tags/{id}  Get a Transaction Tag
- PATCH /public/jurnal/api/v1/tags/{id}  Update a Transaction Tag
- DELETE /public/jurnal/api/v1/tags/{id}  Delete a Transaction  Tag
### TRANSACTIONS
- GET /public/jurnal/api/v1/select2_resources/get_transaction  Transaction Resource
- GET /public/jurnal/api/v1/recurring_schedules/new  Get Recurring Schedule
- POST /public/jurnal/api/v1/recurring_schedules  Set Recurring Schecule for Transaction
### TRIAL BALANCE
- GET /public/jurnal/api/v1/trial_balance  Get Trial Balance Report
- GET /public/jurnal/api/v1/trial_balance/export  Export Trial Balance
### UNIT CONVERTIONS
- GET /public/jurnal/api/v1/unit_conversions  Get List of Unit Conversions
- POST /public/jurnal/api/v1/unit_conversions  Add a Unit Conversion
- GET /public/jurnal/api/v1/unit_conversions/{id}  Get a Unit Conversion
- PATCH /public/jurnal/api/v1/unit_conversions/{id}  Update a Unit Conversion
- DELETE /public/jurnal/api/v1/unit_conversions/{id}  Delete a Unit Conversion
### UNREALISED CURRENCY GAIN LOSS
- GET /public/jurnal/api/v1/unrealised_currency_gain_loss  Get Unrealised Currency Gain Loss
- GET /public/jurnal/api/v1/unrealised_currency_gain_loss/export  Export Unrealised Currency Gain Loss
- GET /public/jurnal/api/v1/unrealised_gain_lost/get_amount  Get Amount From Unrealised Currency Gain Lost
### USER
- GET /public/jurnal/api/v1/users  Get List of Users
- GET /public/jurnal/api/v1/users/{id}  Get a User
- PATCH /public/jurnal/api/v1/users/{id}  Update a User
- DELETE /public/jurnal/api/v1/users/{id}  Delete a user
- GET /public/jurnal/api/v1/users/me  Get Current User
### USER ACCOUNT
- GET /public/jurnal/api/v1/user_account/profile  Get User Account Profile
### VENDOR APPLY CREDIT MEMO
- POST /public/jurnal/api/v1/vendor_apply_credit_memo  Create Vendor Apply Credit Memo
- DELETE /public/jurnal/api/v1/vendor_apply_credit_memo/{id}  Delete a Vendor Apply Credit Memo
- GET /public/jurnal/api/v1/vendor_apply_credit_memo/{id}  Get Vendor Apply Credit Memo by Id
- PATCH /public/jurnal/api/v1/vendor_apply_credit_memo/{id}  Update a Vendor Apply Credit Memo
- GET /public/jurnal/api/v1/vendor_apply_credit_memo/{id}/detail  Get Vendor Apply Credit Memo Detail (Edit Page Load)
- GET /public/jurnal/api/v1/vendor_apply_credit_memo/{id}/build_apply_credit_memo  Get Vendor Apply Credit Memo New Page Prefill
- GET /public/jurnal/api/v1/vendor_apply_credit_memo/credit_memo_options  Get Selectable Debit Memos for Vendor Apply
- GET /public/jurnal/api/v1/vendor_apply_credit_memo/apply_targets  Get Unpaid Purchase Bills to Apply Against
### VENDOR CREDIT MEMO REFUND
- POST /public/jurnal/api/v1/vendor_credit_memo_refund  Create Vendor Credit Memo Refund
- GET /public/jurnal/api/v1/vendor_credit_memo_refund/{id}  Get Vendor Credit Memo Refund by Id
- DELETE /public/jurnal/api/v1/vendor_credit_memo_refund/{id}  Delete a Vendor Credit Memo Refund
- PATCH /public/jurnal/api/v1/vendor_credit_memo_refund/{id}  Update a Vendor Credit Memo Refund
- GET /public/jurnal/api/v1/vendor_credit_memo_refund/{id}/detail  Get Vendor Credit Memo Refund Detail (Edit Page Load)
- GET /public/jurnal/api/v1/vendor_credit_memo_refund/{id}/build_credit_memo_refund  Get Vendor Credit Memo Refund New Page Prefill
- GET /public/jurnal/api/v1/vendor_credit_memo_refund/credit_memo_options  Get Selectable Source Memos for Vendor Refund
### VENDORS
- POST /public/jurnal/api/v1/vendors  Add a Vendor
- GET /public/jurnal/api/v1/vendors  Get List of Vendors
- PATCH /public/jurnal/api/v1/vendors/{id}  Update a Vendor
- DELETE /public/jurnal/api/v1/vendors/{id}  Delete a Vendor
- GET /public/jurnal/api/v1/vendors/{id}  Get a Vendor
- GET /public/jurnal/api/v1/vendors/new  Get Default Input for Vendor
- GET /public/jurnal/api/v1/vendors/export  Export vendors
- POST /public/jurnal/api/v1/vendors/batch_create  Add Many Vendors
### WAREHOUSE
- GET /public/jurnal/api/v1/warehouses  Get List of Warehouses
- POST /public/jurnal/api/v1/warehouses  Add a Warehouse
- GET /public/jurnal/api/v1/warehouses/{id}  Get a Warehouse
- PATCH /public/jurnal/api/v1/warehouses/{id}  Update a Warehouse
- DELETE /public/jurnal/api/v1/warehouses/{id}  Delete a Warehouse
### WAREHOUSE ITEM VALUATION
- GET /public/jurnal/api/v1/warehouse_item_valuation  Get Warehouse Item Valuation
- GET /public/jurnal/api/v1/warehouse_item_valuation/export  Export Warehouse Item Valuation
### WAREHOUSE ITEMS STOCK MOVEMENT
- GET /public/jurnal/api/v1/warehouse_items_stock_movement_summary  Get Warehouse Items Stock Movement Summary
- GET /public/jurnal/api/v1/warehouse_items_stock_movement_summary/export  Export Warehouse Item Stock Movement Summary
### WAREHOUSE STOCK QUANTITY
- GET /public/jurnal/api/v1/warehouse_stock_quantity  Get Warehouse Stock Quantity
- GET /public/jurnal/api/v1/warehouse_stock_quantity/export  Export Warehouse Stock Quantity
### WAREHOUSE TRANSFER
- POST /public/jurnal/api/v1/warehouse_transfers  Add a Warehouse Transfer
- GET /public/jurnal/api/v1/warehouse_transfers  Get List of Warehouse Transfers
- GET /public/jurnal/api/v1/warehouse_transfer_approval/approval_list?page=1&page_size=25&keyword=  Get List of Warehouse Transfers Need Approval
- GET /public/jurnal/api/v1/warehouse_transfer_approval/approval_total  Get List of Warehouse Transfers Total data Need approval
- PATCH /public/jurnal/api/v1/warehouse_transfer_approval/{id}/approve_rule_based  Approve Warehouse Transfers
- GET /public/jurnal/api/v1/warehouse_transfers/{transaction_id}/comments  Comment Warehouse Transfers
- POST /public/jurnal/api/v1/warehouse_transfers/{transaction_id}/comments  Create Comment Warehouse Transfers
- DELETE /public/jurnal/api/v1/warehouse_transfers/{id}  Delete a Warehouse Transfer
- GET /public/jurnal/api/v1/warehouse_transfers/{id}  Get a Warehouse Transfer
### [SCM] BATCH
- GET /public/jurnal/scm/public/lo/v1/batches  Retrieve batches
- GET /public/jurnal/scm/public/lo/v1/batches/{id}  Retrieve a batch
- DELETE /public/jurnal/scm/public/lo/v1/batches/{id}/unit_conversion  Delete batch unit conversion
- GET /public/jurnal/scm/public/lo/v1/batches/{id}/unit_conversion  Retrieve batch unit conversion
- PUT /public/jurnal/scm/public/lo/v1/batches/{id}/unit_conversion  Create or update batch unit conversion
### [SCM] INVENTORY
- POST /public/jurnal/scm/public/lo/v1/inventories/get_secondary_quantities  Retrieve warehouse secondary quantities
### [SCM] PRODUCT
- POST /public/jurnal/scm/public/lo/v1/products/check_quantities  Validate product line quantities
- GET /public/jurnal/scm/public/lo/v1/products/get_product_quantity_per_warehouse  Retrieve product quantities by warehouse
- GET /public/jurnal/scm/public/lo/v1/products/minified  Retrieve a minified list of products
### [SCM] PRODUCT UNIT
- GET /public/jurnal/scm/public/lo/v1/product_units  Retrieve a list of Product Units
- DELETE /public/jurnal/scm/public/lo/v1/product_units/{id}  Delete a product unit by ID in the current company
- GET /public/jurnal/scm/public/lo/v1/product_units/{id}  Retrieve Product Unit specified id in the current company
- PUT /public/jurnal/scm/public/lo/v1/product_units/{id}  Update a product unit by ID
### [SCM] STORAGE
- GET /public/jurnal/scm/public/lo/v1/storages  Retrieve a list of storages
### [SCM] WAREHOUSE TRANSFER
- POST /public/jurnal/scm/public/lo/v1/warehouse_transfer/validate_lines  Validate warehouse transfer lines

Jumlah endpoint: 513

## Mekari POS (Mekari POS Public API 2.0.0)
### Approvals
- GET /approvals/eligible-approvers  List who can approve
- POST /approvals/pin  Verify a manager PIN
- POST /approvals/otp  Send an approval OTP
- POST /approvals/otp/verify  Verify an approval OTP
### Categories
- GET /categories  List product categories
- POST /categories  Create a product category
### Collections
- GET /collections  List product collections
- POST /collections  Create a product collection
- GET /collections/{id}  Get a product collection
- PATCH /collections/{id}  Update a product collection
- DELETE /collections/{id}  Delete a product collection
### Customers
- GET /customers  List customers
- POST /customers  Create a customer
- GET /customers/{id}  Get a customer
- PATCH /customers/{id}  Update a customer
- PUT /customers/{id}/points  Set a customer's points balance
### Exchanges
- POST /exchanges/quote  Quote an exchange
- GET /exchanges  List exchanges
- POST /exchanges  Create an exchange
- GET /exchanges/{exchange_id}  Get an exchange
### Inventory
- GET /inventory/stock/{item_type}/{item_id}  Get the stock of one item
- GET /inventory/movements  List stock movements
- POST /inventory/adjustments  Adjust stock
- PUT /inventory/snapshots/{item_type}/{item_id}  Set item stock to an exact quantity
### Order source
- GET /order-source  Get the order source
- PUT /order-source  Set the order source
### Orders
- GET /orders  List orders
- POST /orders  Create a paid order
- GET /orders/{id}  Get an order
### Outlets
- GET /outlets  List outlets
### Payment methods
- GET /payment-methods  List payment methods
### Products
- GET /products  List products
- POST /products  Create a product
- GET /products/{id}  Get a product
- PATCH /products/{id}  Update a product
- DELETE /products/{id}  Delete a product
- PATCH /products/{id}/status  Change a product's selling status
### Promotions
- GET /promotions  List promotions
- GET /promotions/{id}  Get a promotion
### Raw materials
- GET /raw-materials  List raw materials
- GET /raw-materials/{id}  Get a raw material
### Recipes
- GET /recipes  List recipes
- GET /recipes/{id}  Get a recipe
### Refunds
- GET /refunds  List refunds
- POST /refunds  Create a refund
- GET /refunds/{refund_id}  Get a refund
### Returns
- GET /returns  List returns
- POST /returns  Create a return
- GET /returns/{return_id}  Get a return
- POST /returns/quote  Quote a return
### Shifts
- GET /shifts  List open shifts
### Users
- GET /users  List staff
### Vouchers
- GET /vouchers/{code}  Check a voucher code
### Webhooks
- GET /webhooks/endpoints  List webhook endpoints
- PUT /webhooks/endpoints/orders  Set the orders webhook endpoint
- PUT /webhooks/endpoints/products  Set the products webhook endpoint
- PUT /webhooks/endpoints/collections  Set the collections webhook endpoint
- PUT /webhooks/endpoints/inventory  Set the inventory webhook endpoint
- DELETE /webhooks/endpoints/{key}  Delete a webhook endpoint
- POST /webhooks/endpoints/{key}/rotate-secret  Rotate a webhook signing secret
- POST /webhooks/endpoints/{key}/test  Send a test webhook
### Entitas (skema) dan kolomnya
- ApprovalGrant: approval_token, approver_id, approver_name, order_id, expires_at, method, cancellation_types
- ApprovalOtpRequest: approver_id, order_id, cancellation_types, gate_reason
- ApprovalOtpSent: request_id, approver_id, expires_at, resend_after, sends_used, sends_max
- ApprovalOtpVerifyRequest: request_id, code
- ApprovalPinRequest: pin, approver_id, order_id, cancellation_types, gate_reason
- Attachment: filename, content_type, size_bytes, url
- Category: id, parent_id, name, depth, path
- CategoryItem: id, parent_id, name, depth
- Collection: id, parent_id, name, depth, sort_order
- CreateProduct: name, category_id, collection_id, outlet_ids, attachments, variant_groups, variants
- CreateProductVariant: sku, barcode, variant_values, price, cost, attachment
- Customer: member_tier_id, member_tier_name, origin_outlet_id
- CustomerDetail: points_balance, store_credit
- CustomerSummary: id, name, phone, email, card_number, birthday, address, notes, created_at, updated_at
- EligibleApprover: approver_id, name, role_caption, can_receive_otp, otp_unavailable_reason
- EligibleApprovers: is_enabled, policy, cancellation_types, approvers
- EligibleRefundTender: payment_method_id, payment_method_name, paid_amount, refunded_amount, refundable, reason, settlement_document_numbers
- Envelope: status, code, message, meta
- ErrorEnvelope: status, code, message, data, meta
- Exchange: id, outlet_id, document_number, order_id, replacement_order_id, currency, reason, note, return_total, tip_refund_amount, replacement_total, delta_amount, variance_amount, refund_amount, delta_payment_method_name, approver_id, cashier_id, created_at, lines
- ExchangeCreateRequest: order_id, reason, note, approval_token, returned_lines, replacement_lines, service_fees, excluded_service_fee_category_ids, tenders, expected_payment_fee
- ExchangeLine: id, leg, line_type, variant_id, sku, product_name, variant_name, quantity, unit_price, option_total, total, order_line_id, option_selections
- ExchangeOptionSelection: group_type, group_id, group_name, option_id, option_name, unit_price, extended_amount
- ExchangeQuote: return_total, tip_refund_amount, replacement_subtotal, tax, service_fee, service_fee_lines, replacement_total, delta_amount, variance_amount, refund_amount, payment_fee, grand_total
- ExchangeQuoteRequest: order_id, returned_lines, replacement_lines, service_fees, excluded_service_fee_category_ids, tenders
- ExchangeReplacementLine: variant_id, sku, product_name, quantity, manual_price, modifiers, preferences
- ExchangeTenderInput: payment_method_id, amount, reference
- ImageInput: url
- InventoryAdjustment: id, item_type, item_id, sku, system_quantity, delta, quantity
- InventoryMovement: id, item_type, item_id, sku, delta, type, occurred_at
- InventoryStock: item_type, item_id, sku, name, quantity, unit
- Order: id, outlet_id, document_number, status, sales_type, currency, subtotal, line_discount, order_discount, tax, service_fee, payment_fee, rounding, total, sold_at, created_at, lines, tenders, source, external_order_id, kitchen_order_id, kitchen_status, payment_status, amount_owed
- OrderDetail: member, updated_at
- OrderLine: id, line_type, variant_id, sku, product_name, variant_name, image_url, quantity, unit_price, discount, total
- OrderMember: id, name, email, phone, address, member_tier_id, member_tier_name
- OrderSource: source_code, display_name, created_at, updated_at
- OrderSourceRequest: source_code, display_name
- OrderTender: payment_method_id, payment_method_name, amount, payment_fee, reference
- Outlet: id, name, address, timezone
- PartnerOrderLine: variant_id, sku, product_name, quantity, modifiers, preferences, note, manual_price, discount
- PartnerOrderRequest: external_order_id, external_ordered_at, sales_type, accepted_type, member_id, voucher_code, lines, order_discount, tenders, expected_total
- PartnerOrderTender: payment_method_id, amount, reference
- PaymentMethod: id, name, type
- Product: id, name, status, category_id, collection_id, outlet_ids, attachments, variants, variant_groups
- ProductVariant: variant_id, sku, barcode, variant_values, price, cost, attachment
- Promotion: id, name, type, status, starts_at, ends_at, customer_group, member_tier_ids, outlet_ids, min_purchase, per_customer_limit, quota_type, quota, used_count, created_at, updated_at
- PromotionDetail: config, products, gwp_rules, collections
- PromotionProduct: product_id, product_name, variants
- RawMaterial: id, name, sku, barcode, category_name, unit, status, created_at, updated_at
- Recipe: id, name, status, line_count, created_at, updated_at
- RecipeDetail: lines
- RecipeLine: raw_material_id, raw_material_name, quantity, unit
- Refund: id, outlet_id, document_number, order_id, currency, refund_amount, tip_refund_amount, reason, note, approver_id, cashier_id, created_at, refund_tenders, is_full_refund
- RefundCreateRequest: order_id, refund_amount, reason, note, refund_tenders, approval_token
- RefundTenderInput: payment_method_id, amount, reference
- Return: id, outlet_id, document_number, order_id, reason, currency, refund_amount, payment_fee, cashier_id, approver_id, created_at, lines, refund_tenders
- ReturnCreateRequest: order_id, reason, note, refund_tenders, approval_token, lines
- ReturnLine: order_line_id, line_type, variant_id, sku, product_name, quantity, refund_amount
- ReturnLineInput: order_line_id, quantity
- ReturnQuote: refund_amount, refund_rounding, payment_fee, tip_refund_amount, is_full_return, is_full_refund, lines, eligible_refund_tenders, suggested_refund_tenders
- ReturnQuoteLine: order_line_id, sku, quantity, refund_amount
- ReturnQuoteRequest: order_id, refund_tenders, lines
- ReturnTender: payment_method_id, payment_method_name, amount, reference
- SelectedOption: group_id, option_id
- ServiceFeeLine: fee_category_id, fee_category_name, amount, tax_position
- ServiceFeeSelection: fee_category_id, fee_option_id
- Shift: id, outlet_id, cashier_id, cashier_name, opened_at, opening_float
- SuggestedRefundTender: payment_method_id, amount
- UpdateProduct: name, collection_id, outlet_ids, attachments, variant_groups, variants
- UpdateProductStatus: status
- UpdateProductVariant: variant_id, sku, barcode, variant_values, price, cost, attachment
- UpsertCollectionsWebhookEndpoint: url, events, payload
- UpsertInventoryWebhookEndpoint: url, events, payload
- UpsertOrdersWebhookEndpoint: url, events, payload
- UpsertProductsWebhookEndpoint: url, events, payload
- User: id, name, role, outlet_ids
- VariantGroup: name, values
- VariantGroupInput: name, values
- VariantValue: group_name, value
- VariantValueInput: group_name, value
- Voucher: valid, reason, promotion_id, name, discount_type, discount_pct, discount_amount, restrictions
- WebhookAvailabilityData: product_id, variant_id, available
- WebhookCollectionData: collection_id
- WebhookEndpoint: key, url, events, payload, status, consecutive_failures, active_key_version, created_at, updated_at, secret
- WebhookEvent: id, type, schema_version, occurred_at, company_id, outlet_id, data
- WebhookKitchenData: order_id, kitchen_order_id, kitchen_status, sales_type, updated_at
- WebhookOrderData: order_id, return_id, refund_id, exchange_id, status, sales_type, source, points_earned, points_redeemed, payment_status, amount_owed, updated_at
- WebhookProductData: product_id
- WebhookSecret: secret, key_version
- WebhookSkuData: product_id, variant_id, sku
- WebhookTestResult: delivered, http_status, error

Jumlah endpoint: 61

## Mekari Sign (Mekari Sign API v1)
### Account
- GET /v1/company_aliases  List company aliases
- GET /v1/company_users  List company users
- GET /v1/envelope_types  List document types
- GET /v1/profile  Get your profile and quota
### Approval forms
- GET /v1/approval/forms  List approval forms
- GET /v1/approval/forms/{id}  Get an approval form
- POST /v1/approval/forms/{id}/submit  Submit an approval form
- GET /v1/approval/workflows  List approval workflows
### Approval requests
- POST /v1/approvals/{id}/approve  Approve an approval request
- POST /v1/approvals/{id}/cancel  Cancel an approval request
- DELETE /v1/approvals/{id}  Delete an approval request
- GET /v1/approvals/{id}  Get an approval request
- GET /v1/approvals/{id}/download  Download an approval request
- GET /v1/approvals  List approvals
- POST /v1/approvals/message  Create a message approval
- POST /v1/approvals/{id}/reject  Reject an approval request
- GET /v1/approvals/{id}/status  Get the status of an approval request
### Auto sign
- POST /v1/auto_sign  Create auto signs
- GET /v1/auto_sign  List auto signs
- DELETE /v1/auto_sign/{id}  Delete an auto sign
- GET /v1/auto_sign/{id}  Get an auto sign
- PUT /v1/auto_sign/{id}  Update an auto sign
### Document approvals
- POST /v1/documents/{id}/approvals/approve  Approve a document
- POST /v1/documents/{id}/approvals/cancel  Cancel a document approval
- POST /v1/documents/{id}/approvals/reject  Reject a document
### Documents
- POST /v1/documents/bulk_download  Download several documents as a zip
- DELETE /v1/documents/{id}/delete  Move a document to the trash
- DELETE /v1/documents/{id}  Delete a document from the trash
- GET /v1/documents/{id}  Get document
- GET /v1/documents/{id}/download  Download a document
- GET /v1/documents  List documents
- DELETE /v1/documents/{id}/purge  Permanently delete a document
- POST /v1/documents/{id}/resend  Resend the signing invitation
- POST /v1/documents/{id}/void  Void a document
### E-meterai
- POST /v1/documents/{id}/retry_stamping  Retry e-meterai stamping
- POST /v1/documents/stamp  Stamp e-meterai on a document
### Folders
- GET /v1/folders/{id}/documents  List documents in a folder
- GET /v1/folders  List folders
### In-app signing
- POST /v2/documents/request_global_sign  Send a document to sign in your app
- POST /v2/documents/request_psre_sign  Send a PSrE document to sign in your app
- POST /v2/documents/request_otp_sign  Send a signing code to a signer
- POST /v2/documents/validate_otp/{signer_id}  Check a signing code
- POST /v2/documents/resend_confirmation_to_sign  Resend the signing confirmation email
- POST /v2/documents/signing  Sign a document in your app
- POST /v2/documents/signing_with_confirmation  Sign after the signer confirms by email
### PSrE auto sign
- POST /v1/psre_auto_sign/activate  Start PSrE auto sign activation
- GET /v1/psre_auto_sign/auth_sessions  List PSrE auto sign sessions
- GET /v1/psre_auto_sign/expiry_list  List PSrE auto sign expiry dates
- POST /v1/psre_auto_sign/request_psre_auto_sign  Send a PSrE document with auto sign
- POST /v1/psre_auto_sign/retry_auto_sign  Retry PSrE auto sign
### PSrE signing
- POST /v1/documents/bulk_sign  Sign several documents at once
- POST /v1/documents/{id}/generate_signing_url  Generate signing URLs
- POST /v1/documents/request_psre_sign  Send a PSrE document for signature
- POST /v1/documents/request_psre_sign_only  Send a PSrE document for signature without e-meterai
- POST /v1/documents/request_psre_sign_preview  Preview where PSrE signatures will be placed
- POST /v1/documents/sync_psre_document_status  Sync the PSrE signing status of a document
### Send for signature
- POST /v1/documents/request_global_sign  Send a document for signature
- POST /v1/documents/request_global_sign_multiple  Merge several files into one document and send it
- POST /v1/documents/request_global_sign_only  Send a document for signature without e-meterai
- POST /v1/documents/request_global_sign_preview  Preview where signatures will be placed
- POST /v1/documents/predict_annotations  Suggest where fields go in a PDF
### Template auto sign
- POST /v1/auto_sign_template  Create template auto signs
- GET /v1/auto_sign_template  List template auto signs
- DELETE /v1/auto_sign_template/{id}  Delete a template auto sign
- GET /v1/auto_sign_template/{id}  Get a template auto sign
- PUT /v1/auto_sign_template/{id}  Update a template auto sign
- POST /v1/documents/request_global_auto_sign  Send a document from an auto-sign template
### Templates
- POST /v1/templates/{id}/create_document  Send a document from a template
- GET /v1/templates/{id}/get_fields  Get the fields to fill for a template
- GET /v1/templates  List templates
### eKYC
- POST /v1/ekyc_request  Invite a person to eKYC
- GET /v1/ekyc_request  List eKYC requests
### Entitas (skema) dan kolomnya
- AnnotationInput: type_of, page, position_x, position_y, element_width, element_height, canvas_width, canvas_height, meterai_provided, auto_fields, signature_type
- AnnotationPredictionResult: data, status, error
- ApprovalAction: data
- ApprovalFormDetail: data
- ApprovalFormList: data, meta
- ApprovalFormQuestion: id, type, label, required, description, options, meta
- ApprovalFormSubmission: data
- ApprovalFormSummary: id, type, attributes
- ApprovalList: data, meta
- ApprovalRequestDetail: data
- ApprovalRequestStatus: data
- ApprovalStatusSummary: data
- ApprovalSummary: id, type, attributes
- ApprovalWorkflowList: data, meta
- AutoSignCollection: data
- AutoSignItem: data
- AutoSignList: data, pagination
- AutoSignResource: id, type, attributes
- AutoSignTemplateCollection: data
- AutoSignTemplateItem: data
- AutoSignTemplateList: data, pagination
- AutoSignTemplateResource: id, type, attributes
- BulkSign: data
- CompanyAliasList: data, pagination
- CompanyUserList: data, pagination
- Document: data
- DocumentAttachmentInput: file_base64, content_type, require_review
- DocumentDeadline: signing_deadline, days_reminder_after_received, recurring_reminder
- DocumentList: data, pagination
- DocumentResource: id, type, attributes
- DocumentResourceV2: id, type, attributes
- DocumentV2: data
- DocumentValidity: date_start, date_end, recurring_reminder, days_reminder_before_ended, duration_reminder_unit, duration_reminder_value, doc_maker_notification
- EmptyErrorResponse: data, status, error
- ErrorCodeMessage: code, message
- ErrorMessage: message
- FolderList: data
- FolderNode: id, name, path, created_by, childs
- GlobalSignMultipleRequest: docs, filename, signing_order, signers, receivers, callback_url, redirect_url_after_sign, type_of_meterai, is_signature_without_frame, disable_download, is_login_required, track_as_contract, qr_code_audit_trail, document_deadline, document_validity, scheduled_at, envelope_type_id, folder_id, approval_workflow_id
- GlobalSignRequest: doc, template_id, filename, signing_order, signers, receivers, callback_url, redirect_url_after_sign, type_of_meterai, is_signature_without_frame, disable_download, is_login_required, track_as_contract, qr_code_audit_trail, document_deadline, document_validity, scheduled_at, envelope_type_id, folder_id, approval_workflow_id, attachments, attachments_send_via_email
- GlobalSignRequestV2: doc, template_id, filename, signers, receivers, callback_url, redirect_url_after_sign, type_of_meterai, is_signature_without_frame, is_login_required, track_as_contract, qr_code_audit_trail, document_deadline, document_validity, envelope_type_id, folder_id
- KycItem: data
- KycList: data, pagination
- KycResource: id, type, attributes
- MessageResponse: data, status, error
- MeteraiQuotaError: data, status, error
- OtpLinkResponse: data, status, error
- Pagination: current_page, previous, next, per_page, total_pages, count
- PhoneNumberInput: number, country_code
- PlacementInput: page, position_x, position_y, element_width, element_height, canvas_width, canvas_height
- Profile: data
- PsreAutoSignActivation: data, status, error
- PsreAutoSignAuthSessionList: success, message, data, pagination
- PsreAutoSignExpiryList: data, status, error
- PsreAutoSignRequest: template_id, doc, filename, signers, receivers, callback_url, folder_id, is_signature_without_frame, reformat_document, signing_url
- PsreAutoSignSignerInput: name, email, is_autosign, company_alias_id, annotations
- PsreSignRequest: doc, template_id, filename, signing_order, signers, receivers, callback_url, redirect_url_after_sign, type_of_meterai, is_signature_without_frame, track_as_contract, qr_code_audit_trail, document_deadline, document_validity, scheduled_at, envelope_type_id, folder_id, approval_workflow_id, attachments, attachments_send_via_email, signing_url
- PsreSignRequestV2: doc, template_id, filename, signing_order, signers, receivers, callback_url, redirect_url_after_sign, type_of_meterai, is_signature_without_frame, track_as_contract, qr_code_audit_trail, document_deadline, document_validity, scheduled_at, envelope_type_id, folder_id
- PsreSignerInput: name, email, annotations, phone_number
- PsreSigningLink: data, status, error
- PsreSigningStatus: data
- QuotaInsufficientError: data
- ReceiverInput: name, email, phone_number
- RecipientSummary: name, email, order
- SignaturePlacement: signer_index, type_of, page, rect, page_size
- SignaturePreviewResponse: data
- Signer: name, email, order, status, signed_at, signing_url, is_autosign, phone, passcode, otp_channel
- SignerInput: name, email, order, annotations, phone_number, passcode, requires_otp, otp_channel
- SignerInputV2: name, email, annotations, phone_number, passcode, otp_channel
- SignerV2: id
- SigningConfirmation: data, status, error
- SigningConfirmationResent: data, status, error
- SigningResult: message, is_last_signer
- StatusOk: status
- TemplateDocumentRequest: filename, recipients, creator_fields, qr_code_audit_trail
- TemplateFields: hint, fields_info, request_body
- TemplateList: data, pagination
- TemplateRecipientInput: role, email, name, company, job_title, address, message, phone, is_whatsapp_notify_completed, passcode
- TemplateResource: id, type, attributes
- ValidationErrorResponse: data, status, error

Jumlah endpoint: 72

## Mekari Expense (halaman dokumentasi)
- activate custom field
- append custom field options
- approve claim
- business trip
- business trip manual transaction
- cancel business trip
- cancel claim
- cancel purchase invoice
- cancel purchase invoice payment by bill id
- category
- claim
- company account
- company management
- create business trip report item
- create business trip request
- create cash advance claim
- create custom field
- create purchase invoice
- create purchase invoice payment
- create reimbursement claim
- custom field
- deactivate custom field
- delete custom field
- edit custom field
- find all categories
- find all claims
- find all company employees
- find all company organizations
- find all custom categories
- find all custom fields
- find business trip policy applicable destinations
- find categories with balance for employee
- find company accounts
- find custom field
- find custom field options
- find detail claims
- find employee by id
- find products
- find purchase invoice by id
- find purchase invoices
- find term payments
- find vendors
- find warehouses
- get applicable business trip category rule
- get business trip by id
- get business trip categories
- get business trip data
- get company account ledger items
- get list of the currencies
- get list of the rate
- mark as paid bill payment
- mark claim as disbursed
- mark claim as settled
- media
- overwrite custom field options
- purchase
- reject claim
- remittance
- remove custom field options
- submit business trip report
- submit cash advance receipt
- term payment
- update business trip report item
- update claim by admin or approver
- update purchase invoice
- upload media base 64 web
- upload media web
- vendor
- warehouse
