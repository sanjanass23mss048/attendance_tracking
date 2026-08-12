# MSG91 parent SMS setup (India)

Presence sends attendance SMS through **MSG91 Flow (DLT)**.

When teachers send parent alerts from the web app, they can choose:

- **Channel:** WhatsApp, SMS, or WhatsApp + SMS
- **Recipient:** Father only, Mother only, or Both parents

SMS still uses the MSG91 / Twilio path below. WhatsApp uses Meta Cloud API (`WHATSAPP_*` env) and optional `WHATSAPP_ABSENCE_TEMPLATE`.

## 1. In MSG91 dashboard

1. Create / log in at https://msg91.com  
2. Get **Auth Key** (API → Authentication)  
3. Approve a **6-character Sender ID** (e.g. `BFPRES`)  
4. Create a **DLT template / Flow** matching:

```text
Name : ##var1##
Roll Number : ##var2##
Your ward is absent on ##var3##
Regards,
RIOBizSols
```

| Variable | Sent by Presence |
|---|---|
| var1 | Student name |
| var2 | Roll number |
| var3 | Date (e.g. 06 Aug 2026) |

Copy the **Template / Flow ID**.

## 2. Put this in `server/.env` (VPS + local)

```env
SMS_PROVIDER=msg91
SMS_DEFAULT_COUNTRY=91

SMS_MSG91_AUTH_KEY=your_auth_key_here
SMS_MSG91_SENDER_ID=BFPRES
SMS_MSG91_TEMPLATE_ID=your_template_id_here
```

## 3. Restart API

```bash
cd server
npm run dev
```

On VPS: restart the Node/Docker process after editing `.env`.

## 4. Test

1. Student must have **parent phone** (10-digit India number)  
2. Mark attendance → Submit → **Send to parents**  
3. Parent should receive the DLT SMS  

No APK rebuild needed.

## If SMS fails (API OK but phone gets nothing)

MSG91 often returns `type: success` even when the SMS never reaches the handset. Check in order:

1. **Wallet balance** (most common) — MSG91 panel → Billing, or:
   `https://control.msg91.com/api/balance.php?authkey=YOUR_KEY&type=4`  
   If this is `0`, recharge transactional SMS credits.
2. **Template ID in `.env`** must be the **MSG91 Flow / Template ID** from SMS → Templates (copy icon), **not** only the DLT number.  
   Inside that Flow, map your DLT Template ID + exact approved text + sender `RIOBIZ`.
3. Template status should be **Verified by DLT** (or approved). Use **Test DLT** on the template.
4. Open MSG91 → **Logs** for the request id and read the failure reason (e.g. “Template Inactive on DLT”, “Insufficient Balance”).
5. Phone must be valid (`9876543210` → sent as `919876543210`).
6. App/API `sms.delivery[].error` only shows failures MSG91 returns immediately — not later DLT drops.
