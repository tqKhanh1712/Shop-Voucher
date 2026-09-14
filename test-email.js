require('dotenv').config({ path: 'apps/api/.env' });
const nodemailer = require('nodemailer');

async function testEmail() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  console.log('Testing with GMAIL_USER:', user);

  if (!user || !pass) {
    console.error('Missing credentials');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Test Sender" <${user}>`,
      to: user, // send to oneself
      subject: "Test Email from Nodemailer",
      text: "This is a test email.",
    });
    console.log("Email sent successfully! Message ID:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

testEmail();
