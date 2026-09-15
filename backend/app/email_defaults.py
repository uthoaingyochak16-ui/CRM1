DEFAULT_REGISTRATION_EMAIL_SUBJECT = "Registration Successful — {{event_title}}"

DEFAULT_REGISTRATION_EMAIL_HTML = """
<!doctype html>
<html>
  <body style="margin:0;background:#f5f7fb;padding:28px 12px;font-family:Arial,'Noto Sans Bengali',sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                 style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.12)">
            <tr>
              <td align="center" style="padding:34px 30px 22px">
                <div style="width:58px;height:58px;line-height:58px;border-radius:50%;background:#ecfdf3;color:#15803d;font-size:30px;font-weight:bold">✓</div>
                <h1 style="margin:15px 0 7px;font-size:25px;line-height:1.25">Registration Successful</h1>
                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">আপনার আবেদনটি সফলভাবে গৃহীত হয়েছে।</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px"><div style="border-top:2px dashed #e2e8f0"></div></td>
            </tr>
            <tr>
              <td style="padding:24px 30px 32px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
                  {{registration_details}}
                </table>
                <div style="margin-top:20px;padding:16px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff">
                  <p style="margin:0 0 8px;color:#1e40af;font-size:12px;font-weight:bold;text-transform:uppercase">Event Information</p>
                  <p style="margin:0;color:#334155;font-size:14px;line-height:1.7"><b>{{event_title}}</b><br>{{event_date}}<br>{{event_place}}</p>
                </div>
                <p style="margin:24px 0 0;text-align:center;color:#94a3b8;font-size:12px">Quantum Foundation</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()
