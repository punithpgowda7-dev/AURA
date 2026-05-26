import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, action } = await request.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const isBan = action === 'ban';
    const subject = isBan ? "Security Alert: AURA Account Suspended" : "Security Alert: AURA Session Terminated";
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background-color: ${isBan ? '#ef4444' : '#f59e0b'}; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 2px;">AURA SECURITY</h1>
        </div>
        <div style="padding: 32px; background-color: #ffffff; color: #374151;">
          <h2 style="margin-top: 0; color: #111827;">Account Notification</h2>
          <p style="font-size: 16px; line-height: 1.5;">
            ${isBan 
              ? 'We are writing to inform you that your AURA account has been <strong>permanently banned</strong> by the system administrator due to a violation of our terms of service. All associated data has been securely erased.' 
              : 'We are writing to inform you that your active AURA session was <strong>remotely terminated</strong> by the system administrator.'}
          </p>
          <p style="font-size: 14px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            If you believe this was a mistake, please contact support.<br>
            <em>This is an automated message. Please do not reply.</em>
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"AURA Admin System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlBody,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}