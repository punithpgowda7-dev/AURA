import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    // Set up the engine to send via Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Design the email the user will see
    const mailOptions = {
      from: `"AURA Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your AURA Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #0a0a0a; color: #ffffff; border-radius: 10px;">
          <h2 style="color: #a8c7fa; font-size: 24px;">AURA Authentication</h2>
          <p style="font-size: 16px; color: #cccccc;">Your secure verification code is:</p>
          <div style="margin: 30px 0; padding: 20px; background-color: #1e1f20; border-radius: 10px; display: inline-block;">
            <h1 style="font-size: 40px; letter-spacing: 8px; margin: 0; color: #a8c7fa;">${otp}</h1>
          </div>
          <p style="font-size: 14px; color: #888888;">This code will expire shortly. Do not share this code with anyone.</p>
        </div>
      `
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}