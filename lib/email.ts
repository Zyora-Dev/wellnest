const ZEPTOMAIL_API_URL = "https://api.zeptomail.in/v1.1/email"
const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN!
const SENDER_EMAIL = "no-reply@wellnest.org.in"
const SENDER_NAME = "Wellnest Foundation"
const ADMIN_EMAIL = "wellnest@wellnest.org.in"

interface EmailPayload {
  from: { address: string; name: string }
  to: { email_address: { address: string; name?: string } }[]
  subject: string
  htmlbody?: string
  textbody?: string
}

export async function sendEmail({
  to,
  toName,
  subject,
  html,
  text,
}: {
  to: string
  toName?: string
  subject: string
  html?: string
  text?: string
}) {
  const payload: EmailPayload = {
    from: { address: SENDER_EMAIL, name: SENDER_NAME },
    to: [{ email_address: { address: to, name: toName } }],
    subject,
  }

  if (html) payload.htmlbody = html
  if (text) payload.textbody = text

  const res = await fetch(ZEPTOMAIL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: ZEPTOMAIL_TOKEN,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[ZeptoMail] Failed to send email:", err)
    throw new Error(`Email send failed: ${res.status}`)
  }

  return res.json()
}

export async function sendAdminNotification(submissionId: string, data: Record<string, unknown>) {
  const formatValue = (val: unknown) => {
    if (val === null || val === undefined) return "—"
    if (typeof val === "boolean") return val ? "Yes" : "No"
    if (typeof val === "string") return val.replace(/_/g, " ")
    return String(val)
  }

  const fields = [
    { label: "Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Mobile", key: "mobile" },
    { label: "Date of Birth", key: "dateOfBirth" },
    { label: "Overall Wellbeing", key: "overallWellbeing" },
    { label: "Stress Frequency", key: "stressFrequency" },
    { label: "Energy Levels", key: "energyLevels" },
    { label: "Anxiety Frequency", key: "anxietyFrequency" },
    { label: "Low Mood Frequency", key: "lowMoodFrequency" },
    { label: "Relaxation Difficulty", key: "relaxationDifficulty" },
    { label: "Sleep Quality", key: "sleepQuality" },
    { label: "Sleep Hours", key: "sleepHours" },
    { label: "Wake Rested", key: "wakeRested" },
    { label: "Concentration Issues", key: "concentrationIssues" },
    { label: "Productivity Level", key: "productivityLevel" },
    { label: "Comfort Sharing", key: "comfortSharing" },
    { label: "Support System", key: "supportSystem" },
    { label: "Loneliness Frequency", key: "lonelinessFrequency" },
    { label: "Coping Methods", key: "copingMethods" },
    { label: "Relaxation Activities", key: "relaxationActivities" },
    { label: "Feeling Overwhelmed", key: "feelingOverwhelmed" },
    { label: "Wants Support Resources", key: "wantsSupportResources" },
    { label: "Thoughts", key: "thoughts" },
    { label: "Additional Notes", key: "additionalNotes" },
  ]

  const rows = fields
    .map(
      ({ label, key }) =>
        `<tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #475569; width: 40%;">${label}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${formatValue(data[key])}</td>
        </tr>`
    )
    .join("")

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">
        💜 New Wellnest Submission
      </h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
        A new mental health check-in has been submitted.
      </p>
    </div>
    
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
        Submission ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${submissionId}</code>
      </p>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${rows}
      </table>
      
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          This is an automated notification from Wellnest Foundation.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

  await sendEmail({
    to: ADMIN_EMAIL,
    toName: "Wellnest Admin",
    subject: `New Wellnest Submission — ${submissionId.slice(0, 8)}`,
    html,
  })
}
