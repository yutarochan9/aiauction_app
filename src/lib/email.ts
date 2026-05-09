import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'AIAII <noreply@aiaii.art>'

export async function sendOutbidEmail(to: string, artworkTitle: string, newAmount: number, artworkId: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been outbid on "${artworkTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fafaf9;">
        <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:8px;">You've been outbid</h2>
        <p style="color:#555;font-size:15px;margin-bottom:24px;">
          Someone placed a higher bid of <strong>$${newAmount.toLocaleString()}</strong> on <strong>${artworkTitle}</strong>.
        </p>
        <a href="https://aiauction-app.vercel.app/auction/${artworkId}"
          style="display:inline-block;background:#2C2C2C;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Bid Again
        </a>
      </div>
    `,
  })
}

export async function sendNewBidEmail(to: string, artworkTitle: string, amount: number, bidderName: string, artworkId: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `New bid on "${artworkTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fafaf9;">
        <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:8px;">New bid on your artwork</h2>
        <p style="color:#555;font-size:15px;margin-bottom:24px;">
          <strong>${bidderName}</strong> placed a bid of <strong>$${amount.toLocaleString()}</strong> on <strong>${artworkTitle}</strong>.
        </p>
        <a href="https://aiauction-app.vercel.app/auction/${artworkId}"
          style="display:inline-block;background:#2C2C2C;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          View Auction
        </a>
      </div>
    `,
  })
}

export async function sendPaymentReceivedEmail(to: string, artworkTitle: string, amount: number, artworkId: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Payment received for "${artworkTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fafaf9;">
        <h2 style="color:#B8902A;font-size:20px;margin-bottom:8px;">Payment received</h2>
        <p style="color:#555;font-size:15px;margin-bottom:24px;">
          Your artwork <strong>${artworkTitle}</strong> has been sold for <strong>$${amount.toLocaleString()}</strong>.
          The payment has been processed successfully.
        </p>
        <a href="https://aiauction-app.vercel.app/auction/${artworkId}"
          style="display:inline-block;background:#2C2C2C;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          View Artwork
        </a>
      </div>
    `,
  })
}

export async function sendWonAuctionEmail(to: string, artworkTitle: string, amount: number, artworkId: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You won "${artworkTitle}"!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fafaf9;">
        <h2 style="color:#B8902A;font-size:20px;margin-bottom:8px;">Congratulations — You Won</h2>
        <p style="color:#555;font-size:15px;margin-bottom:24px;">
          You won <strong>${artworkTitle}</strong> with a bid of <strong>$${amount.toLocaleString()}</strong>.
          Please complete your payment within 72 hours.
        </p>
        <a href="https://aiauction-app.vercel.app/auction/${artworkId}"
          style="display:inline-block;background:#B8902A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Complete Purchase
        </a>
      </div>
    `,
  })
}
