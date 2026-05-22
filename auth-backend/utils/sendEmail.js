const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false // ← Add this line to fix SSL certificate issues
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text
    };

    // Add HTML if provided
    if (html) {
      mailOptions.html = html;
    }

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("Email error:", error.message);
    return false;
  }
};

module.exports = sendEmail;