const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, html) => {
  try {
    if (!to || !subject) {
      console.error("Email error: Missing recipient or subject.");
      return false;
    }

    // Explicitly configure Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false 
      }
    });

    const mailOptions = {
      from: `"Hexaverse Support" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    console.log(`[SMTP] Attempting to send email to ${to}...`);
    const info = await transporter.sendMail(mailOptions);
    
    console.log("[SMTP] Email sent successfully!");
    console.log("[SMTP] Response:", info.response);
    
    return true;
  } catch (error) {
    console.error("--- NODEMAILER ERROR ---");
    console.error("Message:", error.message);
    if (error.code) console.error("Code:", error.code);
    console.error("------------------------");
    return false;
  }
};

module.exports = sendEmail;